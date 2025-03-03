from pathlib import Path

import numpy as np
import pandas as pd
import zarr
from intracktive.convert import convert_dataframe_to_zarr


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
            np.testing.assert_allclose(
                new[:],
                old[:],
                rtol=1e-5,
                atol=1e-8,
                err_msg=f"{key}: Content mismatch.",
            )


def test_actual_zarr_content(tmp_path: Path, make_sample_data: pd.DataFrame) -> None:
    df = make_sample_data
    df["radius"] = np.linspace(10, 18, 5)

    new_path = tmp_path / "sample_data_bundle.zarr"
    gt_path = Path(__file__).parent / "data" / "gt_data_bundle.zarr"

    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        add_radius=True,
        extra_cols=(),
    )

    new_data = zarr.open(new_path)
    gt_data = zarr.open(gt_path)

    _evaluate(new_data, gt_data)
