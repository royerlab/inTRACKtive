# Application Architecture

The application itself is based around one main React component, `App`. This component holds two key pieces of state:
- A `PointCanvas` - a Three.js scene that renders the points and tracks
- A `TrackManager` - an object that manages loading and querying of tracks

The rest of the application controls are rendered by this component, and most are built from
[SDS](https://sds.czi.design) and [mui](https://mui.com) components.

## App component
The `App` is the main component of the application. This component holds nearly all of the
required state. State is held in three categories:

- Primary state that determines configuration of application (captured in the shareable URL)
  - `canvas` - a [`PointCanvas`](#PointCanvas) object that holds and manages the Three.js scene
  - `trackManager` - a [`TrackManager`](#TrackManager) object that manages loading and querying of tracks

- Additional state is held in this component
  - `dataUrl` - the URL of the Zarr bundle (duplicate of `trackManager.store`)
  - `playing` - a boolean that determines if the viewer is playing
  - `isLoadingPoints` and `numLoadingTracks` - values to determine if the viewer is loading data

The `canvas` object is managed via a reducer, which is responsible for updating the canvas state
based on changes from inputs and controls. This is created by a custom `usePointCanvas` hook.

Data synchronization and fetching is handled in a series of effects (`useEffect` hooks) that respond
to changes in the application or `canvas` state.

Additionally, this component renders the actual canvas element and the controls for the application.

## PointCanvas
The `PointCanvas` holds the Three.js scene (including points and tracks), camera, and renderer. It
is responsible for rendering the points and tracks, as well as handling user interactions (camera
movement and selection).

### usePointCanvas
The `usePointCanvas` hook is responsible for managing the state of the `PointCanvas` object. This
hook creates a reducer that updates the `PointCanvas` object based on actions dispatched by the
application. This hook also creates the `sceneDivRef` reference that is used to attach the Three.js
canvas element to the DOM.

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
handles basic caching of the `indptr` arrays to reduce the number of requests required. Additional
caching is just left to the browser cache.

## ViewerState
The `ViewerState` class wraps the state of the application that is persisted in the URL. This class
contains the following properties, taken from both the `Scene` and `PointCanvas` state:
- `dataUrl` - from `TrackManager`
- `curTime` - from `PointCanvas`
- `minTime` and `maxTime` - from `PointCanvas` (highlighted portion of tracks)
- `maxPointsPerTimepoint` - from `PointCanvas`
- `pointBrightness` - from `PointCanvas`
- `showTracks` - from `PointCanvas`
- `showTrackHighlights` - from `PointCanvas`
- `selectedPointIds` - from `PointCanvas`
- `cameraPosition` - from `PointCanvas`
- `cameraTarget` - from `PointCanvas`

This class also provides methods for updating the state from the URL and for generating a shareable
URL from the current state.

