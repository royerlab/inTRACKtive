import webbrowser
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
import zarr
from intracktive.convert import convert_dataframe_to_zarr, dataframe_to_browser


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


def test_convert_if_zarr_file_exists(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    new_path = tmp_path / "sample_data_bundle.zarr"
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=(),
    )
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=(),
    )


def test_dataframe_to_browser_with_attributes(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data

    with patch.object(webbrowser, "open", return_value=True) as mock_browser:
        try:
            dataframe_to_browser(
                df,
                tmp_path,
                extra_cols=["x", "y"],
                attribute_types=["hex", "continuous"],
            )
            mock_browser.assert_called_once()
        except Exception as e:
            pytest.fail(f"Button click failed with error: {e}")


def test_dataframe_to_browser_with_missing_attributes(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    df = df.drop(columns=["x", "y"])

    with pytest.raises(ValueError):
        dataframe_to_browser(df, tmp_path, extra_cols=["random_column"])


def test_convert_with_attributes_without_types(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data

    new_path = tmp_path / "sample_data_bundle.zarr"
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=["x", "y"],
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
        extra_cols=["x", "y"],
        attribute_types=["continuous", "continuous"],
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
        extra_cols=["x", "y"],
        attribute_types=["hex", "continuous", "categorical"],
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


def test_convert_with_continuous_attribute(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df1 = make_sample_data
    df2 = make_sample_data.copy()
    df3 = make_sample_data.copy()

    # Modify x values to ensure uniqueness
    df2["x"] = df2["x"] + 5
    df3["x"] = df3["x"] + 10

    # Concatenate the dataframes to get 15 unique values in x (to be detected as continuous attribute)
    df = pd.concat([df1, df2, df3], ignore_index=True)

    new_path = tmp_path / "sample_data_bundle.zarr"
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
        extra_cols=["x"],
    )


def test_convert_with_parents_and_children(
    tmp_path: Path,
    make_sample_data: pd.DataFrame,
) -> None:
    df = make_sample_data
    new_rows = pd.DataFrame(
        [
            [5, 2, 50, 50, 50, 4],  # track 5 is child of 4
            [6, 2, 60, 60, 60, 5],  # track 6 is child of 5
            [7, 3, 70, 70, 70, 6],  # track 7 is child of 6
            [8, 3, 80, 80, 80, 7],  # track 8 is child of 7
        ],
        columns=["track_id", "t", "z", "y", "x", "parent_track_id"],
    )

    df = pd.concat([df, new_rows], ignore_index=True)

    # Create a new column with parent-child relationships

    new_path = tmp_path / "sample_data_bundle.zarr"
    convert_dataframe_to_zarr(
        df=df,
        zarr_path=new_path,
    )
