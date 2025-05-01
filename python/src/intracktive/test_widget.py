import base64
import mimetypes
import os
import socket
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import anywidget
import traitlets


class TestWidget(anywidget.AnyWidget):
    # Add traitlets for both methods
    logo_data_base64 = traitlets.Unicode().tag(sync=True)
    logo_data_direct = traitlets.Unicode().tag(sync=True)

    # Tell anywidget where to find static files
    _package = "intracktive"
    _static = "_static"

    _esm = """
    function render({ model, el }) {
        console.log('Test widget mounted');

        const container = document.createElement('div');
        container.style.padding = '20px';

        const title = document.createElement('h3');
        title.textContent = 'Logo Loading Test - Compare Methods';
        container.appendChild(title);

        // Create image elements with error handling and timing
        function createImage(data, label, method) {
            const wrapper = document.createElement('div');
            wrapper.style.margin = '10px';

            const img = document.createElement('img');
            img.src = data;
            img.alt = `${label} (${method})`;
            img.style.maxWidth = '100px';
            img.style.border = '1px solid #ccc';
            img.style.display = 'block';
            img.style.marginBottom = '5px';

            const status = document.createElement('div');
            status.style.fontSize = '12px';

            const startTime = performance.now();

            img.onload = () => {
                const loadTime = performance.now() - startTime;
                status.style.color = 'green';
                status.textContent = `✓ ${label} loaded (${method}) - ${loadTime.toFixed(2)}ms`;
            };

            img.onerror = () => {
                status.style.color = 'red';
                status.textContent = `✗ ${label} failed to load (${method})`;
                console.error(`Failed to load ${label} using ${method}`);
            };

            wrapper.appendChild(img);
            wrapper.appendChild(status);
            return wrapper;
        }

        // Test both methods
        container.appendChild(createImage(model.get('logo_data_base64'), 'Logo', 'Base64'));
        container.appendChild(createImage(model.get('logo_data_direct'), 'Logo', 'Direct'));

        el.appendChild(container);
    }

    export default { render };
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        print("[TestWidget] Initialization")

        # Get paths to images
        self.static_dir = Path(__file__).parent / "_static"
        logo_path = self.static_dir / "CZ-Biohub-SF-RGB-60x60.png"

        # Start HTTP server
        self.server_port = self._start_http_server()

        # Test base64 method
        self.logo_data_base64 = self._encode_image(logo_path) or ""

        # Test direct file method using local HTTP server
        self.logo_data_direct = (
            f"http://localhost:{self.server_port}/CZ-Biohub-SF-RGB-60x60.png"
        )

        print("[TestWidget] Loading methods initialized:")
        print(f"  Base64 data length: {len(self.logo_data_base64)} chars")
        print(f"  Direct path: {self.logo_data_direct}")

    def _encode_image(self, path):
        if not os.path.exists(path):
            print(f"[TestWidget] Warning: Image not found at {path}")
            return None

        mime_type = mimetypes.guess_type(path)[0]
        with open(path, "rb") as f:
            image_data = f.read()
            base64_data = base64.b64encode(image_data).decode("utf-8")
            return f"data:{mime_type};base64,{base64_data}"

    def _get_free_port(self):
        """Find a free port to use for the HTTP server"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port

    def _start_http_server(self):
        """Start HTTP server in a separate thread"""
        # Create custom handler that serves from static directory
        static_dir = self.static_dir

        class StaticHandler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(static_dir), **kwargs)

            def log_message(self, format, *args):
                # Suppress logging
                pass

        # Get an available port
        port = self._get_free_port()

        # Start server in a thread
        server = HTTPServer(("localhost", port), StaticHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        return port
