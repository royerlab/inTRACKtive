# Application Architecture

The application itself is based on a single React component, `Scene`.
The main feature of this component is a canvas element that is connected to a Three.js WebGL renderer, wrapped by our own `PointCanvas` class.
Application state is split between the `Scene` (React state) and the `PointCanvas` (TypeScript + Three.js state).
