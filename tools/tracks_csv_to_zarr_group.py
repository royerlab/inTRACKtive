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

# %% Populate cell arrays with cell/track IDs and coordinates
root_dir = f"{output_dir}/data.zarr"
root_group = zarr.open_group(root_dir, mode="w")
cells_group = root_group.create_group("cells")

for t, group in tracks.groupby("t"):
    cell_data = group[["TrackID", "x", "y", "z"]].to_numpy().astype(np.float32)
    cell = cells_group.create_dataset(
        f"t{t}",
        shape=cell_data.shape,
        dtype=cell_data.dtype,
        chunks=cell_data.shape, # one chunk
    )
    cell[:] = cell_data

# %% Map from cell/track ID to parent track ID and children IDs
# This is only needed if we want a list of all ancestors/descendants
# tracks_sub = tracks.drop_duplicates("TrackID")[["TrackID", "parent_track_id"]]
# parents: Dict[int, int] = {}
# children: Dict[int, Tuple[int, ...]] = {}
# for c, group in tqdm(tracks_sub.groupby("TrackID")):
#     parents[int(c)] = int(group["parent_track_id"].iloc[0])
#     children[int(c)] = tuple(
#         int(i)
#         for i in tracks_sub[tracks_sub.parent_track_id == c]["TrackID"].unique()
#     )

# %% Populate track arrays with time/lineage metadata in attributes
tracks_group = root_group.create_group("tracks")
for c, group in tqdm(tracks.groupby("TrackID")):
    group_sorted = group.sort_values(by="t")
    track_data = group_sorted[["x", "y", "z"]].to_numpy()
    track = tracks_group.create_dataset(
        f"c{c}",
        shape=track_data.shape,
        dtype=np.float32,
        chunks=track_data.shape, # one chunk
    )
    track.attrs["start_time_index"] = group_sorted["t"].iloc[0]
    track.attrs["parent_track_id"] = int(group["parent_track_id"].iloc[0])
    track.attrs["child_track_ids"] = tuple(
        int(i)
        for i in tracks[tracks.parent_track_id == c]["TrackID"].unique()
    )
    track[:] = track_data
# %%
