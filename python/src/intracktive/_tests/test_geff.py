from pathlib import Path

import geff
import numpy as np
import pandas as pd
import pytest
import zarr
from geff.core_io._base_write import write_dicts
from geff.testing.data import (
    create_mock_geff,
    create_simple_2d_geff,
    create_simple_3d_geff,
)
from geff_spec import GeffMetadata
from intracktive.convert import convert_dataframe_to_zarr, convert_file
from intracktive.geff import is_geff_dataset, read_geff_to_df
from pydantic import ValidationError


@pytest.mark.parametrize("include_z", [False, True])
def test_read_geff_to_df(include_z):
    """Create a minimal geff file for testing convert function."""

    if include_z:
        store, _ = create_simple_3d_geff(directed=True)
    else:
        store, _ = create_simple_2d_geff(directed=True)
    assert is_geff_dataset(store)

    df = read_geff_to_df(store)

    assert "t" in df.columns
    if not include_z:
        assert "z" not in df.columns
    else:
        assert "z" in df.columns
    assert "y" in df.columns
    assert "x" in df.columns
    assert "track_id" in df.columns
    assert "parent_track_id" in df.columns
    assert len(df.columns) == 5 if not include_z else 6

    print("✅ DataFrame is correct!")


@pytest.mark.parametrize("include_all_attributes", [False, True])
def test_read_geff_to_df_with_attributes(include_all_attributes):
    """Test that read_geff_to_df can load all attributes when requested."""

    node_dtype = "uint8"
    # Basic node properties (spatial and temporal axes)
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Extra node properties for testing
    extra_node_props = {"intensity": "float32", "area": "float64", "type": "int8"}
    extra_edge_props = {"score": "float64", "color": "uint8"}
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

    assert is_geff_dataset(store)

    # Test loading all attributes
    df = read_geff_to_df(store, include_all_attributes=include_all_attributes)

    # Should have required columns plus all available attributes
    required_cols = ["track_id", "t", "z", "y", "x", "parent_track_id"]
    if include_all_attributes:
        expected_extra_cols = ["intensity", "area", "type"]
    else:
        expected_extra_cols = []
    expected_cols = required_cols + expected_extra_cols

    for col in expected_cols:
        assert col in df.columns, f"Expected column {col} not found"

    print("✅ Loading all attributes works correctly!")


def test_is_geff_dataset_exception_handling():
    """Test that is_geff_dataset handles exceptions gracefully."""
    # Test with None (should raise exception and return False)
    assert not is_geff_dataset(None)

    # Test with invalid store that doesn't have required attributes
    class InvalidStore:
        def __getitem__(self, key):
            raise KeyError("Invalid store")

    assert not is_geff_dataset(InvalidStore())


def test_convert_file_with_nonexisting_file_with_geff_extension(tmp_path):
    """Test that convert_file raises error when file doesn't exist and has .geff extension."""
    with pytest.raises(
        ValueError, match="File .* has .geff extension but is not a valid GEFF dataset"
    ):
        convert_file(input_file=tmp_path / "nonexisting.geff")


def test_trackmate_geff(tmp_path):
    path_tm_geff = Path(__file__).parent / "data" / "trackmate_example.geff"

    df = read_geff_to_df(path_tm_geff, include_all_attributes=True)

    convert_file(input_file=path_tm_geff, out_dir=tmp_path, add_all_attributes=True)

    expected_columns = {
        "track_id",
        "t",
        "y",
        "x",
        "parent_track_id",
        "z",
        "radius",
    }
    msg = f"Expected columns {expected_columns}, got {set(df.columns)}"
    assert set(df.columns) == expected_columns, msg
    assert df.shape == (77, 7)


