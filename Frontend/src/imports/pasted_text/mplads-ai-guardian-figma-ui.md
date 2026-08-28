# MPLADS AI-GUARDIAN — FULL INTERACTIVE FIGMA UI / PROTOTYPE

Design a **complete multi-screen interactive enterprise dashboard UI** for:

**MPLADS AI-Guardian**
*AI-Powered Fraud & Anomaly Detection Platform for MPLADS*

This is NOT a single landing page.

Create the **entire application UI**, including all screens, overlays, modals, forms, mobile inspector view, tables, filters, navigation states, and interaction states.

The prototype must feel like a real government fraud-detection SaaS product used by auditors, MPs, government officers, and field inspectors.

---

## 1. DESIGN LANGUAGE

Use a professional government + enterprise cybersecurity aesthetic.

### Colors

* Primary Navy: `#0F172A`
* Main Background: `#F8FAFC`
* Card: `#FFFFFF`
* Border: `#E2E8F0`
* Indigo: `#4F46E5`
* Violet: `#7C3AED`
* Safe Green: `#10B981`
* Review Amber: `#F59E0B`
* High Risk Red: `#EF4444`
* Text Primary: `#0F172A`
* Text Secondary: `#64748B`

Use:

* rounded-xl cards
* subtle shadows
* thin borders
* generous spacing
* strong metric typography
* Inter-style sans-serif
* clean government/enterprise dashboard aesthetic

Do NOT make it look like a generic consumer AI website.

---

# 2. GLOBAL APPLICATION SHELL

Every application screen should share the same shell.

### Desktop

Create:

**Top navigation/header**

Left:

* MPLADS AI-GUARDIAN logo
* Shield icon
* "AI-Powered Public Funds Intelligence"

Navigation:

* Dashboard
* Judge Live Test
* AI Audits
* Field Inspector

Right:

* AI Gateway: ONLINE
* Notification bell
* Government Officer avatar
* Profile dropdown

The active navigation item must be visually highlighted.

---

# 3. DASHBOARD SCREEN

Create the complete dashboard as the default screen.

### Header

Title:

**MPLADS AI-Guardian**

Subtitle:

"Real-time anomaly detection and fraud intelligence for public development funds."

Add:

* Last updated timestamp
* Refresh button
* "AI Gateway Online" badge

---

## KPI ROW

Four large cards:

### Total Funds Processed

₹50.4 Cr

### Active Proposals

45

### Anomaly Alerts

8 Red
4 Yellow

### Estimated Taxpayer Savings

₹3.2 Cr

Each KPI card should include:

* icon
* large number
* supporting text
* subtle trend indicator

---

# 4. MAIN DASHBOARD CONTENT

Use a 60/40 split layout.

## LEFT — GIS RISK MAP

Large card:

**MPLADS Risk Intelligence Map**

Create a realistic India/Mumbai-style district grid map visualization.

Show multiple project pins:

🟢 Green
🟡 Yellow
🔴 Red

Pins must visually correspond to projects.

Add map controls:

* Zoom +
* Zoom -
* Reset
* Layers

Top filter buttons:

**All**
**Duplicates**
**Overpricing**
**Split Sanctions**

Each filter should have an active/inactive state.

Clicking a project pin must open:

**Risk Audit Modal**

for that specific project.

---

# 5. RIGHT — LIVE AI ALERT FEED

Card title:

**Live AI Alert Feed**

Show alert cards such as:

🔴 Community Hall Kurla
Risk Score: 88/100
Duplicate Detection

🔴 Samaj Bhavan Kurla
Risk Score: 85/100
Duplicate Detection

🔴 Solar Street Lights Chembur
Risk Score: 92/100
Cost Inflation

🟡 Paver Block Footpath Ph 1
Risk Score: 58/100
Split Sanction

Each alert card contains:

* Project title
* Project ID
* Risk score
* Status badge
* anomaly type
* "Inspect AI Audit" button

Clicking the button opens the corresponding Risk Audit Modal.

---

# 6. AI AUDITS SCREEN

When the user clicks:

**AI Audits**

show a complete audit management page.

Header:

**AI Audit Center**

Subtitle:

"Review proposals flagged by the AI anomaly engine."

