import logging
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from geff.convert import from_trackmate_xml_to_geff
from geff.convert._dataframe import geff_to_dataframes
from geff.core_io._utils import remove_tilde
from geff.validate.structure import validate_structure
from geff_spec import GeffMetadata
from intracktive.vendored.ultrack import add_track_ids_to_tracks_df
from zarr.storage import StoreLike

LOG = logging.getLogger(__name__)
LOG.setLevel(logging.INFO)


def is_geff_dataset(zarr_store: StoreLike) -> bool:
    """
    Check if a zarr store (store | Path | str) is a geff dataset by checking if metadata can be loaded.

    Parameters
    ----------
    zarr_store : StoreLike
        Zarr store

    Returns
    -------
    bool
        True if it's a geff dataset (can load GeffMetadata), False otherwise
    """

    try:
        zarr_store = remove_tilde(zarr_store)

        # use the geff validation function
        validate_structure(zarr_store)

        # Read geff metadata from the zarr store
        metadata = GeffMetadata.read(zarr_store)  # type: ignore[arg-type]

        # Check if the metadata has a geff_version
        if hasattr(metadata, "geff_version") and metadata.geff_version is not None:
            return True
        else:
            return False  # probably not necessary, validate_structure should catch this
    except Exception as e:
        LOG.error(f"Error checking geff dataset: {e}")
        return False


def remove_non_consecutive_edges(
    node_ids: np.ndarray,
    node_times: np.ndarray,
    edge_df: pd.DataFrame,
) -> tuple[bool, pd.DataFrame]:
    """
    Check if all edges connect nodes that are consecutive in time.

    Parameters
    ----------
    node_ids : np.ndarray
        Array of node IDs (shape: (N,))
    node_times : np.ndarray
        Array of corresponding node times (shape: (N,))
    edge_df : pd.DataFrame
        DataFrame of edges with 'source' and 'target' columns

    Returns
    -------
    tuple[bool, pd.DataFrame]
        (is_consecutive, consecutive_edges) where:
        - is_consecutive: True if all edges connect nodes with consecutive times, False otherwise
        - consecutive_edges: DataFrame of consecutive edges (all edges if is_consecutive=True, filtered edges if False)
    """
    # Create a mapping from node_id to its time
    id_to_time = {node_id: time for node_id, time in zip(node_ids, node_times)}

    consecutive_mask = []
    all_consecutive = True

    # Check each edge in the DataFrame
    for _, edge in edge_df.iterrows():
        parent_id = edge["source"]
        daughter_id = edge["target"]

        # Skip edges where parent or daughter is not in our node set
        if parent_id not in id_to_time or daughter_id not in id_to_time:
            consecutive_mask.append(False)
            all_consecutive = False
            continue

        parent_time = id_to_time[parent_id]
        daughter_time = id_to_time[daughter_id]

        # Check if times are consecutive (daughter time = parent time + 1)
        # the +1 check is fine, because we check whether the graph is directed before
        if daughter_time == parent_time + 1:
            consecutive_mask.append(True)
        else:
            consecutive_mask.append(False)
            all_consecutive = False

    consecutive_edges_df = edge_df[consecutive_mask]

    if len(edge_df) - len(consecutive_edges_df) > 0:
        LOG.warning(
            f"{len(edge_df) - len(consecutive_edges_df)} edges of {len(edge_df)} are not consecutive in time"
        )

    return all_consecutive, consecutive_edges_df


def remove_merging_edges(edge_df: pd.DataFrame) -> tuple[bool, pd.DataFrame]:
    """
    Remove edges where a daughter cell appears multiple times, since cells cannot merge.

    Parameters
    ----------
    edge_df : pd.DataFrame
        DataFrame of edges with 'source' and 'target' columns

    Returns
    -------
    tuple[bool, pd.DataFrame]
        (no_merging, non_merging_edges) where:
        - no_merging: True if no merging edges were found, False otherwise
        - non_merging_edges: DataFrame of edges without merging (all edges if no_merging=True, filtered edges if False)
    """
    # Keep only the first occurrence of each target (drop_duplicates keeps first by default)
    df_no_merging = edge_df.drop_duplicates(subset=["target"], keep="first")

    # Check if any duplicates were removed
    removed_count = len(edge_df) - len(df_no_merging)
    no_merging = removed_count == 0

    if removed_count > 0:
        LOG.warning(
            f"warning: {removed_count} merging edges removed (daughter cells appeared multiple times)"
        )

    return no_merging, df_no_merging


