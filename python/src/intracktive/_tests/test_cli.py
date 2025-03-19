from pathlib import Path
from typing import List

import pandas as pd
import pytest
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
            "--input_file",
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
            "--input_file",
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
            "--input_file",
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
            "--input_file",
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
            "--input_file",
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
            "--input_file",
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
            "--input_file",
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
                "--input_file",
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
            "--input_file",
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
                "--input_file",
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
            "--input_file",
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
            "--input_file",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--calc_velocity",
            "--velocity_smoothing_windowsize",
            "3",
        ]
    )
