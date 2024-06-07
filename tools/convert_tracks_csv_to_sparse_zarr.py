import csv
import time
from collections import Counter

import numpy as np
import zarr
from scipy.sparse import lil_matrix

root_dir = "/Users/ehoops/development/"

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
            (int(row[0]), t, float(row[2]), float(row[3]), float(row[4]), int(row[5]), points_in_timepoint[t])
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
tracks_to_children = lil_matrix((tracks, tracks), dtype=np.int32)
tracks_to_parents = lil_matrix((tracks, tracks), dtype=np.int32)

# create a map of the track_index to the parent_track_index
# track_id and parent_track_id are 1-indexed, track_index and parent_track_index are 0-indexed
direct_parent_index_map = {}  

for point in points:
    track_id, t, z, y, x, parent_track_id, n = point # n is the nth point in this timepoint
    point_id = t * max_points_in_timepoint + n # creates a sequential ID for each point, but there is no guarantee that the points close together in space

    track_index = track_id - 1
    if track_index not in direct_parent_index_map:
      # maps the track_index to the parent_track_index
      direct_parent_index_map[track_index] = parent_track_id - 1

    points_array[t, 3 * n:3 * (n + 1)] = [z, y, x]

    points_to_tracks[point_id, track_id - 1] = 1

    if parent_track_id > 0:
        tracks_to_parents[track_id - 1, parent_track_id - 1] = 1
        tracks_to_children[parent_track_id - 1, track_id - 1] = 1
    
print(f"Munged {len(points)} points in {time.monotonic() - start} seconds")

tracks_to_parents.setdiag(1)
tracks_to_children.setdiag(1)
tracks_to_parents = tracks_to_parents.tocsr()
tracks_to_children = tracks_to_children.tocsr()

start = time.monotonic()
iter = 0
# More info on sparse matrix: https://en.wikipedia.org/wiki/Sparse_matrix#Compressed_sparse_row_(CSR,_CRS_or_Yale_format)
# Transitive closure: https://en.wikipedia.org/wiki/Transitive_closure
while tracks_to_parents.nnz != (nxt := tracks_to_parents ** 2).nnz:
    tracks_to_parents = nxt
    iter += 1

print(f"Chased track lineage forward in {time.monotonic() - start} seconds ({iter} iterations)")
start = time.monotonic()

iter = 0
while tracks_to_children.nnz != (nxt := tracks_to_children ** 2).nnz:
    tracks_to_children = nxt
    iter += 1

print(f"Chased track lineage backward in {time.monotonic() - start} seconds ({iter} iterations)")
start = time.monotonic()

tracks_to_tracks = tracks_to_parents + tracks_to_children
tracks_to_tracks = tracks_to_tracks.tolil()
non_zero = tracks_to_tracks.nonzero()

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

top_level_group.create_groups("points_to_tracks", "tracks_to_points", "tracks_to_tracks")
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

# Here is the output of this script on my machine, using the ZSNS001_tracks.csv file.
# Surely this conversion could be sped up!
# ❯ python tools/convert_tracks_csv_to_sparse_zarr.py
# Read 21697591 points in 25.869198750006035 seconds
# Munged 21697591 points in 142.77665075007826 seconds
# Chased track lineage forward in 0.9570639999583364 seconds (7 iterations)
# Chased track lineage backward in 1.2615197079721838 seconds (7 iterations)
# Converted to CSR in 10.87520341691561 seconds
# Saved to Zarr in 45.39336562505923 seconds

# This is what the resulting Zarr store looks like:
# ~/Data/tracking
# ❯ du -sh ZSNS001_tracks_bundle.zarr
# 520M	ZSNS001_tracks_bundle.zarr

# ZSNS001_tracks_bundle.zarr
# ├── points (198M)
# ├── points_to_tracks (62M)
# │   ├── indices (61M)
# │   └── indptr (1M)
# ├── tracks_to_points (259M)
# │   ├── data (207M)
# │   ├── indices (50M)
# │   └── indptr (1.9M)
# └── tracks_to_tracks (37M)
#     ├── data (22M) <- currently unused
#     ├── indices (13M)
#     └── indptr (1.8M)

# note the relatively small size of the indptr arrays
# tracks_to_points/data is a redundant copy of the points array to avoid having
# to fetch point coordinates individually