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