def _map_spatial_axes(
    axis_names: list[str], display_hints: object | None = None
) -> dict[str, str]:
    """
    Map the names of the GEFF spatial axes to the inTRACKtive column names (x, y, z).

    Strategies are tried in order, the first one giving a complete one-to-one mapping wins:
    1. axis names are already x/y/z (case-insensitive)
    2. GEFF display hints (horizontal -> x, vertical -> y, depth -> z)
    3. axis names ending with x/y/z (e.g. POSITION_X, centroid-y)
    4. metadata order, assuming (z), y, x

    Parameters
    ----------
    axis_names : list[str]
        Names of the spatial axes, in metadata order
    display_hints : object | None
        GEFF DisplayHint metadata, by default None

    Returns
    -------
    dict[str, str]
        Mapping from GEFF axis name to inTRACKtive column name
    """
    targets = ["z", "y", "x"][-len(axis_names) :]

    def is_valid(mapping: dict[str, str]) -> bool:
        return set(mapping) == set(axis_names) and sorted(mapping.values()) == sorted(
            targets
        )

    candidates = [{name: name.lower() for name in axis_names}]
    if display_hints is not None:
        hints = {
            getattr(display_hints, "display_horizontal", None): "x",
            getattr(display_hints, "display_vertical", None): "y",
            getattr(display_hints, "display_depth", None): "z",
        }
        candidates.append({k: v for k, v in hints.items() if k in axis_names})
    candidates.append({name: name.lower()[-1] for name in axis_names})

    for mapping in candidates:
        if is_valid(mapping):
            return mapping

    LOG.warning(
        f"Could not infer x/y/z from spatial axis names {axis_names}, "
        f"assuming they are ordered as {targets}"
    )
    return dict(zip(axis_names, targets))


def _normalize_axis_columns(
    node_df: pd.DataFrame, metadata: GeffMetadata
) -> tuple[pd.DataFrame, int]:
    """
    Rename the GEFF time and space columns to t/(z)/y/x and apply format-specific fixes.

    - TrackMate (detected via `extra.other_trackmate_metadata`): use FRAME instead of
      POSITION_T (which is in physical time units) and RADIUS as radius
    - A z axis with a single constant value (e.g. 2D TrackMate data) is dropped

    Parameters
    ----------
    node_df : pd.DataFrame
        Node DataFrame as returned by geff_to_dataframes
    metadata : GeffMetadata
        GEFF metadata

    Returns
    -------
    tuple[pd.DataFrame, int]
        Renamed node DataFrame and the number of spatial dimensions (2 or 3)
    """
    temporal_axes = [axis for axis in metadata.axes if axis.type == "time"]
    spatial_axes = [axis for axis in metadata.axes if axis.type == "space"]
    if len(spatial_axes) < 2 or len(spatial_axes) > 3:
        raise ValueError(f"Expected 2 or 3 spatial axes, got {len(spatial_axes)}")
    if len(temporal_axes) == 0:
        raise ValueError("No temporal axis found in metadata")

    is_trackmate = "other_trackmate_metadata" in (metadata.extra or {})

    # Use first temporal axis, or the integer frame index for TrackMate
    time_col = temporal_axes[0].name
    if is_trackmate and "FRAME" in node_df.columns:
        time_col = "FRAME"

    rename = {time_col: "t"}
    rename.update(
        _map_spatial_axes([axis.name for axis in spatial_axes], metadata.display_hints)
    )
    if is_trackmate and "RADIUS" in node_df.columns and "radius" not in node_df:
        rename["RADIUS"] = "radius"

    # Drop existing columns that would collide with the renamed ones
    collisions = [
        col for col in node_df.columns if col in rename.values() and col not in rename
    ]
    if collisions:
        LOG.warning(f"Dropping columns {collisions}, they collide with the axis names")
        node_df = node_df.drop(columns=collisions)
    node_df = node_df.rename(columns=rename)

    ndim = len(spatial_axes)
    if ndim == 3 and node_df["z"].nunique() <= 1:
        LOG.info("z coordinate is constant, treating data as 2D")
        node_df = node_df.drop(columns=["z"])
        ndim = 2

    return node_df, ndim


