import csv
import time
from collections import Counter

import numpy as np
import zarr
from scipy.sparse import lil_matrix

root_dir = "/Users/aandersoniii/Data/tracking/"

start = time.monotonic()
points = []
points_in_timepoint = Counter()
with open(root_dir + "ZSNS001_tracks.csv", "r") as f:
    reader = csv.reader(f)
    next(reader)  # Skip the header
    # TrackID,t,z,y,x,parent_track_id
    for row in reader:
        t = int(row[1])
        points.append(
            (int(row[0]), t, float(row[2]), float(row[3]), float(row[4]), points_in_timepoint[t])
        )
        points_in_timepoint[t] += 1

print(f"Read {len(points)} points in {time.monotonic() - start} seconds")
start = time.monotonic()

max_points_in_timepoint = max(points_in_timepoint.values())
timepoints = len(points_in_timepoint)
tracks = len(set(p[0] for p in points))

# store the points in an array
points_array = np.ones((timepoints, 3 * max_points_in_timepoint), dtype=np.float32) * -9999.9
points_to_tracks = lil_matrix((timepoints * max_points_in_timepoint, tracks), dtype=np.int32)
for point in points:
    track_id, t, z, y, x, n = point
    point_id = t * max_points_in_timepoint + n

    points_array[t, 3 * n:3 * (n + 1)] = [z, y, x]

    points_to_tracks[point_id, track_id - 1] = 1

print(f"Munged {len(points)} points in {time.monotonic() - start} seconds")
start = time.monotonic()

# Convert to CSR format for efficient row slicing
tracks_to_points = points_to_tracks.T.tocsr()
points_to_tracks = points_to_tracks.tocsr()

print(f"Converted to CSR in {time.monotonic() - start} seconds")
start = time.monotonic()

# save the points array (same format as ZSHS001_nodes.zarr)
top_level_group = zarr.hierarchy.group(
    zarr.storage.DirectoryStore(root_dir + "ZSNS001_tracks_bundle.zarr"),
    overwrite=True,
)

top_level_group.create_dataset(
    "points",
    data=points_array,
    chunks=(1, points_array.shape[1]),
    dtype=np.float32,
)

top_level_group.create_groups("points_to_tracks", "tracks_to_points")
# TODO: tracks_to_points may want to store xyz for the points, not just the indices
# this would make the indices array 3x (4x?) larger, but would eliminate the need to
# fetch coordinates again based on point IDs
tracks_to_points_zarr = top_level_group["tracks_to_points"]
tracks_to_points_zarr.attrs["sparse_format"] = "csr"
tracks_to_points_zarr.create_dataset("indices", data=tracks_to_points.indices)
tracks_to_points_zarr.create_dataset("indptr", data=tracks_to_points.indptr)
tracks_to_points_xyz = np.zeros((len(tracks_to_points.indices), 3), dtype=np.float32)
for i, ind in enumerate(tracks_to_points.indices):
    t, n = divmod(ind, max_points_in_timepoint)
    tracks_to_points_xyz[i] = points_array[t, 3 * n:3 * (n + 1)]
print(tracks_to_points_xyz.shape)
# TODO: figure out chunking?
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

print(f"Saved to Zarr in {time.monotonic() - start} seconds")

# TODO: process the tracks-to-tracks data - right now this does not provide a way
# to get ancestor/descendent tracks

# Here is the output of this script on my machine, using the ZSNS001_tracks.csv file.
# Surely this conversion could be sped up!
# ❯ python convert_tracks_csv_to_sparse_zarr.py
# Read 21697591 points in 23.41321291704662 seconds
# Munged 21697591 points in 61.357248957967386 seconds
# Converted to CSR in 8.24479133298155 seconds
# (21697591, 3)
# Saved to Zarr in 40.47038504201919 seconds

# This is what the resulting Zarr store looks like:
# ~/Data/tracking
# ❯ du -sh ZSNS001_tracks_bundle.zarr
# 520M	ZSNS001_tracks_bundle.zarr

# ZSNS001_tracks_bundle.zarr
# ├── points (198M)
# ├── points_to_tracks (62M)
# │   ├── indices (61M)
# │   └── indptr (1M)
# └── tracks_to_points (259M)
#     ├── data (207M)
#     ├── indices (50M)
#     └── indptr (1.9M)

# note the relatively small size of the indptr arrays
# tracks_to_points/data is a redundant copy of the points array to avoid having
# to fetch point coordinates individually
