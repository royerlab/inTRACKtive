import logging

import numpy as np
import pandas as pd
import zarr
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
    group = zarr.open(zarr_store, mode="r")

    assert metadata.directed, "Geff dataset must be directed"

    # Get and check spatial/temporal axes
    temporal_axes = [axis for axis in metadata.axes if axis.type == "time"]
    spatial_axes = [axis for axis in metadata.axes if axis.type == "space"]
    if len(spatial_axes) < 2 or len(spatial_axes) > 3:
        raise ValueError(f"Expected 2 or 3 spatial axes, got {len(spatial_axes)}")

    if len(temporal_axes) == 0:
        raise ValueError("No temporal axis found in metadata")

    # Use first temporal axis and spatial axes in metadata order
    temporal_axis = temporal_axes[0]  # Take the first temporal axis
    prop_names = [temporal_axis.name] + [axis.name for axis in spatial_axes]

    # Add all available properties if requested
    if include_all_attributes:
        # Discover available node properties from the zarr store structure
        available_props = list(group["nodes/props"].keys())
        # Exclude spatial and temporal axes from additional properties since they're already included
        spatial_temporal_names = {temporal_axis.name} | {
            axis.name for axis in spatial_axes
        }
        additional_props = [
            prop for prop in available_props if prop not in spatial_temporal_names
        ]
        prop_names.extend(additional_props)
        LOG.info(f"Loading all properties: {prop_names}")

    node_df, edge_df = geff_to_dataframes(zarr_store)

    # Checks on edges
    node_ids = node_df["id"].to_numpy()
    node_times = node_df[temporal_axes[0].name].to_numpy()
    _, edge_df = remove_non_consecutive_edges(node_ids, node_times, edge_df)
    _, edge_df = remove_merging_edges(edge_df)

    df = node_df.copy()

    # Determine dimensionality from spatial axes
    ndim = len(spatial_axes)

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
