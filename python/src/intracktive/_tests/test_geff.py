import pytest
from geff.testing.data import create_memory_mock_geff
from intracktive.geff import is_geff_dataset, read_geff_to_df


@pytest.mark.parametrize("include_z", [False, True])
def test_read_geff_to_df(include_z):
    """Create a minimal geff file for testing convert function."""

    node_dtype = "int8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    extra_edge_props = {"score": "float64", "color": "uint8"}
    directed = True
    num_nodes = 7
    num_edges = 16

    store, _ = create_memory_mock_geff(
        node_dtype,
        node_prop_dtypes,
        extra_edge_props=extra_edge_props,
        directed=directed,
        num_nodes=num_nodes,
        num_edges=num_edges,
        include_z=include_z,
    )

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

    node_dtype = "int8"
    # Basic node properties (spatial and temporal axes)
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Extra node properties for testing
    extra_node_props = {"intensity": "float32", "area": "float64", "type": "int8"}
    extra_edge_props = {"score": "float64", "color": "uint8"}
    directed = True
    num_nodes = 7
    num_edges = 16

    store, _ = create_memory_mock_geff(
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


def test_read_geff_to_df_no_axes_metadata():
    """Test that read_geff_to_df raises error when no axes found in metadata."""
    import zarr

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
        # No axes field - this should trigger the error
    }

    with pytest.raises(ValueError, match="No axes found in metadata"):
        read_geff_to_df(store)


def test_read_geff_to_df_invalid_spatial_axes():
    """Test that read_geff_to_df raises error for invalid spatial axes count."""
    import zarr

    # Test with only 1 spatial axis (should fail)
    store_1 = zarr.storage.MemoryStore()
    group_1 = zarr.open_group(store_1, mode="w")
    group_1.attrs["geff"] = {
        "version": "1.0.0",
        "directed": True,
        "axis_names": ["t", "x"],  # Only 1 spatial axis
        "axis_units": ["second", "nanometer"],
        "axis_types": ["time", "space"],
        "axes": [
            {"name": "t", "type": "time", "unit": "second"},
            {"name": "x", "type": "space", "unit": "nanometer"},  # Only 1 spatial axis
        ],
    }

    with pytest.raises(ValueError, match="Expected 2 or 3 spatial axes, got 1"):
        read_geff_to_df(store_1)

    # Test with 4 spatial axes (should fail)
    store_4 = zarr.storage.MemoryStore()
    group_4 = zarr.open_group(store_4, mode="w")
    group_4.attrs["geff"] = {
        "version": "1.0.0",
        "directed": True,
        "axis_names": ["t", "x", "y", "z", "w"],  # 4 spatial axes
        "axis_units": ["second", "nanometer", "nanometer", "nanometer", "nanometer"],
        "axis_types": ["time", "space", "space", "space", "space"],
        "axes": [
            {"name": "t", "type": "time", "unit": "second"},
            {"name": "x", "type": "space", "unit": "nanometer"},
            {"name": "y", "type": "space", "unit": "nanometer"},
            {"name": "z", "type": "space", "unit": "nanometer"},
            {"name": "w", "type": "space", "unit": "nanometer"},  # 4th spatial axis
        ],
    }

    with pytest.raises(ValueError, match="Expected 2 or 3 spatial axes, got 4"):
        read_geff_to_df(store_4)


def test_read_geff_to_df_no_temporal_axis():
    """Test that read_geff_to_df raises error when no temporal axis found."""
    import zarr

    # Create a minimal zarr store
    store = zarr.storage.MemoryStore()
    group = zarr.open_group(store, mode="w")

    # Create a store with metadata that has no temporal axis
    group.attrs["geff"] = {
        "version": "1.0.0",
        "directed": True,
        "axis_names": ["x", "y", "z"],  # No temporal axis
        "axis_units": ["nanometer", "nanometer", "nanometer"],
        "axis_types": ["space", "space", "space"],
        "axes": [
            {"name": "x", "type": "space", "unit": "nanometer"},
            {"name": "y", "type": "space", "unit": "nanometer"},
            {"name": "z", "type": "space", "unit": "nanometer"},
        ],  # No temporal axis
    }

    with pytest.raises(ValueError, match="No temporal axis found in metadata"):
        read_geff_to_df(store)


