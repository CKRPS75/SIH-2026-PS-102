from __future__ import annotations

import argparse
import csv
import json
import random
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


@dataclass(frozen=True)
class Table:
    source: Path
    sheet: str | None
    header: list[str]
    rows: list[list[str]]


def slugify(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_")
    return value or "dataset"


def read_csv_table(path: Path) -> Table:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        reader = csv.reader(handle, dialect)
        header = next(reader)
        rows = [row for row in reader if any(cell.strip() for cell in row)]
    return Table(source=path, sheet=None, header=header, rows=rows)


def read_xlsx_tables(path: Path) -> list[Table]:
    with zipfile.ZipFile(path) as archive:
        shared_strings = read_shared_strings(archive)
        sheet_targets = read_sheet_targets(archive)
        tables: list[Table] = []
        for sheet_name, target in sheet_targets:
            rows = read_xlsx_sheet_rows(archive, target, shared_strings)
            header_index = best_header_row_index(rows)
            if header_index is None:
                tables.append(Table(source=path, sheet=sheet_name, header=[], rows=[]))
                continue
            header = normalize_header(rows[header_index])
            body = normalize_body_rows(rows[header_index + 1 :], len(header))
            tables.append(Table(source=path, sheet=sheet_name, header=header, rows=body))
        return tables


def read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for item in root.findall(f"{{{MAIN_NS}}}si"):
        parts = [node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t")]
        values.append("".join(parts))
    return values


def read_sheet_targets(archive: zipfile.ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall(f"{{{PKG_REL_NS}}}Relationship")}

    targets: list[tuple[str, str]] = []
    for sheet in workbook.findall(f"{{{MAIN_NS}}}sheets/{{{MAIN_NS}}}sheet"):
        relation_id = sheet.attrib[f"{{{REL_NS}}}id"]
        target = rel_map[relation_id].lstrip("/")
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        targets.append((sheet.attrib["name"], target))
    return targets


def read_xlsx_sheet_rows(
    archive: zipfile.ZipFile,
    target: str,
    shared_strings: list[str],
) -> list[list[str]]:
    root = ET.fromstring(archive.read(target))
    parsed_rows: list[list[str]] = []
    for row in root.findall(f".//{{{MAIN_NS}}}sheetData/{{{MAIN_NS}}}row"):
        values_by_index: dict[int, str] = {}
        for cell in row.findall(f"{{{MAIN_NS}}}c"):
            index = column_index_from_ref(cell.attrib.get("r", "A1"))
            values_by_index[index] = read_cell_value(cell, shared_strings)
        if not values_by_index:
            parsed_rows.append([])
            continue
        max_index = max(values_by_index)
        parsed_rows.append([values_by_index.get(index, "") for index in range(max_index + 1)])
    return parsed_rows


def read_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t")).strip()

    value = cell.find(f"{{{MAIN_NS}}}v")
    if value is None or value.text is None:
        return ""

    raw = value.text.strip()
    if cell_type == "s":
        try:
            return shared_strings[int(raw)]
        except (IndexError, ValueError):
            return raw
    return raw


def column_index_from_ref(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref.upper())
    if not letters:
        return 0
    index = 0
    for char in letters.group(0):
        index = index * 26 + (ord(char) - ord("A") + 1)
    return index - 1


def best_header_row_index(rows: list[list[str]]) -> int | None:
    populated = [
        (index, sum(1 for cell in row if str(cell).strip()))
        for index, row in enumerate(rows[:20])
    ]
    populated = [item for item in populated if item[1] > 0]
    if not populated:
        return None
    max_width = max(width for _, width in populated)
    for index, width in populated:
        if width == max_width:
            return index
    return None


def normalize_header(row: list[str]) -> list[str]:
    header: list[str] = []
    for index, value in enumerate(row):
        label = str(value).strip() or f"column_{index + 1}"
        header.append(label)
    return header


def normalize_body_rows(rows: Iterable[list[str]], width: int) -> list[list[str]]:
    body: list[list[str]] = []
    for row in rows:
        normalized = [str(cell).strip() for cell in row[:width]]
        normalized += [""] * (width - len(normalized))
        if any(normalized):
            body.append(normalized)
    return body


def split_rows(rows: list[list[str]], train_ratio: float, seed: int) -> tuple[list[list[str]], list[list[str]]]:
    shuffled = rows[:]
    random.Random(seed).shuffle(shuffled)
    train_count = int(len(shuffled) * train_ratio)
    return shuffled[:train_count], shuffled[train_count:]


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def split_table(table: Table, output_dir: Path, train_ratio: float, seed: int) -> dict[str, object]:
    base_name = slugify(table.source.stem)
    if table.sheet:
        base_name = f"{base_name}_{slugify(table.sheet)}"

    train_rows, test_rows = split_rows(table.rows, train_ratio, seed)
    train_path = output_dir / f"{base_name}_train.csv"
    test_path = output_dir / f"{base_name}_test.csv"
    write_csv(train_path, table.header, train_rows)
    write_csv(test_path, table.header, test_rows)

    return {
        "source": str(table.source),
        "sheet": table.sheet,
        "columns": table.header,
        "total_rows": len(table.rows),
        "train_rows": len(train_rows),
        "test_rows": len(test_rows),
        "train_file": str(train_path),
        "test_file": str(test_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Split supplied SIH datasets into train/test CSVs.")
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("data/splits"))
    parser.add_argument("--train-ratio", type=float, default=0.80)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not 0 < args.train_ratio < 1:
        raise ValueError("--train-ratio must be between 0 and 1")

    manifest: list[dict[str, object]] = []
    for input_path in args.inputs:
        if input_path.suffix.lower() == ".csv":
            tables = [read_csv_table(input_path)]
        elif input_path.suffix.lower() == ".xlsx":
            tables = read_xlsx_tables(input_path)
        else:
            raise ValueError(f"Unsupported input file: {input_path}")

        for table in tables:
            manifest.append(split_table(table, args.output_dir, args.train_ratio, args.seed))

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output_dir / "split_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
