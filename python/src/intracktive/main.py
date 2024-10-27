import click
from intracktive.convert import convert_cli
from intracktive.server import server_cli


@click.group()
def main() -> None:
    pass


main.add_command(convert_cli)
main.add_command(server_cli)


if __name__ == "__main__":
    main()
