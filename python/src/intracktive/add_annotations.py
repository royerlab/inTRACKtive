"""
Standalone script to precompute annotated track point IDs for an inTRACKtive zarr store.

For each hex-binary attribute, finds all cells with a non-background annotation value,
looks up their track IDs, and stores one representative point ID per unique annotated track
in attributes.attrs["annot_point_ids"] (a list of lists, parallel to attribute_names).

Usage:
    python -m intracktive.add_annotations <zarr_path>
"""

import sys
from pathlib import Path

import numpy as np
import zarr

# The hex value used to represent "no annotation" (grey: #404040)
NO_ANNOTATION_VALUE = 4210752
# Sentinel value used to pad the jagged array
INF_SPACE = -9000.0


def add_annotated_point_ids(zarr_path: str | Path) -> None:
    """
    Process an existing inTRACKtive zarr store and write annot_point_ids to attributes.attrs.

    For each hex-binary attribute column, scans all timepoints to find annotated cells,
    resolves their track IDs via points_to_tracks, and stores one representative point ID
    per unique annotated track. Non-hex-binary attributes get an empty list.

    Parameters
    ----------
    zarr_path : str or Path
        Path to the inTRACKtive zarr store.
    """
    zarr_path = Path(zarr_path)
    store = zarr.open(zarr_path.as_posix(), mode="r+")

    if "attributes" not in store:
        print("No attributes array found in zarr — nothing to do.")
        return

    attributes = store["attributes"]
    zattrs = dict(attributes.attrs)

    attribute_names = zattrs.get("attribute_names", [])
    attribute_types = zattrs.get("attribute_types", [])

    if not attribute_names:
        print("No attribute_names found in attributes.zattrs — nothing to do.")
        return

    n_attributes = len(attribute_names)
    max_pts = attributes.shape[1] // n_attributes

    # Load points_to_tracks CSR arrays once
    indptr = store["points_to_tracks/indptr"][:]
    indices = store["points_to_tracks/indices"][:]

    annot_point_ids: list[list[int]] = []
    annot_colors: list[int | None] = []

    for col_idx, (name, attr_type) in enumerate(zip(attribute_names, attribute_types)):
        if attr_type != "hex-binary":
            annot_point_ids.append([])
            annot_colors.append(None)
            continue

        print(f"Processing hex-binary attribute '{name}' (column {col_idx})...")

        # Load full attribute column for all timepoints: shape (n_times, max_pts)
        start_col = col_idx * max_pts
        end_col = start_col + max_pts
        attr_data = attributes[:, start_col:end_col]

        # Find all (t, i) that are annotated: not background and not INF_SPACE padding
        mask = (attr_data != NO_ANNOTATION_VALUE) & (attr_data > INF_SPACE)
        t_indices, i_indices = np.where(mask)
        point_ids = (t_indices * max_pts + i_indices).astype(np.int64)

        # For each point, look up its track(s) and keep one representative point ID per track
        seen_tracks: set[int] = set()
        representative_point_ids: list[int] = []

        for point_id in point_ids:
            pid = int(point_id)
            start = int(indptr[pid])
            end = int(indptr[pid + 1])
            for track_id in indices[start:end]:
                tid = int(track_id)
                if tid not in seen_tracks:
                    seen_tracks.add(tid)
                    representative_point_ids.append(pid)

        # Extract tissue color (all annotated cells share the same hex color for hex-binary)
        annotated_values = attr_data[mask]
        tissue_color = int(annotated_values[0]) if len(annotated_values) > 0 else None
        annot_colors.append(tissue_color)

        print(f"  → {len(seen_tracks)} annotated tracks found")
        annot_point_ids.append(representative_point_ids)

    attributes.attrs["annot_point_ids"] = annot_point_ids
    attributes.attrs["annot_colors"] = annot_colors
    print(f"Saved annot_point_ids to {zarr_path / 'attributes' / '.zattrs'}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m intracktive.add_annotations <zarr_path>")
        sys.exit(1)
    add_annotated_point_ids(sys.argv[1])
