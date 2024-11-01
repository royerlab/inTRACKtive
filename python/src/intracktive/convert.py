import time
from pathlib import Path
from typing import Iterable

import click
import numpy as np
import pandas as pd
import zarr
from scipy.sparse import csr_matrix, lil_matrix
from skimage.util._map_array import ArrayMap

REQUIRED_COLUMNS = ["track_id", "t", "z", "y", "x", "parent_track_id"]
INF_SPACE = -9999.9


def _transitive_closure(
    graph: lil_matrix,
    direction: str,
) -> csr_matrix:
    graph.setdiag(1)
    graph = graph.tocsr()

    start = time.monotonic()

    iter = 0
    while graph.nnz != (nxt := graph**2).nnz:
        graph = nxt
        iter += 1

    print(
        f"Chased track lineage {direction} in {time.monotonic() - start} seconds ({iter} iterations)"
    )
    return graph


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
    start = time.monotonic()

    if "z" not in df.columns:
        df["z"] = 0.0

    extra_cols = list(extra_cols)
    columns = REQUIRED_COLUMNS + extra_cols
    points_cols = ["z", "y", "x"] + extra_cols  # columns to store in the points array

    for col in columns:
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found in the DataFrame")

    for col in ("t", "track_id", "parent_track_id"):
        df[col] = df[col].astype(int)

    start = time.monotonic()

    n_time_points = df["t"].max() + 1
    max_values_per_time_point = df.groupby("t").size().max()

    uniq_track_ids = df["track_id"].unique()
    fwd_map = ArrayMap(uniq_track_ids, np.arange(1, 1 + len(uniq_track_ids)))

    # relabeling from 0 to N-1
    df["track_id"] = fwd_map[df["track_id"].to_numpy()]
    # orphaned are set to 0 according to skimage convention
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

    # inserting points to buffer
    for t, group in df.groupby("t"):
        group_size = len(group)
        points_array[t, : group_size * num_values_per_point] = (
            group[points_cols].to_numpy().ravel()
        )
        points_ids = t * max_values_per_time_point + np.arange(group_size)

        points_to_tracks[points_ids, group["track_id"] - 1] = 1

    print(f"Munged {len(df)} points in {time.monotonic() - start} seconds")


    # creating mapping of tracklets parent-child relationship
    tracks_edges = df[["track_id", "parent_track_id"]].drop_duplicates()
    tracks_edges = tracks_edges[tracks_edges["parent_track_id"] > 0]

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
    # FIXME: I'm not sure on what value the orphaned tracklets should be set to
    # setting to zero for now
    tracks_edges_map = ArrayMap(
        tracks_edges["track_id"].to_numpy(), tracks_edges["parent_track_id"].to_numpy()
    )

    non_zero = tracks_to_tracks.nonzero()

    # tracks_to_tracks[non_zero] = tracks_edges_map[non_zero[1] + 1]
    # for i, j in zip(*non_zero):
    #     counter += 1
    #     tracks_to_tracks[i, j] = tracks_edges_map[tracks_to_tracks[i, j] + 1]
    for i in range(len(non_zero[0])):
        tracks_to_tracks[non_zero[0][i], non_zero[1][i]] = 1
        # tracks_to_tracks[non_zero[0][i], non_zero[1][i]] = tracks_edges_map[non_zero[1][i] + 1]

    # @jordao NOTE: didn't modify the original code, from this point below
    # Convert to CSR format for efficient row slicing
    tracks_to_points = points_to_tracks.T.tocsr()
    points_to_tracks = points_to_tracks.tocsr()
    tracks_to_tracks = tracks_to_tracks.tocsr()

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
    tracks_to_tracks_zarr.create_dataset("indices", data=tracks_to_tracks.indices)
    tracks_to_tracks_zarr.create_dataset("indptr", data=tracks_to_tracks.indptr)
    tracks_to_tracks_zarr.create_dataset("data", data=tracks_to_tracks.data)

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
    start = time.monotonic()

    if out_dir is None:
        out_dir = csv_file.parent
    else:
        out_dir = Path(out_dir)

    zarr_path = out_dir / f"{csv_file.stem}_bundle.zarr"

    # TODO: replace this to take arbitrary columns, CLI must be updated as well
    extra_cols = ["radius"] if add_radius else []

    tracks_df = pd.read_csv(csv_file)

    print(f"Read {len(tracks_df)} points in {time.monotonic() - start} seconds")


    convert_dataframe(
        tracks_df,
        zarr_path,
        extra_cols=extra_cols,
    )


if __name__ == "__main__":
    convert_cli()
