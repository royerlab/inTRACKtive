from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from pathlib import Path

HOST = "localhost"


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser('Serves data on the file system over HTTP')
    parser.add_argument('dir', type=str, help='The directory on the filesystem to serve')
    parser.add_argument('--port', type=int, default=8000, help='The port number to serve on.')

    args = parser.parse_args()

    path = Path(args.dir)
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

    with TCPServer((HOST, port), CORSRequestHandler) as httpd:
        print(f"Serving {path} at: http://{HOST}:{port}")
        httpd.serve_forever()
