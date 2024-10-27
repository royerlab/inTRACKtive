from magicgui.widgets import Container, create_widget


class LaucherWidget(Container):
    def __init__(self) -> None:
        super().__init__()

        self._tracks_layer_w = create_widget(
            annotation="napari.layers.Tracks",
            label="Tracks",
        )
        self.append(self._tracks_layer_w)

        # TODO
        # ...
