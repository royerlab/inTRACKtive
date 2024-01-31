import logging
from pathlib import Path

import numpy as np
import zarr

logging.basicConfig(level=logging.INFO)


def make_random_points(
        *,
        path: Path,
        num_times: int = 500,
        num_points: int = 25_000,
) -> zarr.Array:
    z = zarr.open_array(
        path,
        mode="w",
        shape=(num_times, num_points * 3),
        chunks=(1, num_points * 3),
        dtype="f4",
    )
    z[:] = np.random.random((num_times, num_points * 3)) * 1000
    return z


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser('Generates random points data')
    parser.add_argument('path', type=str, help='The path of the zarr directory to write')
    parser.add_argument('--num_times', type=int, default=500, help='The number of times')
    parser.add_argument('--num_points', type=int, default=25_000, help='The number of points at each time')
    args = parser.parse_args()

    path = Path(args.path)

    array = make_random_points(
        path=path,
        num_times=args.num_times,
        num_points=args.num_points,
    )
    logging.info(f"Made zarr array with shape %s at %s", array.shape, path)