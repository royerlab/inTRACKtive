import logging
import tempfile
import time
import webbrowser
from collections import defaultdict, deque
from pathlib import Path
from typing import Iterable

import click
import numpy as np
import pandas as pd
import zarr
from intracktive.createHash import generate_viewer_state_hash
from intracktive.server import DEFAULT_HOST, find_available_port, serve_directory
from intracktive.vendored.ultrack import inv_tracks_df_forest
from scipy.sparse import csr_matrix, lil_matrix
from skimage.util._map_array import ArrayMap

REQUIRED_COLUMNS = ["track_id", "t", "z", "y", "x", "parent_track_id"]
INF_SPACE = -9999.9

LOG = logging.getLogger(__name__)
LOG.setLevel(logging.INFO)


def _transitive_closure(
    graph: lil_matrix,
    direction: str,
) -> csr_matrix:
    """
    Calculate the transitive closure of a graph

    Parameters
    ----------
    graph : lil_matrix
        The graph to calculate the transitive closure of
    direction : str
        The direction to calculate the transitive closure in, either 'forward' or 'backward'

    Returns
    -------
    csr_matrix
        The transitive closure of the graph in the specified direction as a CSR matrix
    """
    graph.setdiag(1)
    graph = graph.tocsr()

    start = time.monotonic()

    iter = 0
    while graph.nnz != (nxt := graph**2).nnz:
        graph = nxt
        iter += 1

    LOG.info(
        f"Chased track lineage {direction} in {time.monotonic() - start} seconds ({iter} iterations)"
    )
    return graph


def get_unique_zarr_path(zarr_path: Path) -> Path:
    """
    Ensure the Zarr path is unique by appending a counter to the name

    Parameters
    ----------
    zarr_path : Path
        The path to the Zarr store, including the name of the store (for example: /path/to/zarr_bundle.zarr)
    """
    zarr_path = Path(zarr_path)
    base_path = zarr_path.parent / zarr_path.stem
    extension = zarr_path.suffix

    counter = 1
    unique_path = zarr_path

    # Increment the counter until we find a path that doesn't exist
    while unique_path.exists():
        unique_path = base_path.with_name(f"{base_path.name}_{counter}").with_suffix(
            extension
        )
        counter += 1

    return unique_path


def smooth_column(df, column, window_size):
    """
    Smooth the displacement column using a mean filter within each track_id.
    Smoothing includes normalization of the displacements over time, to ensure that the displacements are not flickering too much between frames.

    Parameters:
    ----------
    df : pd.DataFrame
        Input DataFrame with a 'displacement' column and 'track_id'.
    column : str
        The column to smooth.
    window_size : int
        The size of the rolling window for the mean filter.

    Returns:
    -------
    pd.DataFrame
        DataFrame with an additional 'smoothed_displacement' column.
    """
    # Ensure the DataFrame is sorted by track_id and t
    df = df.sort_values(by=["track_id", "t"]).reset_index(drop=True)
    column_name = str(column) + "_smooth"

    # Apply rolling mean filter to the displacement column within each track_id
    df[column_name] = (
        df.groupby("track_id")[column]
        .rolling(window=window_size, min_periods=1, center=True)
        .mean()
        .reset_index(level=0, drop=True)  # Align back to original DataFrame
    )

    # df[column_name] = df[column_name].round(1)

    return df


def normalize_column(df, col, percentile=0.95) -> pd.DataFrame:
    """
    Normalize a column by:
    1) calculating the 1-percentile and 99-percentile for each time point,
    2) get the min/max of the 1-percentile and 99-percentile for each time point,
    3) normalize the column to the range [0, 1] for each time point
    """
    percentile_min_df = df.groupby("t")[col].quantile(1 - percentile).reset_index()
    percentile_max_df = df.groupby("t")[col].quantile(percentile).reset_index()
    min_percentile = percentile_min_df[col].min()
    max_percentile = percentile_max_df[col].max()
    df[col] = (df[col] - min_percentile) / (max_percentile - min_percentile)
    df[col] = df[col].clip(lower=0, upper=1.0)
    return df


