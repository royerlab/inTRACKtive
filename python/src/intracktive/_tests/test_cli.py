from pathlib import Path
from typing import List
from unittest.mock import patch

import pandas as pd
import pytest
from click.testing import CliRunner
from intracktive.main import main


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


def test_convert_cli_all_attributes_prenormalized(
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
            "--pre_normalized",
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


def test_open_cli_simple(tmp_path: Path) -> None:
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        _run_command(
            [
                "open",
                str(zarr_path),
            ]
        )

        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=zarr_path, flag_open_browser=True, threaded=False, csv_path=None
        )


def test_open_cli_no_browser(tmp_path: Path) -> None:
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        _run_command(
            [
                "open",
                str(zarr_path),
                "--no-browser",
            ]
        )

        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=zarr_path, flag_open_browser=False, threaded=False, csv_path=None
        )


def test_open_cli_validates_zarr_extension(tmp_path: Path) -> None:
    non_zarr_path = tmp_path / "test.txt"
    non_zarr_path.touch()  # Create the file so it exists

    runner = CliRunner()
    result = runner.invoke(main, ["open", str(non_zarr_path)])
    assert result.exit_code == 2
    assert "Path must end in .zarr" in result.output


def test_open_cli_validates_zarr_exists(tmp_path: Path) -> None:
    zarr_path = tmp_path / "test.zarr"  # Correct extension but doesn't exist

    runner = CliRunner()
    result = runner.invoke(main, ["open", str(zarr_path)])
    assert result.exit_code == 2
    assert "does not exist" in result.output


def test_open_cli_with_csv_simple(
    tmp_path: Path, make_sample_data: pd.DataFrame
) -> None:
    """Test opening a zarr file with a simple CSV file containing selected cells."""
    # Create a zarr file first
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Create a simple CSV file with the required columns
    csv_data = pd.DataFrame(
        {
            "track_id": [1, 2],
            "parent_track_id": [-1, 1],
            "t": [0, 1],
            "z": [10, 20],
            "y": [20, 40],
            "x": [30, 60],
        }
    )
    csv_path = tmp_path / "selected_cells.csv"
    csv_data.to_csv(csv_path, index=False)

    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        _run_command(
            [
                "open",
                str(zarr_path),
                "--csv-path",
                str(csv_path),
            ]
        )

        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=zarr_path,
            flag_open_browser=True,
            threaded=False,
            csv_path=csv_path,
        )


def test_open_cli_with_csv_no_browser(
    tmp_path: Path, make_sample_data: pd.DataFrame
) -> None:
    """Test opening a zarr file with CSV but without opening browser."""
    # Create a zarr file first
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Create a simple CSV file with the required columns
    csv_data = pd.DataFrame(
        {
            "track_id": [1],
            "parent_track_id": [-1],
            "t": [0],
            "z": [10],
            "y": [20],
            "x": [30],
        }
    )
    csv_path = tmp_path / "selected_cells.csv"
    csv_data.to_csv(csv_path, index=False)

    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        _run_command(
            [
                "open",
                str(zarr_path),
                "--csv-path",
                str(csv_path),
                "--no-browser",
            ]
        )

        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=zarr_path,
            flag_open_browser=False,
            threaded=False,
            csv_path=csv_path,
        )


def test_open_cli_with_csv_missing_columns(tmp_path: Path) -> None:
    """Test that open command fails when CSV file is missing required columns."""
    # Create a zarr file first
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Create a CSV file missing required columns
    csv_data = pd.DataFrame(
        {
            "track_id": [1],
            "t": [0],
            "z": [10],
            "y": [20],
            "x": [30],
            # Missing parent_track_id
        }
    )
    csv_path = tmp_path / "invalid_cells.csv"
    csv_data.to_csv(csv_path, index=False)

    # Test the actual CSV validation logic directly
    from intracktive.convert import get_selected_cells_and_max_points

    with pytest.raises(
        ValueError, match="does not have the columns track_id and parent_track_id"
    ):
        get_selected_cells_and_max_points(csv_path, zarr_path)


def test_open_cli_with_nonexistent_csv(tmp_path: Path) -> None:
    """Test that open command fails when CSV file doesn't exist."""
    # Create a zarr file first
    zarr_path = tmp_path / "test.zarr"
    zarr_path.mkdir()

    # Use a non-existent CSV path
    csv_path = tmp_path / "nonexistent.csv"

    runner = CliRunner()
    result = runner.invoke(main, ["open", str(zarr_path), "--csv-path", str(csv_path)])
    assert result.exit_code == 2
    assert "does not exist" in result.output


