from pathlib import Path

import click
from intracktive.convert import convert_file, is_geff_dataset, zarr_to_browser


def open_file(
    input_path: Path,
    no_browser: bool = False,
    out_dir: Path | None = None,
    add_radius: bool = False,
    add_all_attributes: bool = False,
    add_attribute: str | None = None,
    add_hex_attribute: str | None = None,
    pre_normalized: bool = False,
    calc_velocity: bool = False,
    velocity_smoothing_windowsize: int = 1,
) -> Path:
    """
    Open a file in inTRACKtive viewer. Supports Zarr stores, CSV, Parquet, and GEFF files.

    This is the core function that can be called both programmatically and via CLI.

    Parameters
    ----------
    input_path : Path
        Path to the file (Zarr store, CSV, Parquet, or GEFF)
    no_browser : bool, optional
        Don't open browser automatically, just print the URL, by default False
    out_dir : Path | None, optional
        Path to the output directory for converted Zarr files, by default None
    add_radius : bool, optional
        Boolean indicating whether to include the column radius as cell size, by default False
    add_all_attributes : bool, optional
        Boolean indicating whether to include extra columns as attributes, by default False
    add_attribute : str | None, optional
        Comma-separated list of column names to include as attributes, by default None
    add_hex_attribute : str | None, optional
        Comma-separated list of column names to include as HEX attributes, by default None
    pre_normalized : bool, optional
        Boolean indicating whether the attributes are prenormalized to [0,1], by default False
    calc_velocity : bool, optional
        Boolean indicating whether to calculate velocity of the cells, by default False
    velocity_smoothing_windowsize : int, optional
        Smoothing factor for velocity calculation, by default 1

    Returns
    -------
    Path
        Path to the Zarr store that was opened

    Raises
    ------
    ValueError
        If the file format is unsupported or file doesn't exist
    """
    # Determine if we need to convert the file
    file_extension = input_path.suffix.lower()
    is_zarr = input_path.suffix == ".zarr"

    if is_zarr:
        # Direct Zarr file - use as is
        zarr_path = input_path
        if not zarr_path.exists():
            raise click.UsageError(f"Zarr store does not exist: {zarr_path}")

        # Validate that the Zarr store has the required folders
        required_folders = [
            "points",
            "points_to_tracks",
            "tracks_to_points",
            "tracks_to_tracks",
        ]
        missing_folders = []

        for folder in required_folders:
            folder_path = zarr_path / folder
            if not folder_path.exists() or not folder_path.is_dir():
                missing_folders.append(folder)

        if missing_folders:
            raise click.UsageError(
                "intracktive folders are missing in the zarr, this is probably a wrong path"
            )
    else:
        # Need to convert CSV/Parquet/GEFF to Zarr
        if file_extension not in [".csv", ".parquet"] and not is_geff_dataset(
            input_path
        ):
            raise click.UsageError(
                f"Unsupported file format: {file_extension}. Only .zarr, .csv, .parquet and GEFF files are supported."
            )

        if not input_path.exists():
            raise click.UsageError(f"Input file does not exist: {input_path}")

        # Convert to Zarr
        print(f"Converting {input_path} to Zarr format...")
        zarr_path = convert_file(
            input_file=input_path,
            out_dir=out_dir,
            add_radius=add_radius,
            add_all_attributes=add_all_attributes,
            add_attribute=add_attribute,
            add_hex_attribute=add_hex_attribute,
            pre_normalized=pre_normalized,
            calc_velocity=calc_velocity,
            velocity_smoothing_windowsize=velocity_smoothing_windowsize,
        )
        print(f"Conversion completed! Zarr store created at: {zarr_path}")

    print("zarr_path in open_file", zarr_path)
    # Open in browser
    zarr_to_browser(
        zarr_path=zarr_path, flag_open_browser=not no_browser, threaded=False
    )

    return zarr_path


@click.command("open")
@click.argument(
    "input_path",
    type=click.Path(exists=True, path_type=Path),
)
@click.option(
    "--no-browser",
    is_flag=True,
    default=False,
    help="Don't open browser automatically, just print the URL",
)
@click.option(
    "--out_dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=None,
    help="Path to the output directory for converted Zarr files (optional, defaults to temporary directory)",
)
@click.option(
    "--add_radius",
    is_flag=True,
    help="Boolean indicating whether to include the column radius as cell size",
    default=False,
    type=bool,
)
@click.option(
    "--add_all_attributes",
    is_flag=True,
    help="Boolean indicating whether to include extra columns as attributes for colors the cells in the viewer",
    default=False,
    type=bool,
)
@click.option(
    "--add_attribute",
    type=str,
    default=None,
    help="Comma-separated list of column names to include as attributes (e.g., 'cell_size,diameter,type,label')",
)
@click.option(
    "--add_hex_attribute",
    type=str,
    default=None,
    help="Comma-separated list of column names to include as HEX attributes (e.i., columns with hexInt values, only internal use')",
)
@click.option(
    "--pre_normalized",
    is_flag=True,
    help="Boolean indicating whether the extra column/columns with attributes are prenormalized to [0,1]",
    default=False,
    type=bool,
)
@click.option(
    "--calc_velocity",
    is_flag=True,
    help="Boolean indicating whether to calculate velocity of the cells (smoothing is recommended, please provide a --velocity_smoothing_windowsize)",
    default=False,
    type=bool,
)
@click.option(
    "--velocity_smoothing_windowsize",
    type=int,
    default=1,
    help="Smoothing factor for velocity calculation, using a moving average over n frames around each frame",
)
def open_cli(
    input_path: Path,
    no_browser: bool,
    out_dir: Path | None,
    add_radius: bool,
    add_all_attributes: bool,
    add_attribute: str | None,
    add_hex_attribute: str | None,
    pre_normalized: bool,
    calc_velocity: bool,
    velocity_smoothing_windowsize: int,
) -> None:
    """
    Open a file in inTRACKtive viewer. Supports Zarr stores, CSV, Parquet, and GEFF files.

    Arguments:
        INPUT_PATH: Path to the file (Zarr store, CSV, Parquet, or GEFF)

    This command will:
    1. If input is CSV/Parquet/GEFF: Convert to Zarr format first
    2. Start a local server to host the Zarr store
    3. Generate a URL for viewing in inTRACKtive
    4. Open the browser (unless --no-browser is specified)

    The server will keep running until interrupted with Ctrl+C.

    Example usage:

    intracktive open /path/to/data.zarr
    intracktive open /path/to/data.zarr --no-browser
    intracktive open /path/to/data.csv
    intracktive open /path/to/data.parquet
    intracktive open /path/to/data.geff
    """
    open_file(
        input_path=input_path,
        no_browser=no_browser,
        out_dir=out_dir,
        add_radius=add_radius,
        add_all_attributes=add_all_attributes,
        add_attribute=add_attribute,
        add_hex_attribute=add_hex_attribute,
        pre_normalized=pre_normalized,
        calc_velocity=calc_velocity,
        velocity_smoothing_windowsize=velocity_smoothing_windowsize,
    )


if __name__ == "__main__":
    open_cli()
