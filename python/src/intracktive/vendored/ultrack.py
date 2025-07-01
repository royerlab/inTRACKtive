import pandas as pd
from typing import Dict

NO_PARENT = -1

def inv_tracks_df_forest(df: pd.DataFrame) -> Dict[int, int]:
    """
    Returns `track_id` and `parent_track_id` leaves-to-root inverted forest (set of trees) graph structure.

    Example:
    forest[child_id] = parent_id
    """
    for col in ["track_id", "parent_track_id"]:
        if col not in df.columns:
            raise ValueError(
                f"The input dataframe does not contain the column '{col}'."
            )

    df = df.drop_duplicates("track_id")
    df = df[df["parent_track_id"] != NO_PARENT]
    graph = {}
    for parent_id, id in zip(df["parent_track_id"], df["track_id"]):
        graph[id] = parent_id
    return graph