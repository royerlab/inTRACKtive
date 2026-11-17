from pathlib import Path
from typing import List
from unittest.mock import patch

import geff
import pandas as pd
import pytest
from click import UsageError
from click.testing import CliRunner
from geff.testing.data import create_mock_geff
from intracktive.convert import zarr_to_browser
from intracktive.main import main
from intracktive.open import open_file
from intracktive.record import QUALITY_PRESETS, record_url


def _run_command(command_and_args: List[str]) -> None:
    try:
        main(command_and_args)
    except SystemExit as exit:
        assert exit.code == 0, f"{command_and_args} failed with exit code {exit.code}"


def test_convert_cli_simple(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
        ]
    )


def test_convert_cli_without_output_path(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
        ]
    )


def test_convert_cli_single_attribute(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_attribute",
            "z",
        ]
    )


def test_convert_cli_single_hex_attribute(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_hex_attribute",
            "z",
        ]
    )


def test_convert_cli_two_types_of_attributes(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_hex_attribute",
            "z,y",
            "--add_attribute",
            "x",
        ]
    )


def test_convert_cli_multiple_attributes(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_attribute",
            "z,x,z",
        ]
    )


def test_convert_cli_all_attributes(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_all_attributes",
        ]
    )


def test_convert_cli_missing_attributes(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    with pytest.raises(ValueError):
        _run_command(
            [
                "convert",
                str(tmp_path / "sample_data.csv"),
                "--out_dir",
                str(tmp_path),
                "--add_attribute",
                "nonexisting_column_name",
            ]
        )


def test_convert_cli_invalid_format(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    invalid_file = tmp_path / "sample_data.txt"
    df.to_csv(invalid_file, index=False)

    with pytest.raises(ValueError):
        _run_command(
            [
                "convert",
                str(invalid_file),
                "--out_dir",
                str(tmp_path),
            ]
        )


def test_convert_cli_geff_file(
    tmp_path: Path,
) -> None:
    """Test conversion of GEFF files with and without attributes."""

    # Create a mock GEFF store
    node_dtype = "uint8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    extra_node_props = {"intensity": "float32", "area": "float64"}
    extra_edge_props = {"score": "float64"}
    directed = True
    num_nodes = 7
    num_edges = 16

    store, _ = create_mock_geff(
        node_dtype,
        node_prop_dtypes,
        extra_node_props=extra_node_props,
        extra_edge_props=extra_edge_props,
        directed=directed,
        num_nodes=num_nodes,
        num_edges=num_edges,
        include_z=True,
    )

    # Convert MemoryStore to disk-based Zarr store using GEFF read/write
    geff_file = tmp_path / "test.geff"
    graph, metadata = geff.read(store, backend="networkx")
    geff.write(graph, geff_file, metadata=metadata)

    # Test basic GEFF conversion without attributes
    _run_command(
        [
            "convert",
            str(geff_file),
            "--out_dir",
            str(tmp_path),
        ]
    )

    # Test GEFF conversion with all attributes
    _run_command(
        [
            "convert",
            str(geff_file),
            "--out_dir",
            str(tmp_path),
            "--add_all_attributes",
        ]
    )

    # Test GEFF conversion with specific attributes
    _run_command(
        [
            "convert",
            str(geff_file),
            "--out_dir",
            str(tmp_path),
            "--add_attribute",
            "intensity",
        ]
    )


def test_convert_cli_trackmate_xml(tmp_path: Path) -> None:
    xml_file = Path(__file__).parent / "data" / "trackmate_mini.xml"
    _run_command(["convert", str(xml_file), "--out_dir", str(tmp_path)])
    _run_command(
        [
            "convert",
            str(xml_file),
            "--out_dir",
            str(tmp_path),
            "--add_all_attributes",
            "--discard_filtered_spots",
            "--discard_filtered_tracks",
        ]
    )


def test_convert_cli_negative_coordinates(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    """Test that conversion fails when coordinates are too negative (below -9000)."""
    df = make_sample_data.copy()
    # Set some coordinates to very negative values
    df.loc[0, "x"] = -9500
    df.loc[1, "y"] = -10000
    df.loc[2, "z"] = -9200

    df.to_csv(tmp_path / "sample_data.csv", index=False)

    with pytest.raises(ValueError, match="Coordinates too negative"):
        _run_command(
            [
                "convert",
                str(tmp_path / "sample_data.csv"),
                "--out_dir",
                str(tmp_path),
            ]
        )


@pytest.mark.parametrize(
    "file_format,save_method",
    [
        ("csv", "to_csv"),
        ("parquet", "to_parquet"),
    ],
)
def test_convert_cli_simple_file_formats(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
    file_format: str,
    save_method: str,
) -> None:
    df = make_sample_data
    input_file = tmp_path / f"sample_data.{file_format}"
    getattr(df, save_method)(input_file, index=False)

    _run_command(
        [
            "convert",
            str(input_file),
            "--out_dir",
            str(tmp_path),
        ]
    )


def test_convert_cli_velocity_smoothing(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.to_csv(tmp_path / "sample_data.csv", index=False)

    _run_command(
        [
            "convert",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--calc_velocity",
            "--velocity_smoothing_windowsize",
            "3",
        ]
    )


def test_convert_cli_with_overwrite_zarr_true(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    """Test CLI with --overwrite_zarr flag."""
    df = make_sample_data
    csv_path = tmp_path / "sample_data.csv"
    df.to_csv(csv_path, index=False)

    # First conversion
    _run_command(
        [
            "convert",
            str(csv_path),
            "--out_dir",
            str(tmp_path),
        ]
    )

    # Check that the first zarr file was created
    expected_zarr_path = tmp_path / "sample_data_bundle.zarr"
    assert expected_zarr_path.exists()

    # Second conversion with overwrite flag
    _run_command(
        [
            "convert",
            str(csv_path),
            "--out_dir",
            str(tmp_path),
            "--overwrite_zarr",
        ]
    )

    # Verify that the same zarr file still exists (was overwritten)
    assert expected_zarr_path.exists()

    # Verify no additional numbered files were created
    numbered_files = list(tmp_path.glob("sample_data_bundle_*.zarr"))
    assert len(numbered_files) == 0, (
        f"Found unexpected numbered files: {numbered_files}"
    )


def test_convert_cli_with_overwrite_zarr_false(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    """Test CLI without --overwrite_zarr flag (default behavior)."""
    df = make_sample_data
    csv_path = tmp_path / "sample_data.csv"
    df.to_csv(csv_path, index=False)

    # First conversion
    _run_command(
        [
            "convert",
            str(csv_path),
            "--out_dir",
            str(tmp_path),
        ]
    )

    # Check that the first zarr file was created
    expected_zarr_path = tmp_path / "sample_data_bundle.zarr"
    assert expected_zarr_path.exists()

    # Second conversion without overwrite flag (should generate unique path)
    _run_command(
        [
            "convert",
            str(csv_path),
            "--out_dir",
            str(tmp_path),
        ]
    )

    # Verify that the original file still exists
    assert expected_zarr_path.exists()

    # Verify that a numbered file was created
    numbered_files = list(tmp_path.glob("sample_data_bundle_*.zarr"))
    assert len(numbered_files) == 1, (
        f"Expected 1 numbered file, found: {numbered_files}"
    )
    assert "sample_data_bundle_1.zarr" in str(numbered_files[0])


def test_open_cli_simple(tmp_path: Path) -> None:
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Create required folders for a valid inTRACKtive Zarr store
    required_folders = [
        "points",
        "points_to_tracks",
        "tracks_to_points",
        "tracks_to_tracks",
    ]
    for folder in required_folders:
        (zarr_path / folder).mkdir()

    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        _run_command(
            [
                "open",
                str(zarr_path),
            ]
        )

        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=zarr_path, flag_open_browser=True, threaded=False
        )


def test_open_cli_no_browser(tmp_path: Path) -> None:
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Create required folders for a valid inTRACKtive Zarr store
    required_folders = [
        "points",
        "points_to_tracks",
        "tracks_to_points",
        "tracks_to_tracks",
    ]
    for folder in required_folders:
        (zarr_path / folder).mkdir()

    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        _run_command(
            [
                "open",
                str(zarr_path),
                "--no-browser",
            ]
        )

        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=zarr_path, flag_open_browser=False, threaded=False
        )


def test_open_cli_validates_unsupported_format(tmp_path: Path) -> None:
    unsupported_path = tmp_path / "test.txt"
    unsupported_path.touch()  # Create the file so it exists

    runner = CliRunner()
    result = runner.invoke(main, ["open", str(unsupported_path)])
    assert result.exit_code == 2
    assert (
        "Unsupported file format: .txt. Only .zarr, .csv, .parquet, .xml (TrackMate/MaMuT) and GEFF files are supported."
        in result.output
    )


def test_open_cli_validates_zarr_exists(tmp_path: Path) -> None:
    zarr_path = tmp_path / "test.zarr"  # Correct extension but doesn't exist

    runner = CliRunner()
    result = runner.invoke(main, ["open", str(zarr_path)])
    assert result.exit_code == 2
    assert "does not exist" in result.output


def test_open_cli_nonexisting_zarr(tmp_path: Path) -> None:
    """Test that opening a non-existing Zarr store raises the correct error."""
    zarr_path = tmp_path / "nonexisting.zarr"

    # Ensure the path doesn't exist
    assert not zarr_path.exists()

    # Test the open_file function directly to cover the specific line
    with pytest.raises(UsageError, match=f"Zarr store does not exist: {zarr_path}"):
        open_file(input_path=zarr_path)


def test_open_cli_missing_folders(tmp_path: Path) -> None:
    """Test that opening a Zarr store with missing required folders raises the correct error."""
    zarr_path = tmp_path / "incomplete.zarr"
    zarr_path.mkdir()

    # Create only some of the required folders, missing others
    (zarr_path / "points").mkdir()
    (zarr_path / "points_to_tracks").mkdir()
    # Missing: tracks_to_points, tracks_to_tracks

    # Test the open_file function directly to cover the missing folders validation
    with pytest.raises(UsageError, match="intracktive folders are missing in the zarr"):
        open_file(input_path=zarr_path)


def test_open_cli_nonexisting_csv(tmp_path: Path) -> None:
    """Test that opening a non-existing CSV file raises the correct error."""
    csv_path = tmp_path / "nonexisting.csv"

    # Ensure the path doesn't exist
    assert not csv_path.exists()

    # Test the open_file function directly to cover the specific line
    with pytest.raises(UsageError, match=f"Input file does not exist: {csv_path}"):
        open_file(input_path=csv_path)


def test_open_cli_working_csv(tmp_path: Path, make_sample_data: pd.DataFrame) -> None:
    """Test that opening a valid CSV file successfully converts to Zarr and opens browser."""
    df = make_sample_data
    csv_path = tmp_path / "sample_data.csv"
    df.to_csv(csv_path, index=False)

    # Ensure the file exists
    assert csv_path.exists()

    # Mock the zarr_to_browser function to avoid actually opening browser
    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        result = open_file(input_path=csv_path)

        # Should return the path to the created Zarr store
        assert result.exists()
        assert result.suffix == ".zarr"

        # Should call zarr_to_browser with the created Zarr path
        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=result, flag_open_browser=True, threaded=False
        )


def test_zarr_to_browser_not_threaded_with_browser(tmp_path: Path) -> None:
    """Test zarr_to_browser when flag_open_browser=True and threaded=False."""
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Create required folders for a valid inTRACKtive Zarr store
    required_folders = [
        "points",
        "points_to_tracks",
        "tracks_to_points",
        "tracks_to_tracks",
    ]
    for folder in required_folders:
        (zarr_path / folder).mkdir()

    with (
        patch("intracktive.convert.webbrowser.open") as mock_webbrowser,
        patch("intracktive.convert.serve_directory") as mock_serve_directory,
    ):
        zarr_to_browser(zarr_path, flag_open_browser=True, threaded=False)

        # Browser should be opened exactly once
        mock_webbrowser.assert_called_once()
        # Data server + frontend server (when bundled frontend is available) = 2 calls,
        # or just 1 call when falling back to the external URL.
        assert mock_serve_directory.call_count in (1, 2)


def test_zarr_to_browser_no_browser_flag(tmp_path: Path) -> None:
    """Test zarr_to_browser when flag_open_browser=False (should return URLs)."""
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Create required folders for a valid inTRACKtive Zarr store
    required_folders = [
        "points",
        "points_to_tracks",
        "tracks_to_points",
        "tracks_to_tracks",
    ]
    for folder in required_folders:
        (zarr_path / folder).mkdir()

    with patch("intracktive.convert.serve_directory") as mock_serve_directory:
        result = zarr_to_browser(zarr_path, flag_open_browser=False, threaded=True)

        # Should return dataUrl and fullUrl when flag_open_browser=False
        assert result is not None
        assert len(result) == 2
        dataUrl, fullUrl = result
        assert isinstance(dataUrl, str)
        assert isinstance(fullUrl, str)
        # Data server + frontend server (when bundled frontend is available) = 2 calls,
        # or just 1 call when falling back to the external URL.
        assert mock_serve_directory.call_count in (1, 2)


# ---------------------------------------------------------------------------
# record_url tests
# ---------------------------------------------------------------------------

_DUMMY_URL = "https://example.com/#viewerState=%7B%22dataUrl%22%3A%22https%3A%2F%2Fexample.com%2Fdata.zarr%22%7D"


def _make_browser_mock(num_times: int = 3):
    """Return (mock_sync_playwright, mock_page, mock_download) mimicking Playwright's browser API."""
    from unittest.mock import MagicMock

    mock_download = MagicMock()
    mock_download_ctx = MagicMock()
    mock_download_ctx.__enter__ = MagicMock(return_value=mock_download_ctx)
    mock_download_ctx.__exit__ = MagicMock(return_value=False)
    mock_download_ctx.value = mock_download

    mock_page = MagicMock()
    mock_page.evaluate.side_effect = (
        lambda expr: num_times if "numTimes" in expr else None
    )
    mock_page.expect_download.return_value = mock_download_ctx

    mock_browser = MagicMock()
    mock_browser.new_page.return_value = mock_page

    mock_playwright_instance = MagicMock()
    mock_playwright_instance.chromium.launch.return_value = mock_browser

    mock_sync_playwright = MagicMock()
    mock_sync_playwright.return_value.__enter__ = MagicMock(
        return_value=mock_playwright_instance
    )
    mock_sync_playwright.return_value.__exit__ = MagicMock(return_value=False)

    return mock_sync_playwright, mock_page, mock_download


def test_record_url_invalid_quality(tmp_path: Path) -> None:
    """record_url raises UsageError for an unrecognised quality value."""
    from unittest.mock import MagicMock

    with (
        patch("intracktive.record.sync_playwright", MagicMock()),
        pytest.raises(Exception, match="quality"),
    ):
        record_url(url=_DUMMY_URL, output=tmp_path / "out.mp4", quality="ultra_hd")


def test_record_url_missing_playwright(tmp_path: Path) -> None:
    """record_url raises UsageError when playwright is not installed."""
    with (
        patch("intracktive.record.sync_playwright", None),
        pytest.raises(Exception, match="playwright"),
    ):
        record_url(url=_DUMMY_URL, output=tmp_path / "out.mp4")


def test_record_url_no_frontend(tmp_path: Path) -> None:
    """record_url raises UsageError when no bundled frontend is present."""
    from unittest.mock import MagicMock

    # Patch __file__ so the frontend path resolves to a dir without index.html.
    empty_frontend = tmp_path / "frontend"
    empty_frontend.mkdir()
    fake_record_file = tmp_path / "record.py"

    with (
        patch("intracktive.record.sync_playwright", MagicMock()),
        patch("intracktive.record.__file__", str(fake_record_file)),
        pytest.raises(Exception, match="frontend"),
    ):
        record_url(url=_DUMMY_URL, output=tmp_path / "out.mp4")


def test_record_url_start_recording_args(tmp_path: Path) -> None:
    """
    record_url calls __intracktive_startRecording with the correct fps, frameSkip,
    bitrateMbps, and filename, then saves the download to the output path.

    Skipped when no bundled frontend is installed (requires 'npm run build:python').
    """
    frontend_path = Path(__file__).parent.parent / "frontend"
    if not (frontend_path.exists() and (frontend_path / "index.html").exists()):
        pytest.skip("No bundled frontend — run 'npm run build:python' first")

    fps = 15
    skip = 2
    quality = "low"
    output = tmp_path / "out.mp4"

    mock_sync_playwright, mock_page, mock_download = _make_browser_mock(num_times=5)

    with (
        patch("intracktive.record.serve_directory"),
        patch("intracktive.record.find_available_port", return_value=8099),
        patch("intracktive.record.sync_playwright", mock_sync_playwright, create=True),
    ):
        record_url(url=_DUMMY_URL, output=output, fps=fps, skip=skip, quality=quality)

    # Find the evaluate call that triggered recording.
    recording_calls = [
        c for c in mock_page.evaluate.call_args_list if "startRecording" in str(c)
    ]
    assert len(recording_calls) == 1
    call_str = str(recording_calls[0])
    assert f"fps: {fps}" in call_str
    assert f"frameSkip: {skip}" in call_str
    assert f"bitrateMbps: {QUALITY_PRESETS[quality]}" in call_str
    assert output.name in call_str

    mock_download.save_as.assert_called_once_with(str(output))


def test_record_cli_command_registered() -> None:
    """The 'record' subcommand is registered on the CLI and exposes its options."""
    from click.testing import CliRunner as CR

    runner = CR()
    result = runner.invoke(main, ["record", "--help"])
    assert result.exit_code == 0
    assert "--fps" in result.output
    assert "--skip" in result.output
    assert "--output" in result.output
    assert "--quality" in result.output
