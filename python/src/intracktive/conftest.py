import pandas as pd
import pytest


@pytest.fixture
def make_sample_data() -> pd.DataFrame:
    matrix = [
        [1, 0, 10, 20, 30, -1],
        [2, 1, 20, 40, 60, 1],
        [3, 1, 60, 30, 90, 1],
        [4, 0, 31, 32, 33, -1],
        [4, 1, 41, 42, 43, -1],
    ]  # don't change this, it's used in the tests and compared to hardcoded expected Zarr output

    df = pd.DataFrame(
        matrix, columns=["track_id", "t", "z", "y", "x", "parent_track_id"]
    )
    df = df.sort_values(by=["track_id", "t"])
    df = df.reset_index(drop=True)
    return df