def calculate_displacement(
    df: pd.DataFrame, velocity_smoothing_windowsize: int
) -> pd.DataFrame:
    """
    Calculate the displacement of the cells in the DataFrame

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame with a 'displacement' column and 'track_id'.
    velocity_smoothing_windowsize : int
        The size of the rolling window for the mean filter. If 1, no smoothing is applied.

    Returns
    -------
    pd.DataFrame
        DataFrame with an additional 'displacement' column.
        Displacement is calculated as the Euclidean distance between the current and previous position of the cell.
        Smoothing is applied to the displacement column using a rolling mean filter. If the windowsize is 1, no smoothing is applied.
        When smoothing is applied, values are normalized to [0,1]. Otherwise, values maintain the same precision as x coordinates.
    """
    LOG.info("calculating velocity")
    # Sort the DataFrame by track_id and time
    df = df.sort_values(by=["track_id", "t"]).reset_index(drop=True)

    # Get precision from x column (number of decimal places)
    x_precision = df["x"].astype(str).str.extract(r"\.(\d+)")[0].str.len().max()
    if pd.isna(x_precision):  # If x values are integers
        x_precision = 0

    # Calculate displacement
    df["displacement"] = np.sqrt(
        (df.groupby("track_id")["x"].shift(-1) - df["x"]) ** 2
        + (df.groupby("track_id")["y"].shift(-1) - df["y"]) ** 2
        + (df.groupby("track_id")["z"].shift(-1) - df["z"]) ** 2
    )

    # Set displacement to 0 for the last time point in each track
    last_timepoints = df.groupby("track_id")["t"].transform("max") == df["t"]
    df.loc[last_timepoints, "displacement"] = 0

    if velocity_smoothing_windowsize > 1:
        LOG.info("smoothing velocities")
        df = smooth_column(df, "displacement", velocity_smoothing_windowsize)
        # remove displacement column after smoothing
        df = df.drop("displacement", axis=1)
        df = df.rename(columns={"displacement_smooth": "displacement"})
        df = normalize_column(df, "displacement")
        LOG.info("smoothing applied")
    else:
        LOG.info("no smoothing applied")
        # Only apply precision rounding when no smoothing/normalization is done
        df["displacement"] = df["displacement"].round(x_precision)
        if x_precision == 0:
            df["displacement"] = df["displacement"].astype(int)

    return df


def validate_coordinates(df, threshold=-9000):
    """Check if any coordinates are too close to INF_SPACE."""
    for col in ["x", "y", "z"]:
        if (df[col] <= threshold).any():
            problematic = df[df[col] <= threshold]
            LOG.warning(
                f"WARNING: Found {len(problematic)} points with {col} coordinates below {threshold}"
            )
            LOG.warning(f"This might conflict with the fill value {INF_SPACE}")
            return True
    return False


