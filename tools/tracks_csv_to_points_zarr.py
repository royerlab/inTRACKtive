# Heavily based on JoOkuma's work:
# https://github.com/czbiohub-sf/interactive-3d-cell-tracking/blob/data-structure/scripts/preprocess_script.py
# %%
import os
import zarr
import pandas as pd
import numpy as np
from tqdm import tqdm

# %%
input_dir = "/Users/asweet/data/zebrahub/public.czbiohub.org/royerlab/zebrahub/imaging/single-objective"
tracks_path = f"{input_dir}/ZSNS001_tracks.csv"
tracks = pd.read_csv(tracks_path)

# %%
df = tracks[["TrackID", "t", "z", "y", "x"]]
df.head()

# %%
df.info()

# %%
n_dim = 3
grouped = df.groupby("t")
num_timepoints = grouped.ngroups
num_points = grouped.size().max()

# %%
# Also use float32 to save space
data = np.full((num_timepoints, num_points * n_dim), -9999.99, dtype=np.float32)
print(data.shape)
print(data.dtype)

# %% [markdown]
# # Example Output
# ```py
# array(
# [
#     # t = 1 (or 0, whatever your first timepoint is)
#     [1.1, 2.1, 3.1, 2.1, 3.1, 4.1],  # Points 1 and 2 at t=1
#
#     # t = 2
#     [3.1, 4.1, 5.1, 0.0, 0.0, 0.0],  # Points 1 and 2 at t=2
#
#     # t = 3
#     [5.1, 6.1, 7.1, 6.1, 7.1, 8.1],  # Points 1 and 2 at t=3
#
#     # t = 4
#     [0.0, 0.0, 0.0, 7.1, 8.1, 9.1]   # Points 1 and 2 at t=4
# ])
# ```

# %%
# we assume the time points are 0 to T-1
for name, group in tqdm(grouped):
    timepoint = int(name)
    # Flatten ALL the points' coordinates at this timepoint
    data[timepoint, :len(group) * n_dim] = group[["x", "y", "z"]].to_numpy().ravel()

# %%
# Save data so I don't have to re-compute everything again
output_dir = f"{input_dir}/output"
os.makedirs(output_dir)
np.save(f"{output_dir}/points.npy", data)

# %%
z1 = zarr.open(
    f"{output_dir}/points.zarr",
    mode="w",
    shape=data.shape,
    dtype=data.dtype,
    # https://zarr.readthedocs.io/en/stable/tutorial.html#chunk-optimizations
    chunks=(1, None),
)
z1[:] = data
z1.info
print(z1.info)

# %%
# Examples
# Get all the tracks' coordinates at time point 0
print(z1[0].shape)

# Get the first 5 time points
print(z1[:5])
