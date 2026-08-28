# Frontend Analytics Plan

Use these dataset attributes to explain the fraud-detection workflow visually.

## Executive Summary Cards

- total projects
- total allocation amount
- GREEN/YELLOW/RED project counts
- possible duplicate count
- possible cost-outlier count
- IsolationForest anomaly count
- possible split-sanction count
- pending/unsanctioned count

## Recommended Graphs

1. Risk level distribution
   - x-axis: `model_risk_level`
   - y-axis: project count
   - chart: bar or donut

2. Risk score histogram
   - x-axis: `model_risk_score` buckets
   - y-axis: project count
   - chart: histogram

3. State-wise risk heat table
   - rows: `state`
   - values: project count, RED count, YELLOW count, total allocation
   - chart: table with conditional formatting

4. Constituency high-risk ranking
   - x-axis: constituency
   - y-axis: RED/YELLOW count or total risk amount
   - chart: horizontal bar

5. Category-wise cost outliers
   - x-axis: `category`
   - y-axis: count of rows where `model_financial_score >= 45`
   - chart: bar

6. Amount vs risk scatter plot
   - x-axis: `allocation_amount_numeric`
   - y-axis: `model_risk_score`
   - color: `model_risk_level`
   - chart: scatter

7. Duplicate cluster table
   - columns: `work_clean`, `state`, `constituency`, `block`, `village`, `same_work_same_locality_count`
   - sort: highest `same_work_same_locality_count`

8. Split-sanction watchlist
   - columns: `mp_name_canonical`, `ida`, `locality`, `same_ida_locality_7day_sub5l_count`, `allocation_amount_numeric`
   - filter: `model_split_sanction_score >= 60`

9. Pending workflow monitor
   - x-axis: `ida_approval`
   - y-axis: project count
   - filter: `status_unsanctioned_flag = true`

10. IsolationForest anomaly distribution
    - x-axis: `isolation_forest_risk_score` buckets
    - y-axis: project count
    - highlight: `isolation_forest_anomaly_flag = true`
    - chart: histogram

11. Rule financial vs ML anomaly scatter
    - x-axis: `model_financial_rule_score`
    - y-axis: `isolation_forest_risk_score`
    - color: `model_risk_level`
    - chart: scatter

12. MP allocation utilization
    - x-axis: `mp_name_canonical`
    - y-axis: `mp_total_recommended_amount`
    - optional line/reference: `mp_allocated_amount`

## Best Dashboard Filters

- state
- constituency
- MP
- implementing agency / IDA
- category
- status
- risk level
- IsolationForest anomaly flag
- weak label type

## Map View Later

After coordinates are added:

- marker latitude/longitude
- marker color: `model_risk_level`
- popup: project title, allocation amount, risk score, reasons
- layer toggles: duplicates, cost outliers, split sanctions, pending risk
