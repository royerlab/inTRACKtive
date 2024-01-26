import os
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from pathlib import Path

import numpy as np
import zarr

HOST = "localhost"
PORT = 8000
NAME = "sample.zarr"


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def make_sample_data(
        path: str,
        n_time_points: int = 500,
        n_points: int = 25_000,
) -> zarr.Array:
    z = zarr.open_array(
        path,
        mode="w",
        shape=(n_time_points, n_points * 3),
        dtype="f4",
    )
    z[:] = np.random.random((n_time_points, n_points * 3)) * 1000
    return z


if __name__ == "__main__":
    data_dir = Path(__file__).parent.parent.resolve() / "data"
    if not data_dir.exists():
        os.mkdir(str(data_dir))
    assert data_dir.is_dir()

    path = str(data_dir / NAME)
    array = make_sample_data(path=path)
    print(f"made zarr array ({array.shape}) at {path}")

    with TCPServer((HOST, PORT), CORSRequestHandler) as httpd:
        print(f"serving at: http://{HOST}:{PORT}/{NAME}")
        httpd.serve_forever()