def convert_dataframe_to_zarr(
    df: pd.DataFrame,
    zarr_path: Path,
    add_radius: bool = False,
    extra_cols: Iterable[str] = (),
    attribute_types: Iterable[str] = (),
    pre_normalized: bool = False,
    calc_velocity: bool = False,
    velocity_smoothing_windowsize: int = 1,
) -> Path:
    """
    Convert a DataFrame of tracks to a sparse Zarr store

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame containing the tracks must have the following columns:
        - track_id: int
        - t: int
        - z: float
        - y: float
        - x: float
        - parent_track_id: int
    zarr_path : Path
        Path to the zarr store, including name of Zarr store ('example: /path/to/zarr_bundle.zarr')
    extra_cols : Iterable[str], optional
        List of extra columns to include in the Zarr store, by default ()
    """
    start = time.monotonic()

    if "z" in df.columns:
        flag_2D = False
    else:
        flag_2D = True
        df["z"] = 0.0

    if "parent_track_id" not in df.columns:
        LOG.info("No parent_track_id column found, setting to -1 (no divisions)")
        df["parent_track_id"] = -1

    if calc_velocity and velocity_smoothing_windowsize < 1:
        raise ValueError("velocity_smoothing_windowsize must be >= 1")

    points_cols = (
        ["z", "y", "x", "radius"] if add_radius else ["z", "y", "x"]
    )  # columns to store in the points array
    extra_cols = list(extra_cols)
    columns_to_check = (
        REQUIRED_COLUMNS + ["radius"] if add_radius else REQUIRED_COLUMNS
    )  # columns to check for in the DataFrame
    columns_to_check = columns_to_check + extra_cols
    LOG.info("point_cols: %s", points_cols)
    LOG.info("columns_to_check: %s", columns_to_check)

    for col in columns_to_check:
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found in the DataFrame")

    for col in ("t", "track_id", "parent_track_id"):
        df[col] = df[col].astype(int)

    # Check if attribute_types is empty or has wrong length
    if not attribute_types or len(attribute_types) != len(extra_cols):
        LOG.info("attributes types are not provided or have wrong length")
        attribute_types = [get_col_type(df[c]) for c in extra_cols]
    LOG.info("column types: %s", attribute_types)

    # Check for problematic coordinates before conversion
    has_very_negative_coords = validate_coordinates(df)
    if has_very_negative_coords:
        raise ValueError(
            "Coordinates too negative (below -9000), please preprocess data to prevent this"
        )

    # calculate velocity
    if calc_velocity:
        df = calculate_displacement(df, velocity_smoothing_windowsize)
        extra_cols = extra_cols + ["displacement"] if calc_velocity else extra_cols

    start = time.monotonic()

    n_time_points = df["t"].max() + 1
    max_values_per_time_point = df.groupby("t").size().max()

    uniq_track_ids = df["track_id"].unique()
    extended_uniq_track_ids = np.append(
        uniq_track_ids, -1
    )  # include -1 for orphaned tracklets
    fwd_map = ArrayMap(
        extended_uniq_track_ids, np.append(np.arange(1, 1 + len(uniq_track_ids)), -1)
    )

    # relabeling from 0 to N-1
    df["track_id"] = fwd_map[df["track_id"].to_numpy()]
    # orphaned are set to 0 according to skimage convention
    df["parent_track_id"] = fwd_map[df["parent_track_id"].to_numpy()]

    n_tracklets = df["track_id"].nunique()
    # (z, y, x) + extra_cols
    num_values_per_point = 4 if add_radius else 3

    # store the points in an array
    points_array = (
        np.ones(
            (n_time_points, num_values_per_point * max_values_per_time_point),
            dtype=np.float32,
        )
        * INF_SPACE
    )
    attribute_array_empty = (
        np.ones(
            (n_time_points, max_values_per_time_point),
            dtype=np.float32,
        )
        * INF_SPACE
    )
    attribute_arrays = {}

    points_to_tracks = lil_matrix(
        (n_time_points * max_values_per_time_point, n_tracklets), dtype=np.int32
    )

    # inserting points to buffer
    for t, group in df.groupby("t"):
        group_size = len(group)
        points_array[t, : group_size * num_values_per_point] = (
            group[points_cols].to_numpy().ravel()
        )

        points_ids = t * max_values_per_time_point + np.arange(group_size)

        points_to_tracks[points_ids, group["track_id"] - 1] = 1

    for col in extra_cols:
        attribute_array = attribute_array_empty.copy()
        for t, group in df.groupby("t"):
            group_size = len(group)
            attribute_array[t, :group_size] = group[col].to_numpy().ravel()
        attribute_arrays[col] = attribute_array

    LOG.info(f"Munged {len(df)} points in {time.monotonic() - start} seconds")

    # creating mapping of tracklets parent-child relationship
    tracks_edges_all = df[
        ["track_id", "parent_track_id"]
    ].drop_duplicates()  # all unique edges
    tracks_edges = tracks_edges_all[
        tracks_edges_all["parent_track_id"] > 0
    ]  # only the tracks with a parent

    tracks_to_children = lil_matrix((n_tracklets, n_tracklets), dtype=np.int32)
    tracks_to_children[
        tracks_edges["track_id"] - 1, tracks_edges["parent_track_id"] - 1
    ] = 1
    tracks_to_children = _transitive_closure(tracks_to_children, "forward")

    tracks_to_parents = lil_matrix((n_tracklets, n_tracklets), dtype=np.int32)
    tracks_to_parents[
        tracks_edges["parent_track_id"] - 1, tracks_edges["track_id"] - 1
    ] = 1
    tracks_to_parents = _transitive_closure(tracks_to_parents, "backward")
    start = time.monotonic()

    tracks_to_tracks = (tracks_to_parents + tracks_to_children).tolil()
    tracks_edges_map = {
        int(k): int(v)
        for k, v in zip(
            tracks_edges_all["track_id"].to_numpy(),
            tracks_edges_all["parent_track_id"].to_numpy(),
        )
    }

    non_zero = tracks_to_tracks.nonzero()

    for i in range(len(non_zero[0])):
        tracks_to_tracks[non_zero[0][i], non_zero[1][i]] = tracks_edges_map[
            non_zero[1][i] + 1
        ]

    # Convert to CSR format for efficient row slicing
    tracks_to_points = points_to_tracks.T.tocsr()
    points_to_tracks = points_to_tracks.tocsr()
    tracks_to_tracks = tracks_to_tracks.tocsr()

    LOG.info(
        f"Parsed dataframe and converted to CSR data structures in {time.monotonic() - start} seconds"
    )
    start = time.monotonic()

    # Ensure the Zarr path is unique
    zarr_path = get_unique_zarr_path(zarr_path)

    LOG.info(f"Saving to Zarr at {zarr_path}")

    # save the points array
    top_level_group: zarr.Group = zarr.hierarchy.group(
        zarr.storage.DirectoryStore(zarr_path.as_posix()),
        overwrite=True,
    )

    points = top_level_group.create_dataset(
        "points",
        data=points_array,
        chunks=(1, points_array.shape[1]),
        dtype=np.float32,
    )
    points.attrs["values_per_point"] = num_values_per_point

    if len(extra_cols) > 0:
        attributes_matrix = np.hstack(
            [attribute_arrays[attr] for attr in attribute_arrays]
        )
        attributes = top_level_group.create_dataset(
            "attributes",
            data=attributes_matrix,
            chunks=(1, attribute_array.shape[1]),
            dtype=np.float32,
        )
        attributes.attrs["attribute_names"] = extra_cols
        attributes.attrs["attribute_types"] = attribute_types
        attributes.attrs["pre_normalized"] = pre_normalized

    mean = df[["z", "y", "x"]].mean()
    extent = (df[["z", "y", "x"]] - mean).abs().max()
    extent_xyz = extent.max()

    for col in ("z", "y", "x"):
        points.attrs[f"mean_{col}"] = mean[col]

    points.attrs["extent_xyz"] = extent_xyz
    points.attrs["fields"] = points_cols
    points.attrs["ndim"] = 2 if flag_2D else 3

    top_level_group.create_groups(
        "points_to_tracks", "tracks_to_points", "tracks_to_tracks"
    )

    # TODO: tracks_to_points may want to store xyz for the points, not just the indices
    # this would make the indices array 3x (4x?) larger, but would eliminate the need to
    # fetch coordinates again based on point IDs
    tracks_to_points_zarr = top_level_group["tracks_to_points"]
    tracks_to_points_zarr.attrs["sparse_format"] = "csr"
    tracks_to_points_zarr.create_dataset("indices", data=tracks_to_points.indices)
    tracks_to_points_zarr.create_dataset("indptr", data=tracks_to_points.indptr)
    tracks_to_points_xyz = np.zeros(
        (len(tracks_to_points.indices), 3), dtype=np.float32
    )
    for i, ind in enumerate(tracks_to_points.indices):
        t, n = divmod(ind, max_values_per_time_point)
        tracks_to_points_xyz[i] = points_array[
            t, num_values_per_point * n : num_values_per_point * (n + 1)
        ][:3]

    # TODO: figure out better chunking?
    tracks_to_points_zarr.create_dataset(
        "data",
        data=tracks_to_points_xyz,
        chunks=(2048, 3),
        dtype=np.float32,
    )

    points_to_tracks_zarr = top_level_group["points_to_tracks"]
    points_to_tracks_zarr.attrs["sparse_format"] = "csr"
    points_to_tracks_zarr.create_dataset("indices", data=points_to_tracks.indices)
    points_to_tracks_zarr.create_dataset("indptr", data=points_to_tracks.indptr)

    tracks_to_tracks_zarr = top_level_group["tracks_to_tracks"]
    tracks_to_tracks_zarr.attrs["sparse_format"] = "csr"
    tracks_to_tracks_zarr.create_dataset("indices", data=tracks_to_tracks.indices)
    tracks_to_tracks_zarr.create_dataset("indptr", data=tracks_to_tracks.indptr)
    tracks_to_tracks_zarr.create_dataset("data", data=tracks_to_tracks.data)

    LOG.info(f"Saved to Zarr in {time.monotonic() - start} seconds")

    return zarr_path


