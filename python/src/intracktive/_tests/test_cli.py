from pathlib import Path
from typing import List

import pandas as pd
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
            "--csv_file",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
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
            "--csv_file",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_attribute",
            "z",
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
            "--csv_file",
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
            "--csv_file",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_all_attributes",
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
            "--csv_file",
            str(tmp_path / "sample_data.csv"),
            "--out_dir",
            str(tmp_path),
            "--add_all_attributes",
            "--pre_normalized",
        ]
    )