Add summary cards:

* Critical Risks
* Requires Review
* Verified
* Total Audited

Below create a full-width table.

Columns:

Project ID
Project
Location
Requested Amount
Risk Score
Anomaly
Status
Action

Rows:

MPLADS-2026-TRAP-001
Community Hall Kurla
₹15.0L
88
Duplicate
HIGH RISK

MPLADS-2026-TRAP-002
Samaj Bhavan Kurla
₹15.5L
85
Duplicate
HIGH RISK

MPLADS-2026-TRAP-003
Solar Street Lights Chembur
₹35.0L
92
Overpricing
HIGH RISK

MPLADS-2026-TRAP-004
Paver Block Footpath Ph 1
₹4.9L
58
Split Sanction
REVIEW

MPLADS-2026-BASE-001
RO Water Purification Plant
₹4.5L
12
None
VERIFIED

MPLADS-2026-BASE-002
Asphalt Road Resurfacing
₹18.0L
18
None
VERIFIED

Add:

* Search input
* Status filter
* Risk filter
* Sort dropdown
* pagination
* View Audit buttons

Clicking "View Audit" opens the Risk Audit Modal.

---

# 7. JUDGE LIVE TEST SCREEN

Create a dedicated page.

Title:

**Judge Live Test**

Subtitle:

"Submit a proposed MPLADS project and evaluate it through the AI risk gateway."

Use a polished 2-column form.

Fields:

### Work Title

Placeholder:
"e.g. Community Hall Construction"

### Project Description

Large textarea.

### Requested Amount

₹ input

### Standard BSR Benchmark Cost

₹ input

### Latitude

Input

### Longitude

Input

Add an information panel on the right:

**AI Evaluation Engine**

Show:

NLP Duplicate Detection
Cost Inflation Engine
Geospatial Analysis
Vendor Network Intelligence
Sanction Pattern Analysis

Button:

**✦ Evaluate Proposal via AI Gateway**

Use an indigo → violet gradient.

---

# 8. LIVE AI EVALUATION STATE

After clicking Evaluate:

First show a loading state:

**AI Gateway analyzing proposal...**

Show animated-looking processing steps:

✓ Parsing proposal
✓ Running NLP similarity
✓ Checking BSR benchmark
✓ Evaluating geospatial risk
● Generating risk score

Then show the result.

Example:

### HIGH FRAUD RISK

**90 / 100**

Risk factors:

🔴 Cost exceeds BSR benchmark
🔴 Description matches known project pattern
🟡 Geographic anomaly detected

Show:

**Proposal automatically added to Active AI Monitoring.**

Add buttons:

**View Full Audit**
**Submit Another Proposal**

---

# 9. RISK AUDIT MODAL

This is one of the most important UI states.

Create a large centered modal overlay with darkened background.

Header:

**AI Risk Audit**

Project ID:
MPLADS-2026-TRAP-001

Title:
Community Hall Kurla

Close X button.

---

## RISK SCORE

Large visual score:

**88 / 100**

**HIGH FRAUD RISK**

Use red status styling.

Include a horizontal risk meter:

LOW → MEDIUM → HIGH → CRITICAL

---

# 10. AUDIT BREAKDOWN TABS

Create clickable tabs:

**Overview**
**Duplicate Detection**
**Cost Analysis**
**Vendor Network**

The content changes when each tab is clicked.

---

## OVERVIEW TAB

Show:

Risk Factors

Duplicate Match
87%

BSR Inflation
Normal

Geofence Anomaly
180m

Vendor Risk
Elevated

Add a "Why was this flagged?" explanation card.

---

## DUPLICATE DETECTION TAB

Title:

**NLP Duplicate Detection**

Create side-by-side cards:

### Current Proposal

"Construction of Community Hall at Kurla..."

### Similar Proposal

"Construction of Community Hall at Kurla..."

Show:

**87% similarity**

Geofence:

**180 meters apart**

Add visual connection between both projects.

Badge:

**POSSIBLE DUPLICATE**

---

## COST ANALYSIS TAB

Title:

**Cost Inflation Engine**

Show:

Requested Cost
₹35.0L

Official BSR Benchmark
₹8.0L

