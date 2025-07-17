import numpy as np
import pandas as pd
import zarr
from intracktive.vendored.ultrack import add_track_ids_to_tracks_df


def is_geff_dataset(zarr_path: str) -> bool:
    """
    Check if a zarr group/store is a geff dataset by looking for geff_version in .zattrs.

    Parameters
    ----------
    zarr_path : str
        Path to the zarr group

    Returns
    -------
    bool
        True if it's a geff dataset (contains geff_version in .zattrs), False otherwise
    """
    try:
        # Open the zarr group
        group = zarr.open_group(zarr_path, mode="r")

        # Check if .zattrs exists and contains geff_version
        if hasattr(group, "attrs"):
            attrs = group.attrs.asdict()
            return "geff_version" in attrs
        else:
            return False
    except Exception as e:
        print(f"Error checking geff dataset: {e}")
        return False


def geff_to_arrays(zarr_path: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Read nodes and edges from a zarr group with the specified structure.

    Parameters
    ----------
    zarr_path : str
        Path to the zarr group containing 'nodes' and 'edges' subgroups

    Returns
    -------
    tuple
        (node_ids, node_positions, edge_ids) where:
        - node_ids: numpy array of shape (N,) dtype uint64
        - node_positions: numpy array of shape (N, 3) dtype float16
        - edge_ids: numpy array of shape (E, 2) dtype uint64
    """
    # Open the zarr group
    group = zarr.open_group(zarr_path, mode="r")

    # Read nodes
    nodes_group = group["nodes"]
    node_ids = nodes_group["ids"][:]  # shape: (N,) dtype: uint64
    node_positions = nodes_group["attrs"]["position"]["values"][
        :
    ]  # shape: (N, 3) dtype: float16
    node_times = nodes_group["attrs"]["t"]["values"][:]  # shape: (N,) dtype: float16

    # Read edges
    edges_group = group["edges"]
    edge_ids = edges_group["ids"][:]  # shape: (E, 2) dtype: uint64

    return node_ids, node_positions, node_times, edge_ids


def read_geff_to_df(zarr_path: str) -> pd.DataFrame:
    """
    Read geff data and convert to pandas DataFrame with columns: id, parent_id, t, y, x

    Parameters
    ----------
    zarr_path : str
        Path to the zarr group containing geff data

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
    node_ids, node_positions, node_times, edge_ids = geff_to_arrays(zarr_path)

    # Create mapping from string IDs to integers
    unique_ids = np.unique(np.concatenate([node_ids, edge_ids.flatten()]))
    id_mapping = {id_str: i for i, id_str in enumerate(unique_ids)}

    # Map string IDs to integers
    node_ids_int = np.array([id_mapping[id_str] for id_str in node_ids])
    edge_ids_int = np.array(
        [[id_mapping[parent], id_mapping[daughter]] for parent, daughter in edge_ids]
    )

    # Create DataFrame with node data
    df_data = {
        "id": node_ids_int,
        "t": node_times,
        "y": node_positions[:, 0],
        "x": node_positions[:, 1],
    }

    # Add z column if positions are 3D
    if node_positions.shape[1] == 3:
        df_data["z"] = node_positions[:, 2]

    df = pd.DataFrame(df_data)

    # Create parent mapping using vectorized operations
    # edge_ids_int contains [parent, daughter] pairs as integers
    parent_df = pd.DataFrame(edge_ids_int, columns=["parent", "daughter"])

    # Use merge to efficiently map daughters to parents
    df = df.merge(
        parent_df[["daughter", "parent"]], left_on="id", right_on="daughter", how="left"
    )

    # Rename 'parent' to 'parent_id' and fill NaN values with -1
    df = df.rename(columns={"parent": "parent_id"})
    df["parent_id"] = df["parent_id"].fillna(-1).astype(int)

    # Drop the temporary 'daughter' column
    df = df.drop("daughter", axis=1)

    # Set id as the index
    df = df.set_index("id")

    df = add_track_ids_to_tracks_df(df)

    # Define required columns (excluding z as requested)
    required_columns = ["track_id", "t", "y", "x", "parent_track_id"]

    # Check if all required columns are present
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    # Select only the required columns in the correct order
    df = df[required_columns]

    return df
