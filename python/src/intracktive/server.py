import logging
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import click

DEFAULT_HOST = "127.0.0.1"

logging.basicConfig(level=logging.INFO)


def serve_directory(
    path: Path,
    host: str = DEFAULT_HOST,
    port: int = 8000,
) -> None:
    """
    Serves a directory over HTTP bypassing CORS

    Parameters
    ----------
    path : Path
        The directory to serve.
    host : str
        The host name or IP address, by default 127.0.0.1 (localhost).
    port : int
        The port number to serve on, by default 8000.
    """

    # Define the class here so we can capture the directory to host.
    class CORSRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(*args, directory=str(path), **kwargs)

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()

    with ThreadingHTTPServer((host, port), CORSRequestHandler) as httpd:
        logging.info("Serving %s at http://%s:%s", path, host, port)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logging.info("Keyboard interrupt received, exiting.")
            raise SystemExit(0)
        except Exception as e:
            logging.error("An error occurred: %s", e)
            raise SystemExit(1)


@click.command()
@click.argument(
    "path",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
)
@click.option(
    "--host", type=str, default=DEFAULT_HOST, help="The host name or IP address."
)
@click.option("--port", type=int, default=8000, help="The port number to serve on.")
def server_cli(
    path: Path,
    host: str,
    port: int,
) -> None:
    serve_directory(path, host, port)


if __name__ == "__main__":
    server_cli()
