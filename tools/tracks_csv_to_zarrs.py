# Partly based on JoOkuma's work:
# https://github.com/czbiohub-sf/interactive-3d-cell-tracking/blob/data-structure/scripts/preprocess_script.py
# %%
import os
from typing import Dict, List, Tuple
import zarr
import pandas as pd
import numpy as np
from tqdm import tqdm

# %% Read napari-like tracks CSV file.
input_dir = "/Users/asweet/data/zebrahub/public.czbiohub.org/royerlab/zebrahub/imaging/single-objective"
tracks_path = f"{input_dir}/ZSNS001_tracks.csv"
tracks = pd.read_csv(tracks_path)

# %% Make output directory.
output_dir = f"{input_dir}/output"
os.makedirs(output_dir, exist_ok=True)

# %% Populate an array of vertices sorted by time
root_dir = f"{output_dir}/data.zarr"
root_group = zarr.open_group(root_dir, mode="w")

# %% Populate an array of vertices sorted by time

# Secondary sort by trackID might be helpful for search over this chunk?
tracks_by_time = tracks.sort_values(["t", "TrackID"])
time_data = tracks_by_time[["TrackID", "x", "y", "z"]].to_numpy().astype(np.float32)
time_array = root_group.create_dataset(
    "vertices_grouped_by_time",
    shape=time_data.shape,
    dtype=time_data.dtype,
    chunks=(10000, time_data.shape[1]),
)
time_array[:] = time_data

# Store the index offsets for each time point
_, time_index_data = np.unique(tracks_by_time["t"], return_index=True)
time_index_array = root_group.create_dataset(
   "vertices_grouped_by_time_indices",
   shape=time_index_data.shape,
   dtype=time_index_data.dtype,
   chunks=None,
)
time_index_array[:] = time_index_data

# %% Populate an array of vertices sorted by trackID
# Secondary sort by time is needed for correct rendering
tracks_by_id = tracks.sort_values(["TrackID", "t"])
# No need for trackID here
# Keep t for convenience though it will just increment so should
# just store the first value somewhere else
# Keep parent_track_id for convenience even though it will repeat
# so should be stored more efficiently
id_data = tracks_by_time[["x", "y", "z", "t", "parent_track_id"]].to_numpy().astype(np.float32)
id_array = root_group.create_dataset(
    "vertices_grouped_by_id",
    shape=id_data.shape,
    dtype=id_data.dtype,
    chunks=(10000, id_data.shape[1]),
)
id_array[:] = id_data

# Store the index offsets for each ID
_, id_index_data = np.unique(tracks_by_id["t"], return_index=True)
id_index_array = root_group.create_dataset(
   "vertices_grouped_by_id_indices",
   shape=id_index_data.shape,
   dtype=id_index_data.dtype,
   chunks=None,
)
id_index_array[:] = id_index_data