def zarr_to_browser(
    zarr_path: Path,
    csv_path: Path | None = None,
    flag_open_browser: bool = True,
    threaded: bool = True,
) -> None:
    """
    Open a Zarr store in inTRACKtive in the browser. This function will
    1) host the zarr path as localhost, 2) open the localhost in the browser with inTRACKtive.

    Parameters
    ----------
    zarr_path : Path
        The full path to the Zarr store (including the .zarr extension)
    csv_path : Path, optional
        The full path to the CSV file with cells to select. Normally this is the CSV file that is exported from inTRACKtive which the user wants to load again, by default None
    flag_open_browser : bool, optional
        Whether to automatically open the browser, by default True
    threaded : bool, optional
        Whether to run the server in a separate thread, by default True
    """
    zarr_dir = zarr_path.parent

    selected_cells = []
    maxPointsPerTimepoint = 0
    if csv_path:
        selected_cells, maxPointsPerTimepoint = get_selected_cells_and_max_points(
            csv_path, zarr_path
        )
        LOG.info(f"Selected cells: {selected_cells}")
        LOG.info(f"Max points per timepoint: {maxPointsPerTimepoint}")

    # Calculate URLs before starting server
    host = DEFAULT_HOST
    port = find_available_port(8000)
    hostURL = f"http://{host}:{port}"
    baseUrl = "https://intracktive.sf.czbiohub.org"  # inTRACKtive application
    dataUrl = (
        hostURL + "/" + zarr_path.name + "/"
    )  # exact path of the data (on localhost)
    fullUrl = baseUrl + generate_viewer_state_hash(
        data_url=str(dataUrl),
        selected_cells=selected_cells,
        maxPointsPerTimepoint=maxPointsPerTimepoint,
    )  # full hash that encodes viewerState

    LOG.info("Copy the following URL into the Google Chrome browser:")
    LOG.info("full URL: %s", fullUrl)

    # Open browser before starting server if not threaded
    if flag_open_browser and not threaded:
        webbrowser.open(fullUrl)

    # Start server
    serve_directory(
        path=zarr_dir,
        host=host,
        port=port,
        threaded=threaded,
    )

    # Open browser after starting server if threaded
    if flag_open_browser and threaded:
        webbrowser.open(fullUrl)

    if not flag_open_browser:
        return dataUrl, fullUrl


