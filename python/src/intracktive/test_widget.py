import anywidget
import traitlets
from pathlib import Path
import os
import base64
import mimetypes

class TestWidget(anywidget.AnyWidget):
    # Add traitlets for image data
    logo_data = traitlets.Unicode().tag(sync=True)
    spark_data = traitlets.Unicode().tag(sync=True)

    _esm = """
    function render({ model, el }) {
        console.log('Test widget mounted');
        
        // Create container
        const container = document.createElement('div');
        container.style.padding = '20px';
        
        // Add title
        const title = document.createElement('h3');
        title.textContent = 'Image Loading Test';
        container.appendChild(title);
        
        // Create image elements with error handling
        function createImage(data, label) {
            const wrapper = document.createElement('div');
            wrapper.style.margin = '10px';
            
            const img = document.createElement('img');
            img.src = data;
            img.alt = label;
            img.style.maxWidth = '100px';
            img.style.border = '1px solid #ccc';
            img.style.display = 'block';
            img.style.marginBottom = '5px';
            
            const status = document.createElement('div');
            status.style.fontSize = '12px';
            
            img.onload = () => {
                status.style.color = 'green';
                status.textContent = `✓ ${label} loaded`;
            };
            
            img.onerror = () => {
                status.style.color = 'red';
                status.textContent = `✗ ${label} failed to load`;
                console.error(`Failed to load ${label}`);
            };
            
            wrapper.appendChild(img);
            wrapper.appendChild(status);
            return wrapper;
        }
        
        container.appendChild(createImage(model.get('logo_data'), 'Logo'));
        container.appendChild(createImage(model.get('spark_data'), 'Spark'));
        
        el.appendChild(container);
    }
    
    export default { render };
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        print(f"[TestWidget] Initialization")
        
        # Function to read and encode image
        def encode_image(path):
            if not os.path.exists(path):
                print(f"[TestWidget] Warning: Image not found at {path}")
                return None
            
            mime_type = mimetypes.guess_type(path)[0]
            with open(path, 'rb') as f:
                image_data = f.read()
                base64_data = base64.b64encode(image_data).decode('utf-8')
                return f"data:{mime_type};base64,{base64_data}"

        # Get paths to images
        static_dir = Path(__file__).parent / '_static'
        logo_path = static_dir / 'CZ-Biohub-SF-RGB-60x60.png'
        spark_path = static_dir / 'spark1.png'

        # Encode images
        print(f"[TestWidget] Loading images:")
        print(f"  Logo path: {logo_path} (exists: {logo_path.exists()})")
        print(f"  Spark path: {spark_path} (exists: {spark_path.exists()})")
        
        self.logo_data = encode_image(logo_path) or ''
        self.spark_data = encode_image(spark_path) or ''
        
        # Verify data (truncated for logging)
        print(f"[TestWidget] Image data loaded:")
        print(f"  Logo data: {self.logo_data[:50]}...")
        print(f"  Spark data: {self.spark_data[:50]}...")