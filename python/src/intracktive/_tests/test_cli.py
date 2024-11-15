import pytest

from typing import List
from pathlib import Path
import pandas as pd
from intracktive.main import main

def _run_command(command_and_args: List[str]) -> None:
    try:
        main(command_and_args)
    except SystemExit as exit:
        assert exit.code == 0, f"{command_and_args} failed with exit code {exit.code}"

def test_convert_cli(
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
            str(tmp_path),]
    )