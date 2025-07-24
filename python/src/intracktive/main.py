import logging
import sys

import click
from intracktive.convert import convert_cli
from intracktive.open import open_cli
from intracktive.server import server_cli


@click.group()
def main() -> None:
    # Configure logging for CLI
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


main.add_command(convert_cli)
main.add_command(server_cli)
main.add_command(open_cli)

if __name__ == "__main__":
    main()
