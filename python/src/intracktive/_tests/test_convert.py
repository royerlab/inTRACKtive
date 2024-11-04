import subprocess
from pathlib import Path

import numpy as np
import pandas as pd
import zarr
from intracktive.convert import convert_dataframe


def _evaluate(new_group: zarr.Group, old_group: zarr.Group) -> None:
    assert new_group.keys() == old_group.keys()

    for key in new_group.keys():
        new = new_group[key]
        old = old_group[key]

        assert new.attrs == old.attrs

        if isinstance(new, zarr.Group):
            _evaluate(new, old)
        else:
            print(f"{key}: new {new.shape} old {old.shape}")
            assert new.shape == old.shape, f"{key}: {new.shape} != {old.shape}"
            assert new.dtype == old.dtype, f"{key}: {new.dtype} != {old.dtype}"
            # TODO: check content


def test_new_conversion(tmp_path: Path) -> None:
    # might change in the future, smaller than zebrahub data
    sample_data_url = "https://public.czbiohub.org/royerlab/ultrack/multi-color-cytoplasm-sparse-tracks.csv"

    rng = np.random.default_rng(0)

    df = pd.read_csv(sample_data_url)
    df["radius"] = rng.uniform(1, 5, size=len(df))
    df.loc[df["parent_track_id"] == 0, "parent_track_id"] = -1

    df.to_csv(tmp_path / "sample_data.csv", index=False)

    new_path = tmp_path / "sample_data_bundle.zarr"
    old_path = tmp_path / "sample_data_bundle_OLD.zarr"

    convert_dataframe(
        df=df,
        out_path=new_path,
        extra_cols=["radius"],
    )

    print("\n\n-------------\n")

    old_cmd_path = Path(__file__).parent.parent / "convert_OLD.py"

    cplt_process = subprocess.run(
        [
            "python",
            str(old_cmd_path),
            str(tmp_path / "sample_data.csv"),
            str(old_path.parent),
            "--add_radius",
        ]
    )
    assert cplt_process.returncode == 0

    new_data = zarr.open(new_path)
    old_data = zarr.open(old_path)

    _evaluate(new_data, old_data)
