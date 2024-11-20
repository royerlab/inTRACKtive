import json
import urllib.parse

HASH_KEY = "viewerState"


def generate_viewer_state_hash(data_url: str) -> str:
    """
    Generate a hash string that can be appended to a URL to load inTRACKtive with a specific viewer state.

    Parameters
    ----------
    data_url : str
        The URL to the data file to load in inTRACKtive.

    Returns
    -------
    str
        The inTRACKtive hash string (to be added to the URL).
    """

    # Replicate the initial state based on your ViewerState defaults
    viewer_state = {
        "dataUrl": data_url,
        "curTime": 0,
        "minTime": -6,
        "maxTime": 5,
        "maxPointsPerTimepoint": 0,
        "pointBrightness": 1.0,
        "selectedPointIds": [],
        "showTracks": True,
        "showTrackHighlights": True,
        "cameraPosition": [-4, 0, 0],
        "cameraTarget": [0, 0, 0],
    }

    # Step 1: Serialize the viewer state to a JSON string
    json_string = json.dumps(
        viewer_state, separators=(",", ":")
    )  # To mimic JavaScript JSON.stringify formatting

    # Step 2: URL encode the JSON string (like URLSearchParams in JavaScript)
    url_encoded_json = urllib.parse.quote(json_string, safe="")

    # Step 3: Create the hash by adding the HASH_KEY
    hash_string = f"#{HASH_KEY}={url_encoded_json}"

    return hash_string
