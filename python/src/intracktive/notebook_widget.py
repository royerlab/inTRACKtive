from pathlib import Path

import anywidget
import traitlets

# Get the directory containing this file
STATIC_DIR = Path(__file__).parent / "static"


class Widget(anywidget.AnyWidget):
    get_selected_tracks = traitlets.List().tag(sync=True)
    dataset_url = traitlets.Unicode(
        "https://public.czbiohub.org/royerlab/zoo/Drosophila/tracks_drosophila_attributes_bundle.zarr/"
    ).tag(sync=True)
    selected_cells = traitlets.List().tag(sync=True)

    def select_tracks(self, cell_ids):
        self.selected_cells = cell_ids

    # Reference the static files relative to this package
    _esm = str(STATIC_DIR / "widget.js")
    _css = str(STATIC_DIR / "widget.css")