def test_read_geff_to_df_non_numerical_dtype():
    """Test that read_geff_to_df handles non-numerical dtypes with warning."""
    from geff.testing.data import create_memory_mock_geff

    # Create a GEFF store with string properties
    node_dtype = "int8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    extra_node_props = {"label": "str"}  # String dtype
    extra_edge_props = {"score": "float64"}
    directed = True
    num_nodes = 7
    num_edges = 16

    store, _ = create_memory_mock_geff(
        node_dtype,
        node_prop_dtypes,
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
    import numpy as np
    from geff.testing.data import create_memory_mock_geff

    # Create a GEFF store with NaN values
    node_dtype = "int8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Create property with NaN values
    num_nodes = 7
    nan_property = np.array([1.0, 2.0, np.nan, 4.0, 5.0, np.nan, 7.0], dtype=np.float32)
    extra_node_props = {"intensity": nan_property}
    extra_edge_props = {"score": "float64"}
    directed = True
    num_edges = 16

    store, _ = create_memory_mock_geff(
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
    import numpy as np
    from geff.testing.data import create_memory_mock_geff

    # Create a GEFF store with infinite values
    node_dtype = "int8"
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

    store, _ = create_memory_mock_geff(
        node_dtype,
        node_prop_dtypes,
        extra_node_props=extra_node_props,
        extra_edge_props=extra_edge_props,
        directed=directed,
        num_nodes=num_nodes,
        num_edges=num_edges,
        include_z=True,
    )

    # This should normalize the values and clip infinite values to [0, 1]
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property should be included and normalized
    assert "intensity" in df.columns

    # Check that values are normalized to [0, 1] range
    intensity_values = df["intensity"].values
    assert np.all(intensity_values >= 0.0)
    assert np.all(intensity_values <= 1.0)

    # Check that infinite values were clipped
    assert not np.any(np.isinf(intensity_values))


def test_read_geff_to_df_with_all_inf_values():
    """Test that read_geff_to_df handles all infinite values correctly."""
    import numpy as np
    from geff.testing.data import create_memory_mock_geff

    # Create a GEFF store with all infinite values
    node_dtype = "int8"
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

    store, _ = create_memory_mock_geff(
        node_dtype,
        node_prop_dtypes,
        extra_node_props=extra_node_props,
        extra_edge_props=extra_edge_props,
        directed=directed,
        num_nodes=num_nodes,
        num_edges=num_edges,
        include_z=True,
    )

    # This should skip the property entirely since all values are infinite
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property with all infinite values should not be included in the DataFrame
    assert "intensity" not in df.columns


def test_read_geff_to_df_with_constant_values():
    """Test that read_geff_to_df handles constant values correctly."""
    import numpy as np
    from geff.testing.data import create_memory_mock_geff

    # Create a GEFF store with constant values
    node_dtype = "int8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    # Create property with constant values
    num_nodes = 7
    constant_property = np.array([5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0], dtype=np.float32)
    extra_node_props = {"intensity": constant_property}
    extra_edge_props = {"score": "float64"}
    directed = True
    num_edges = 16

    store, _ = create_memory_mock_geff(
        node_dtype,
        node_prop_dtypes,
        extra_node_props=extra_node_props,
        extra_edge_props=extra_edge_props,
        directed=directed,
        num_nodes=num_nodes,
        num_edges=num_edges,
        include_z=True,
    )

    # This should set all values to 0.5 (middle of range)
    df = read_geff_to_df(store, include_all_attributes=True)

    # The property should be included
    assert "intensity" in df.columns

    # Check that all values are set to 0.5
    intensity_values = df["intensity"].values
    assert np.all(intensity_values == 0.5)


def test_read_geff_to_df_missing_geff_version():
    """Test that read_geff_to_df raises error when geff version is missing."""
    import zarr

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
    from intracktive.convert import convert_file

    # Create a mock GEFF store
    node_dtype = "int8"
    node_prop_dtypes = {"position": "double", "time": "double"}
    extra_node_props = {"intensity": "float32", "area": "float64"}
    extra_edge_props = {"score": "float64"}
    directed = True
    num_nodes = 7
    num_edges = 16

    store, _ = create_memory_mock_geff(
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
    import geff

    graph, metadata = geff.read_nx(store)
    geff_path = tmp_path / "test_geff_data"
    geff.write_nx(graph, geff_path, metadata=metadata)

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
