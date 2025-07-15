from pathlib import Path

import click
from intracktive.convert import zarr_to_browser


@click.command("open")
@click.argument(
    "zarr_path",
    type=click.Path(exists=True, path_type=Path),
)
@click.option(
    "--csv-path",
    type=click.Path(exists=True, path_type=Path),
    help="Path to the CSV file with cells to select",
)
@click.option(
    "--no-browser",
    is_flag=True,
    default=False,
    help="Don't open browser automatically, just print the URL",
)
def open_cli(
    zarr_path: Path,
    csv_path: Path | None = None,
    no_browser: bool = False,
) -> None:
    """
    Open a Zarr store in inTRACKtive viewer.

    Arguments:
        ZARR_PATH: Path to the Zarr store (directory ending in .zarr)

    This command will:
    1. Start a local server to host the Zarr store
    2. Generate a URL for viewing in inTRACKtive
    3. Open the browser (unless --no-browser is specified)

    The server will keep running until interrupted with Ctrl+C.

    Example usage:

    intracktive open /path/to/data.zarr
    intracktive open /path/to/data.zarr --no-browser
    """
    if not zarr_path.suffix == ".zarr":
        raise click.BadParameter(f"Path must end in .zarr, got: {zarr_path}")

    if not zarr_path.exists():
        raise click.BadParameter(f"Zarr store does not exist: {zarr_path}")

    if csv_path:
        print(f"CSV path provided: {csv_path}")

    zarr_to_browser(
        zarr_path=zarr_path,
        flag_open_browser=not no_browser,
        threaded=False,
        csv_path=csv_path,
    )


if __name__ == "__main__":
    open_cli()