def dataframe_to_browser(
    df: pd.DataFrame,
    zarr_dir: Path,
    extra_cols: Iterable[str] = (),
    attribute_types: Iterable[str] = (),
    add_radius: bool = False,
    pre_normalized: bool = False,
    flag_open_browser: bool = True,
) -> None:
    """
    Open a Tracks DataFrame in inTRACKtive in the browser. In detail: this function
    1) converts the DataFrame to Zarr, 2) saves the zarr in speficied path (if provided, otherwise temporary path),
    3) host the outpat path as localhost, 4) open the localhost in the browser with inTRACKtive.

    Parameters
    ----------
    df : pd.DataFrame
        The DataFrame containing the tracks data. The required columns in the dataFrame are: ['track_id', 't', 'z', 'y', 'x', 'parent_track_id']
    zarr_dir : Path
        The directory to save the Zarr bundle, only the path to the folder is required (excluding the zarr_bundle.zarr filename)
    extra_cols : Iterable[str], optional
        List of extra columns to include in the Zarr store, by default empty list
    attribute_types : Iterable[str], optional
        List of attribute types for the extra columns, by default empty list
    add_radius: bool, optional
        Boolean indicating whether to include the column radius as cell size, by default False
    pre_normalized: bool, optional
        Whether the attributes are already normalized to [0,1], by default False
    flag_open_browser: bool, optional
        Whether to automatically open the browser, by default True
    """
    if str(zarr_dir) in (".", None):
        with tempfile.TemporaryDirectory() as temp_dir:
            zarr_dir = Path(temp_dir)
            LOG.info("Temporary directory used for localhost: %s", zarr_dir)
    else:
        LOG.info("Provided directory used for localhost: %s", zarr_dir)

    # check if extra_cols are in df
    for col in extra_cols:
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found in the DataFrame")

    # if attribute_types is not provided, get it from the extra_cols
    if not attribute_types:
        attribute_types = [get_col_type(df[col]) for col in extra_cols]

    zarr_path = get_unique_zarr_path(zarr_dir / "zarr_bundle.zarr")
    zarr_dir_with_storename = convert_dataframe_to_zarr(
        df=df,
        zarr_path=zarr_path,
        extra_cols=extra_cols,
        add_radius=add_radius,
        attribute_types=attribute_types,
        pre_normalized=pre_normalized,
    )

    # Use the new zarr_to_browser function
    zarr_to_browser(zarr_dir_with_storename, flag_open_browser=flag_open_browser)


