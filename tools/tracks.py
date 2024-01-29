from dataclasses import dataclass
from typing import List, Set, Tuple
from typing_extensions import Self


@dataclass(frozen=True)
class Cell:
    id: int
    start_time: int
    positions: Tuple[Tuple[float, float, float], ...]
    parents: Tuple[Self, ...]


def make_cells(
        *,
        init_num_cells: int,
        num_times: int,
        xyz_min: float = 0,
        xyz_max: float = 1000,
        split_prob: float = 0.1,
        merge_prob: float = 0,
) -> List[Cell]:
    cells: List[Cell] = []
    current_cells: Set[Cell] = set()
    for t in range(num_times):

    for c in range(init_num_cells):
        cells.append(cell)
    return cells
