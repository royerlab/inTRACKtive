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


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def __init__(
        self, *args, directory: str = None, enable_logging: bool = False, **kwargs
    ) -> None:
        self.directory = directory
        self.enable_logging = enable_logging
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def log_message(self, format, *args):
        if self.enable_logging:
            super().log_message(format, *args)


def find_available_port(starting_port=8000):
    port = starting_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex((DEFAULT_HOST, port)) != 0:  # Port is free
                return port
            port += 1  # Increment to find the next available port


def serve_directory(
    path: Path,
    host: str = DEFAULT_HOST,
    port: int = 8000,
    threaded: bool = True,
    enable_request_logging: bool = False,
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
    threaded : bool
        Whether to run the server in a separate thread, by default True.
    enable_request_logging : bool
        Whether to enable request logging, by default False.

    Returns
    -------
    str
        The URL of the server.
    """

    port = find_available_port(port)  # Get an available port

    # Ensure path exists and is a directory
    if not path.exists() or not path.is_dir():
        logging.error(
            "The specified path does not exist or is not a directory: %s", path
        )
        return

    # Factory to pass directory to CORSRequestHandler
    def handler_factory(*args, **kwargs):
        return CORSRequestHandler(
            *args, directory=str(path), enable_logging=enable_request_logging, **kwargs
        )

    def start_server():
        with ThreadingHTTPServer((host, port), handler_factory) as httpd:
            logging.info("Serving %s at http://%s:%s", path, host, port)
            try:
                logging.info("Server running...")
                httpd.serve_forever()
            except KeyboardInterrupt:
                logging.info("Server interrupted, shutting down.")
            except Exception as e:
                logging.error("An error occurred: %s", e)

    if threaded:
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
    else:
        start_server()

    logging.info(f"Server started in background thread at http://{host}:{port}")

    return f"http://{host}:{port}"


@click.command("serve")
@click.argument(
    "path",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
)
@click.option(
    "--host",
    type=str,
    default=DEFAULT_HOST,
    help="The host name or IP address (default: 127.0.0.1)",
)
@click.option(
    "--port", type=int, default=8000, help="The port number to serve on (default: 8000)"
)
def server_cli(
    path: Path,
    host: str,
    port: int,
) -> None:
    """
    Serves data on the file system over HTTP bypassing CORS
    """
    serve_directory(path, host, port, threaded=False)


if __name__ == "__main__":
    server_cli()
