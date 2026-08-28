from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from build_features import add_features  # noqa: E402


def project_row(project_key: str, work: str) -> dict[str, object]:
    return {
        "project_key": project_key,
        "source_row_number": project_key,
        "mp_name": "Rajesh Sharma",
        "mp_name_canonical": "Rajesh Sharma",
        "mp_key": "rajesh_sharma",
        "work_raw": work,
        "work_clean": work,
        "work_key": work.lower().replace(" ", "_"),
        "category": "Community Infrastructure",
        "state": "Maharashtra",
        "state_key": "maharashtra",
        "constituency": "Mumbai North East",
        "constituency_key": "mumbai_north_east",
        "ida": "District Planning Officer",
        "ida_key": "district_planning_officer",
        "city": "Kurla West",
        "ward": "Ward 12",
        "block": "Kurla",
        "village": "",
        "locality": "Kurla West, Ward 12, Kurla",
        "locality_key": "kurla_west_ward_12_kurla",
        "recommended_date": "2026-08-10",
        "allocation_amount": "1500000",
        "ida_approval": "Pending",
        "status": "Proposed",
        "house": "Lok Sabha",
        "duplicate_group_key": project_key,
        "exact_duplicate_group_count": "1",
        "is_exact_duplicate_candidate": "false",
        "data_quality_flags": "",
    }


class FeatureBuilderTest(unittest.TestCase):
    def test_same_category_same_locality_detects_similar_type_duplicate(self) -> None:
        projects = pd.DataFrame(
            [
                project_row("P-001", "Construction of community hall near Kurla Station"),
                project_row("P-002", "Construction of Samaj Bhavan building at Kurla West"),
            ]
        )
        allocation_lookup = pd.DataFrame(
            [
                {
                    "mp_key": "rajesh_sharma",
                    "state_key": "maharashtra",
                    "mp_allocated_amount": 50_000_000,
                }
            ]
        )
        amount = pd.Series(
            [1_000_000],
            index=pd.Index(["Community Infrastructure"], name="category"),
        )
        state_amount = pd.Series(
            [1_000_000],
            index=pd.MultiIndex.from_tuples(
                [("maharashtra", "Community Infrastructure")],
                names=["state_key", "category"],
            ),
        )
        constituency_amount = pd.Series(
            [1_000_000],
            index=pd.MultiIndex.from_tuples(
                [("mumbai_north_east", "Community Infrastructure")],
                names=["constituency_key", "category"],
            ),
        )

        features = add_features(projects, allocation_lookup, projects, state_amount, amount, constituency_amount)

        self.assertEqual(features["same_work_same_locality_count"].tolist(), [1, 1])
        self.assertEqual(features["same_work_same_duplicate_location_count"].tolist(), [1, 1])
        self.assertEqual(features["same_category_same_locality_count"].tolist(), [2, 2])
        self.assertEqual(features["same_type_location_month_count"].tolist(), [2, 2])
        self.assertEqual(features["duplicate_location_key"].tolist(), ["kurla_west_ward_12", "kurla_west_ward_12"])
        self.assertEqual(features["possible_type_location_duplicate"].tolist(), ["true", "true"])
        self.assertEqual(features["weak_label_duplicate"].tolist(), ["true", "true"])


if __name__ == "__main__":
    unittest.main()
