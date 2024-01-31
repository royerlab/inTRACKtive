import logging
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "localhost"

logging.basicConfig(level=logging.INFO)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser('Serves data on the file system over HTTP bypassing CORS')
    parser.add_argument('dir', type=str, help='The directory on the filesystem to serve')
    parser.add_argument('--host', type=str, default="127.0.0.1", help='The host name or IP address.')
    parser.add_argument('--port', type=int, default=8000, help='The port number to serve on.')

    args = parser.parse_args()

    path = Path(args.dir)
    host = args.host
    port = args.port

    if not path.exists():
        raise ValueError('Given path does not exist.')
    if not path.is_dir():
        raise ValueError('Given path is not a directory.')

    class CORSRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(*args, directory=str(path), **kwargs)

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()

    with ThreadingHTTPServer((HOST, port), CORSRequestHandler) as httpd:
        logging.info(f"Serving {path} at: http://{host}:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logging.info("Keyboard interrupt received, exiting.")
            raise SystemExit(0)
