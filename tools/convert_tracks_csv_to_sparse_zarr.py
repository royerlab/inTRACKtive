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
zarr.save_array(
    zarr.storage.DirectoryStore(root_dir + "ZSNS001_points.zarr"),
    points_array,
    chunks=(1, points_array.shape[1]),
    dtype=np.float32,
)

# TODO: tracks_to_points may want to store xyz for the points, not just the indices
# this would make the indices array 3x (4x?) larger, but would eliminate the need to
# fetch coordinates again based on point IDs
tracks_to_points_zarr = zarr.hierarchy.group(
    zarr.storage.DirectoryStore(root_dir + "ZSNS001_tracks_to_points.zarr"),
    overwrite=True,
)
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

points_to_tracks_zarr = zarr.hierarchy.group(
    zarr.storage.DirectoryStore(root_dir + "ZSNS001_points_to_tracks.zarr"),
    overwrite=True,
)
points_to_tracks_zarr.attrs["sparse_format"] = "csr"
points_to_tracks_zarr.create_dataset("indices", data=points_to_tracks.indices)
points_to_tracks_zarr.create_dataset("indptr", data=points_to_tracks.indptr)

print(f"Saved to Zarr in {time.monotonic() - start} seconds")

# TODO: process the tracks-to-tracks data - right now this does not provide a way
# to get ancestor/descendent tracks

# Here is the output of this script on my machine, using the ZSNS001_tracks.csv file:
# Read 21697591 points in 22.329734917002497 seconds
# Munged 21697591 points in 118.71619812501012 seconds
# Converted to CSR in 13.235349250011495 seconds
# Saved to Zarr in 1.1937562500097556 seconds
# ~/Data/tracking
# ❯ du -sh *
# 197M	ZSNS001_points.zarr
# 62M	ZSNS001_points_to_tracks.zarr
# 849M	ZSNS001_tracks.csv
#  64M	ZSNS001_tracks_to_points.zarr

# within each sparse array group we have something like this:
# ❯ du -sh ZSNS001_tracks_to_points.zarr/*
#  62M	ZSNS001_tracks_to_points.zarr/indices
# 1.9M	ZSNS001_tracks_to_points.zarr/indptr
# thus `indptr` can certainly be cahced locally to eliminate many extra requests

# I need to test if this would just be better as a big compressed zarr array with lots of zeros