Inflation:

**337%**

Create a large horizontal comparison bar.

Show:

Requested
████████████████████

BSR
█████

Alert:

**Cost significantly exceeds regional benchmark.**

---

## VENDOR NETWORK TAB

Title:

**Vendor Cartel Graph**

Create a network-style visualization.

Nodes:

Contractor
Agency
Project
Subcontractor

Connect them using lines.

Show relationship badges:

Shared Contractor
Repeated Agency
Split Sanction Pattern

---

# 11. MODAL ACTION BAR

At bottom of audit modal create three large buttons:

### Approve & Fast-Track

Green

### Request Field Audit

Amber

### Suspend & Freeze Payment

Red

Each button must have a different interaction state.

After clicking:

Approve:
Show confirmation state.

Field Audit:
Show "Field inspection requested."

Suspend:
Show red confirmation dialog:

**Freeze payment for this project?**

Buttons:

Cancel
Confirm Freeze

---

# 12. FIELD INSPECTOR SCREEN

Create a separate application screen.

Title:

**Field Inspector**

Subtitle:

"Verify project completion using on-site evidence."

The primary content should be a realistic **390px × 844px smartphone frame** centered on the page.

---

# 13. MOBILE PWA INSIDE PHONE

Phone screen should contain:

Top:

MPLADS AI-Guardian

Field Verification

Project:

Community Hall Kurla

Project ID:

MPLADS-2026-TRAP-001

Approved Location:

19.0728° N
72.8826° E

---

## CAMERA AREA

Large camera capture box.

Show camera icon.

Text:

**Capture Site Evidence**

Button:

**Take Photo**

When clicked, transition to:

**Photo Captured ✓**

---

# 14. EXIF EXTRACTION STATE

After photo capture show:

**Extracting Photo Metadata...**

Then:

✓ GPS Coordinates
✓ Timestamp
✓ Device ID
✓ Image Integrity

Display:

GPS:
19.0727° N
72.8825° E

Distance from approved site:

**12m**

Timestamp:

28 Aug 2026, 11:24 AM

Device:

FIELD-DEVICE-204

---

# 15. VERIFICATION RESULT

Green verification card:

🟢

**EXIF Location Verified**

"Coordinates match approved target site within 12m."

Status:

VERIFIED

Button:

**Verify & Trigger PFMS Payment Release**

After clicking:

Show success screen:

✓ Verification Complete

**PFMS Payment Release Triggered**

Reference:

PFMS-2026-XXXX

---

# 16. PROJECT DETAILS DRAWER

Clicking any project throughout the application should open either:

* Risk Audit Modal
  OR
* Project Details Drawer

Drawer contents:

Project ID
Project title
District
MP Constituency
Requested amount
BSR benchmark
Risk score
Current status
Detected anomalies
Contractor
Agency
Coordinates
Submission date

---

# 17. FILTER INTERACTIONS

The following must visually change the displayed data:

### All

Show all projects.

### Duplicates

Show duplicate-related projects.

### Overpricing

Show cost inflation projects.

### Split Sanctions

Show split-sanction projects.

When a filter is selected:

* selected button becomes navy/indigo
* inactive buttons remain white
* map pins update
* alert feed updates

---

# 18. NOTIFICATION PANEL

Clicking the bell icon opens a dropdown.

Show:

🔴 Critical anomaly detected
Community Hall Kurla

🔴 BSR inflation detected
Solar Street Lights Chembur

🟡 Split sanction warning
Paver Block Footpath

Add:

**Mark all as read**

---

# 19. PROFILE DROPDOWN

Clicking the profile avatar opens:

Government Officer

Role:
MPLADS Audit Officer

Menu:

Profile
Preferences
Audit Logs
Sign Out

---

# 20. REFRESH INTERACTION

Clicking Refresh:

Show temporary loading indicator:

**Refreshing AI intelligence...**

Then update:

Last updated:
Just now

---

# 21. EMPTY / SUCCESS / ERROR STATES

Design all important states.

Include:

* No alerts found
* No search results
* Evaluation success
* Field audit requested
* Payment frozen
* Payment release triggered
* Proposal approved
* Loading state
* Confirmation dialog

---

