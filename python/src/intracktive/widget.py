import pandas as pd

from pathlib import Path
from magicgui.widgets import Container, create_widget, PushButton, FileEdit

from intracktive.convert import dataframe_to_browser


class LauncherWidget(Container):
    def __init__(self) -> None:
        super().__init__()

        self._tracks_layer_w = create_widget(
            annotation="napari.layers.Tracks",
            label="Layer",
        )
        self.append(self._tracks_layer_w)

        self._file_dialog = FileEdit(
            name="Directory to save Zarr",
            mode = 'd',
        )
        self.append(self._file_dialog)

        self._run_btn = PushButton(
            name="Open in inTRACKtive",
        )
        self._run_btn.changed.connect(self._run_btn_click)
        self.append(self._run_btn)


    def _run_btn_click(self) -> None:
        if self._tracks_layer_w.value is None:
            print('No tracks layer selected')
            return
        
        tracks_layer = self._tracks_layer_w.value

        tracks_data = tracks_layer.data
        graph_data = tracks_layer.graph

        flag_2D = False
        if tracks_data.shape[1] == 4:
            flag_2D = True

        # Extract any properties (e.g., 'track_id') that were added to the layer
        properties = tracks_layer.properties

        # Convert to a pandas DataFrame
        if flag_2D:
            df_extracted = pd.DataFrame(tracks_data, columns=["track_id", "t", "y", "x"])
        else:
            df_extracted = pd.DataFrame(tracks_data, columns=["track_id", "t", "z", "y", "x"])

        # Add additional properties if present
        for prop_name, prop_values in properties.items():
            df_extracted[prop_name] = prop_values

        for prop_name, prop_values in properties.items():
            df_extracted[prop_name] = prop_values

        # check if graph was provided, if yes: add parent_track_id, if not: set to -1
        graph_data = {k: v[0] if isinstance(v, list) else v for k, v in graph_data.items()}
        if len(graph_data) > 0:
            print('graph used to extract parent_track_id')
            df_extracted['parent_track_id'] = df_extracted['track_id'].map(graph_data).fillna(-1).astype(int)
        else:
            print('no graph provided, set parent_track_id to -1')
            df_extracted["parent_track_id"] = -1

        dataframe_to_browser(df_extracted, self._file_dialog.value)

