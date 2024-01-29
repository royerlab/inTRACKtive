# %%
import zarr
import pandas as pd
import numpy as np
from tqdm import tqdm

# %% [markdown]
# NOTES
# it converts the tracking data into a (T, 2, position) array
# where T is the number of time points
# (t, 0) is the coordinates at the previous time point (t-1)
# (t, 1) is the coordinates at the current time point (t)
# this information is sufficient to draw the edges (lines)


# %%
tracks_path = "http://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001_tracks.csv"
tracks = pd.read_csv(tracks_path)

# %%
df = tracks[["TrackID", "t", "z", "y", "x"]]
print(df.head())

# %%
df.info()

# %%
n_dim = 3

# %%
df = df.sort_values(by=["TrackID", "t"])
edges = [] #  = 
for track_id, group in tqdm(df.groupby("TrackID")):
    pos = group[["x", "y", "z"]].to_numpy()
    edge_coords = np.concatenate(
        (group["t"].to_numpy()[1:, None], pos[1:], pos[:-1]),
        axis=1,
    )
    edges.append(edge_coords)

edges = np.concatenate(edges, axis=0)
edges_df = pd.DataFrame(
    edges,
    columns=["t", "source_x", "source_y", "source_z", "target_x", "target_y", "target_z"],
) 
edges_df["t"] = edges_df["t"].astype(int)
print(edges_df.head())

# %%
grouped = edges_df.groupby("t")
num_timepoints = df["t"].max() + 1
num_points = grouped.size().max()

# %%
# Using float32 to save space
data = np.full((num_timepoints, 2, num_points * n_dim), -9999.99, dtype=np.float32)
print(data.shape)
print(data.dtype)

# %%
# we assume the time points are 0 to T-1
for name, group in tqdm(grouped):
    timepoint = int(name)
    # Flatten ALL the points' coordinates at this timepoint
    data[timepoint, 0, :len(group) * n_dim] = group[["target_x", "target_y", "target_z"]].to_numpy().ravel()
    data[timepoint, 1, :len(group) * n_dim] = group[["source_x", "source_y", "source_z"]].to_numpy().ravel()

# %%
# Save data so I don't have to re-compute everything again
np.save("edges_coordinates.npy", data)

# %%
z1 = zarr.open(
    "edges_coordinates.zarr",
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
