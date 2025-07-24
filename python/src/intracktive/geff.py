import logging

import numpy as np
import pandas as pd
import zarr
from geff.geff_reader import GeffReader
from geff.metadata_schema import GeffMetadata
from geff.utils import validate
from intracktive.vendored.ultrack import add_track_ids_to_tracks_df
from zarr.storage import StoreLike

LOG = logging.getLogger(__name__)
LOG.setLevel(logging.INFO)


def is_geff_dataset(zarr_store: StoreLike) -> bool:
    """
    Check if a zarr group/store is a geff dataset by checking if metadata can be loaded.

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
        # use the geff validation function
        validate(zarr_store)

        # Open the zarr group
        group = zarr.open(zarr_store, mode="r")

        # Read geff metadata from the zarr group
        metadata = GeffMetadata.read(group)  # type: ignore[arg-type]

        # Check if the metadata has a geff_version
        if hasattr(metadata, "geff_version") and metadata.geff_version is not None:
            return True
        else:
            return False
    except Exception as e:
        print(f"Error checking geff dataset: {e}")
        return False


def remove_non_consecutive_edges(
    node_ids: np.ndarray, edge_ids: np.ndarray, node_times: np.ndarray
) -> tuple[bool, np.ndarray]:
    """
    Check if all edges connect nodes that are consecutive in time.

    Parameters
    ----------
    node_ids : np.ndarray
        Array of node IDs (shape: (N,))
    edge_ids : np.ndarray
        Array of edge pairs (shape: (E, 2)) where each row is [parent_id, daughter_id]
    node_times : np.ndarray
        Array of node times (shape: (N,))

    Returns
    -------
    tuple[bool, np.ndarray]
        (is_consecutive, consecutive_edges) where:
        - is_consecutive: True if all edges connect nodes with consecutive times, False otherwise
        - consecutive_edges: Array of consecutive edges (all edges if is_consecutive=True, filtered edges if False)
    """
    # Create a mapping from node_id to its time
    id_to_time = {node_id: time for node_id, time in zip(node_ids, node_times)}

    consecutive_edges = []
    all_consecutive = True

    # Check each edge
    for parent_id, daughter_id in edge_ids:
        parent_time = id_to_time[parent_id]
        daughter_time = id_to_time[daughter_id]

        # Check if times are consecutive (daughter time = parent time + 1)
        # the +1 check is fine, because we check whether the graph is directed before
        if daughter_time == parent_time + 1:
            consecutive_edges.append([parent_id, daughter_id])
        else:
            all_consecutive = False

    if len(edge_ids) - len(consecutive_edges) > 0:
        print(
            f"{len(edge_ids) - len(consecutive_edges)} edges of {len(edge_ids)} are not consecutive in time"
        )

    return all_consecutive, np.array(consecutive_edges)


def remove_merging_edges(edge_ids: np.ndarray) -> tuple[bool, np.ndarray]:
    """
    Remove edges where a daughter cell appears multiple times, since cells cannot merge.

    Parameters
    ----------
    edge_ids : np.ndarray
        Array of edge pairs (shape: (E, 2)) where each row is [parent_id, daughter_id]

    Returns
    -------
    tuple[bool, np.ndarray]
        (no_merging, non_merging_edges) where:
        - no_merging: True if no merging edges were found, False otherwise
        - non_merging_edges: Array of edges without merging (all edges if no_merging=True, filtered edges if False)
    """
    # Convert to DataFrame for efficient duplicate removal
    df = pd.DataFrame(edge_ids, columns=["parent", "daughter"])

    # Keep only the first occurrence of each daughter (drop_duplicates keeps first by default)
    df_no_merging = df.drop_duplicates(subset=["daughter"], keep="first")

    # Convert back to numpy array
    non_merging_edges = df_no_merging[["parent", "daughter"]].values

    # Check if any duplicates were removed
    removed_count = len(edge_ids) - len(non_merging_edges)
    no_merging = removed_count == 0

    if removed_count > 0:
        print(
            f"warning: {removed_count} merging edges removed (daughter cells appeared multiple times)"
        )

    return no_merging, non_merging_edges


def read_geff_to_df(zarr_store: StoreLike) -> pd.DataFrame:
    """
    Read geff data and convert to pandas DataFrame with columns: id, parent_id, t, y, x

    Parameters
    ----------
    zarr_store : StoreLike
        Zarr store (str | Path | zarr store) containing geff data

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
    """

    LOG.info("Reading GEFF file...")

    file_reader = GeffReader(zarr_store, validate=True)

    assert file_reader.metadata.directed, "Geff dataset must be directed"

    # Get temporal and spatial axes from metadata (keep original order)
    if file_reader.metadata.axes is None:
        raise ValueError("No axes found in metadata")

    temporal_axes = [axis for axis in file_reader.metadata.axes if axis.type == "time"]
    spatial_axes = [axis for axis in file_reader.metadata.axes if axis.type == "space"]

    if len(spatial_axes) < 2 or len(spatial_axes) > 3:
        raise ValueError(f"Expected 2 or 3 spatial axes, got {len(spatial_axes)}")

    if len(temporal_axes) == 0:
        raise ValueError("No temporal axis found in metadata")

    # Use first temporal axis and spatial axes in metadata order
    temporal_axis = temporal_axes[0]  # Take the first temporal axis
    prop_names = [temporal_axis.name] + [axis.name for axis in spatial_axes]

    file_reader.read_node_props(prop_names)
    graph_dict = file_reader.build()

    node_ids = graph_dict["node_ids"]
    node_times = graph_dict["node_props"][temporal_axis.name]["values"]

    # Extract spatial coordinates in metadata order
    spatial_coords = []
    for axis in spatial_axes:
        spatial_coords.append(graph_dict["node_props"][axis.name]["values"])

    node_positions = np.stack(spatial_coords, axis=1)
    edge_ids = graph_dict["edge_ids"]

    # time mapping
    unique_times = np.unique(node_times)
    time_mapping = {time: i for i, time in enumerate(unique_times)}
    node_times = np.array([time_mapping[time] for time in node_times])

    # Checks on edges
    _, edge_ids = remove_non_consecutive_edges(node_ids, edge_ids, node_times)
    _, edge_ids = remove_merging_edges(edge_ids)

    # Create mapping from string IDs to integers
    unique_ids = np.unique(np.concatenate([node_ids, edge_ids.flatten()]))
    id_mapping = {id_str: i for i, id_str in enumerate(unique_ids)}

    # Map string IDs to integers
    node_ids_int = np.array([id_mapping[id_str] for id_str in node_ids])
    edge_ids_int = np.array(
        [[id_mapping[parent], id_mapping[daughter]] for parent, daughter in edge_ids]
    )

    # Create DataFrame with node data
    ndim = node_positions.shape[1]
    df_data = {"id": node_ids_int, "t": node_times}  # Always use "t" for time column

    # Map spatial coordinates to z/y/x based on position in metadata
    # First axis becomes z (for 3D) or y (for 2D), second becomes y or x, third becomes x
    spatial_names = ["z", "y", "x"] if ndim == 3 else ["y", "x"]
    for i, axis in enumerate(spatial_axes):
        df_data[spatial_names[i]] = node_positions[:, i]

    df = pd.DataFrame(df_data)

    # Create parent mapping using vectorized operations
    # edge_ids_int contains [parent, daughter] pairs as integers
    parent_df = pd.DataFrame(edge_ids_int, columns=["parent", "daughter"], dtype=int)

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

    # Set id as the index
    df = df.set_index("id")

    df = add_track_ids_to_tracks_df(df)

    # Define required columns based on dimensions
    if ndim == 3:
        required_columns = ["track_id", "t", "z", "y", "x", "parent_track_id"]
    else:  # ndim == 2
        required_columns = ["track_id", "t", "y", "x", "parent_track_id"]

    # Check if all required columns are present
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    # Select only the required columns in the correct order
    df = df[required_columns]

    return df
