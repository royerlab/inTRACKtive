import click

from intracktive.convert import convert_csv


@click.group()
def main() -> None:
    pass


main.add_command(convert_csv)


if __name__ == "__main__":
    main()