def test_open_cli_integration_with_real_zarr(
    tmp_path: Path, make_sample_data: pd.DataFrame
) -> None:
    """Integration test that actually creates a zarr file and tests the open command."""
    # Create a real zarr file from sample data
    df = make_sample_data
    zarr_path = tmp_path / "test.zarr"

    from intracktive.convert import convert_dataframe_to_zarr

    convert_dataframe_to_zarr(df=df, zarr_path=zarr_path)

    # Create a CSV file with selected cells
    csv_data = pd.DataFrame(
        {
            "track_id": [1, 2],
            "parent_track_id": [-1, 1],
            "t": [0, 1],
            "z": [10, 20],
            "y": [20, 40],
            "x": [30, 60],
        }
    )
    csv_path = tmp_path / "selected_cells.csv"
    csv_data.to_csv(csv_path, index=False)

    # Test with --no-browser to avoid actually opening browser
    with patch("intracktive.open.zarr_to_browser") as mock_zarr_to_browser:
        _run_command(
            [
                "open",
                str(zarr_path),
                "--csv-path",
                str(csv_path),
                "--no-browser",
            ]
        )

        mock_zarr_to_browser.assert_called_once_with(
            zarr_path=zarr_path,
            flag_open_browser=False,
            threaded=False,
            csv_path=csv_path,
        )


def test_zarr_to_browser_integration(
    tmp_path: Path, make_sample_data: pd.DataFrame
) -> None:
    """Integration test for zarr_to_browser function with real data."""
    # Create a real zarr file from sample data
    df = make_sample_data
    zarr_path = tmp_path / "test.zarr"

    from intracktive.convert import convert_dataframe_to_zarr, zarr_to_browser

    convert_dataframe_to_zarr(df=df, zarr_path=zarr_path)

    # Create a CSV file with selected cells
    csv_data = pd.DataFrame(
        {
            "track_id": [1, 2],
            "parent_track_id": [-1, 1],
            "t": [0, 1],
            "z": [10, 20],
            "y": [20, 40],
            "x": [30, 60],
        }
    )
    csv_path = tmp_path / "selected_cells.csv"
    csv_data.to_csv(csv_path, index=False)

    # Mock webbrowser to avoid actually opening browser
    with patch("webbrowser.open") as mock_browser:
        # Mock the server to avoid actually starting it
        with patch("intracktive.convert.serve_directory") as mock_server:
            result = zarr_to_browser(
                zarr_path=zarr_path,
                csv_path=csv_path,
                flag_open_browser=True,
                threaded=False,
            )

            # Should return None when flag_open_browser is True
            assert result is None

            # Check that browser was called
            mock_browser.assert_called_once()

            # Check that server was called
            mock_server.assert_called_once()


def test_zarr_to_browser_integration_no_browser(
    tmp_path: Path, make_sample_data: pd.DataFrame
) -> None:
    """Integration test for zarr_to_browser function with flag_open_browser=False."""
    # Create a real zarr file from sample data
    df = make_sample_data
    zarr_path = tmp_path / "test.zarr"

    from intracktive.convert import convert_dataframe_to_zarr, zarr_to_browser

    convert_dataframe_to_zarr(df=df, zarr_path=zarr_path)

    # Mock the server to avoid actually starting it
    with patch("intracktive.convert.serve_directory") as mock_server:
        result = zarr_to_browser(
            zarr_path=zarr_path, csv_path=None, flag_open_browser=False, threaded=False
        )

        # Should return URLs when flag_open_browser is False
        assert result is not None
        assert len(result) == 2
        data_url, full_url = result
        assert isinstance(data_url, str)
        assert isinstance(full_url, str)
        assert "http://" in data_url
        assert "https://intracktive.sf.czbiohub.org" in full_url

        # Check that server was called
        mock_server.assert_called_once()


def test_zarr_to_browser_integration_with_csv_processing(
    tmp_path: Path, make_sample_data: pd.DataFrame
) -> None:
    """Integration test that exercises the CSV processing logic in zarr_to_browser."""
    # Create a real zarr file from sample data
    df = make_sample_data
    zarr_path = tmp_path / "test.zarr"

    from intracktive.convert import convert_dataframe_to_zarr, zarr_to_browser

    convert_dataframe_to_zarr(df=df, zarr_path=zarr_path)

    # Create a CSV file with selected cells that will trigger the CSV processing
    csv_data = pd.DataFrame(
        {
            "track_id": [1, 2, 3, 4],
            "parent_track_id": [-1, 1, 1, -1],
            "t": [0, 1, 1, 0],
            "z": [10, 20, 60, 31],
            "y": [20, 40, 30, 32],
            "x": [30, 60, 90, 33],
        }
    )
    csv_path = tmp_path / "selected_cells.csv"
    csv_data.to_csv(csv_path, index=False)

    # Mock server to avoid actually starting it
    with patch("intracktive.convert.serve_directory") as mock_server:
        result = zarr_to_browser(
            zarr_path=zarr_path,
            csv_path=csv_path,
            flag_open_browser=False,
            threaded=False,
        )

        # Should return URLs
        assert result is not None
        data_url, full_url = result

        # The full URL should contain the hash with selected cells
        assert "viewerState=" in full_url

        # Check that server was called
        mock_server.assert_called_once()
