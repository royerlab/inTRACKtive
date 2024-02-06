The tools here are used for development purposes and not intended to be distributed outside of this repository.

## File format

We wanted to make the tracking data available in the zarr format for easy ingestion in Python and JS.
We also wanted efficient access to tracks data for visualization.

- Fast read access of cell locations and IDs per time-point.
    - May also want fast read-access for contiguous chunks across time (i.e. to enable fewer individual fetches for playback).
- Fast read access of track vertices based on cell IDs
    - This enables fetching all tracks per cell (including ancestors, descendants).
    - Maybe some chunking in time, but probably unnecessary
- Fast read access of cell lineages based on cell IDs
    - E.g. given a cell ID, get the IDs of all its ancestors and descendants


### Idea 1: use zarr groups as keys

The key idea with our specific zarr layout is to use groups as a way to organize data.
This provides a self-documenting way to organize the data and a simple way to read
data by specific keys like time or cell index.
The main downsides of this approach are that track vertices are repeated/redundant
and that some queries (e.g. across several time points) require multiple requests.

For example:

subject_01_tracks.zarr/
  .zgroup
  cells
    .zgroup
    t0 // n0x4 zarr array that stores positions and IDs at time 0 (i.e. each row is something like [0, 1.2, 3.4, 5.6])
      .zarray
      ...
    t1 // n1x4 zarr array that stores positions and IDs at time 1
      .zarray
      ...
  tracks
    .zgroup
    c0 // m0x3 zarr array that stores positions of cell 0 over time (i.e. each row is something like [1.2, 3.4, 5.6])
      .zarray
      .zattrs // stores lineage of cell 0 (i.e. all ancestors and descendant indices)
      ...
    c1 // m1x3 zarr array that stores positions of cell 1 over time (i.e. each row is something like [1.2, 3.4, 5.6])
      .zarray
      .zattrs // stores lineage of cell 1 (i.e. all ancestors and descendant indices)

In the app, when we want to display the coordinates of cells at time 0, we simply call

```
const array = await openArray({
    store: "https://zebrahub.org/data/subject_01_tracks.zarr,
    path: "cells/t0",
    mode: "r",
});
// Request all data in one. We'll unpack the positions into the
// three.js buffer anyway, and will store the IDs separately.
const data = (await array.get()).data;
// Could await two requests as follows, but that's likely silly.
// Alternative, could transpose data, but also not ideal.
// const ids = (await array.get([slice(null), 0])).data;
// const points = (await array.get([slice(null), slice(1, 4)])).data;
```

Then, let's say cell 0 is selected.
We can load the tracks of this cell by doing the following

```
const array = await openArray({
    store: "https://zebrahub.org/data/subject_01_tracks.zarr,
    path: "tracks/c0",
    mode: "r",
});
const track = (await array.get([slice(null), 0])).data;
// yield main track data, so that it can be visualized immediately
const ancestors = await array.attrs["ancestors"];
for (anc in ancestors) {
    // may be able to skip some ancestors based on viz config
    const ancTrack = (await array.get([slice(null), anc])).data;
    // yield ancestor track
}
const descendants = await array.attrs["descendants"];
for (desc in descendants) {
    // may be able to skip some descendants based on viz config
    const descTrack = (await array.get([slice(null), desc])).data;
    // yield descendant track
}
```

In practice this did not work well because there are too many array associated with the tracks.
This made writing those files slow and costly (i.e. the .zarray JSON file was often bigger than the data chunks).
And it would make reading those arrays costly too (i.e. extra request for each .zarray).

### Idea 2: tracks table sorted two ways as zarrs

Instead of using groups to organize the cells by time and tracks by ID,
we can sort the tracks table data (in the CSV) two ways.

First, we sort it by time.
Each row represents a cell at a particular time point.
Each consecutive group of rows then represents all the cells IDs and coordinates at one time point.

Second, we sort it by track ID, then by time.
Each row again represents a cell at a particular time point.
Each consecutive group of rows then represents a track(let) of cells coordinate across multiple consecutive time points.
We can also append columns to store parent and child IDs, though we likely

We then store 1D vectors to look up offset indices for particular time points and track IDs.

The storage cost associated with this representation is just 2 times the storage cost of the tracks table in zarr.