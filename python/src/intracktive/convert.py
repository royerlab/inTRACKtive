import time
from pathlib import Path
from typing import Iterable

import click
import numpy as np
import pandas as pd
import zarr
from scipy.sparse import csgraph, lil_matrix
from skimage.segmentation import relabel_sequential

REQUIRED_COLUMNS = ["track_id", "t", "z", "y", "x", "parent_track_id"]
INF_SPACE = -9999.9


def convert_dataframe(
    df: pd.DataFrame,
    out_path: Path,
    extra_cols: Iterable[str] = (),
) -> None:
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
    out_path : Path
        Path to the output Zarr store
    extra_cols : Iterable[str], optional
        List of extra columns to include in the Zarr store, by default ()
    """

    if "z" not in df.columns:
        df["z"] = 0.0

    extra_cols = list(extra_cols)
    columns = REQUIRED_COLUMNS + extra_cols

    for col in columns:
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found in the DataFrame")

    for col in ("t", "track_id", "parent_track_id"):
        df[col] = df[col].astype(int)

    start = time.monotonic()

    n_time_points = df["t"].max() + 1
    max_values_per_time_point = df.groupby("t").size().max()

    relabeld_track_ids, fwd_map, _ = relabel_sequential(df["track_id"], offset=0)
    fwd_map[-1] = -1

    # relabeling from 0 to N-1
    df["track_id"] = relabeld_track_ids
    df["parent_track_id"] = fwd_map[df["parent_track_id"].to_numpy()]

    n_tracklets = df["track_id"].nunique()
    # (z, y, x) + extra_cols
    num_values_per_point = 3 + len(extra_cols)

    # store the points in an array
    points_array = (
        np.ones(
            (n_time_points, num_values_per_point * max_values_per_time_point),
            dtype=np.float32,
        )
        * INF_SPACE
    )

    points_to_tracks = lil_matrix(
        (n_time_points * max_values_per_time_point, n_tracklets), dtype=np.int32
    )

    # inserting points their buffer
    for t, group in df.groupby("t"):
        group_size = len(group)
        points_array[t, : group_size * num_values_per_point] = (
            df[columns].to_numpy().ravel()
        )
        points_ids = t * max_values_per_time_point + np.arange(group_size)

        points_to_tracks[points_ids, group["track_id"]] = 1

    # creating mapping of tracklets parent-child relationship
    tracks_edges = df[["track_id", "parent_track_id"]].drop_duplicates()

    tracklets_graph = lil_matrix((n_tracklets, n_tracklets), dtype=np.int32)
    tracklets_graph[tracks_edges["track_id"], tracks_edges["parent_track_id"]] = 1
    tracklets_graph = tracklets_graph.tocsr()

    # find connected components to obtain transitive closure
    n_cc, cc = csgraph.connected_components(
        tracklets_graph, directed=True, connection="weak"
    )
    lineage_graph = lil_matrix((n_tracklets, n_tracklets), dtype=np.int32)

    for i in range(n_cc):
        lineage_graph[cc == i, cc == i] = 1

    non_zero = lineage_graph.nonzero()
    lineage_graph = lineage_graph.tolil()

    tracks_edges_map = tracks_edges.set_index("track_id")
    lineage_graph[non_zero] = tracks_edges_map.loc[
        non_zero[1], "parent_track_id"
    ].to_numpy()

    # @jordao NOTE: didn't modify the original code, from this point below

    # Convert to CSR format for efficient row slicing
    tracks_to_points = points_to_tracks.T.tocsr()
    points_to_tracks = points_to_tracks.tocsr()
    lineage_graph = lineage_graph.tocsr()

    print(
        f"Parsed dataframe and converted to CSR data structures in {time.monotonic() - start} seconds"
    )
    start = time.monotonic()

    # save the points array
    top_level_group: zarr.Group = zarr.hierarchy.group(
        zarr.storage.DirectoryStore(out_path.as_posix()),
        overwrite=True,
    )

    points = top_level_group.create_dataset(
        "points",
        data=points_array,
        chunks=(1, points_array.shape[1]),
        dtype=np.float32,
    )
    points.attrs["values_per_point"] = num_values_per_point

    mean = df[["z", "y", "x"]].mean()
    extent = (df[["z", "y", "x"]] - mean).abs().max()
    extent_xyz = extent.max()

    for col in ("z", "y", "x"):
        points.attrs[f"mean_{col}"] = mean[col]

    points.attrs["extent_xyz"] = extent_xyz
    points.attrs["fields"] = ["z", "y", "x"] + extra_cols

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
    tracks_to_tracks_zarr.create_dataset("indices", data=lineage_graph.indices)
    tracks_to_tracks_zarr.create_dataset("indptr", data=lineage_graph.indptr)
    tracks_to_tracks_zarr.create_dataset("data", data=lineage_graph.data)

    print(f"Saved to Zarr in {time.monotonic() - start} seconds")


@click.command(name="convert")
@click.option(
    "--csv_file",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="Path to the CSV file",
    required=True,
)
@click.option(
    "--out_dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=None,
    help="Path to the output directory (optional, defaults to the parent dir of the CSV file)",
)
@click.option(
    "--add_radius",
    is_flag=True,
    help="Boolean indicating whether to include the column radius as cell size",
    default=False,
    type=bool,
)
def convert_cli(
    csv_file: Path,
    out_dir: Path | None,
    add_radius: bool,
) -> None:
    """
    Convert a CSV of tracks to a sparse Zarr store
    """

    if out_dir is None:
        out_dir = csv_file.parent
    else:
        out_dir = Path(out_dir)

    zarr_path = out_dir / f"{csv_file.stem}_bundle.zarr"

    # TODO: replace this to take arbitrary columns, CLI must be updated as well
    extra_cols = ["radius"] if add_radius else []

    tracks_df = pd.read_csv(csv_file)

    convert_dataframe(
        tracks_df,
        zarr_path,
        extra_cols=extra_cols,
    )


if __name__ == "__main__":
    convert_cli()
