from pathlib import Path

import anywidget
import traitlets

# Get the directory containing this file
STATIC_DIR = Path(__file__).parent / "static"


class Widget(anywidget.AnyWidget):
    _internal_selected_tracks = traitlets.List().tag(sync=True)
    dataset_url = traitlets.Unicode(
        "https://public.czbiohub.org/royerlab/zoo/Drosophila/tracks_drosophila_attributes_bundle.zarr/"
    ).tag(sync=True)
    selected_cells = traitlets.List().tag(sync=True)

    def select_tracks(self, cell_ids):
        # Convert from 1-based (Python) to 0-based (JavaScript) indexing
        adjusted_ids = [id - 1 for id in cell_ids]
        self.selected_cells = adjusted_ids

    @property
    def get_selected_tracks(self):
        # Convert from 0-based (JavaScript) to 1-based (Python) indexing
        return [id + 1 for id in self._internal_selected_tracks]

    # Reference the static files relative to this package
    _esm = str(STATIC_DIR / "widget.js")
    _css = str(STATIC_DIR / "widget.css")
