![Tests](https://github.com/royerlab/inTRACKtive/actions/workflows/python-lint-and-test.yml/badge.svg)
[![codecov](https://codecov.io/gh/royerlab/inTRACKtive/branch/main/graph/badge.svg)](https://codecov.io/gh/royerlab/inTRACKtive)
[![PyPI version](https://badge.fury.io/py/intracktive.svg?cache_bust=1)](https://badge.fury.io/py/intracktive)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Contributors](https://img.shields.io/github/contributors-anon/royerlab/inTRACKtive)](https://github.com/royerlab/inTRACKtive/graphs/contributors)
[![GitHub stars](https://img.shields.io/github/stars/royerlab/inTRACKtive?style=social)](https://github.com/royerlab/inTRACKtive/)
[![GitHub forks](https://img.shields.io/github/forks/royerlab/inTRACKtive?style=social)](https://git:hub.com/royerlab/inTRACKtive/)

# inTRACKtive

`inTRACKtive`([preprint](https://www.biorxiv.org/content/10.1101/2024.10.18.618998v1), [videos](public/docs/videos.md)) is an application for data-efficient visualization and sharing of cell tracking data in the browser. The viewer allows users to navigate the tracked cells through time with a time slider, select specific cells, and trace cell lineages. The view of the explored lineage selections can be shared with a simple link, making it ideal for collaboration, education, and showcasing. This viewer eliminates the local setup of native software, making advanced lineage tracing and *in silico* fate mapping accessible to everyone with a browser. It is built in TypeScript, using [React](https://react.dev/) and
[Three.js](https://threejs.org/), bundled with [Vite](https://vitejs.dev/), using [Zarr.js](https://github.com/gzuidhof/zarr.js) for light-weight data loading and the CZI [SDS](https://github.com/chanzuckerberg/sci-components?tab=readme-ov-file) component library. The viewer utilizes a specialized [tracking data format](public/docs/file_format.md) for asynchronous lazy data loading and on-the-fly interactivity. This tool makes it possible for everyone to visualize, host, and interact with your cell tracking data!

This tool was originally built to explore the light-sheet microscopy 3D cell tracking results of the [Virtual Embryo Zoo](https://virtual-embryo-zoo.sf.czbiohub.org/), but can be used to visualize any tracking data acquired with any 2D ([example](https://t.ly/K-hA7)) or 3D microscopy modality from which tracking data can be obtained, from organoids down to single molecules.

https://github.com/user-attachments/assets/4d674696-0add-4f03-8f38-600b44c987e7

(<a href="https://vimeo.com/1019958933/a61cfa4120">Vimeo</a> for the high-resolution version)

<br/>

# Table of contents
`inTRACKtive` ([preprint](https://www.biorxiv.org/content/10.1101/2024.10.18.618998v1)) has three main use-cases: 

1. Explore the Virtual Embryo Zoo ([↓1. Explore the Virtual Embryo Zoo↓](#1-explore-the-virtual-embryo-zoo))

2. Visualize your own cell tracking data ([↓2. Visualize your own tracking data↓](#2-visualize-your-own-cell-tracking-data))

3. Host your own customized `inTRACKtive` client ([↓3. Host your own customized viewer↓](#3-host-your-own-customized-viewer))

Below we will explain each use-case in more detail.

<br/>


## 1. Explore the Virtual Embryo Zoo

<details open>
    <summary>collapse</summary></br>

The [Virtual Embryo Zoo](https://virtual-embryo-zoo.sf.czbiohub.org/) ([preprint](https://www.biorxiv.org/content/10.1101/2024.10.18.618998v1), [videos](public/docs/videos.md)) is a growing platform that empowers researchers to investigate single-cell embryogenesis of six commonly studied model organisms: Drosophila, zebrafish, C. elegans, Ascidian, mouse, and Tribolium. The Virtual Embryo Zoo webpage uses `inTRACKtive` for an intuitive and accessible web-based interface.


https://github.com/user-attachments/assets/15147514-bc92-466f-a3ef-47bfe9fa2c6d

(<a href="https://vimeo.com/1019959289/edfcb4d6a7">Vimeo</a> for the high-resolution version)

See the image below with the explanation of the `inTRACKtive` UI: 

<p align="center">
  <img src="/public/docs/images/UI_overview.png" width="75%">
  <p align="center">
    <em>Figure 1 - UI overview</em>
  </p>
</p>

([↑Back to table of contents↑](#table-of-contents))

</details><br/>




## 2. Visualize your own cell tracking data 

<details open>
    <summary>collapse</summary></br>

We tried to make it as easy as possible to visualize your own data with `inTRACKtive`, there are currently three pathways you can follow: _i_) use the command-line interface for data conversion and hosting, _ii_) open `inTRACKtive` from the napari plugin, or _iii_) from a Jupyter Notebook. All three options are outlined below, after the note regarding the file format. 


#### Note: Tracking data format

In order to view your own cell tracking data with `inTRACKtive`, make sure your data is in the following format (which is the standard [Ultrack](https://github.com/royerlab/ultrack) format):

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

where `track_id` is the label of each track (consistent over time), and `parent_track_id` the `track_id` of the parent cell after cell division (a `parent_track_id` of `-1` indicates that the cell has no parent. The absence of this column in the tracking data assumes that there are no cell divisions). In this example, cell `1` divides into cells `2` and `3` in at `t=2`. Make sure that `t` is continuous and starts at `0` and that `track_id` is integer-valued and starts from `1`. This can be in a `csv` format, or `pandas.DataFrame`, or anything equivalent. Note that the order of the columns is not important, since they are accessed by name. We are working on conversion script from popular cell tracking algorithms into our format, they will be available soon.

For `inTRACKtive`, the data described above needs to be converted into our specialized Zarr format. We have python and command-line functions (see below at point _i_), while the napari and Jupyter Notebook solutions do this under the hood. 

The common first step for all three approaches is to start with a clean conda environment, and git install the package: 

```
conda create -n intracktive python
conda activate intracktive
pip install intracktive
```

---

### i) Command-line interface to convert and host your own data for `inTRACKtive`

This approach consists of two steps: converting the tracking data into our specialized Zarr format, and hosting the data to make it accessible for the browser. 

For the first step, we assume your cell tracking data is saved as `tracks.csv` (or `tracks.parquet`) in the format as described above (5-6 columns, with column names: `track_id, t, (z), y, x, (parent_track_id)]`), where `z` and `parent_track_id` are optional (no `z` column assumes 2D data, and no `parent_track_id` column assumes no cell divisions). This `tracks.csv` file can be converted to our Zarr format using the following command-line function (found in [/python/src/intracktive/convert.py](/python/src/intracktive/convert.py)):

```
intracktive convert --input_file /path/to/tracks.csv
```

This function converts `tracks.csv` to `tracks_bundle.zarr` (if interested, see the [Zarr format](public/docs/file_format.md)). Change `/path/to/tracks.csv` into the actual path to your `tracks.csv`. By default, `tracks_bundle.zarr` is saved in the same directory as `tracks.csv`, unless `--out_dir` is specified as the extra parameter to the function call (see the [function itself](python/src/intracktive/convert.py) for more details). The conversion script works for 2D and 3D datasets (when the column `z` is not present, a 2D dataset is assumed, i.e., all `z`-values will be set to 0)

By default, all the cells are represented by equally-sized dots in `inTRACKtive`. The conversion script has the option of giving each cell a different size. For this: 1) make sure `tracks.csv` has an extra column named `radius`, and 2) use the flag `--add_radius` when calling the conversion script:

```
intracktive convert --input_file path/to/tracks.csv --add_radius
```

Or use `intracktive convert --help` for the documentation on the inputs and outputs

Additionally, inTRACKtive has the option of giving each cell a different color based on provided data attributes (see the example [Jupyter Notebook (`/napari/src/intracktive/examples`)](/python/src/intracktive/examples/notebook1_inTRACKtive_from_notebook.ipynb)). One can add any attributes to the Zarr file, as long as they are present as columns in the `tracks.csv` tracking data. Using the following command-line interface, you can add one/multiple/all columns as attributes to the data:
```
#add specific column as attribute
intracktive convert --input_file path/to/file.csv --add_attribute cell_size

#add multiple columns as attributes
intracktive convert --input_file path/to/file.csv --add_attribute cell_size,time,diameter,color

#add all columns as attributes
intracktive convert --input_file path/to/tracks.csv --add_all_attributes
```
When using `add_all_attributes`, the code will add all given columns as an attribute, apart from the default columns (`track_id`, `t`, `z`, `y`, `x`, and `parent_track_id`). If desired, one can manually add these columns as attributes using `add_attribute x`,  for example. The conversion script will detect whether each provided column represents a categorical or continuous attribute. This information is saved in the Zarr attributes information and loaded by inTRACKtive to use the appropriate colormap. 

In order for the viewer to access the data, the data must be hosted at a location the browser can access. For testing and visualizing data on your own computer, the easiest way is to host the data via `localhost`. This repository contains a [tool](python/src/intracktive//server.py) to host the data locally:

```
intracktive serve path/to/data
```

where `path/to/data` is the full path to the folder containing your data (e.g., `tracks_bundle.zarr`). Note that the path should **not** include the Zarr filename, so if the `tracks_bundle.zarr` is located in your Downloads folder, use `intracktive server ~/Downloads`. The tool will create a `localhost` with a name similar to `http://127.0.0.1:8000/`. 

Open this link in the browser, navigate to the exact dataset, right-click on the dataset (`tracks-bundle.zarr`) and `copy link` (depending on the browser). Then, open [the `inTRACKtive` viewer](https://intracktive.sf.czbiohub.org/), paste the copied link into the viewer (use the :globe_with_meridians: icon in the lower-left corner), and visualize your own data!

Alternatively, you can use use a single command to serve and view the Zarr bundle with inTRACKtive: 

```
intracktive open path/to/zarr
```

where `path/to/zarr` is the full path to the Zarr bundle, including the Zarr filename (example: `~/Downloads/tracks_bundle.zarr`). This command will spin up a local host at the location of the Zarr bundle, and open a browser tab with `inTRACKtive` running with this dataset. 

---

### ii) Open `inTRACKtive` using a Jupyter Notebook

To make the previous two processes (conversion + hosting data) easier, we compiled them into a single python function, which is demonstrated in a [Jupyter Notebook (`/napari/src/intracktive/examples`)](/python/src/intracktive/examples/notebook1_inTRACKtive_from_notebook.ipynb). 

```
dataframe_to_browser(data, zarr_dir)
```
where `data` is a `pandas.DataFrame` containing the tracking data, and `zarr_dir` is a directory on your computer to save the Zarr file. The `dataframe_to_browser` function, under the hood, sequentially: 1) converts pd.dataFrame to Zarr,  2) saves the Zarr in the specified location, 3) spins up a localhost at that location, and 4) launches a browser window of `inTRACKtive` with as dataUrl the zarr in the localhost. All in a function call. 

> ⚠️ Currently `dataframe_to_browser` only works for Google Chrome and Firefox (not Safari)

### iii) Open `inTRACKtive` using the napari widget

Using the same capabilities of the `dataframe_to_browser`, we made a [napari](https://napari.org/stable/) widget. The widget (`intracktiveWidget`) is part of the Python package after `pip install`, and automatically shows up in the napari widget list (`plugins>inTRACKtive`). To keep the `inTRACKtive` python package light-weight, napari is not listed as one of its dependencies. To make use of the napari widget, please `pip install napari[all]` in the same conda environment as `inTRACKtive`. The widget takes the tracking data from a [`tracks`](https://napari.org/dev/howtos/layers/tracks.html) layer in napari and opens an `inTRACKtive` browser window with the data. We provide an example of how to use the widget in a [Jupyter Notebook (`/napari/src/intracktive/examples`)](/python/src/intracktive/examples/notebook2_inTRACKtive_from_napari.ipynb). 

<p align="center">
  <img src="/public/docs/images/napari_widget.png" width="75%">
  <p align="center">
    <em>Figure 2 - the inTRACKtive napari widget</em>
  </p>
</p>

Some notes: 
- The user can select a tracks layer to open in `inTRACKtive`
- The user can choose the directory where to save the Zarr (either provide a directory, or leave blank, and the widget will save in a temporary location)

> ⚠️ Note that when viewing a dataset that is hosted locally, sharing the dataset with someone else via the "shareable URL" option does not work, since the dataset only exists locally. Either share the dataset, or deposit the data on a public repository (examples: lab/university website, a public partition on a local cluster (HPC), AWS S3 bucket, Github Pages, Google Cloud Storage, etc)  

([↑Back to table of contents↑](#table-of-contents))



</details><br/>




## 3. Host your own customized viewer

<details open>
    <summary>collapse</summary></br>

If you want to host your own customizable `inTRACKtive`, we recommend to `fork` the repo. To run the viewer locally, you need to install with `npm`:

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
    - name (`"University of XX"`)
    - path to logo (`"/path/to/logo.png"`)
- data:
    - path to default dataset (`"https://public/XXX_bundle.zarr/"`)
- parameters:
    - max number of points allowed to select, before warning pops up (`100`)
    - colormap of the track highlights (`"viridis-inferno"`)
    - size of points (`0.1`)
    - color of the cells (`[0, 0.8, 0.8]`) = cyan
    - color of the selected cells (`[0.9, 0, 0.9]`) = pink
    - color of the previewed cells (`[0.8, 0.8, 0]`) = yellow

Of course, any other setting can be personalized by actively changing the code of `inTRACKtive`. For more technical details check the [architecture documentation](public/docs/architecture.md) of the application.

([↑Back to table of contents↑](#table-of-contents))

</details><br/>







# Collaborators
This tool has been developed by the [Loïc A. Royer Group](https://www.czbiohub.org/royer/) from the [Chan Zuckerberg Biohub San Francisco](https://www.czbiohub.org/sf/) and the [Chan Zuckerberg Initiative](https://chanzuckerberg.com).

Team: 
- [Teun A.P.M. Huijben](https://github.com/TeunHuijben)
- [Ashley Anderson](https://github.com/aganders3)
- [Andy Sweet](https://github.com/andy-sweet)
- [Erin Hoops](https://github.com/ehoops-cz)
- [Connor Larsen](https://github.com/clarsen-czi)
- [Kyle Awayan](https://github.com/kyleawayan)
- [Jordão Bragantini](https://github.com/JoOkuma)
- [Chi-Li Chiu](https://github.com/chili-chiu)
- [Loïc A. Royer](https://github.com/royerloic)

<br/>


# Contact us
If you have any questions, requests, or awesome ideas, please contact us:

Teun Huijben (teun.huijben@czbiohub.org / [Twitter/X](https://x.com/TeunHuijben))

Loïc A. Royer (loic.royer@czbiohub.org / [Twitter/X](https://x.com/loicaroyer/))

<br/>


# Citation

If you use `inTRACKtive` in your research, please cite the following [preprint](https://www.biorxiv.org/content/10.1101/2024.10.18.618998v1):
```
@article {Huijben2024.10.18.618998,
	author = {Huijben, Teun A.P.M. and Anderson, Ashley G. and Sweet, Andrew and Hoops, Erin and Larsen, Connor and Awayan, Kyle and Bragantini, Jordao and Chiu, Chi-Li and Royer, Loic A.},
	title = {inTRACKtive - A Web-Based Tool for Interactive Cell Tracking Visualization},
	year = {2024},
	doi = {10.1101/2024.10.18.618998},
	publisher = {Cold Spring Harbor Laboratory},
	URL = {https://www.biorxiv.org/content/early/2024/10/20/2024.10.18.618998},
	journal = {bioRxiv}
}
```

<br/>