def check_if_columns_exist(
    selected_columns: list[str], available_columns: pd.Index
) -> None:
    """
    Check if all selected columns exist in the available columns.

    Parameters
    ----------
    selected_columns : list[str]
        List of column names to check for
    available_columns : pd.Index
        Index of available column names in the DataFrame

    Raises
    ------
    ValueError
        If any selected column is not found in available columns
    """
    missing_columns = [col for col in selected_columns if col not in available_columns]
    if missing_columns:
        raise ValueError(
            f"Columns not found in the input file: {', '.join(missing_columns)}"
        )


def get_col_type(column: pd.Series) -> str:
    """
    Determine if a column is categorical or continuous based on number of unique values.

    Parameters
    ----------
    column : pd.Series
        The column to analyze

    Returns
    -------
    str
        'categorical' if column has 10 or fewer unique values, 'continuous' otherwise
    """
    # Get number of unique values, excluding INF_SPACE
    n_unique = len(np.unique(column[column != INF_SPACE]))

    if n_unique <= 10:
        return "categorical"
    else:
        return "continuous"


def get_selected_cells_and_max_points(
    csv_path: Path | None, zarr_path: Path
) -> tuple[list[int], int]:
    """
    Get selected cells from CSV and max points per timepoint from zarr store.

    Parameters
    ----------
    csv_path : Path | None
        Path to CSV file with track data, or None if no CSV provided
    zarr_path : Path
        Path to zarr store

    Returns
    -------
    tuple[list[int], int]
        Tuple of (selected_cells, maxPointsPerTimepoint)
    """
    selected_cells = []
    maxPointsPerTimepoint = 0

    if csv_path:
        # Check if file exists
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV file does not exist: {csv_path}")

        # Read the csv file
        df = pd.read_csv(csv_path)

        # Check if the csv file has the required columns
        if not all(col in df.columns for col in ["track_id", "parent_track_id"]):
            raise ValueError(
                "CSV file does not have the columns track_id and parent_track_id"
            )

        # Get selected cells from the csv file
        graph = inv_tracks_df_forest(df)
        selected_tracks = split_graph_and_find_selected_tracks(graph)
        LOG.info(f"Selected tracks: {selected_tracks}")
        selected_cells = [
            get_point_id_for_track_from_zarr(zarr_path, track_id)
            for track_id in selected_tracks
        ]
        LOG.info(f"Selected cells: {selected_cells}")

    # Get maxPointsPerTimepoint from the zarr store
    try:
        zarr_store = zarr.open_group(zarr_path)
        points_group = zarr_store["points"]
        attrs = points_group.attrs.asdict()
        values_per_point = attrs.get("values_per_point", 3)
        points_shape = points_group.shape
        maxPointsPerTimepoint = points_shape[1] // values_per_point
        LOG.info(
            f"Calculated max points per timepoint from zarr: {maxPointsPerTimepoint}"
        )
    except Exception as e:
        LOG.warning(f"Could not read from zarr, using fallback: {e}")
        if csv_path:
            # Use CSV data as fallback
            df = pd.read_csv(csv_path)
            maxPointsPerTimepoint = df.groupby("t").size().max()
            LOG.info(
                f"Using CSV fallback max points per timepoint: {maxPointsPerTimepoint}"
            )
        else:
            # Use default fallback
            maxPointsPerTimepoint = 1000
            LOG.info(f"Using default max points per timepoint: {maxPointsPerTimepoint}")

    return selected_cells, maxPointsPerTimepoint


