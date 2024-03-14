# f8m8

f8m8 ("Fate Mate") is an application for vizualizing cell tracking data in the
browser. It is built on [React](https://react.dev/) and
[Three.js](https://threejs.org/). This project was built to explore light-sheet
imaging data from [Zebrahub](https://zebrahub.ds.czbiohub.org/), processed with
[Ultrack](https://github.com/royerlab/ultrack).

Cell tracking data comprises:
1. *Points* are locations of identified cells within a timepoint. They are
   represented by a point cloud in the canvas.
2. *Tracks* (aka *Tracklets*) connect points through time, and thus correspond
   to the lifespan of a single cell, excluding division and/or merging. A track
   may only contain one point per timepoint.
3. *Track lineage* represents the relationships between tracklets, including
   ancestors (parents) and descendents (children) of a given track (cell).

In both code and documentation, "tracks" ends up being overloaded to mean both
individual tracks, as well as full track lineage.
