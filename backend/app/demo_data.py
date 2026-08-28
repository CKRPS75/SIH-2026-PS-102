from __future__ import annotations

from app.schemas.project import AgencyInput, ContractorInput, CostItemInput, LocationInput, ProjectCreate


def demo_projects() -> list[ProjectCreate]:
    agency = AgencyInput(name="District Rural Works Agency", district="Demo District", state="Maharashtra")
    contractor_normal = ContractorInput(legal_name="ABC Infra")
    contractor_split = ContractorInput(legal_name="Same Vendor Works")
    return [
        ProjectCreate(
            external_work_id="MPLADS-DEMO-001",
            title="Construction of Community Center",
            description="Community center near Ward 4 school",
            district="Demo District",
            state="Maharashtra",
            agency=agency,
            contractor=contractor_normal,
            location=LocationInput(lat=19.0760, lng=72.8777),
            estimated_cost=900000,
            cost_items=[
                CostItemInput(
                    item_code="COMMUNITY-HALL",
                    description="Small community hall structure",
                    quantity=1,
                    unit="job",
                    proposed_rate=900000,
                    bsr_rate=850000,
                )
            ],
            award_date="2026-08-20",
            bid_count=3,
            source="DEMO_SEED",
        ),
        ProjectCreate(
            external_work_id="MPLADS-DEMO-002",
            title="100m Drainage Line",
            description="Construction of standard storm water drainage line",
            district="Demo District",
            state="Maharashtra",
            agency=agency,
            contractor=ContractorInput(legal_name="High Cost Contractors"),
            location=LocationInput(lat=19.0800, lng=72.8800),
            estimated_cost=2500000,
            cost_items=[
                CostItemInput(
                    item_code="DRAIN-100M",
                    description="Standard 100m drainage line",
                    quantity=1,
                    unit="job",
                    proposed_rate=2500000,
                    bsr_rate=300000,
                )
            ],
            award_date="2026-08-22",
            bid_count=2,
            source="DEMO_SEED",
        ),
        ProjectCreate(
            external_work_id="MPLADS-DEMO-003",
            title="Const. of Samaj Bhavan",
            description="Samaj Bhavan building near Ward 4 school",
            district="Demo District",
            state="Maharashtra",
            agency=agency,
            contractor=ContractorInput(legal_name="XYZ Civil Works"),
            location=LocationInput(lat=19.0762, lng=72.8779),
            estimated_cost=880000,
            cost_items=[
                CostItemInput(
                    item_code="COMMUNITY-HALL",
                    description="Small community hall structure",
                    quantity=1,
                    unit="job",
                    proposed_rate=880000,
                    bsr_rate=850000,
                )
            ],
            award_date="2026-08-23",
            bid_count=3,
            source="DEMO_SEED",
        ),
        ProjectCreate(
            external_work_id="MPLADS-DEMO-004",
            title="Paving work phase 1",
            description="Internal lane paving in ward 8",
            district="Demo District",
            state="Maharashtra",
            agency=agency,
            contractor=contractor_split,
            location=LocationInput(lat=19.0900, lng=72.8900),
            estimated_cost=490000,
            cost_items=[],
            award_date="2026-08-24",
            bid_count=1,
            source="DEMO_SEED",
        ),
        ProjectCreate(
            external_work_id="MPLADS-DEMO-005",
            title="Paving work phase 2",
            description="Internal lane paving beside ward 8 school",
            district="Demo District",
            state="Maharashtra",
            agency=agency,
            contractor=contractor_split,
            location=LocationInput(lat=19.0903, lng=72.8902),
            estimated_cost=490000,
            cost_items=[],
            award_date="2026-08-25",
            bid_count=1,
            source="DEMO_SEED",
        ),
        ProjectCreate(
            external_work_id="MPLADS-DEMO-006",
            title="Paving work phase 3",
            description="Internal lane paving continuation in ward 8",
            district="Demo District",
            state="Maharashtra",
            agency=agency,
            contractor=contractor_split,
            location=LocationInput(lat=19.0906, lng=72.8904),
            estimated_cost=490000,
            cost_items=[],
            award_date="2026-08-26",
            bid_count=1,
            source="DEMO_SEED",
        ),
    ]