# 22. RESPONSIVE DESIGN

Create desktop-first design.

Also create responsive layouts for:

Desktop: 1440px
Tablet: 1024px
Mobile: 390px

On mobile:

* sidebar becomes hamburger menu
* KPI cards become stacked
* map becomes vertically scrollable
* tables become cards
* modals become full-screen
* Field Inspector remains optimized for mobile

---

# 23. FIGMA PROTOTYPE INTERACTIONS

IMPORTANT:

Do NOT create only static screens.

Create clickable prototype interactions between screens and states.

Required interactions:

Dashboard → Judge Live Test
Dashboard → AI Audits
Dashboard → Field Inspector

Dashboard project pin → Risk Audit Modal

Alert "Inspect AI Audit" → Risk Audit Modal

AI Audits "View Audit" → Risk Audit Modal

Risk Audit tabs → switch content

Audit actions → confirmation/success states

Judge Live Test Submit → loading state → result state

View Full Audit → Risk Audit Modal

Submit Another Proposal → empty form

Field Inspector Take Photo → captured state

Captured Photo → EXIF extraction state

EXIF extraction → verification state

Verify & Trigger PFMS Payment Release → success state

Notification Bell → notification dropdown

Profile → profile dropdown

Filter buttons → filtered dashboard state

Refresh → refreshing state

Close buttons → return to previous screen

---

# 24. IMPORTANT — BUILD ALL SCREENS

Do NOT stop after designing the Dashboard.

The final Figma file/prototype must contain these distinct application states:

1. Dashboard — Default
2. Dashboard — Duplicate Filter
3. Dashboard — Overpricing Filter
4. Dashboard — Split Sanction Filter
5. AI Audit Center
6. Risk Audit Modal — Overview
7. Risk Audit Modal — Duplicate Detection
8. Risk Audit Modal — Cost Analysis
9. Risk Audit Modal — Vendor Network
10. Freeze Payment Confirmation
11. Proposal Approved State
12. Field Audit Requested State
13. Judge Live Test — Empty
14. Judge Live Test — Loading
15. Judge Live Test — High Risk Result
16. Judge Live Test — Safe Result
17. Field Inspector — Project
18. Field Inspector — Camera
19. Field Inspector — Photo Captured
20. Field Inspector — EXIF Extraction
21. Field Inspector — Location Verified
22. Field Inspector — PFMS Success
23. Notifications Dropdown
24. Profile Dropdown
25. Mobile Dashboard

---

# 25. SAMPLE PROJECT DATA

Use these exact records in the UI:

### TRAP 001

MPLADS-2026-TRAP-001
Community Hall Kurla
₹15.0L
Risk: 88/100
RED
Reason: 87% duplicate match within 180m with TRAP-002

### TRAP 002

MPLADS-2026-TRAP-002
Samaj Bhavan Kurla
₹15.5L
Risk: 85/100
RED
Reason: Near identical description & coordinates

### TRAP 003

MPLADS-2026-TRAP-003
Solar Street Lights Chembur
₹35.0L
BSR: ₹8.0L
Risk: 92/100
RED
Reason: 337% cost inflation over BSR

### TRAP 004

MPLADS-2026-TRAP-004
Paver Block Footpath Ph 1 Ghatkopar
₹4.9L
Risk: 58/100
YELLOW
Reason: Split sanction warning

### BASE 001

MPLADS-2026-BASE-001
RO Water Purification Plant
₹4.5L
Risk: 12/100
GREEN
Verified

### BASE 002

MPLADS-2026-BASE-002
Asphalt Road Resurfacing
₹18.0L
Risk: 18/100
GREEN
Verified

---

# 26. FINAL QUALITY BAR

The result should look like a **production-ready government AI fraud intelligence platform**, not a generic admin dashboard.

Prioritize:

* information hierarchy
* data density
* clear risk visualization
* excellent spacing
* polished cards
* meaningful empty/loading/success states
* realistic government workflow
* strong visual distinction between Safe / Review / High Risk
* complete navigation
* clickable prototype interactions
* every major button should lead somewhere meaningful

Most importantly:

**Do not generate just the first dashboard screen.**

Generate the complete application experience and connect the screens using Figma prototype interactions.
