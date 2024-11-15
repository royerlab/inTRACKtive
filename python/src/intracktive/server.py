import logging
import socket
import socketserver
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import click

DEFAULT_HOST = "127.0.0.1"
logging.basicConfig(level=logging.INFO)


class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""

    daemon_threads = True  # Ensure threads close when main thread exits


def find_available_port(starting_port=8000):
    port = starting_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex((DEFAULT_HOST, port)) != 0:  # Port is free
                return port
            port += 1  # Increment to find the next available port


def serve_directory_forever(path: Path, host: str = DEFAULT_HOST, port: int = 8000):
    """
    Starts an HTTP server to serve a directory

    Parameters
    ----------
    path : Path
        The directory to serve.
    host : str
        The host name or IP address, by default 127.0.0.1 (localhost).
    port : int
        The port number to serve on, by default 8000.
    """

    port = find_available_port(port)  # Get an available port

    if not path.exists() or not path.is_dir():
        logging.error(
            "The specified path does not exist or is not a directory: %s", path
        )
        return

    class CORSRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(*args, directory=str(path), **kwargs)

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()

    with ThreadingHTTPServer((host, port), CORSRequestHandler) as httpd:
        logging.info("Serving %s at http://%s:%s", path, host, port)
        try:
            logging.info("Server running...")
            httpd.serve_forever()
        except KeyboardInterrupt:
            logging.info("Server interrupted, shutting down.")
            raise SystemExit(0)
        except Exception as e:
            logging.error("An error occurred: %s", e)
            raise SystemExit(1)

    # print(f"Server started in background thread at http://{host}:{port}")
    logging.info(f"Server started in background thread at http://{host}:{port}")


def serve_directory_threaded(
    path: Path, host: str = DEFAULT_HOST, port: int = 8000
) -> str:
    """
    Starts an HTTP server in a background thread to serve a directory, allowing non-blocking execution.

    Parameters
    ----------
    path : Path
        The directory to serve.
    host : str
        The host name or IP address, by default 127.0.0.1 (localhost).
    port : int
        The port number to serve on, by default 8000.

    Returns
    -------
    str
        The URL of the server.
    """

    port = find_available_port(port)  # Get an available port

    # Ensure path exists and is a directory
    if not path.exists() or not path.is_dir():
        # print(f"The specified path does not exist or is not a directory: {path}")
        logging.error(
            "The specified path does not exist or is not a directory: %s", path
        )
        return

    class CORSRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(*args, directory=str(path), **kwargs)

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()

    def start_server():
        with ThreadingHTTPServer((host, port), CORSRequestHandler) as httpd:
            logging.info("Serving %s at http://%s:%s", path, host, port)
            try:
                logging.info("Server running...")
                httpd.serve_forever()
            except KeyboardInterrupt:
                logging.info("Server interrupted, shutting down.")
            except Exception as e:
                logging.error("An error occurred: %s", e)

    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    logging.info(f"Server started in background thread at http://{host}:{port}")
    print(f"Server started in background thread at http://{host}:{port}")

    return f"http://{host}:{port}"


@click.command("serve")
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
    """
    Serves data on the file system over HTTP bypassing CORS
    """
    serve_directory_forever(path, host, port)


if __name__ == "__main__":
    server_cli()