def get_point_id_for_track_from_zarr(zarr_store_path, track_id):
    """
    Get the point ID for a specific track from the zarr store.

    Parameters
    ----------
    zarr_store_path : str
        Path to the zarr store
    track_id : int
        The track ID (0-indexed)

    Returns
    -------
    int
        The point ID for the last point in the track
    """

    zarr_store = zarr.open_group(zarr_store_path)
    tracks_to_points_group = zarr_store["tracks_to_points"]

    indices = tracks_to_points_group["indices"][:]
    indptr = tracks_to_points_group["indptr"][:]

    n_tracks = len(indptr) - 1
    # The indices array contains point IDs, not the total number of points
    # We need to find the maximum point ID to determine the matrix size
    max_point_id = np.max(indices) if len(indices) > 0 else 0
    n_points = max_point_id + 1  # Point IDs are 0-indexed

    # Create a CSR matrix where the data is just 1s (indicating presence of points)
    # The actual coordinates are stored separately in the data array
    csr_matrix_data = np.ones(len(indices), dtype=np.int32)

    tracks_to_points_csr = csr_matrix(
        (csr_matrix_data, indices, indptr), shape=(n_tracks, n_points)
    )

    # Get the row for this track
    track_row = tracks_to_points_csr[track_id]

    # Get the column indices (point IDs) where this track has non-zero values
    point_indices = track_row.indices

    # Return the last point ID for this track (point IDs are 0-indexed)
    return int(point_indices[-1] - 1)


def split_graph_and_find_selected_tracks(graph):
    """
    Given graph: dict[daughter]=parent,
    returns the inferred set of originally selected cells.
    """
    # 1) find undirected components
    nodes = set(graph) | set(graph.values())
    adj = defaultdict(set)
    for d, p in graph.items():
        adj[d].add(p)
        adj[p].add(d)

    seen = set()
    all_selected = []

    def get_component(start):
        comp = {start}
        q = deque([start])
        seen.add(start)
        while q:
            u = q.popleft()
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    comp.add(v)
                    q.append(v)
        return comp

    for n in nodes:
        if n in seen:
            continue
        comp = get_component(n)

        # build children/parent maps restricted to comp
        children = defaultdict(list)
        parent = {}
        for d, p in graph.items():
            if d in comp and p in comp:
                children[p].append(d)
                parent[d] = p

        # compute closure of x = {x} ∪ all its ancestors ∪ all its descendants
        def closure(x):
            anc = set()
            cur = x
            while cur in parent:
                cur = parent[cur]
                anc.add(cur)
            desc = set()
            q = deque([x])
            while q:
                u = q.popleft()
                for c in children[u]:
                    if c not in desc:
                        desc.add(c)
                        q.append(c)
            return anc | desc | {x}

        # compute depth of x (distance from root)
        def depth(x):
            d = 0
            cur = x
            while cur in parent:
                cur = parent[cur]
                d += 1
            return d

        # helper to count how many of u's direct children are non-leaf
        def non_leaf_kids(u):
            return sum(1 for c in children[u] if children[c])

        # check for perfect-binary property of subtree rooted at u
        def is_perfect(u):
            stk = [u]
            while stk:
                v = stk.pop()
                c = children[v]
                if len(c) not in (0, 2):
                    return False
                stk.extend(c)
            return True

        # 1) find all full-coverers: nodes whose closure == comp
        full = [u for u in comp if closure(u) == comp]

        # 2) filter to those that genuinely “explain” the tree:
        #    - no children (pure chain leaf)
        #    - OR branching but ≤1 non-leaf child
        #    - OR perfect binary subtree
        candidates = []
        for u in full:
            k = len(children[u])
            nl = non_leaf_kids(u)
            if k == 0 or (k >= 2 and nl <= 1) or is_perfect(u):
                candidates.append(u)

        if candidates:
            # pick the deepest candidate
            pick = max(candidates, key=depth)
            all_selected.append(pick)
            continue

        # 3) otherwise, greedy leaf-cover
        uncovered = set(comp)
        sel = []
        while uncovered:
            leaves = [
                u for u in uncovered if all(c not in uncovered for c in children[u])
            ]
            x = leaves[0]
            sel.append(x)
            uncovered -= closure(x)
        all_selected.extend(sel)

    return all_selected


