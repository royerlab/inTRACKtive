import webbrowser
from typing import Callable
from unittest.mock import patch

import napari
import pytest
from intracktive._tests.test_convert import make_sample_data
from intracktive.widget import LauncherWidget


def test_intracktive_widget_2D(
    make_napari_viewer: Callable[[], napari.Viewer],
    request,
):
    df = make_sample_data()
    filtered_df = df[df["parent_track_id"] != -1]
    graph = dict(zip(filtered_df["track_id"], filtered_df["parent_track_id"]))

    viewer = make_napari_viewer()
    widget = LauncherWidget()
    viewer.window.add_dock_widget(widget)
    viewer.add_tracks(df[["track_id", "t", "y", "x"]], graph=graph, name="Tracks")

    assert "Tracks" in viewer.layers

    assert widget._tracks_layer_w.value is not None
    assert str(widget._file_dialog.value) == "."

    # Attempt to simulate the "run" button click and catch errors
    with patch.object(webbrowser, "open", return_value=True) as mock_browser:
        try:
            widget._run_btn_click()
            mock_browser.assert_called_once()
        except Exception as e:
            pytest.fail(f"Button click failed with error: {e}")

    if request.config.getoption("--show-napari-viewer"):
        napari.run()


def test_intracktive_widget_2D_withoutGraph(
    make_napari_viewer: Callable[[], napari.Viewer],
    request,
):
    df = make_sample_data()

    viewer = make_napari_viewer()
    widget = LauncherWidget()
    viewer.window.add_dock_widget(widget)
    viewer.add_tracks(df[["track_id", "t", "y", "x"]], name="Tracks")

    assert "Tracks" in viewer.layers

    assert widget._tracks_layer_w.value is not None
    assert str(widget._file_dialog.value) == "."

    # Attempt to simulate the "run" button click and catch errors
    with patch.object(webbrowser, "open", return_value=True) as mock_browser:
        try:
            widget._run_btn_click()
            mock_browser.assert_called_once()
        except Exception as e:
            pytest.fail(f"Button click failed with error: {e}")

    if request.config.getoption("--show-napari-viewer"):
        napari.run()


def test_intracktive_widget_3D(
    make_napari_viewer: Callable[[], napari.Viewer],
    request,
):
    df = make_sample_data()
    filtered_df = df[df["parent_track_id"] != -1]
    graph = dict(zip(filtered_df["track_id"], filtered_df["parent_track_id"]))

    viewer = make_napari_viewer()
    widget = LauncherWidget()
    viewer.window.add_dock_widget(widget)
    viewer.add_tracks(df[["track_id", "t", "z", "y", "x"]], graph=graph, name="Tracks")

    assert "Tracks" in viewer.layers

    assert widget._tracks_layer_w.value is not None
    assert str(widget._file_dialog.value) == "."

    # Attempt to simulate the "run" button click and catch errors
    with patch.object(webbrowser, "open", return_value=True) as mock_browser:
        try:
            widget._run_btn_click()
            mock_browser.assert_called_once()
        except Exception as e:
            pytest.fail(f"Button click failed with error: {e}")

    if request.config.getoption("--show-napari-viewer"):
        napari.run()


def test_intracktive_widget_noTracksLayer(
    make_napari_viewer: Callable[[], napari.Viewer],
    request,
):
    viewer = make_napari_viewer()
    widget = LauncherWidget()
    viewer.window.add_dock_widget(widget)

    assert widget._tracks_layer_w.value is None
    assert str(widget._file_dialog.value) == "."

    # Attempt to simulate the "run" button click and catch errors
    with patch.object(webbrowser, "open", return_value=True) as mock_browser:
        try:
            widget._run_btn_click()
            mock_browser.assert_called_once()
        except Exception as e:
            pytest.fail(f"Button click failed with error: {e}")

    if request.config.getoption("--show-napari-viewer"):
        napari.run()