def test_read_geff_to_df_no_axes_metadata():
    """Test that read_geff_to_df raises error when no axes found in metadata."""

    # Create a simple zarr store without proper GEFF structure
    store = zarr.storage.MemoryStore()
    group = zarr.open_group(store, mode="w")

    # Add minimal GEFF metadata without axes
    group.attrs["geff"] = {
        "version": "1.0.0",
        "directed": True,
        "axis_names": ["t", "x", "y"],
        "axis_units": ["second", "nanometer", "nanometer"],
        "axis_types": ["time", "space", "space"],
        # No axes field - this should trigger a validation error
    }

    with pytest.raises(ValidationError):
        read_geff_to_df(store)


def test_read_geff_to_df_invalid_spatial_axes():
    """Test that read_geff_to_df raises error for invalid spatial axes count."""

    # Test with only 1 spatial axis (should fail)
    store_1 = zarr.storage.MemoryStore()
    axes_1 = [
        {"name": "x", "type": "space", "unit": "nanometer"},  # Only 1 spatial axis
    ]
    meta_1 = GeffMetadata(
        geff_version="0.3.0",
        directed=True,
        axes=axes_1,
        node_props_metadata={},
        edge_props_metadata={},
    )

    node_data_1 = [(float(node), {"x": 10}) for node in range(10)]
    write_dicts(store_1, node_data_1, [], ["x"], [], metadata=meta_1)

    with pytest.raises(ValueError, match="Expected 2 or 3 spatial axes, got 1"):
        read_geff_to_df(store_1)

    # Test with 4 spatial axes (should fail)
    store_4 = zarr.storage.MemoryStore()
    axes_4 = [
        {"name": "t", "type": "time", "unit": "second"},
        {"name": "x", "type": "space", "unit": "nanometer"},
        {"name": "y", "type": "space", "unit": "nanometer"},
        {"name": "z", "type": "space", "unit": "nanometer"},
        {"name": "w", "type": "space", "unit": "nanometer"},  # 4th spatial axis
    ]
    meta_4 = GeffMetadata(
        geff_version="0.3.0",
        directed=True,
        axes=axes_4,
        node_props_metadata={},
        edge_props_metadata={},
    )
    node_data_4 = [
        (float(node), {"t": 5, "x": 10, "y": 15, "z": 20, "w": 25})
        for node in range(10)
    ]
    write_dicts(
        store_4, node_data_4, [], ["t", "x", "y", "z", "w"], [], metadata=meta_4
    )

    with pytest.raises(ValueError, match="Expected 2 or 3 spatial axes, got 4"):
        read_geff_to_df(store_4)


def test_read_geff_to_df_no_temporal_axis():
    """Test that read_geff_to_df raises error when no temporal axis found."""

    # Create a GEFF store with no temporal axis (only spatial axes)
    store = zarr.storage.MemoryStore()
    axes = [
        {"name": "x", "type": "space", "unit": "nanometer"},
        {"name": "y", "type": "space", "unit": "nanometer"},
        {"name": "z", "type": "space", "unit": "nanometer"},
    ]
    meta = GeffMetadata(
        geff_version="0.3.0",
        directed=True,
        axes=axes,
        node_props_metadata={},
        edge_props_metadata={},
    )

    node_data = [(float(node), {"x": 10, "y": 15, "z": 20}) for node in range(10)]
    write_dicts(store, node_data, [], ["x", "y", "z"], [], metadata=meta)

    with pytest.raises(ValueError, match="No temporal axis found in metadata"):
        read_geff_to_df(store)


def test_read_geff_to_df_non_numerical_dtype():
    """Test that read_geff_to_df handles non-numerical dtypes with warning."""

    # Create a GEFF store with string properties
    node_dtype = "uint8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    extra_node_props = {"label": "str"}  # String dtype
    extra_edge_props = {"score": "float64"}
    directed = True
    num_nodes = 7
    num_edges = 16

    store, _ = create_mock_geff(
        node_id_dtype=node_dtype,
        node_axis_dtypes=node_prop_dtypes,
        extra_node_props=extra_node_props,
        extra_edge_props=extra_edge_props,
        directed=directed,
        num_nodes=num_nodes,
        num_edges=num_edges,
        include_z=True,
    )

    # This should not raise an error but should log a warning
    df = read_geff_to_df(store, include_all_attributes=True)

    # The string property should not be included in the DataFrame
    assert "label" not in df.columns


