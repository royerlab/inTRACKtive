from pathlib import Path

import numpy as np
import pandas as pd
import pytest
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


def test_convert_with_attributes_without_types(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data

    new_path = tmp_path / "sample_data_bundle.zarr"
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=['x','y'],
    )

def test_convert_with_attributes_with_types(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data

    new_path = tmp_path / "sample_data_bundle.zarr"
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=['x','y'],
        attribute_types=['continuous','continuous'],
    )

def test_convert_with_attributes_with_wrong_number_of_types(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data

    new_path = tmp_path / "sample_data_bundle.zarr"
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=['x','y'],
        attribute_types=['hex','continuous','categorical'],
    )


def test_convert_with_missing_column(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df = df.drop(columns=["x"])

    new_path = tmp_path / "sample_data_bundle.zarr"
    with pytest.raises(ValueError):
        convert_dataframe_to_zarr(
            df=df,
            zarr_path=new_path,
            extra_cols=(),
        )


def test_convert_with_non_existing_attribute(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df.attrs["non_existing_attribute"] = "test"

    new_path = tmp_path / "sample_data_bundle.zarr"

    with pytest.raises(ValueError):
        convert_dataframe_to_zarr(
            df=df,
            zarr_path=new_path,
            extra_cols=["non_existing_attribute"],
        )


def test_convert_without_parents(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df = df.drop(columns=["parent_track_id"])

    new_path = tmp_path / "sample_data_bundle.zarr"

    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=(),
    )


def test_convert_with_velocity_without_smoothing(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data

    new_path = tmp_path / "sample_data_bundle.zarr"

    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        calc_velocity=True,
    )


def test_convert_with_velocity_without_smoothing_with_extra_cols(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df["radius"] = 10

    new_path = tmp_path / "sample_data_bundle.zarr"

    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        calc_velocity=True,
        extra_cols=["radius"],
    )


def test_convert_with_velocity_with_smoothing(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data

    new_path = tmp_path / "sample_data_bundle.zarr"

    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        calc_velocity=True,
        velocity_smoothing_windowsize=3,
    )


def test_convert_with_velocity_with_smoothing_with_extra_cols(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df["radius"] = 10

    new_path = tmp_path / "sample_data_bundle.zarr"

    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        calc_velocity=True,
        velocity_smoothing_windowsize=3,
        extra_cols=["radius"],
    )


def test_convert_with_invalid_velocity_window(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    """Test that convert_dataframe_to_zarr raises ValueError for invalid velocity window sizes"""
    df = make_sample_data
    new_path = tmp_path / "sample_data_bundle.zarr"

    # Test with invalid window sizes
    with pytest.raises(ValueError, match="velocity_smoothing_windowsize must be >= 1"):
        convert_dataframe_to_zarr(
            df=df,
            zarr_path=new_path,
            calc_velocity=True,
            velocity_smoothing_windowsize=0,
        )

    with pytest.raises(ValueError, match="velocity_smoothing_windowsize must be >= 1"):
        convert_dataframe_to_zarr(
            df=df,
            zarr_path=new_path,
            calc_velocity=True,
            velocity_smoothing_windowsize=-1,
        )

    # Verify that no error is raised when calc_velocity is False
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        calc_velocity=False,
        velocity_smoothing_windowsize=0,  # Should not raise error when calc_velocity is False
    )