def read_geff_to_df(
    zarr_store: StoreLike,
    include_all_attributes: bool = False,
) -> pd.DataFrame:
    """
    Read geff data and convert to pandas DataFrame with columns: id, parent_id, t, y, x

    Parameters
    ----------
    zarr_store : StoreLike
        Zarr store (str | Path | zarr store) containing geff data
    include_all_attributes : bool, optional
        Whether to include all available attributes, by default False

    Returns
    -------
    pd.DataFrame
        DataFrame with columns:
        - id: node IDs (mapped to integers)
        - parent_id: parent node IDs (mapped to integers, -1 for root nodes)
        - t: node times
        - z: z coordinates (only for 3D data, otherwise not present)
        - y: y coordinates
        - x: x coordinates
        - Additional attributes if include_all_attributes=True
    """

    LOG.info("Reading GEFF file...")

    zarr_store = remove_tilde(zarr_store)
    metadata = GeffMetadata.read(zarr_store)
    assert metadata.directed, "Geff dataset must be directed"

    node_df, edge_df = geff_to_dataframes(zarr_store)
    node_df, ndim = _normalize_axis_columns(node_df, metadata)

    # Checks on edges
    node_ids = node_df["id"].to_numpy()
    node_times = node_df["t"].to_numpy()
    _, edge_df = remove_non_consecutive_edges(node_ids, node_times, edge_df)
    _, edge_df = remove_merging_edges(edge_df)

    df = node_df.copy()

    # Create mapping from string IDs to integers
    parent_df = edge_df[["source", "target"]].astype(int)
    parent_df = parent_df.rename(columns={"source": "parent", "target": "daughter"})

    # Use merge to efficiently map daughters to parents
    df = df.merge(
        parent_df[["daughter", "parent"]], left_on="id", right_on="daughter", how="left"
    )

    # Rename 'parent' to 'parent_id' and fill NaN values with -1
    df = df.rename(columns={"parent": "parent_id"})
    df.loc[:, "parent_id"] = df["parent_id"].fillna(-1).astype(int)

    df["parent_id"] = df["parent_id"].astype(int)

    # Drop the temporary 'daughter' column
    df = df.drop("daughter", axis=1)

    # Set id as the index - make sure all IDs are integers
    df["id"] = df["id"].astype(int)
    df = df.set_index("id")

    df = add_track_ids_to_tracks_df(df)
    df = df.drop(columns=["parent_id"])

    # Define required columns based on dimensions
    if ndim == 3:
        required_columns = ["track_id", "t", "z", "y", "x", "parent_track_id"]
    else:  # ndim == 2
        required_columns = ["track_id", "t", "y", "x", "parent_track_id"]

    # Check if all required columns are present
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    # Select required columns first, then add any additional columns
    final_columns = required_columns + [
        col for col in df.columns if col not in required_columns
    ]
    df = df[final_columns]

    # Remove non-numerical columns
    if include_all_attributes:
        # Use only the additional properties (exclude spatial and temporal axes)

        for prop_name in final_columns:
            prop_data = df[prop_name].to_numpy()
            remove_column = False
            # Check if dtype is numerical (not string/unicode/object)
            if np.issubdtype(prop_data.dtype, np.number):
                # Check for NaN values - skip properties with NaN
                has_nan = np.any(np.isnan(prop_data))
                if has_nan:
                    LOG.warning(
                        f"Property '{prop_name}' has NaN values, skipping fetching from GEFF"
                    )
                    remove_column = True

                if len(prop_data.shape) != 1:
                    LOG.warning(
                        f"Property '{prop_name}' has shape {prop_data.shape}, expected 1D array, skipping fetching from GEFF"
                    )
                    remove_column = True

                # Check for byte order compatibility
                if prop_data.dtype.byteorder == ">":  # Big-endian
                    prop_data = prop_data.astype(prop_data.dtype.newbyteorder("<"))

            else:
                LOG.warning(
                    f"Property '{prop_name}' has non-numerical dtype {prop_data.dtype}, skipping fetching from GEFF"
                )
                remove_column = True

            if remove_column:
                df = df.drop(columns=[prop_name])
    return df


def read_trackmate_xml_to_df(
    xml_path: Path | str,
    include_all_attributes: bool = False,
    discard_filtered_spots: bool = False,
    discard_filtered_tracks: bool = False,
) -> pd.DataFrame:
    """
    Read a TrackMate/MaMuT XML file into a tracks DataFrame.

    The XML is first converted to a temporary GEFF with geff's TrackMate converter,
    which is then read with `read_geff_to_df`.

    Parameters
    ----------
    xml_path : Path | str
        Path to the TrackMate/MaMuT XML file
    include_all_attributes : bool, optional
        Whether to include all available attributes, by default False
    discard_filtered_spots : bool, optional
        Whether to discard spots filtered out in TrackMate, by default False
    discard_filtered_tracks : bool, optional
        Whether to discard tracks filtered out in TrackMate, by default False

    Returns
    -------
    pd.DataFrame
        DataFrame in the same format as returned by `read_geff_to_df`
    """
    xml_path = Path(xml_path).expanduser()
    LOG.info(f"Converting TrackMate XML {xml_path} to GEFF...")
    with tempfile.TemporaryDirectory() as tmp_dir:
        geff_path = Path(tmp_dir) / f"{xml_path.stem}.geff"
        from_trackmate_xml_to_geff(
            xml_path,
            geff_path,
            discard_filtered_spots=discard_filtered_spots,
            discard_filtered_tracks=discard_filtered_tracks,
        )
        return read_geff_to_df(geff_path, include_all_attributes=include_all_attributes)