def test_read_geff_to_df_with_nan_values():
    """Test that read_geff_to_df handles NaN values correctly."""

    # Create a GEFF store with NaN values
    node_dtype = "uint8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Create property with NaN values
    num_nodes = 7
    nan_property = np.array([1.0, 2.0, np.nan, 4.0, 5.0, np.nan, 7.0], dtype=np.float32)
    extra_node_props = {"intensity": nan_property}
    extra_edge_props = {"score": "float64"}
    directed = True
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

    # This should not raise an error but should log a warning and skip the property
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property with NaN values should not be included in the DataFrame
    assert "intensity" not in df.columns


def test_read_geff_to_df_with_inf_values():
    """Test that read_geff_to_df handles infinite values correctly."""

    # Create a GEFF store with infinite values
    node_dtype = "uint8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Create property with infinite values
    num_nodes = 7
    inf_property = np.array(
        [1.0, 2.0, np.inf, 4.0, 5.0, -np.inf, 7.0], dtype=np.float32
    )
    extra_node_props = {"intensity": inf_property}
    extra_edge_props = {"score": "float64"}
    directed = True
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

    # read_geff_to_df should include the property with infinite values as-is
    # The infinite value handling now happens in convert_dataframe_to_zarr
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property should be included with original values (including inf)
    assert "intensity" in df.columns

    # Check that infinite values are preserved in the DataFrame
    intensity_values = df["intensity"].values
    assert np.any(np.isinf(intensity_values))

    # Check that finite values are preserved
    finite_mask = np.isfinite(intensity_values)
    assert np.all(intensity_values[finite_mask] == [1.0, 2.0, 4.0, 5.0, 7.0])


def test_read_geff_to_df_with_all_inf_values():
    """Test that read_geff_to_df handles all infinite values correctly."""

    # Create a GEFF store with all infinite values
    node_dtype = "uint8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Create property with all infinite values
    num_nodes = 7
    all_inf_property = np.array(
        [np.inf, np.inf, np.inf, np.inf, np.inf, np.inf, np.inf], dtype=np.float32
    )
    extra_node_props = {"intensity": all_inf_property}
    extra_edge_props = {"score": "float64"}
    directed = True
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

    # read_geff_to_df should include the property with all infinite values as-is
    # The infinite value handling now happens in convert_dataframe_to_zarr
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property should be included with all infinite values
    assert "intensity" in df.columns

    # Check that all values are infinite
    intensity_values = df["intensity"].values
    assert np.all(np.isinf(intensity_values))


def test_read_geff_to_df_with_constant_values():
    """Test that read_geff_to_df handles constant values correctly."""

    # Create a GEFF store with constant values
    node_dtype = "uint8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Create property with constant values
    num_nodes = 7
    constant_property = np.array([5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0], dtype=np.float32)
    extra_node_props = {"intensity": constant_property}
    extra_edge_props = {"score": "float64"}
    directed = True
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

    # read_geff_to_df should include the property with constant values as-is
    # The normalization now happens in convert_dataframe_to_zarr
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property should be included
    assert "intensity" in df.columns

    # Check that all values are preserved as the original constant value
    intensity_values = df["intensity"].values
    assert np.all(intensity_values == 5.0)


def test_read_geff_to_df_missing_geff_version():
    """Test that read_geff_to_df raises error when geff version is missing."""

    # Create a minimal zarr store
    store = zarr.storage.MemoryStore()
    group = zarr.open_group(store, mode="w")

    # Create a store with metadata that has no geff version
    group.attrs["geff"] = {
        "directed": True,
        "axis_names": ["t", "x", "y", "z", "w"],  # 4 spatial axes
        "axes": [
            {"name": "t", "type": "time", "unit": "second"},
            {"name": "x", "type": "space", "unit": "nanometer"},
            {"name": "y", "type": "space", "unit": "nanometer"},
            {"name": "z", "type": "space", "unit": "nanometer"},
        ],
    }

    assert not is_geff_dataset(store)


