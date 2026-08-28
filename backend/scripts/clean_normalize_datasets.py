from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Iterable


PROJECT_TRAIN = "MPLADS_train.csv"
PROJECT_TEST = "MPLADS_test.csv"
ALLOCATION_TRAIN_SUFFIX = "_train.csv"
ALLOCATION_TEST_SUFFIX = "_test.csv"


def clean_text(value: str | None) -> str:
    value = "" if value is None else str(value)
    value = value.replace("\ufeff", "")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_key(value: str | None) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def normalize_work_text(value: str | None) -> str:
    value = clean_text(value)
    value = re.sub(r"^(na|n/a)\s*[-:]\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^[A-Z]{1,5}/[A-Z0-9/.\-]+\s*[-:]\s*", "", value, flags=re.IGNORECASE)
    value = value.replace("&", " and ")
    value = re.sub(r"\bconst[.]?\b", "construction", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" -")


def canonical_person_name(value: str | None) -> str:
    value = clean_text(value)
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(
        r"\b(shri|smt|smt\.|dr|dr\.|mr|mr\.|mrs|mrs\.|ms|ms\.|adv|adv\.|prof|prof\.)\b",
        " ",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"[^A-Za-z ]+", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip().title()


def parse_amount(value: str | None) -> str:
    value = clean_text(value)
    if not value:
        return ""
    value = value.replace(",", "")
    value = re.sub(r"[^0-9.\-]", "", value)
    if value in {"", ".", "-", "-."}:
        return ""
    try:
        amount = float(value)
    except ValueError:
        return ""
    if amount.is_integer():
        return str(int(amount))
    return f"{amount:.2f}".rstrip("0").rstrip(".")


def parse_iso_date(value: str | None) -> str:
    value = clean_text(value)
    if not value:
        return ""
    candidates = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
        "%d-%b-%Y",
        "%d %b %Y",
    ]
    for fmt in candidates:
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def stable_id(*parts: str) -> str:
    raw = "|".join(clean_text(part) for part in parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def data_quality_flags(row: dict[str, str]) -> list[str]:
    flags: list[str] = []
    if not row["work_clean"]:
        flags.append("missing_work")
    if not row["allocation_amount"]:
        flags.append("missing_or_invalid_amount")
    if not row["recommended_date"]:
        flags.append("missing_or_invalid_recommended_date")
    if not row["locality_key"]:
        flags.append("missing_locality")
    if not row["ida_key"]:
        flags.append("missing_implementing_agency")
    return flags


def normalize_project_rows(rows: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    for index, source in enumerate(rows, start=1):
        mp_name = clean_text(source.get("MP NAME"))
        mp_name_canonical = canonical_person_name(mp_name)
        work_clean = normalize_work_text(source.get("WORK"))
        state = clean_text(source.get("STATE")).title()
        constituency = clean_text(source.get("CONSTITUENCY")).upper()
        city = clean_text(source.get("CITY")).title()
        ward = clean_text(source.get("WARD"))
        block = clean_text(source.get("BLOCK")).title()
        village = clean_text(source.get("VILLAGE")).title()
        ida = clean_text(source.get("IDA"))
        recommended_date = parse_iso_date(source.get("RECOMMENDED DATE"))
        allocation_amount = parse_amount(source.get("ALLOCATION AMOUNT"))
        locality = ", ".join(part for part in [city, ward, block, village] if part)
        locality_key = normalize_key("|".join(part for part in [city, ward, block, village] if part))
        work_key = normalize_key(work_clean)
        project_key = stable_id(
            mp_name,
            work_key,
            state,
            constituency,
            locality_key,
            recommended_date,
            allocation_amount,
            ida,
        )
        duplicate_group_key = stable_id(work_key, state, constituency, locality_key, allocation_amount)

        row = {
            "project_key": project_key,
            "source_row_number": str(index),
            "mp_name": mp_name,
            "mp_name_canonical": mp_name_canonical,
            "mp_key": normalize_key(mp_name_canonical or mp_name),
            "work_raw": clean_text(source.get("WORK")),
            "work_clean": work_clean,
            "work_key": work_key,
            "category": clean_text(source.get("CATEGORY")),
            "state": state,
            "state_key": normalize_key(state),
            "constituency": constituency,
            "constituency_key": normalize_key(constituency),
            "ida": ida,
            "ida_key": normalize_key(ida),
            "city": city,
            "ward": ward,
            "block": block,
            "village": village,
            "locality": locality,
            "locality_key": locality_key,
            "recommended_date": recommended_date,
            "allocation_amount": allocation_amount,
            "ida_approval": clean_text(source.get("IDA APPROVAL")),
            "status": clean_text(source.get("STATUS")),
            "house": clean_text(source.get("HOUSE")),
            "duplicate_group_key": duplicate_group_key,
            "source_dataset": "MPLADS",
        }
        row["data_quality_flags"] = "|".join(data_quality_flags(row))
        normalized.append(row)

    counts = Counter(row["duplicate_group_key"] for row in normalized)
    for row in normalized:
        row["exact_duplicate_group_count"] = str(counts[row["duplicate_group_key"]])
        row["is_exact_duplicate_candidate"] = "true" if counts[row["duplicate_group_key"]] > 1 else "false"
    return normalized


def normalize_allocation_rows(rows: Iterable[dict[str, str]], source_dataset: str) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    for index, source in enumerate(rows, start=1):
        mp_name = first_present(
            source,
            "Hon'ble Members of Parliament",
            "Hon'ble Members of Parliaments",
        )
        mp_name_canonical = canonical_person_name(mp_name)
        state = clean_text(source.get("State")).title()
        constituency = clean_text(source.get("Constituency")).upper()
        elected_nominated = clean_text(source.get("Elected/Nominated"))
        allocation_amount = parse_amount(first_header_containing(source, "allocated amount"))
        row = {
            "allocation_key": stable_id(source_dataset, mp_name, state, constituency, elected_nominated, allocation_amount),
            "source_dataset": source_dataset,
            "source_row_number": str(index),
            "serial_number": clean_text(source.get("Sr. No.")),
            "state": state,
            "state_key": normalize_key(state),
            "mp_name": clean_text(mp_name),
            "mp_name_canonical": mp_name_canonical,
            "mp_key": normalize_key(mp_name_canonical or mp_name),
            "constituency": constituency,
            "constituency_key": normalize_key(constituency),
            "elected_nominated": elected_nominated,
            "member_type_key": normalize_key(elected_nominated),
            "allocated_amount": allocation_amount,
        }
        flags: list[str] = []
        if not row["mp_name"]:
            flags.append("missing_mp_name")
        if not row["state"]:
            flags.append("missing_state")
        if not row["allocated_amount"]:
            flags.append("missing_or_invalid_allocated_amount")
        row["data_quality_flags"] = "|".join(flags)
        output.append(row)
    return output


def first_present(row: dict[str, str], *headers: str) -> str:
    for header in headers:
        value = clean_text(row.get(header))
        if value:
            return value
    return ""


def first_header_containing(row: dict[str, str], needle: str) -> str:
    needle_key = normalize_key(needle)
    for header, value in row.items():
        if needle_key in normalize_key(header):
            return clean_text(value)
    return ""


def summarize(rows: list[dict[str, str]], quality_field: str = "data_quality_flags") -> dict[str, object]:
    flags = Counter()
    for row in rows:
        for flag in row.get(quality_field, "").split("|"):
            if flag:
                flags[flag] += 1
    return {
        "rows": len(rows),
        "rows_with_quality_flags": sum(1 for row in rows if row.get(quality_field)),
        "quality_flag_counts": dict(sorted(flags.items())),
    }


def allocation_split_files(input_dir: Path, suffix: str) -> list[Path]:
    return sorted(
        path
        for path in input_dir.glob(f"*{suffix}")
        if path.name != PROJECT_TRAIN
        and path.name != PROJECT_TEST
        and path.name != "split_manifest.json"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean and normalize SIH train/test datasets.")
    parser.add_argument("--input-dir", type=Path, default=Path("data/splits"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/processed"))
    args = parser.parse_args()

    train_projects = normalize_project_rows(read_csv(args.input_dir / PROJECT_TRAIN))
    test_projects = normalize_project_rows(read_csv(args.input_dir / PROJECT_TEST))

    train_allocations: list[dict[str, str]] = []
    for path in allocation_split_files(args.input_dir, ALLOCATION_TRAIN_SUFFIX):
        train_allocations.extend(normalize_allocation_rows(read_csv(path), path.stem.removesuffix("_train")))

    test_allocations: list[dict[str, str]] = []
    for path in allocation_split_files(args.input_dir, ALLOCATION_TEST_SUFFIX):
        test_allocations.extend(normalize_allocation_rows(read_csv(path), path.stem.removesuffix("_test")))

    project_fields = [
        "project_key",
        "source_row_number",
        "mp_name",
        "mp_name_canonical",
        "mp_key",
        "work_raw",
        "work_clean",
        "work_key",
        "category",
        "state",
        "state_key",
        "constituency",
        "constituency_key",
        "ida",
        "ida_key",
        "city",
        "ward",
        "block",
        "village",
        "locality",
        "locality_key",
        "recommended_date",
        "allocation_amount",
        "ida_approval",
        "status",
        "house",
        "duplicate_group_key",
        "exact_duplicate_group_count",
        "is_exact_duplicate_candidate",
        "data_quality_flags",
        "source_dataset",
    ]
    allocation_fields = [
        "allocation_key",
        "source_dataset",
        "source_row_number",
        "serial_number",
        "state",
        "state_key",
        "mp_name",
        "mp_name_canonical",
        "mp_key",
        "constituency",
        "constituency_key",
        "elected_nominated",
        "member_type_key",
        "allocated_amount",
        "data_quality_flags",
    ]

    write_csv(args.output_dir / "projects_train_normalized.csv", train_projects, project_fields)
    write_csv(args.output_dir / "projects_test_normalized.csv", test_projects, project_fields)
    write_csv(args.output_dir / "mp_allocations_train_normalized.csv", train_allocations, allocation_fields)
    write_csv(args.output_dir / "mp_allocations_test_normalized.csv", test_allocations, allocation_fields)

    report = {
        "projects_train": summarize(train_projects),
        "projects_test": summarize(test_projects),
        "mp_allocations_train": summarize(train_allocations),
        "mp_allocations_test": summarize(test_allocations),
        "notes": [
            "Source split files are preserved under data/splits.",
            "No fraud labels are created in this step; only cleaning, normalization, and data-quality flags are added.",
            "Latitude/longitude are not present in the supplied MPLADS.csv, so geospatial duplicate detection still needs coordinates from another source.",
        ],
    }
    report_path = args.output_dir / "cleaning_report.json"
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
