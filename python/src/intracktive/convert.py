import logging
import tempfile
import time
import webbrowser
from pathlib import Path
from typing import Iterable

import click
import numpy as np
import pandas as pd
import zarr
from intracktive.__about__ import __version__
from intracktive.createHash import generate_viewer_state_hash
from intracktive.geff import is_geff_dataset, read_geff_to_df
from intracktive.server import DEFAULT_HOST, find_available_port, serve_directory
from scipy.sparse import csr_matrix, lil_matrix
from skimage.util._map_array import ArrayMap

REQUIRED_COLUMNS = ["track_id", "t", "z", "y", "x", "parent_track_id"]
INF_SPACE = -9999.9

LOG = logging.getLogger(__name__)
LOG.setLevel(logging.INFO)

# Note: Zarr 3.x introduced a new storage format that changes the directory structure:
# - Zarr 2.x: .zarray, .zattrs, and numerical chunk files (0.0, 1.0, etc.)
# - Zarr 3.x: zarr.json, and c/ directory with numbered subdirectories (0, 1, 2, etc.)
# We explicitly use zarr_format=2 to maintain backward compatibility with existing JavaScript applications.


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
    df.loc[:, column_name] = (
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
    df.loc[:, col] = (df[col] - min_percentile) / (max_percentile - min_percentile)
    df.loc[:, col] = df[col].clip(lower=0, upper=1.0)
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
    df.loc[:, "displacement"] = np.sqrt(
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
        df.loc[:, "displacement"] = df["displacement"].round(x_precision)
        if x_precision == 0:
            df.loc[:, "displacement"] = df["displacement"].astype(int)

    return df


def validate_coordinates(df, threshold=-9000):
    """Check if any coordinates are too close to INF_SPACE."""
    for col in ["x", "y", "z"]:
        if (df[col] <= threshold).any():
            problematic = df[df[col] <= threshold]
            LOG.warning(
                f"Found {len(problematic)} points with {col} coordinates below {threshold}"
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
        # Check if all z values are very close to zero (effectively 2D data)
        z_values = df["z"].values
        if np.allclose(z_values, 0.0, atol=1e-10):
            flag_2D = True
            LOG.info("Z column present but all values are zero, treating as 2D data")
        else:
            flag_2D = False
    else:
        flag_2D = True
        df.loc[:, "z"] = 0.0

    if "parent_track_id" not in df.columns:
        LOG.info("No parent_track_id column found, setting to -1 (no divisions)")
        df.loc[:, "parent_track_id"] = -1

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
        df.loc[:, col] = df[col].astype(int)

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

    # Check if attribute_types is empty or has wrong length
    if not attribute_types or len(attribute_types) != len(extra_cols):
        LOG.info("attributes types are not provided or have wrong length")
        attribute_types = [get_col_type(df[c]) for c in extra_cols]
    LOG.info("column types: %s", attribute_types)

    start = time.monotonic()

    n_time_points = int(df["t"].max() + 1)
    max_values_per_time_point = int(df.groupby("t").size().max())

    uniq_track_ids = df["track_id"].unique()
    extended_uniq_track_ids = np.append(
        uniq_track_ids, -1
    )  # include -1 for orphaned tracklets
    fwd_map = ArrayMap(
        extended_uniq_track_ids, np.append(np.arange(1, 1 + len(uniq_track_ids)), -1)
    )

    # relabeling from 0 to N-1
    df.loc[:, "track_id"] = fwd_map[df["track_id"].to_numpy()]
    # orphaned are set to 0 according to skimage convention
    df.loc[:, "parent_track_id"] = fwd_map[df["parent_track_id"].to_numpy()]

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

    # Create a mapping from time values to consecutive integer indices
    unique_times = sorted(df["t"].unique())
    time_to_index = {time_val: idx for idx, time_val in enumerate(unique_times)}

    # inserting points to buffer
    for t, group in df.groupby("t"):
        group_size = int(len(group))
        t_idx = time_to_index[t]
        points_array[t_idx, : group_size * num_values_per_point] = (
            group[points_cols].to_numpy().ravel()
        )

        points_ids = t_idx * max_values_per_time_point + np.arange(group_size)

        points_to_tracks[points_ids, group["track_id"] - 1] = 1

    for col in extra_cols:
        attribute_array = attribute_array_empty.copy()
        for t, group in df.groupby("t"):
            group_size = int(len(group))
            t_idx = time_to_index[t]
            attribute_array[t_idx, :group_size] = group[col].to_numpy().ravel()

        # Normalize the attribute if not pre-normalized and not a hex attribute
        col_idx = list(extra_cols).index(col)
        col_type = attribute_types[col_idx]

        # Only normalize continuous and discrete types, not hex
        if col_type in ["continuous", "categorical"]:
            # Handle infinite and NaN values BEFORE normalization
            neg_inf_mask = np.isneginf(attribute_array)
            pos_inf_mask = np.isposinf(attribute_array)
            nan_mask = np.isnan(attribute_array)
            has_inf_or_nan = (
                np.any(neg_inf_mask) or np.any(pos_inf_mask) or np.any(nan_mask)
            )

            if has_inf_or_nan:
                # Set problematic values to safe values before normalization
                attribute_array[neg_inf_mask] = 0.0
                attribute_array[pos_inf_mask] = 1.0
                attribute_array[nan_mask] = 0.0

                LOG.info(
                    f"Attribute '{col}' had infinite or NaN values: -inf→0, +inf→1, NaN→0.0"
                )

            # Now normalize all values (excluding INF_SPACE values)
            # Get only the actual data values (not the padding INF_SPACE values)
            actual_data_mask = attribute_array != INF_SPACE
            if np.any(actual_data_mask):
                actual_data = attribute_array[actual_data_mask]
                attr_min = actual_data.min()
                attr_max = actual_data.max()

                # Check for constant data
                if attr_max == attr_min:
                    # For constant data, set all actual data values to 0.5 (middle of range)
                    attribute_array[actual_data_mask] = 0.5
                else:
                    # Normalize only the actual data values
                    attribute_array[actual_data_mask] = (actual_data - attr_min) / (
                        attr_max - attr_min
                    )
            else:
                # No actual data, set everything to 0.5
                attribute_array = np.full_like(attribute_array, 0.5)

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
    top_level_group: zarr.Group = zarr.group(
        zarr_path.as_posix(),  # Direct path, no DirectoryStore wrapper
        overwrite=True,
        zarr_format=2,  # Use Zarr format 2 to maintain backward compatibility
    )

    # Add inTRACKtive version to the top-level group attributes
    top_level_group.attrs["intracktive_version"] = __version__

    points = top_level_group.create_array(
        "points",
        data=points_array,
        chunks=(1, points_array.shape[1]),
    )
    points.attrs["values_per_point"] = num_values_per_point

    if len(extra_cols) > 0:
        attributes_matrix = np.hstack(
            [attribute_arrays[attr] for attr in attribute_arrays]
        )
        attributes = top_level_group.create_array(
            "attributes",
            data=attributes_matrix,
            chunks=(1, attribute_array.shape[1]),
        )
        attributes.attrs["attribute_names"] = extra_cols
        attributes.attrs["attribute_types"] = attribute_types
        attributes.attrs[
            "pre_normalized"
        ] = True  # Always True since normalization is handled here

    mean = df[["z", "y", "x"]].mean()
    extent = (df[["z", "y", "x"]] - mean).abs().max()
    extent_xyz = extent.max()

    for col in ("z", "y", "x"):
        points.attrs[f"mean_{col}"] = mean[col]

    points.attrs["extent_xyz"] = extent_xyz
    points.attrs["fields"] = points_cols
    points.attrs["ndim"] = 2 if flag_2D else 3

    top_level_group.create_group("points_to_tracks")
    top_level_group.create_group("tracks_to_points")
    top_level_group.create_group("tracks_to_tracks")

    # TODO: tracks_to_points may want to store xyz for the points, not just the indices
    # this would make the indices array 3x (4x?) larger, but would eliminate the need to
    # fetch coordinates again based on point IDs
    tracks_to_points_zarr = top_level_group["tracks_to_points"]
    tracks_to_points_zarr.attrs["sparse_format"] = "csr"
    tracks_to_points_zarr.create_array("indices", data=tracks_to_points.indices)
    tracks_to_points_zarr.create_array("indptr", data=tracks_to_points.indptr)
    tracks_to_points_xyz = np.zeros(
        (len(tracks_to_points.indices), 3), dtype=np.float32
    )
    for i, ind in enumerate(tracks_to_points.indices):
        t, n = divmod(ind, max_values_per_time_point)
        tracks_to_points_xyz[i] = points_array[
            t, num_values_per_point * n : num_values_per_point * (n + 1)
        ][:3]

    # TODO: figure out better chunking?
    tracks_to_points_zarr.create_array(
        "data",
        data=tracks_to_points_xyz,
        chunks=(2048, 3),
    )

    points_to_tracks_zarr = top_level_group["points_to_tracks"]
    points_to_tracks_zarr.attrs["sparse_format"] = "csr"
    points_to_tracks_zarr.create_array("indices", data=points_to_tracks.indices)
    points_to_tracks_zarr.create_array("indptr", data=points_to_tracks.indptr)

    tracks_to_tracks_zarr = top_level_group["tracks_to_tracks"]
    tracks_to_tracks_zarr.attrs["sparse_format"] = "csr"
    tracks_to_tracks_zarr.create_array("indices", data=tracks_to_tracks.indices)
    tracks_to_tracks_zarr.create_array("indptr", data=tracks_to_tracks.indptr)
    tracks_to_tracks_zarr.create_array("data", data=tracks_to_tracks.data)

    LOG.info(f"Saved to Zarr in {time.monotonic() - start} seconds")

    return zarr_path


def zarr_to_browser(
    zarr_path: Path,
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
    flag_open_browser : bool, optional
        Whether to automatically open the browser, by default True
    threaded : bool, optional
        Whether to run the server in a separate thread, by default True
    """
    zarr_dir = zarr_path.parent

    # Calculate URLs before starting server
    host = DEFAULT_HOST
    port = find_available_port(8000)
    hostURL = f"http://{host}:{port}"
    baseUrl = "https://intracktive.sf.czbiohub.org"  # inTRACKtive application
    dataUrl = (
        hostURL + "/" + zarr_path.name + "/"
    )  # exact path of the data (on localhost)
    fullUrl = baseUrl + generate_viewer_state_hash(
        data_url=str(dataUrl)
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
    )

    # Use the new zarr_to_browser function
    zarr_to_browser(zarr_dir_with_storename, flag_open_browser)


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


def convert_file(
    input_file: Path,
    out_dir: Path | None = None,
    add_radius: bool = False,
    add_all_attributes: bool = False,
    add_attribute: str | None = None,
    add_hex_attribute: str | None = None,
    calc_velocity: bool = False,
    velocity_smoothing_windowsize: int = 1,
) -> Path:
    """
    Convert a CSV/Parquet/GEFF file of tracks to a sparse Zarr store.

    This is the core function that can be called both programmatically and via CLI.

    Parameters
    ----------
    input_file : Path
        Path to the input file (CSV, Parquet, or GEFF)
    out_dir : Path | None, optional
        Path to the output directory (optional, defaults to the parent dir of the input file)
    add_radius : bool, optional
        Boolean indicating whether to include the column radius as cell size, by default False
    add_all_attributes : bool, optional
        Boolean indicating whether to include all extra columns as attributes, by default False
    add_attribute : str | None, optional
        Comma-separated list of column names to include as attributes, by default None
    add_hex_attribute : str | None, optional
        Comma-separated list of column names to include as HEX attributes, by default None
    calc_velocity : bool, optional
        Boolean indicating whether to calculate velocity of the cells, by default False
    velocity_smoothing_windowsize : int, optional
        Smoothing factor for velocity calculation, by default 1

    Returns
    -------
    Path
        Path to the created Zarr store

    Raises
    ------
    ValueError
        If the file format is unsupported or required columns are missing
    """
    start = time.monotonic()

    if out_dir is None:
        out_dir = input_file.parent
    else:
        out_dir = Path(out_dir)

    if not isinstance(input_file, Path):
        input_file = Path(input_file)

    zarr_path = out_dir / f"{input_file.stem}_bundle.zarr"

    # Read input file based on extension
    file_extension = input_file.suffix.lower()
    if file_extension == ".csv":
        tracks_df = pd.read_csv(input_file)
    elif file_extension == ".parquet":
        tracks_df = pd.read_parquet(input_file)
    elif file_extension == ".geff" or is_geff_dataset(input_file):
        # Handle both .geff files and Zarr stores that are GEFF datasets
        # Validate that it's actually a GEFF dataset
        if not is_geff_dataset(input_file):
            raise ValueError(
                f"File {input_file} has .geff extension but is not a valid GEFF dataset"
            )

        # Only include all attributes if user has specified they want attributes
        include_all_attributes = (
            add_all_attributes or add_attribute or add_hex_attribute
        )
        # GEFF properties are not pre-normalized, they will be normalized in convert_dataframe_to_zarr
        tracks_df = read_geff_to_df(
            input_file, include_all_attributes=include_all_attributes
        )
    else:
        raise ValueError(
            f"Unsupported file format: {file_extension}. Only .csv, .parquet and GEFF files are supported."
        )

    LOG.info(
        f"Read and converted {len(tracks_df)} points in {time.monotonic() - start} seconds"
    )

    extra_cols = []
    col_types = []

    # Process attributes the same way for all file types
    if add_all_attributes:
        columns_standard = REQUIRED_COLUMNS
        extra_cols = tracks_df.columns.difference(columns_standard).to_list()
        for c in extra_cols:
            col_types.append(get_col_type(tracks_df[c]))
        LOG.info(f"All attributes included: {', '.join(extra_cols)}")
    if add_attribute:
        selected_columns = [col.strip() for col in add_attribute.split(",")]
        check_if_columns_exist(selected_columns, tracks_df.columns)
        extra_cols = extra_cols + selected_columns
        for c in selected_columns:
            col_types.append(get_col_type(tracks_df[c]))
        LOG.info(f"Columns included as attributes: {', '.join(selected_columns)}")
    if add_hex_attribute:
        selected_columns = [col.strip() for col in add_hex_attribute.split(",")]
        check_if_columns_exist(selected_columns, tracks_df.columns)
        extra_cols = extra_cols + selected_columns
        for c in selected_columns:
            col_types.append("hex")
        LOG.info(f"Columns included as hex attributes: {', '.join(selected_columns)}")
    LOG.info(f"Column types: {col_types}")

    # TODO: do the calc_velocity BEFORE the zarr conversion, because now we check the existance of attributes in the dataframe, before the conversion script
    zarr_path = convert_dataframe_to_zarr(
        tracks_df,
        zarr_path,
        add_radius,
        extra_cols=extra_cols,
        attribute_types=col_types,
        calc_velocity=calc_velocity,
        velocity_smoothing_windowsize=velocity_smoothing_windowsize,
    )

    LOG.info(f"Full conversion took {time.monotonic() - start} seconds")

    return zarr_path


@click.command(name="convert")
@click.argument(
    "input_file",
    type=click.Path(exists=True, dir_okay=True, path_type=Path),
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
    help="Boolean indicating whether to include all extra columns as attributes for colors the cells in the viewer",
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
    calc_velocity: bool,
    velocity_smoothing_windowsize: int,
) -> None:
    """
    Convert a CSV/Parquet/GEFF file of tracks to a sparse Zarr store.

    Arguments:
        INPUT_FILE: Path to the input file (CSV, Parquet, or GEFF)
    """
    convert_file(
        input_file=input_file,
        out_dir=out_dir,
        add_radius=add_radius,
        add_all_attributes=add_all_attributes,
        add_attribute=add_attribute,
        add_hex_attribute=add_hex_attribute,
        calc_velocity=calc_velocity,
        velocity_smoothing_windowsize=velocity_smoothing_windowsize,
    )


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