@click.command(name="convert")
@click.argument(
    "input_file",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--out_dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=None,
    help="Path to the output directory (optional, defaults to the parent dir of the input file)",
)
@click.option(
    "--add_radius",
    is_flag=True,
    help="Boolean indicating whether to include the column radius as cell size",
    default=False,
    type=bool,
)
@click.option(
    "--add_all_attributes",
    is_flag=True,
    help="Boolean indicating whether to include extra columns as attributes for colors the cells in the viewer",
    default=False,
    type=bool,
)
@click.option(
    "--add_attribute",
    type=str,
    default=None,
    help="Comma-separated list of column names to include as attributes (e.g., 'cell_size,diameter,type,label')",
)
@click.option(
    "--add_hex_attribute",
    type=str,
    default=None,
    help="Comma-separated list of column names to include as HEX attributes (e.i., columns with hexInt values, only internal use')",
)
@click.option(
    "--pre_normalized",
    is_flag=True,
    help="Boolean indicating whether the extra column/columns with attributes are prenormalized to [0,1]",
    default=False,
    type=bool,
)
@click.option(
    "--calc_velocity",
    is_flag=True,
    help="Boolean indicating whether to calculate velocity of the cells (smoothing is recommended, please provide a --velocity_smoothing_windowsize)",
    default=False,
    type=bool,
)
@click.option(
    "--velocity_smoothing_windowsize",
    type=int,
    default=1,
    help="Smoothing factor for velocity calculation, using a moving average over n frames around each frame",
)
def convert_cli(
    input_file: Path,
    out_dir: Path | None,
    add_radius: bool,
    add_all_attributes: bool,
    add_attribute: str | None,
    add_hex_attribute: str | None,
    pre_normalized: bool,
    calc_velocity: bool,
    velocity_smoothing_windowsize: int,
) -> None:
    """
    Convert a CSV or Parquet file of tracks to a sparse Zarr store.

    Arguments:
        INPUT_FILE: Path to the input file (CSV or Parquet)
    """
    start = time.monotonic()

    if out_dir is None:
        out_dir = input_file.parent
    else:
        out_dir = Path(out_dir)

    zarr_path = out_dir / f"{input_file.stem}_bundle.zarr"

    # Read input file based on extension
    file_extension = input_file.suffix.lower()
    if file_extension == ".csv":
        tracks_df = pd.read_csv(input_file)
    elif file_extension == ".parquet":
        tracks_df = pd.read_parquet(input_file)
    else:
        raise ValueError(
            f"Unsupported file format: {file_extension}. Only .csv and .parquet files are supported."
        )

    LOG.info(f"Read {len(tracks_df)} points in {time.monotonic() - start} seconds")

    extra_cols = []
    col_types = []
    if add_all_attributes:
        columns_standard = REQUIRED_COLUMNS
        extra_cols = tracks_df.columns.difference(columns_standard).to_list()
    else:
        if add_attribute:
            selected_columns = [col.strip() for col in add_attribute.split(",")]
            check_if_columns_exist(selected_columns, tracks_df.columns)
            extra_cols = selected_columns
            for c in selected_columns:
                col_types.append(get_col_type(tracks_df[c]))
            LOG.info(f"Columns included as attributes: {', '.join(selected_columns)}")
        if add_hex_attribute:
            selected_columns = [col.strip() for col in add_hex_attribute.split(",")]
            check_if_columns_exist(selected_columns, tracks_df.columns)
            extra_cols = extra_cols + selected_columns
            for c in selected_columns:
                col_types.append("hex")
            LOG.info(
                f"Columns included as hex attributes: {', '.join(selected_columns)}"
            )
    LOG.info(f"Column types: {col_types}")

    convert_dataframe_to_zarr(
        tracks_df,
        zarr_path,
        add_radius,
        extra_cols=extra_cols,
        attribute_types=col_types,
        pre_normalized=pre_normalized,
        calc_velocity=calc_velocity,
        velocity_smoothing_windowsize=velocity_smoothing_windowsize,
    )

    LOG.info(f"Full conversion took {time.monotonic() - start} seconds")


if __name__ == "__main__":
    convert_cli()


# # This is what an example resulting Zarr store looks like:
# # ❯ du -sh tracks_bundle.zarr
# # 520M	tracks_bundle.zarr
# # tracks_bundle.zarr
# # ├── points (198M)
# # ├── points_to_tracks (62M)
# # │   ├── indices (61M)
# # │   └── indptr (1M)
# # ├── tracks_to_points (259M)
# # │   ├── data (207M)
# # │   ├── indices (50M)
# # │   └── indptr (1.9M)
# # └── tracks_to_tracks (37M)
# #     ├── data (22M)
# #     ├── indices (13M)
# #     └── indptr (1.8M)

# # note the relatively small size of the indptr arrays
# # tracks_to_points/data is a redundant copy of the points array to avoid having
# # to fetch point coordinates individually
