# Application Architecture

The application itself is based on a single React component, `Scene`. The main feature of this
component is a canvas element that is connected to a Three.js WebGL renderer, wrapped by our own
`PointCanvas` class. Application state is split between the `Scene` (React state) and the
`PointCanvas` (TypeScript + Three.js state).

## Scene component
The `Scene` is the main component of the application. This component holds nearly all of the
required state. State is held in three categories:

- References are used to manage objects that should never change, even when the component re-render.
  - divRef - a reference to the div that holds the canvas
  - canvas - a [`PointCanvas`](#PointCanvas) object that holds and manages the Three.js scene

- Primary state that determines configuration of application (captured in the shareable URL)
  - dataUrl - URL to the Zarr bundle
  - curTime - current timepoint

- Other state that is not (yet) persisted (not captured in shareable URL)
  - autoRotate - whether the camera should rotate automatically
  - playing - whether the timepoint should advance automatically
  - trackManager - a [`TrackManager`](#TrackManager) object that manages loading and querying of tracks
  - numTimes - number of timepoints in the data
  - trackHighlightLength - how many timepoints to highlight around the current timepoint
  - loading - whether the data is still loading (shows loading spinner)
  - selectedPoints - list of point IDs that are last selected

Additionally, this component renders the actual canvas element and the controls for the application.

### ViewerState
The `ViewerState` class wraps the state of the application that is persisted in the URL. This class
contains the following properties, taken from both the `Scene` and `PointCanvas` state:
- dataUrl - from Scene
- curTime - from Scene
- cameraPosition - from PointCanvas
- cameraTarget - from PointCanvas

This class also provides methods for updating the state from the URL and for generating a shareable
URL from the current state.

## PointCanvas
The `PointCanvas` holds the Three.js scene, camera, and renderer. It is responsible for rendering
the points and tracks, as well as handling user interactions.

### Track
The `Track` class is a modified Three.js [`Line2`
object](https://threejs.org/examples/?q=lines#webgl_lines_fat), which renders lines as an instanced
mesh. Each timepoint is rendered as a separate instance. This class is responsible for rendering the
tracks in the scene, including highlighting the track around the current timepoint. This works by
including a `time` instanced attribute in the geometry as well as `minTime` and `maxTime` uniforms.
Together, these allow the shader to change the width and color of the line at each segment.

## TrackManager
The `TrackManager` class is responsible for loading tracks from the [Zarr bundle](file_format.md).
This is just a wrapper around a series of [`ZarrArray`
objects](https://guido.io/zarr.js/#/getting-started/zarr-arrays) (using Zarr.js). This class
provides a simple interface for the basic queries required by the application:
- `fetchPointsAtTime`
- `fetchTrackIDsForPoint`
- `fetchPointsForTrack`
- `fetchLineageForTrack`

### SparseZarr
The `SparseZarr` class is a wrapper around a Zarr array that is stored in CSR format. This class
provides a simple interface for fetching rows of the array. Each row requires two requests to the
Zarr array: one for the `indptr` array and one for the `indices` array. The `SparseZarr` class also
handles basic caching of the `indptr` arrays to reduce the number of requests required.
