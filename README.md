# points-web-viewer

The `points-web-viewer` **[ToDo: Link to Preprint]** is an application for data-efficient vizualization and sharing of cell tracking data in the browser. The viewer allows users to navigate the tracked cells through time with a time slider, select specific cells, and trace cell lineages. The view of the explored lineage selections can be shared with a simple link, making it ideal for collaboration, education, and showcasing. This viewer eliminates the local setup of native software, making advanced  lineage tracing and *in silico* fate mapping accessible to everyone with a browser. It is built in TypeScript, using [React](https://react.dev/) and
[Three.js](https://threejs.org/), bundles with [Vite](https://vitejs.dev/), and using [Zarr.js](https://github.com/gzuidhof/zarr.js) for light-weight data loading. The viewer utilizes a specialized tracking data format for asynchronous laze data loading and on-the-fly interactivity. This tool makes it possible for everyone to visualize, host, and interact with your cell tracking data!

This tool was originally built to explore the light-sheet 3D cell tracking results of the Virtual Embryo Zoo project.

**[ToDo: Link to Virtual Embryo Zoo]**

<p align="center">
  <img src="/public/docs/images/UI_overview.png" width="75%">
  <p align="center">
    <em>Figure 1 - UI overview</em>
  </p>
</p>

**[ToDo: Video demo]**

<br/>

# Table of content
The `points-web-viewer` has three main use-cases: 

1. Explore the Virtual Embryo Zoo ([🠋go down🠋](#1-explore-the-virtual-embryo-zoo))

2. Vizualize your own cell tracking data ([🠋go down🠋](#2-vizualize-your-own-cell-tracking-data))

3. Host your own customized `points-web-viewer` client ([🠋go down🠋](#3-host-your-own-customized-viewer))

Below we will explain each use-case in more detail.

<br/>


## 1. Explore the Virtual Embryo Zoo

<details open>
    <summary>collapse</summary></br>

The Virtual Embryo Zoo is a growing platform that empowers researchers to investigate single-cell embryogenesis of six commonly studied model organisms: Drosophila, zebrafish, C. elegans, Ascidian, mouse, and Tribolium. The Virtual Embryo Zoo webpage uses the `points-web-viewer` for an intuitive and accesible web-based interface. 

**[ToDo: Link to Virtual Embryo Zoo]**

See the image below with the explanation of the viewer's GUI: 

**[ToDo: Figure explaining all GUI functionalities]**

([🠉go up🠉](#table-of-content))

</details><br/>




## 2. Vizualize your own cell tracking data 

<details open>
    <summary>collapse</summary></br>

If you want to vizualize your own data with the `points-web-viewer` tool, you need to do two things: 

### i) Convert the cell tracking data into our zarr format

In order to view your own cell tracking data in the `points-web-viewer`, you need to convert your data into our zarr format. Make sure your cell tracking data is saved as `tracks.csv` and has the following format: 

```
|   track_id |   t |   z |   y |   x |   parent_track_id |
|-----------:|----:|----:|----:|----:|------------------:|
|          1 |   0 | 361 | 415 | 266 |                -1 |
|          1 |   1 | 364 | 419 | 269 |                -1 |
|          2 |   2 | 331 | 421 | 259 |                 1 |
|          2 |   3 | 335 | 397 | 265 |                 1 |
|          2 |   4 | 334 | 390 | 275 |                 1 |
|          3 |   2 | 422 | 405 | 291 |                 1 |
|          3 |   3 | 423 | 400 | 300 |                 1 |
|          3 |   4 | 419 | 398 | 302 |                 1 |
```

where `track_id` is the label of each track (consistent over time), and `parent_track_id` the `track_id` of the parent cell after cell division. In this example, cell `1` divides into cells `2` and `3` in at `t=2`. Make sure that `t` is continuous and starts at `0` and that `track_id` is continuously and starts from `1`.

This `tracks.csv` file can be converted to our zarr format using the following command-line function (found in [/tools/convert_tracks_csv_to_sparse_zarr.py](tools/convert_tracks_csv_to_sparse_zarr.py)):

```
cd tools
python convert_tracks_csv_to_sparse_zarr.py /path/to/tracks.csv
```

This function converts `tracks.csv` to `tracks_bundle.zarr` (if interested, see on the [zarr format](public/docs/file_format.md)). Change `/path/to/tracks.csv` to the actual path to you `tracks.csv`. By default, `tracks_bundle.zarr` is saved in the same directory as `tracks.csv`, unless `output_directory` is specified as second parameter to the function call (see the [function itself](tools/convert_tracks_csv_to_sparse_zarr.py) for more details)

### ii) Host the data

In order for the viewer to access the data, the data must be hosted on a location where the browser has access to. For testing and vizualizing data on your own computer, the easiest way is to host the data via `local_host`. This repository contains a [tool](tools/serve_directory_http.py) to host the data locally:

```
cd tools
python serve_directory_http path/to/data
```

where `path/to/data` is the full path to the folder containing your data (`tracks_bundle.zarr`). The tool will create a `localhost` with a name similar to `http://127.0.0.1:8000/`. Open this link in the browser, navigate to the exact dataset, right-click on the dataset and `copy link` (depending on the browser). Then, [open](https://points-web-viewer.vercel.app/) the viewer, paste the copied link into the viewer (use the :globe_with_meridians: icon in the lower-left corner), and vizualize your own data!

([🠉go up🠉](#table-of-content))



</details><br/>



## 3. Host your own customized viewer

<details open>
    <summary>collapse</summary></br>

If you want to host your own customizable `points-web-viewer`, we recommend to `fork` the repo. To run the viewer locally, you need to install with `npm`:

```
npm install
```

Then, you can run the development server with:

```
npm run dev
```

For testing, use `npm run test` or `npm run coverage`


To customize the viewer, personalize the settings by simply changing elements in `CONFIG.json`. The following settings can be changed: 

- branding:
    - name (`University of XX`)
    - path to logo (`/path/to/logo.png`)
- data:
    - path to default dataset (`https://public/XXX_bundle.zarr/`)
- parameters:
    - max number of points allowed to select, before warning pops up (`100`)

Of course, any other setting can be personalized by activately changing the code of the `points-web-viewer`

([🠉go up🠉](#table-of-content))

</details><br/>







# Collaborators
... \
(Ashley, Andy, Erin, Teun, Jordao, Kyle, Loic)

<br/>


# Contact us
...

<br/>


# Citation
...

<br/>
