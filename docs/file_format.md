# File Format

Cell tracking data are loaded from a collection of [Zarr](https://zarr.dev) arrays.
This allows efficient access to data on static hosting, without the need for server-side processing.
Necessary queries are baked-in to the file format at the cost of some data redundancy.

These queries are encoded in sparse [CSR-format](https://en.wikipedia.org/wiki/Sparse_matrix#Compressed_sparse_row_(CSR,_CRS_or_Yale_format)) arrays, represented by 2 or 3 Zarr arrays.
Sparse arrays in CSR format allow relatively efficient retrieval (typically 2 requests) of complete *rows* in the array.
Conveniently, these Zarr arrays can be constructed by saving the `indices` and `indptr` attributes (numpy arrays) of a `scipy.sparse` array.
The `data` array is only necessary if you have additional data to encode - it's used in the `tracks_to_points` where it stores the point coordinates.
If present, the `data` array should have shape `(len(indices), N)`, where `N` is the number of associated pieces of data (in the `tracks_to_points` example, this is 3).

Here is the directory layout including approximate sizes for the arrays our example dataset:

```
ZSNS001_tracks_bundle.zarr
├── points (198M)
├── points_to_tracks (62M)
│   ├── indices (61M)
│   └── indptr (1M)
├── tracks_to_points (259M)
│   ├── data (207M)
│   ├── indices (50M)
│   └── indptr (1.9M)
└── tracks_to_tracks (15M)
    ├── indices (13M)
    └── indptr (1.8M)
```

## points

The `points` array is a dense, ragged array of 32-bit floats with shape `(n_timepoints, max_points_per_timepoint)`.
So each row is a timepoint, and within that row are point coordinates as `[x0, y0, z0, x1, y1, z1, ...]`.
Rows with fewer points are padded at the end with `-9999.9`.
Each point is then given a unique ID calculated by `t * max_points_per_timepoint + n` where `t` is the timepoint (row in the `points` array), and `n` is the index of the point within the timepoint.
That is, the point ID is just a flat index value.

This array is used for fetching all the points in a given timeframe.

## points_to_tracks

The `points_to_tracks` array encodes the relationship between a given point ID (row) and any track IDs (columns) it is part of.
The total shape of the array is then `(n_points, n_tracks)`.
Thus, fetching a row is used to get all tracks associated with a given point.
This is effectively an adjacency matrix.
In the sample data, each point belongs to at most one track.
Values in the array don't matter, just the presence of a nonzero element which indicates a connection.

This is the first query run when points are selected.

## tracks_to_tracks

This array, shape `(n_tracks, n_tracks)` allows us to retrieve lineage (ancestors and descendents) for a given track.
This can be pre-computed by first creating adjacency matrices for two directed graphs: `tracks_to_children` and `tracks_to_parents`.
Iterative squaring of these matrices converges on the transitive closure of each - this gives each track a connection to all of its descendents (`tracks_to_children`) or all of its ancestors (`tracks_to_parents`).
The sum of these matrices produces the matrix we want, where a track is connected directly to all of its ancestors and descendents.

This is run for each track returned from the initial `points_to_tracks` query.

## tracks_to_points

This is just a transpose of the `points_to_tracks` array.

This is the *last* query run when points are selected, and is run for each track in the lineage.
