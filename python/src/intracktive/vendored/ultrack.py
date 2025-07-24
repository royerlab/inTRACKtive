from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

NO_PARENT = -1


def _fast_path_transverse(
    node: int,
    track_id: int,
    queue: List[Tuple[int, int]],
    forest: Dict[int, List[int]],
) -> List[int]:
    """Transverse a path in the forest directed graph and add path (track) split into queue.

    Parameters
    ----------
    node : int
        Source path node.
    track_id : int
        Reference track id for path split.
    queue : List[Tuple[int, int]]
        Source nodes and path (track) id reference queue.
    forest : Dict[int, List[int]]
        Directed graph (tree) of paths relationships.

    Returns
    -------
    List[int]
        Sequence of nodes in the path.
    """
    path = []

    while True:
        path.append(node)

        children = forest.get(node)
        if children is None:
            # end of track
            break

        elif len(children) == 1:
            node = children[0]

        elif len(children) == 2:
            queue.append((children[1], track_id))
            queue.append((children[0], track_id))
            break

        else:
            raise RuntimeError(
                "Something is wrong. Found node with more than two children when parsing tracks."
            )

    return path


def _fast_forest_transverse(
    roots: List[int],
    forest: Dict[int, List[int]],
) -> Tuple[List[List[int]], List[int], List[int], List[int]]:
    """Transverse the tracks forest graph creating a distinc id to each path.

    Parameters
    ----------
    roots : List[int]
        Forest roots.
    forest : Dict[int, List[int]]
        Graph (forest).

    Returns
    -------
    Tuple[List[List[int]], List[int], List[int], List[int]]
        Sequence of paths, their respective track_id, parent_track_id and length.
    """
    track_id = 1
    paths = []
    track_ids = []  # equivalent to arange
    parent_track_ids = []
    lengths = []

    for root in roots:
        queue = [(root, NO_PARENT)]

        while queue:
            node, parent_track_id = queue.pop()
            path = _fast_path_transverse(node, track_id, queue, forest)
            paths.append(path)
            track_ids.append(track_id)
            parent_track_ids.append(parent_track_id)
            lengths.append(len(path))
            track_id += 1

    return paths, track_ids, parent_track_ids, lengths


def _create_tracks_forest(
    node_ids: np.ndarray, parent_ids: np.ndarray
) -> Dict[int, List[int]]:
    """Creates the forest graph of track lineages

    Parameters
    ----------
    node_ids : np.ndarray
        Nodes indices.
    parent_ids : np.ndarray
        Parent indices.

    Returns
    -------
    Dict[int, List[int]]
        Forest graph where parent maps to their children (parent -> children)
    """
    forest = {}
    for parent in parent_ids:
        forest[parent] = []

    for i in range(len(parent_ids)):
        forest[parent_ids[i]].append(node_ids[i])

    return forest


def add_track_ids_to_tracks_df(df: pd.DataFrame) -> pd.DataFrame:
    """Adds `track_id` and `parent_track_id` columns to forest `df`.
    Each maximal path receveis a unique `track_id`.

    Parameters
    ----------
    df : pd.DataFrame
        Forest defined by the `parent_id` column and the dataframe indices.

    Returns
    -------
    pd.DataFrame
        Inplace modified input dataframe with additional columns.
    """
    assert df.shape[0] > 0

    df.index = df.index.astype(int)
    df["parent_id"] = df["parent_id"].astype(int)

    forest = _create_tracks_forest(df.index.values, df["parent_id"].to_numpy())
    roots = forest.pop(NO_PARENT)

    df["track_id"] = NO_PARENT
    df["parent_track_id"] = NO_PARENT

    paths, track_ids, parent_track_ids, lengths = _fast_forest_transverse(roots, forest)

    paths = np.concatenate(paths)
    df.loc[paths, "track_id"] = np.repeat(track_ids, lengths)
    df.loc[paths, "parent_track_id"] = np.repeat(parent_track_ids, lengths)

    unlabeled_tracks = df["track_id"] == NO_PARENT
    assert not np.any(
        unlabeled_tracks
    ), f"Something went wrong. Found unlabeled tracks\n{df[unlabeled_tracks]}"

    return df
