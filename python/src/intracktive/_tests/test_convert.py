import csv
import time
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
import zarr
from intracktive.convert import convert_dataframe
from scipy.sparse import lil_matrix


def _old_convert_cmd(
    csv_file: str,
    out_dir: str,
    add_radius: bool,
) -> None:
    csv_file = Path(csv_file)
    if out_dir is None:
        out_dir = csv_file.parent
    else:
        out_dir = Path(out_dir)
    zarr_path = out_dir / f"{csv_file.stem}_bundle.zarr"

    print("add_radius", add_radius)
    if add_radius:
        num_values_per_point = 4
    else:
        num_values_per_point = 3
    print("num_values_per_point (z,y,x,radius)", num_values_per_point)

    start = time.monotonic()
    points = []
    points_in_timepoint = Counter()
    with open(csv_file, "r") as f:
        reader = csv.reader(f)
        header = next(reader)  # Skip the header

        column_map = {name: idx for idx, name in enumerate(header)}
        if "z" in column_map:
            flag_2D = False
            print("3D dataset")
        else:
            flag_2D = True
            print("2D dataset")

        required_columns = ["track_id", "t", "y", "x", "parent_track_id"]
        for col in required_columns:
            assert col in column_map, f"Error: column {col} must exist in the CSV"
        if not flag_2D:
            assert "z" in column_map, "Error: column z must exist in the CSV"
        if add_radius:
            assert "radius" in column_map, "Error: column radius must exist in the CSV"

        for row in reader:
            t = int(row[column_map["t"]])
            if add_radius and not flag_2D:  # 3D + radius
                points.append(
                    (
                        int(row[column_map["track_id"]]),
                        t,
                        float(row[column_map["z"]]),
                        float(row[column_map["y"]]),
                        float(row[column_map["x"]]),
                        int(row[column_map["parent_track_id"]]),
                        float(row[column_map["radius"]]),
                        points_in_timepoint[t],
                    )
                )
            elif add_radius and flag_2D:  # 2D + radius
                points.append(
                    (
                        int(row[column_map["track_id"]]),
                        t,
                        float(0),
                        float(row[column_map["y"]]),
                        float(row[column_map["x"]]),
                        int(row[column_map["parent_track_id"]]),
                        float(row[column_map["radius"]]),
                        points_in_timepoint[t],
                    )
                )
            elif not add_radius and not flag_2D:  # 3D without radius
                points.append(
                    (
                        int(row[column_map["track_id"]]),
                        t,
                        float(row[column_map["z"]]),
                        float(row[column_map["y"]]),
                        float(row[column_map["x"]]),
                        int(row[column_map["parent_track_id"]]),
                        points_in_timepoint[t],
                    )
                )
            elif not add_radius and flag_2D:  # 2D without radius
                points.append(
                    (
                        int(row[column_map["track_id"]]),
                        t,
                        float(0),
                        float(row[column_map["y"]]),
                        float(row[column_map["x"]]),
                        int(row[column_map["parent_track_id"]]),
                        points_in_timepoint[t],
                    )
                )
            points_in_timepoint[t] += 1

    print(f"Read {len(points)} points in {time.monotonic() - start} seconds")
    start = time.monotonic()

    max_points_in_timepoint = max(points_in_timepoint.values())
    timepoints = len(points_in_timepoint)
    tracks = len(set(p[0] for p in points))

    # tests track_id consistency
    track_id_set = set(p[0] for p in points)

    if len(track_id_set) != max(track_id_set):
        print(
            f"Warning: track_ids not consecutive ({len(track_id_set)} track_IDs found, max track_id = {max(track_id_set)})"
        )
        print(
            "Solution: Track_id are reformatted to be consecutive from 1 to N, with N the number of tracks"
        )

    track_id_map = {
        old_id: new_id for new_id, old_id in enumerate(sorted(track_id_set), start=1)
    }
    points = [
        (
            track_id_map[p[0]],  # remap track_id
            p[1],  # time
            p[2],  # z
            p[3],  # y
            p[4],  # x
            track_id_map[p[5]]
            if p[5] != -1
            else -1,  # remap parent_track_id (keep -1 unchanged)
            *p[6:],  # radius and other remaining values (if any)
        )
        for p in points
    ]

    # store the points in an array
    points_array = (
        np.ones(
            (timepoints, num_values_per_point * max_points_in_timepoint),
            dtype=np.float32,
        )
        * -9999.9
    )
    points_to_tracks = lil_matrix(
        (timepoints * max_points_in_timepoint, tracks), dtype=np.int32
    )
    tracks_to_children = lil_matrix((tracks, tracks), dtype=np.int32)
    tracks_to_parents = lil_matrix((tracks, tracks), dtype=np.int32)

    # create a map of the track_index to the parent_track_index
    # track_id and parent_track_id are 1-indexed, track_index and parent_track_index are 0-indexed
    direct_parent_index_map = {}

    vector_x = []
    vector_y = []
    vector_z = []

    for point in points:
        if add_radius:
            (
                track_id,
                t,
                z,
                y,
                x,
                parent_track_id,
                radius,
                n,
            ) = point  # n is the nth point in this timepoint
            points_array[
                t, num_values_per_point * n : num_values_per_point * (n + 1)
            ] = [z, y, x, radius]
        else:
            (
                track_id,
                t,
                z,
                y,
                x,
                parent_track_id,
                n,
            ) = point  # n is the nth point in this timepoint
            points_array[
                t, num_values_per_point * n : num_values_per_point * (n + 1)
            ] = [z, y, x]

        vector_x.append(x)
        vector_y.append(y)
        vector_z.append(z)

        point_id = (
            t * max_points_in_timepoint + n
        )  # creates a sequential ID for each point, but there is no guarantee that the points close together in space

        track_index = track_id - 1
        if track_index not in direct_parent_index_map:
            # maps the track_index to the parent_track_index
            direct_parent_index_map[track_id - 1] = parent_track_id - 1

        points_to_tracks[point_id, track_id - 1] = 1

        if parent_track_id > 0:
            tracks_to_parents[track_id - 1, parent_track_id - 1] = 1
            tracks_to_children[parent_track_id - 1, track_id - 1] = 1

    print(f"Munged {len(points)} points in {time.monotonic() - start} seconds")
    tracks_to_parents.setdiag(1)
    tracks_to_children.setdiag(1)
    tracks_to_parents = tracks_to_parents.tocsr()
    tracks_to_children = tracks_to_children.tocsr()

    mean_x = np.mean(vector_x)
    mean_y = np.mean(vector_y)
    mean_z = np.mean(vector_z)
    extent_x = np.max(np.abs(vector_x - mean_x))
    extent_y = np.max(np.abs(vector_y - mean_y))
    extent_z = np.max(np.abs(vector_z - mean_z))
    extent_xyz = np.max([extent_x, extent_y, extent_z])

    start = time.monotonic()
    iter = 0

    print(tracks_to_parents.shape)
    print("parent NNZ", tracks_to_parents.nnz)
    # More info on sparse matrix: https://en.wikipedia.org/wiki/Sparse_matrix#Compressed_sparse_row_(CSR,_CRS_or_Yale_format)
    # Transitive closure: https://en.wikipedia.org/wiki/Transitive_closure
    while tracks_to_parents.nnz != (nxt := tracks_to_parents**2).nnz:
        tracks_to_parents = nxt
        iter += 1
    print("parent NNZ", tracks_to_parents.nnz)

    print(
        f"Chased track lineage forward in {time.monotonic() - start} seconds ({iter} iterations)"
    )
    start = time.monotonic()

    print("child NNZ", tracks_to_children.nnz)
    iter = 0
    while tracks_to_children.nnz != (nxt := tracks_to_children**2).nnz:
        tracks_to_children = nxt
        iter += 1
    print("child NNZ", tracks_to_children.nnz)

    print(
        f"Chased track lineage backward in {time.monotonic() - start} seconds ({iter} iterations)"
    )
    start = time.monotonic()

    tracks_to_tracks = tracks_to_parents + tracks_to_children
    tracks_to_tracks = tracks_to_tracks.tolil()
    non_zero = tracks_to_tracks.nonzero()

    print("NNZ", tracks_to_parents.nnz - tracks_to_parents.shape[0])
    print("NNZ", tracks_to_children.nnz - tracks_to_parents.shape[0])
    print("NNZ", tracks_to_tracks.nnz)

    for i in range(len(non_zero[0])):
        # track_index = track_id - 1 since track_id is 1-indexed
        track_index = non_zero[1][i]
        parent_track_index = direct_parent_index_map[track_index]
        tracks_to_tracks[non_zero[0][i], non_zero[1][i]] = parent_track_index + 1

    # Convert to CSR format for efficient row slicing
    tracks_to_points = points_to_tracks.T.tocsr()
    points_to_tracks = points_to_tracks.tocsr()
    tracks_to_tracks = tracks_to_tracks.tocsr()

    print(f"Converted to CSR in {time.monotonic() - start} seconds")
    start = time.monotonic()

    # save the points array
    top_level_group = zarr.hierarchy.group(
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
    points.attrs["mean_x"] = mean_x
    points.attrs["mean_y"] = mean_y
    points.attrs["mean_z"] = mean_z
    points.attrs["extent_xyz"] = extent_xyz
    points.attrs["fields"] = ["z", "y", "x", "radius"][:num_values_per_point]

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
        t, n = divmod(ind, max_points_in_timepoint)
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


def _evaluate(new_group: zarr.Group, old_group: zarr.Group) -> None:
    assert new_group.keys() == old_group.keys()

    for key in new_group.keys():
        new = new_group[key]
        old = old_group[key]

        assert new.attrs == old.attrs

        if isinstance(new, zarr.Group):
            _evaluate(new, old)
        else:
            print(f"{key}: new {new.shape} old {old.shape}")
            assert new.shape == old.shape, f"{key}: {new.shape} != {old.shape}"
            assert new.dtype == old.dtype, f"{key}: {new.dtype} != {old.dtype}"
            # TODO: check content


def test_new_conversion(tmp_path: Path) -> None:
    # might change in the future, smaller than zebrahub data
    sample_data_url = "https://public.czbiohub.org/royerlab/ultrack/multi-color-cytoplasm-sparse-tracks.csv"

    rng = np.random.default_rng(0)

    df = pd.read_csv(sample_data_url)
    df["radius"] = rng.uniform(1, 5, size=len(df))
    df.loc[df["parent_track_id"] == 0, "parent_track_id"] = -1

    df.to_csv(tmp_path / "sample_data.csv", index=False)

    new_path = tmp_path / "new/sample_data_bundle.zarr"
    old_path = tmp_path / "old/sample_data_bundle.zarr"

    convert_dataframe(
        df=df,
        out_path=new_path,
        extra_cols=["radius"],
    )

    print("\n\n-------------\n")

    _old_convert_cmd(
        csv_file=str(tmp_path / "sample_data.csv"),
        out_dir=str(old_path.parent),
        add_radius=True,
    )

    new_data = zarr.open(new_path)
    old_data = zarr.open(old_path)

    _evaluate(new_data, old_data)