def test_convert_geff_dataset_without_extension(tmp_path):
    """Test converting a GEFF dataset that doesn't have a .geff extension."""

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

    # # Save the GEFF store to disk without .geff extension
    graph, metadata = geff.read(store, backend="networkx")
    geff_path = tmp_path / "test_geff_data"
    geff.write(graph, geff_path, metadata=metadata)

    # Test conversion with attributes
    zarr_path = convert_file(
        input_file=geff_path,
        out_dir=tmp_path / "test.zarr",
        add_all_attributes=True,
    )

    # Verify the conversion worked
    assert zarr_path.exists()
    assert zarr_path.suffix == ".zarr"

    print("✅ GEFF dataset conversion without .geff extension works correctly!")


def test_convert_dataframe_to_zarr_with_nan_values(tmp_path):
    """Test that convert_dataframe_to_zarr handles NaN values correctly in normalization."""

    # Create a GEFF store with NaN values
    node_dtype = "uint8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Create property with NaN values - use dtype string, not actual array
    num_nodes = 7
    nan_property = np.array([1.0, 2.0, np.nan, 4.0, 5.0, np.nan, 7.0], dtype=np.float32)
    extra_node_props = {"intensity": nan_property}
    extra_edge_props = {"score": "float64"}
    directed = True
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

    # Read the GEFF data into a DataFrame
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property with NaN values should NOT be included in the DataFrame
    # because read_geff_to_df skips properties with NaN values
    assert "intensity" not in df.columns

    # Create a simple DataFrame with NaN values to test the normalization logic directly
    # All points at the same time to ensure all data is preserved
    test_df = pd.DataFrame(
        {
            "track_id": [1, 2, 3, 4, 5, 6, 7],
            "t": [0, 0, 0, 0, 0, 0, 0],  # All at same time point
            "z": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            "y": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0],
            "x": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0],
            "parent_track_id": [-1, -1, -1, -1, -1, -1, -1],
            "intensity": [1.0, 2.0, np.nan, 4.0, 5.0, np.nan, 7.0],
        }
    )

    # Convert to Zarr using convert_dataframe_to_zarr
    zarr_path = tmp_path / "test_nan_values.zarr"
    convert_dataframe_to_zarr(
        df=test_df,
        zarr_path=zarr_path,
        extra_cols=["intensity"],
        attribute_types=["continuous"],
    )

    # Load the Zarr data and check the normalization
    zarr_group = zarr.open(zarr_path)
    assert "attributes" in zarr_group

    # Check that the attribute was normalized correctly
    attributes = zarr_group["attributes"][:]
    attribute_names = zarr_group["attributes"].attrs["attribute_names"]
    attribute_types = zarr_group["attributes"].attrs["attribute_types"]

    assert "intensity" in attribute_names
    assert "continuous" in attribute_types

    # Get the intensity values from the attributes array
    intensity_idx = attribute_names.index("intensity")
    intensity_values = attributes[intensity_idx, :]

    # With the new normalization logic:
    # - NaN values are set to 0.0 before normalization
    # - Then all values are normalized together
    # - Original finite values: [1.0, 2.0, 4.0, 5.0, 7.0] + NaN→0.0
    # - After replacement: [1.0, 2.0, 0.0, 4.0, 5.0, 0.0, 7.0]
    # - Normalized: (value - 0.0) / (7.0 - 0.0) = value / 7.0
    expected_normalized = np.array([1 / 7, 2 / 7, 0 / 7, 4 / 7, 5 / 7, 0 / 7, 7 / 7])
    np.testing.assert_allclose(intensity_values, expected_normalized, rtol=1e-5)

    # Check that all values are in [0, 1] range
    assert np.all(intensity_values >= 0)
    assert np.all(intensity_values <= 1)

    print("✅ convert_dataframe_to_zarr handles NaN values correctly!")
