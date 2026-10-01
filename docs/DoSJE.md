# DoSJE Domain Model

Persistent domain knowledge base for NETRAM. Written for humans and future coding
agents so the DoSJE domain does not have to be rediscovered every session.

Legend used throughout:

- **Officially documented** - stated in an official government source (URL given).
- **Observed implementation** - what the DoSJE Social Audit MIS portal actually
  implements, as observed in its public pages/data (may not match policy documents).
- **Inferred** - derived from multiple official sources; not stated verbatim anywhere.
- **NETRAM design decision** - a choice NETRAM makes; not a DoSJE fact.
- **Needs further verification** - plausible but unconfirmed.

---

## 1. Purpose of this Document

NETRAM is being aligned to the real operational model of the Department of Social
Justice and Empowerment (DoSJE), Government of India. This file records:

- what DoSJE actually is and how it operates,
- how the Social Audit system works,
- what the schemes are and what they fund,
- the terminology DoSJE uses,
- the mapping between that reality and NETRAM's data model,
- every source used, and every place where NETRAM had to make a judgement call.

Update this file whenever a domain decision is made in code (AGENTS.md §60 - document domain decisions when made in code).

## 2. NETRAM and DoSJE

NETRAM is a Smart India Hackathon 2026 project for problem statement **SIH26095**
(see section 3). It is a monitoring and inspection platform, not a scheme
management system, not a beneficiary DBT system, and not an accounting system.

DoSJE (Department of Social Justice and Empowerment, under the Ministry of Social
Justice and Empowerment, MoSJE) runs welfare schemes implemented through:

- State Governments / UTs (scholarships, PM-AJAY components),
- grant-in-aid (GIA) to NGOs/voluntary organisations (senior citizen homes,
  de-addiction centres/IRCA, residential schools, Garima Greh),
- central sector components (RVY assistive devices, SAGE, SCOPE).

The department cannot personally watch every institution. Its stated mechanisms
for oversight are (all under the I-MESA scheme, section 20):

- a Project Monitoring Unit (PMU) doing surprise inspections,
- a Central Smart Surveillance Unit (CSSU) connecting GIA institutions' CCTV,
- Social Audit through State Social Audit Units (SAUs),
- periodic third-party evaluation studies.

NETRAM productises the first three: real-time CCTV monitoring, surprise
inspections with random assignment, geo-tagged evidence, findings, corrective
action tracking, and complaint oversight, converging on each monitored entity.

**Officially documented.** Source: I-MESA guidelines
(https://socialjustice.gov.in/social-audit/public/report-doc/realted-material/i mesa guideline dosje.pdf).

## 3. SIH Problem Statement

> **SIH26095 - Smart Real-Time Monitoring & Inspection Mobile App**
> "Develop a centralised mobile application for real-time monitoring, surprise
> inspections, CCTV surveillance integration, and random inspection assignment
> for projects/institutes/NGOs running under DoSJE schemes."

Key features per the statement: live CCTV integration, random VC with project
in-charge/staff/beneficiaries, real-time dashboard for department officials,
mobile inspection module for PMU/inspection teams, AI-assisted random assignment,
geo-tagged reports and live evidence capture, AI anomaly and attendance analytics.

Source: https://netram.vercel.app/ (project site quoting the PS), SIH 2026 portal.

Consequence for the domain model: the central monitored thing in the problem
statement is deliberately open-ended - "projects/institutes/NGOs running under
DoSJE schemes". Research (sections 22-25) confirms the real audited targets are
of several concrete types: institutions (homes, hostels, schools, IRCAs) AND
villages. NETRAM must therefore model a general monitored implementation target
with typed sub-kinds (see section 23).

## 4. DoSJE Organisational Structure

**Officially documented.**

```
Government of India
  |
Ministry of Social Justice and Empowerment (MoSJE)
  |
Department of Social Justice and Empowerment (DoSJE)   <- the department NETRAM serves
  |
  +-- Schemes (AVYAY, NAPDDR, PM-AJAY, SHRESHTA, PM-YASASVI, I-MESA, ...)
  +-- National institutes (NISD, NILD, etc.)
  +-- Corporations & foundations (NSFDC, NBCFDC, Dr. Ambedkar Foundation, ...)
  +-- Statutory commissions (NCSC, NCBC, CIC for the sector)
```

DoSJE scheme implementation reaches the ground through three channels:

1. **State/UT Governments** - scholarships, PM-AJAY village/hostel components,
   implemented by state social welfare departments and district administration.
2. **Grant-in-aid NGOs/VOs** - senior citizen homes (AVYAY/IPSrC), IRCA
   de-addiction centres (NAPDDR), residential schools (SHRESHTA Mode 2), hostels.
3. **Direct central components** - RVY, SAGE, SCOPE, coaching, PM DAKSH.

Sources:

- DoSJE main site: https://socialjustice.gov.in/
- Scheme pages: https://socialjustice.gov.in/schemes/43 (AVYAY) etc.

## 5. Authority and Responsibility

Distinct roles that the DoSJE system actually distinguishes (NETRAM must keep
them separate too):

| Function                                       | Who does it                                                         | Source status         |
| ---------------------------------------------- | ------------------------------------------------------------------- | --------------------- |
| Owns schemes, funds them, sets audit framework | DoSJE (MoSJE)                                                       | Officially documented |
| Implements state components                    | State Social Welfare / nodal departments                            | Officially documented |
| Implements district administration             | District Collector/DM, DSWO                                         | Officially documented |
| Runs GIA institutions                          | NGOs / voluntary organisations (societies, trusts)                  | Officially documented |
| Conducts surprise inspections                  | PMU (I-MESA component 2), hosted in NISD                            | Officially documented |
| Runs central CCTV monitoring                   | CSSU (I-MESA component 3) via external agency                       | Officially documented |
| Conducts social audits                         | State SAUs via their Social Justice Cells                           | Officially documented |
| Trains/handholds SAUs                          | NRCSA (technical resource agency)                                   | Officially documented |
| Responds to findings / submits ATRs            | Implementing department / institution                               | Officially documented |
| Reviews findings, orders action                | District panel of the Social Justice Assembly; state assembly panel | Officially documented |

Key separation: the **auditor is independent of the implementer**. SAUs sit
outside the implementing departments (in Odisha under the Panchayati Raj
department, not the Social Welfare department). NETRAM must never let an
implementing organisation approve, review, or verify its own compliance.

## 6. National-Level Structure

- **DoSJE** - owns schemes; convenes the National Annual Review Meet.
- **NISD** (National Institute of Social Defence) - hosts the PMU (I-MESA) and,
  since 27/01/2023, hosts NRCSA. Also the nodal institute for drug-demand and
  senior-citizen training.
- **NRCSA** (National Resource Cell/Centre for Social Audit of DoSJE schemes) -
  special unit originally at the Centre for Social Audit, NIRDPR Hyderabad
  (established June 2022), relocated to NISD New Delhi. Acts as the bridge
  between DoSJE and State SAUs: trains Social Justice Cells, monitors audit
  progress/quality, provides technical assistance. Convenes the National Annual
  Review Meet jointly with DoSJE.

**Officially documented.** Sources:

- https://socialjustice.gov.in/social-audit/about-us-nrcsa
- Social Audit Handbook for Social Justice Cell Members, NRC-CSA/NIRDPR, Sept 2022
  (https://socialjustice.gov.in/social-audit/public/report-doc/calender-material/Handbook%20for%20Social%20Audit%20of%20Scheme%20of%20DoSJE_05%20Sept.2022.pdf)

## 7. State-Level Structure

- **State Social Audit Unit (SAU)** - a society or directorate set up in every
  state (originally under Rural Development departments for MGNREGA; DoSJE
  schemes audit through the same SAUs). Independent of implementing departments.
  Each SAU forms a **Social Justice Cell (SJC)** of 10 dedicated social audit
  resource persons (5-15 per some sources) for DoSJE scheme audits.
- **State Social Welfare Department** - nodal department for DoSJE schemes in the
  state; convenes the State Level Social Justice Assembly (its Secretary chairs
  the panel); receives ATRs.
- **State analytical annual report** - prepared by the SAU after the audit cycle;
  submitted to the state government, MoSJE and NRCSA.

**Officially documented.** Sources: Handbook (above), About Social Audit page
(https://socialjustice.gov.in/social-audit/about-us-social-audit).

## 8. District-Level Structure

- **District Social Welfare Officer (DSWO)** - implements schemes in the district.
- **District administration** (DM/Collector) - protection, panel membership.
- **District Social Justice Assembly (SJA)** - the public forum where validated
  audit findings are discussed. Panel typically: DM, DSWO, District Education
  Officer, standing committee chair (social welfare) of the Zilla Parishad,
  Child Welfare Committee chairperson, CSO representative. Decisions are sent to
  all concerned departments/institutions, which must submit **Action Taken
  Reports (ATR)** to the state Social Welfare Department with a copy to the SAU,
  uploaded to the MIS.

**Officially documented.** Source: Handbook, "Social Audit Assembly" section.

## 9. Social Audit Units

- Set up in every state; independent societies/directorates.
- Conduct audits of DoSJE schemes via Social Justice Cells (10 RP model).
- Submit annual calendar and budget proposals to NRCSA based on annual targets
  communicated at the start of each FY.
- Prepare the annual analytical state report; organise SJAs logistically with
  the nodal department.

Odisha's SAU is **OSSAAT** (Odisha Society for Social Audit Accountability and
Transparency), constituted under the P.R. & D.W. Department, Govt. of Odisha,
Panchayati Raj campus, Unit-VIII, Bhubaneswar. Its stated audit scope is
MGNREGS, NSAP, NFSA and ICDS/MAMATA; its site lists a "SAMAGRA SIKHYA MID-DAY
MEAL SOCIAL JUSTICE SCHEME" upcoming social audit. Per the DoSJE Annual Report
2025-26 (section 3.38, Table 3.38.2), **Odisha did not participate in DoSJE
scheme social audits in FY 2024-25**: it was one of eight states (with Assam,
Chhattisgarh, Gujarat, J&K, Jharkhand, Manipur and West Bengal) that
"communicated their inability to conduct social audits during the year".

**Officially documented.** Sources:

- https://ossaat.in/ ("constituted as a Society under the aegis of P.R. & D.W.
  Department")
- https://socialjustice.gov.in/social-audit/about-us-nrcsa
- DoSJE Annual Report 2025-26, section 3.38:
  https://socialjustice.gov.in/writereaddata/UploadFile/71441776233188.pdf

NETRAM consequence: the seed models a pilot DoSJE audit run in Odisha, which is
forward-looking, not a record of existing practice. Seed prose says "pilot".

## 10. Social Justice Cells

A Social Justice Cell is a dedicated team inside a state SAU: ~10 social audit
resource persons (RPs) dedicated to DoSJE scheme audits. They:

- receive documents from implementing agencies 15 days before field verification,
- perform field verification (interviews, focus group discussions, physical and
  document verification),
- present primary findings at village/institution-level validation meetings,
- present validated findings at the District Social Justice Assembly.

**Officially documented.** Source: Handbook, "Steps for Field Processes".

## 11. NRCSA

See section 6. Objectives verbatim-summary:

1. Bridge between DoSJE and state SAUs.
2. Equip SJCs via capacity building of RPs (10-day regional trainings at SIRDs,
   SAAB-approved curriculum).
3. Monitor and handhold SAUs' audits.
4. Technical assistance for qualitative audits.
5. Facilitate national professionals/CSOs for states/SAUs.

## 12. Social Audit Lifecycle

Officially documented process (Handbook "Steps for Social Audit" + "Steps for
Field Processes"):

```
1. Orientation & sensitisation (SAU orients implementing agencies, state/district)
2. Preparation (SJC formation; targets, calendar, budgets; documents made
   available 15 days before verification)
3. Field verification (interviews, FGDs, physical + document verification)
4. Validation (primary findings presented to beneficiaries at
   village/institution level)
5. Action (District Social Justice Assembly; panel decides; ATRs ordered)
6. Reflection (SAU annual analytical state report; policy recommendations)
```

Then the review ladder:

```
District SJA  ->  (ATR to state SW Dept + SAU; uploaded to MIS)
State Level Social Justice Assembly (30 days after district SJAs;
  Secretary SW Dept chairs; pending ATR status presented district-wise)
National Annual Review Meet (after state assemblies; NRCSA + DoSJE)
```

Calendar mechanics: NRCSA informs states of annual targets and geographic
coverage early each FY; SAUs submit calendar + budget proposals to NRCSA; audits
then happen per calendar. The public MIS shows per audit: Scheme, State,
District, Institute, SA Beneficiary, SA Period From/To, Starting Date, Ending
Date. Dashboard aggregates: Total Audit Planned, Completed, Ongoing; Issues
Identified, Pending, Resolved; ATR Submitted.

**Officially documented** (process) and **Observed implementation** (MIS fields).
Source: https://socialjustice.gov.in/social-audit/ and /social-audit/calender-list-web
(2,914 calendar records observed on 22 Sep 2026).

## 13. Inspection and Monitoring Lifecycle

Parallel to social audit, DoSJE runs direct monitoring via the PMU (I-MESA
component 2): fresh graduates located in states, each acting as State
Coordinator for one or more states, doing surprise inspections of GIA
institutions, scholarship holders, coaching centres, PMAGY villages and hostels
(~32,000 field inspections planned over 5 years, 5,800 in 2021-22). Reports are
uploaded to the Ministry's IT portal and "followed up promptly".

GIA institutions must install CCTV covering their services and share login
credentials with State Coordinators who use them for monitoring (CSSU, I-MESA
component 3). A central monitoring dashboard in the Ministry watches all GIA
institutions.

**Officially documented.** Source: I-MESA guidelines.

NETRAM is effectively the "IT portal" + "central monitoring dashboard" of this
system: PMU-style surprise inspections, CCTV integration, evidence, findings and
follow-up. Social audit (section 12) is the community-facing process that
produces findings into the same follow-up machinery.

## 14. Findings

Findings are called **issues** in the observed MIS ("Issues Identified: 1724,
Pending Issues: 1724, Issues Resolved: 1"). The lifecycle observed:

```
Issue identified (backed by evidence, per the social audit definition:
"issues identified, backed up with evidence")
  -> consolidated into social audit report
  -> read out / validated in public forum
  -> District SJA decision
  -> ATR ordered from responsible department/institution
  -> verification/review -> resolved or pending (tracked issue-wise,
     district-wise at state assembly)
```

**Observed implementation.** Source: https://socialjustice.gov.in/social-audit/dashboard.

Findings are inherently evidence-backed and public-facing (Report
Dissemination/Prasar is a guiding principle). Confidentiality is required for
misconduct cases during verification; safety of complainants and SJC members is
explicitly protected.

## 15. Issue Categories

The observed MIS has a "Category Wise Report" download, so issues are
categorised, but the public portal does not expose the category list (the
report page sits behind MIS login; confirmed 22 Sep 2026).
Category codes used in the social audit formats include financial, procedural
and grievance themes. From the scheme matrices in the Handbook, verified
verification scopes include: fund diversion, eligibility/process violations,
attendance/physical verification failures, amenity shortfalls, grievance
redressal failures.

**Observed implementation + Inferred.** Source: dashboard downloads list
("Category Wise Report"); Handbook scheme matrices. The exact enumeration
**needs further verification**; NETRAM therefore uses an extensible category
table seeded with the categories that are documentable today.

## 16. Action Taken Reports

After a District SJA, proceedings with decisions are sent to all concerned
departments and institutions, which must submit ATRs to the state Social Welfare
Department (copy to SAU), uploaded to the MIS for the public domain. At the
State SJA, "pending ATR status district wise and issue wise" is presented for
responses and decisions. ATR status is reviewed again at the National Annual
Review Meet.

**Officially documented.** Source: Handbook, SJA and State SJA sections.

Consequence: an ATR is not a boolean. It is a submission by a responsible
organisation against a specific issue, with content, dates, and a review
outcome, and it is tracked publicly. See section 31 for NETRAM's mapping.

## 17. District Social Justice Assembly

Public forum at district level after all audits in the district complete.
Concerned department representatives must be present. A panel (DM, DSWO, DEO,
ZP standing committee chair, CWC chair, CSO rep) takes decisions on validated
findings. Decisions trigger ATR obligations. Logistics: SAU + nodal department.

**Officially documented.** Source: Handbook.

## 18. State Social Justice Assembly

Held 30 days after all district SJAs in the state. Convened by the Secretary of
the Social Welfare Department on SAU request. Presents the state analytical
report and pending ATR status district-wise and issue-wise. Panel chaired by
Secretary SW; includes state officials, CSO/academic representatives identified
by NRCSA, NRCSA itself; DoSJE officials invited. Proceedings prepared by SAU and
sent to state departments and DoSJE.

**Officially documented.** Source: Handbook.

## 19. National Review

National Annual Review Meet, organised by NRCSA with DoSJE after all state
assemblies. Reviews process, parameters, findings, action taken. NRCSA presents
the annual analytical report of DoSJE scheme social audits.

**Officially documented.** Source: Handbook.

## 20. Schemes

The DoSJE 5-year social audit plan (Handbook Annexure, I-MESA) groups schemes
into categories with per-year audit targets: GIA institutions, scholarships
(per district), PM-AJAY, PCR-related, free coaching, PM DAKSH, SMILE, RVY.

Schemes NETRAM seeds (names verified against official pages):

| Scheme     | Full official name                                                              | Auditable targets under social audit MIS                                                 |
| ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| AVYAY      | Atal Vayo Abhyuday Yojana                                                       | Sr. Citizen Home (IPSrC component)                                                       |
| NAPDDR     | National Action Plan for Drug Demand Reduction                                  | IRCA (Integrated Rehabilitation Centre for Addicts)                                      |
| PM-AJAY    | Pradhan Mantri Anusuchit Jaati Abhyuday Yojana                                  | Villages (Adarsh Gram component), Hostels (BJRC component), GIA projects                 |
| SHRESHTA   | Scheme for Residential Education for Students in High Schools in Targeted Areas | Schools (Mode 1: best CBSE private residential schools; Mode 2: NGO/VO operated schools) |
| PM-YASASVI | PM Young Achievers Scholarship Award Scheme for Vibrant India (OBCs and others) | OBC Hostels (Top Class School Education + hostel construction component)                 |
| I-MESA     | Information, Monitoring, Evaluation and Social Audit (Central Sector Scheme)    | Not a beneficiary scheme; it funds PMU, CSSU, social audit, evaluation                   |

Sources:

- Social audit MIS scheme list: https://socialjustice.gov.in/social-audit/ (scheme
  select: "Sr. Citizen Home under AVYAY", "IRCA under NAPDDR", "Hostels (BJRC)
  under PMAJAY", "Schools under SHRESHTA Mode 1/2", "Villages under PMAJAY",
  "OBC Hostel under YASASVI")
- AVYAY components: https://socialjustice.gov.in/schemes/43
- SHRESHTA modes: https://grants-msje.gov.in/scguidelines (Mode 1/Mode 2)
- PM-AJAY merger of PMAGY + SCA-to-SCSP + BJRC: Handbook Annexure 1.4
- I-MESA components: I-MESA guidelines PDF

## 21. Scheme Components

Verified component structure for the schemes NETRAM models:

- **AVYAY**: Integrated Programme for Senior Citizens (IPSrC) - Senior Citizen
  Homes (25/50 indigents, continuous care homes); SAPSrC; RVY; SCOPE; SAGE.
- **NAPDDR**: GIA to IRCA de-addiction centres; CPLI; ODIC; preventive education
  and awareness; training. (Revised guideline 2023 on the MIS.)
- **PM-AJAY** (merged scheme, three components):
  - _Adarsh Gram_: integrated development of SC-majority villages (Rs 21 lakh/village
    per the handbook); audited as **villages**.
  - _Grant-in-aid for district/state level projects_ (SCA-to-SCSP lineage).
  - _Babu Jagjivan Ram Chhatrawas Yojana (BJRC)_: hostels for SC boys/girls;
    audited as **hostels**.
- **SHRESHTA**: Mode 1 (best private CBSE residential schools; meritorious SC
  students selected via NETS conducted by NTA, admitted to classes 9/11, fee
  coverage); Mode 2 (VO/NGO grant-in-aid schools continued subject to
  satisfactory performance; no new schools; primary schools must upgrade to
  secondary before 2027; PMU gets a suitability checklist covering
  infrastructure, State/board approval, pass percentage, staff quality).
  Source: SHRESHTA guidelines, https://grants-msje.gov.in/scguidelines
  ("Modalities of operation", "Mode 2").
- **PM-YASASVI**: scholarships (Class IX/XI) + OBC hostel construction.
- **I-MESA**: Information Dissemination; PMU; CSSU; Social Audit; Evaluation &
  Studies.

**Officially documented** except where noted. PM-AJAY component names from
Handbook Annexure 1.4; SHRESHTA modes from grants-msje.gov.in; AVYAY components
from socialjustice.gov.in/schemes/43.

NETRAM consequence: a scheme has components; a monitored target is an instance
of one component (a Senior Citizen Home is not "AVYAY" generically, it is an
IPSrC Senior Citizen Home). The public MIS already names audits by
"scheme + component-ish label" ("Sr. Citizen Home under AVYAY").

## 22. Scheme-to-Target Relationships

Observed in the audit calendar data (2,914 records, 22 Sep 2026):

| Calendar label                | State+District                                         | "Institute" column                                                                          |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| IRCA under NAPDDR             | e.g. Mizoram/AIZAWL, Odisha/PURI                       | named NGO (e.g. "New Life Home Society", "NILACHAL SEVA PRATISTHAN")                        |
| Sr. Citizen Home under AVYAY  | e.g. Odisha/PURI                                       | named NGO or home (e.g. "Nilachal Seva Pratisthan- Astaraag-II", "Bankeswari Jubak Sangha") |
| Hostels (BJRC) under PMAJAY   | e.g. Assam                                             | named society/hostel                                                                        |
| Schools under SHRESHTA Mode 1 | e.g. Assam/KAMRUP                                      | named school ("Royal Global School")                                                        |
| Villages under PMAJAY         | e.g. Odisha/JAJAPUR (32 records), Madhya Pradesh/BHIND | **N/A** - the village itself is the audited unit                                            |
| OBC Hostel under YASASVI      | various                                                | named hostel                                                                                |

Two facts matter:

1. **Village audits have no institution.** "Villages under PMAJAY | Odisha |
   JAJAPUR | N/A". Validation for these happens at the Gram Sabha (Handbook
   Annexure 1.4: "Participants and place of validation of the Report:
   Validation will be at Gram Sabha"). A model that forces every audit target
   to be an institution is wrong.
2. **One NGO can operate multiple auditable units.** "Nilachal Seva
   Pratisthan- Astaraag-I", "-Astaraag-II", "Plot no 2334..." etc. are distinct
   audit rows for units of the same organisation. Organisation != facility.

Scale context from the DoSJE Annual Report 2025-26 (section 3.38, Table
3.38.1): FY 2024-25 completed social audits were 65 Senior Citizen Homes
(AVYAY), 42 IRCAs (NAPDDR), 8 BJRC hostels, 40 SHRESHTA residential schools,
391 PM-AJAY villages, 4 OBC hostels (PM-YASASVI), plus scholarship,
SC/ST-atrocity, inter-caste marriage, NBCFDC and Garima Greh (SMILE) audits -
972 in total. The audit universe is wider than the six institution/village
target kinds (case-based audits exist), but the SIH problem statement scopes
NETRAM to the facility/village targets above.

**Observed implementation.** Source: /social-audit/calender-list-web data.

## 23. Project / Facility / Implementation Unit Model

**NETRAM design decision.** DoSJE audits both institution-type targets and
village-type targets (section 22). NETRAM keeps its existing central entity
`Project` (the monitored implementation target, which already flows through
inspections, CCTV, complaints, attendance, evidence, findings) and makes its
type explicit and DoSJE-accurate instead of introducing a second parallel
entity. `PROJECT_TYPES` becomes:

```
institution        - a facility run by an organisation (home, hostel, school, IRCA)
village            - a PM-AJAY Adarsh Gram style village target (organisation N/A)
authority_project  - departmentally executed infrastructure/activity project
other              - future scheme targets that do not fit a known kind
```

`organisationId` is nullable precisely because village targets have no
implementing organisation. A village target is monitored at its location; its
"responsible organisation" for ATR purposes is the implementing department
(DSWO/ZP), represented through the authority/review machinery, not a fake NGO.

Rejected alternative: a new `ImplementationUnit` table parallel to `projects`.
That would have forced a migration of inspections/CCTV/attendance/complaints/
evidence onto a polymorphic target reference for zero domain gain - the existing
`Project` already is "the thing being monitored".

## 24. Institution Types

Observed institution/unit types in DoSJE audit data (used for seed + UI labels):

- Senior Citizen Home (AVYAY/IPSrC)
- Continuous Care Home (AVYAY/IPSrC)
- IRCA de-addiction centre (NAPDDR)
- Half-Way Home / ODIC / CPLI (NAPDDR family)
- SC/ST Hostel (BJRC under PM-AJAY; OBC Hostel under YASASVI)
- Residential School (SHRESHTA Mode 1/2)
- Garima Greh (SMILE scheme)

**Observed implementation** (MIS labels + scheme documents). Keep as an open
enum (strings with labels), not a hard-coded closed list, per AGENTS.md §14 (extensible domain concepts).

## 25. Village-Based Targets

- Target = the village (SC-majority village selected under PM-AJAY Adarsh Gram).
- Responsible body: district administration/implementing department; validation
  at Gram Sabha; committee: village-level PMAGY committee, Village Development
  Plan; audit checks: VDP prepared, works executed, roads/electrification/
  internet/CSC/anganwadi availability (Handbook "Social Audit Format for PM
  Adarsh Village Assessment").
- Village geography needs State -> District -> Block -> Gram Panchayat ->
  Village resolution for meaningful audit addressing.

**Officially documented** (handbook format) + **Observed implementation** (N/A
institute column).

## 26. Geography

India's administrative hierarchy relevant to DoSJE audits:

```
State
  -> District
       -> Block / Tehsil
            -> Gram Panchayat
                 -> Village
```

Not every target needs every level: an IRCA in a city resolves fine at
State -> District; a PM-AJAY village needs the full chain. The observed MIS only
carries State and District on audit records; block/GP/village appear inside the
audit formats ("GP: ___ Village: ___ Date of SA: ___").

**Observed implementation** (MIS fields) + **Officially documented** (format
fields in Handbook Annexure 2.x). NETRAM extends its geography with optional
block/GP/village rows (NETRAM design decision, section 31).

## 27. Funding and Disbursement

Documented funding structure (kept out of scope for NETRAM's database beyond
reference metadata on schemes/projects):

- GIA institutions receive recurring grants per beneficiary norms (e.g. AVYAY
  IPSrC rates per indigent: SrCH 25 - 3.09 lakh etc., grants-msje.gov.in).
- PM-AJAY: Adarsh Gram Rs 21 lakh/village (handbook); hostels by unit cost.
- I-MESA outlays: PMU Rs 52.5 Cr / 5 yrs; CSSU Rs 15 Cr / 5 yrs (~1000-1400
  institutions per year instrumented with CCTV).
- PMU selection: fresh graduates via NIRF ranking; hosted in NISD.

**Officially documented.** NETRAM does not model fund flows in this phase
(monitoring is the SIH problem-statement scope). Scheme/project records can carry
descriptive metadata only.

## 28. Users and Roles

Who needs access in the real system, mapped to NETRAM roles (existing role
codes retained):

| Real actor                                          | NETRAM role                                   | Scope             |
| --------------------------------------------------- | --------------------------------------------- | ----------------- |
| DoSJE / national administrator                      | `system_admin`                                | national          |
| NRCSA user (training/monitoring)                    | `authority_officer` variant, national reach   | national (future) |
| PMU member / State Coordinator (surprise inspector) | `inspector`                                   | state/district    |
| State SW Dept officer / SAU director                | `authority_officer`                           | state             |
| SJC resource person (social audit verifier)         | `inspector` (social audit type)               | district          |
| DSWO / district officer                             | `authority_officer`                           | district          |
| NGO/institution head (implements, submits ATR)      | `institution_admin`                           | own facility      |
| Control room / CSSU operator                        | `control_room`                                | state             |
| Beneficiary/citizen                                 | public complaint + tracking routes (no login) | public            |

The existing seeded role set (`system_admin`, `authority_officer`,
`control_room`, `institution_admin`, `inspector`) already covers these actors;
no new role machinery is required. The distinction that matters (section 5) -
implementers never review their own work - is already enforced by permissions:
`institution_admin` has no `inspection:review`, `project:approve`,
`corrective_action:approve`, or `ai:anomaly:transition`.

**NETRAM design decision** grounded in officially documented responsibilities.

## 29. Permissions

Existing permission catalogue (seeded `permissions` table) maps cleanly:

- `inspection:create/assign/transition/review` - PMU + authority review flow
- `observation:create`, `evidence:create` - SJC/PMU field verification
- `corrective_action:submit` (institution) / `:approve` (authority) - ATR flow
- `complaint:create/resolve` - grievance redressal (Sunwai principle)
- `ai:anomaly:*` - advisory-only AI review (CSSU-style monitoring)
- `cctv:*` - CSSU-style stream access
- `audit:read` - Prasar (report dissemination)

No new permissions required by the domain alignment in this phase.

## 30. Important Workflows

### Workflow A: PMU-style surprise inspection (NETRAM's core)

```
Authority officer creates inspection (type=surprise, trigger=officer|risk_engine)
  -> random/assigned inspector (PMU/inspector role)
  -> mobile evidence capture (geo-tagged, hashed)
  -> observations + findings
  -> authority review (confirm/dismiss)
  -> corrective action (ATR-equivalent) ordered with deadline
  -> institution submits action
  -> authority verifies -> accepted/rejected
  -> overdue escalation by background job
```

### Workflow B: Social audit (modeled as inspection type `social_audit`)

```
SAU/SJC (inspector-role users) audit a target per calendar
  -> field verification: interviews, FGD, physical + document checks
  -> issues recorded as findings with category
  -> validation at village/institution level
  -> District SJA decisions -> corrective actions with deadlines
  -> ATR submission by responsible organisation
  -> state assembly reviews pending ATRs district-wise
```

### Workflow C: Complaint (grievance redressal)

```
Citizen complaint (public, tracking code) -> under review
  -> may trigger an inspection
  -> may create findings -> same ATR flow
  -> resolution communicated (Sunwai principle)
```

## 31. Data Model Implications for NETRAM

Mapping from researched reality to the existing NETRAM schema (migration debt
kept minimal; every change preserves existing functionality):

| #   | Current NETRAM                                                                                                       | DoSJE reality                                                       | Required change (implemented)                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Geography ends at `districts`                                                                                        | Audits need Block/GP/Village for village targets                    | Add `blocks`, `gram_panchayats`, `villages` tables; `villageId` on projects                                                                                                        |
| 2   | `PROJECT_TYPES = institution/authority_project/other`                                                                | Audit targets are institutions AND villages                         | Extend types with `village`                                                                                                                                                        |
| 3   | `programmeIds` JSON array on projects; flat `programmes`                                                             | Schemes have components (IPSrC, BJRC, Adarsh Gram, Mode 1/2...)     | Add `schemeComponents` table with `programmeId` FK; `schemeComponentId` on projects                                                                                                |
| 4   | Findings have severity only                                                                                          | Issues are categorised (Category Wise Report)                       | Add `findingCategories` table + `categoryId` + `amountInr` + `responsibleOrganisationId` on findings                                                                               |
| 5   | Corrective action has no submission content                                                                          | ATR is a real submission (action, evidence, dates, review)          | Add `actionSummary`, `verifiedAt`, `verifiedByUserId`, `reviewRemarks` on corrective actions; ATR attachments (PDF/photo/video, max 5, ≤100 MB each) via `corrective_action_files` |
| 6   | `INSPECTION_TYPES = surprise/routine/special/follow_up`                                                              | Social audit is a distinct official process                         | Add `social_audit` inspection type                                                                                                                                                 |
| 7   | Orgs are free-form categories                                                                                        | Real org kinds: NGO/VO, state dept, SAU, national institute         | Keep extensible `category` strings; seed real values                                                                                                                               |
| 8   | `organisations` table not linked to geography/state                                                                  | SAUs, state departments are state-bound                             | Add nullable `stateId` on organisations                                                                                                                                            |
| 9   | Seed schemes are fabricated ("National Scholarship Programme - Special Hostels", "Annual Surprise Inspection Drive") | Real schemes: AVYAY, NAPDDR, PM-AJAY, SHRESHTA, PM-YASASVI, I-MESA  | Reseed with real schemes + components + real Odisha audit targets                                                                                                                  |
| 10  | Every seed project is type=institution with an org                                                                   | Real Odisha audit calendar includes village rows with N/A institute | Seed village targets with `organisationId = NULL`                                                                                                                                  |

Everything else (inspections, evidence, complaints, AI anomalies, attendance,
CCTV, VC, audit events, outbox) already matches the domain and is untouched.

## 32. Existing NETRAM Model vs Required Model

See the table in section 31 for the change list. The pre-change gaps in words:

1. **Monitored entity type** - one type (`institution`) was used for every seed
   project, and the type enum had no representation for village audits which are
   1,600+ of the observed calendar rows nationally.
2. **Scheme depth** - PM-AJAY's three components have different audited target
   kinds; a flat programme table cannot express "Sr. Citizen Home under AVYAY"
   vs "IRCA under NAPDDR" faithfully.
3. **Findings** - no category, no disputed-amount field, no responsible
   organisation pointer, although the public MIS tracks issues by category and
   ATRs issue-wise.
4. **ATR** - corrective actions tracked status but had no record of what was
   actually done (`atr_submitted = true` anti-pattern (anti-pattern: deriving status from flags - see AGENTS.md §24 on where business truth lives)
   about).
5. **Geography** - no sub-district units, so a PM-AJAY village could not be
   addressed beyond its district.
6. **Seed data** - synthetic schemes/organisations presented without labelling;
   real Odisha records (Jajapur PM-AJAY village audits, Puri senior citizen
   homes and IRCAs) were absent.

## 33. Known Gaps

- The exact issue-category enumeration used by the official MIS is not public
  (section 15). NETRAM seeds the documentable categories and keeps the table
  extensible.
- The observed MIS does not expose beneficiary-level or fund-level public data;
  NETRAM does not model those.
- SHRESHTA Mode 1 schools are private fee-reimbursement schools entered via
  NETS/NTA; Mode 2 schools are VO/NGO grant-in-aid schools (official
  guidelines). Their "organisation" is the school trust - NETRAM models them
  as institutions whose organisation is the school society. This is now
  **verified against the guidelines**; per-school trust names are not public
  in the calendar rows we extracted.
- Odisha SAU (OSSAAT) is documented for MGNREGA/NSAP/NFSA/ICDS social audit
  under the P.R. & D.W. Department. For DoSJE schemes specifically, the Annual
  Report 2025-26 (3.38) records that **Odisha did not conduct DoSJE social
  audits in FY 2024-25** (one of eight non-participating states). The national
  framework still routes DoSJE audits through state SAUs, so OSSAAT remains
  the future implementing SAU; the seed labels its Odisha social audit rows as
  a pilot run.
- Real per-institution CCTV status is not public; seed CCTV/attendance rows
  remain synthetic demo data (clearly labelled).

## 34. Seed Data Sources

Real records used in the deterministic seed (all public, no fabrication):

1. **Social Audit Calendar** - https://socialjustice.gov.in/social-audit/calender-list-web
   (2,914 records incl. 90 Odisha rows, extracted 22 Sep 2026). Used for:
   - Odisha district names: Jajapur, Puri, Baleshwar, Bhadrak (plus Khordha,
     Cuttack, Ganjam, Sundargarh from Census 2011 spelling).
   - Real audit targets: "Villages under PMAJAY | Odisha | JAJAPUR" (village
     targets, institute N/A), "Sr. Citizen Home under AVYAY | Odisha | PURI"
     (e.g. Nilachal Seva Pratisthan units, Bankeswari Jubak Sangha, Jayakishan
     Youth Club), "IRCA under NAPDDR | Odisha | PURI" (e.g. NILACHAL SEVA
     PRATISTHAN, Council for All Round Development of Society, Association for
     Voluntary Action), Baleshwar (Prayas Voluntary Organisation, PEACE BIRD OF
     CAPABILITY), Bhadrak (NIKHILA UTKAL HARIJAN ADIVASI SEVA SANGHA).
   - Audit period dates for calendar realism.
2. **Scheme names/components** - official scheme pages and the Handbook
   (section 20/21 sources).
3. **SHRESHTA Mode 1/Mode 2 semantics** - official guidelines PDF,
   https://grants-msje.gov.in/scguidelines (Modalities of operation; Mode 2
   PMU suitability checklist). Component descriptions in the seed follow the
   guideline wording.
4. **OSSAAT** - https://ossaat.in/ for the Odisha SAU organisation record.
5. **DoSJE Annual Report 2025-26, section 3.38** (Tables 3.38.1/3.38.2) -
   scheme-wise FY 2024-25 audit completion (65 SrCH, 42 IRCA, 8 BJRC hostels,
   40 SHRESHTA schools, 391 PM-AJAY villages, 4 OBC hostels, plus scholarship,
   atrocity, inter-caste marriage, NBCFDC, Garima Greh audits; total 972) and
   the state-wise participation table. Confirms Odisha did not conduct DoSJE
   social audits in FY 2024-25, so the seeded Odisha audits are a labelled
   pilot, not history.
6. **Users, staff, attendance devices, CCTV cameras, AI anomaly rows** -
   remain synthetic demo data, marked as demo in the seed file; emails are
   `@dev.netram.in`; no real personal data (AGENTS.md §13, §28).

Where the public record names an organisation but not a specific unit
(e.g. "Prayas Voluntary Organisation" with a SrCH audit), the seed stores the
organisation and an institution row named from the record verbatim.

## 35. Official URLs

- Problem statement site: https://netram.vercel.app/
- DoSJE main site: https://socialjustice.gov.in/
- DoSJE schemes index: https://socialjustice.gov.in/schemes/ (AVYAY: /schemes/43)
- Social Audit MIS portal: https://socialjustice.gov.in/social-audit/
  - About: https://socialjustice.gov.in/social-audit/about-us-social-audit
  - NRCSA: https://socialjustice.gov.in/social-audit/about-us-nrcsa
  - Dashboard: https://socialjustice.gov.in/social-audit/dashboard
  - Calendar list: https://socialjustice.gov.in/social-audit/calender-list-web
  - Downloads: https://socialjustice.gov.in/social-audit/download-report
- Handbook for Social Justice Cell Members (NRC-CSA/NIRDPR, 05 Sep 2022):
  https://socialjustice.gov.in/social-audit/public/report-doc/calender-material/Handbook%20for%20Social%20Audit%20of%20Scheme%20of%20DoSJE_05%20Sept.2022.pdf
- I-MESA guidelines:
  https://socialjustice.gov.in/social-audit/public/report-doc/realted-material/i mesa guideline dosje.pdf
- Social Audit process & protocol:
  https://socialjustice.gov.in/social-audit/public/report-doc/realted-material/Process%20&%20protocol(SA,DoSJE).pdf
- PM-AJAY guidelines: https://pmajay.dosje.gov.in/Writereaddata/Guidelines.pdf
- SHRESHTA guidelines: https://grants-msje.gov.in/scguidelines
- GIA grant norms: https://grants-msje.gov.in/display-avyay
- NISD: https://nisd.gov.in/
- OSSAAT (Odisha SAU): https://ossaat.in/
- DoSJE Annual Report 2025-26 (social audit section 3.38):
  https://socialjustice.gov.in/writereaddata/UploadFile/71441776233188.pdf
- NIRDPR Centre for Social Audit: https://nirdpr.org.in/

## 36. Research Notes

- The social audit MIS ("Social Audit MIS Portal", developed by ADG Online
  Solutions, hosted by NIC) is the observed system of record for DoSJE social
  audits. Its footer states content ownership by the Ministry of Rural
  Development - SAUs were originally MoRD bodies, consistent with the SAU
  history in section 7.
- The dashboard public counters on 22 Sep 2026 read: Total Audit Planned 1454,
  Completed 1454, Ongoing ~0; Issues Identified 1724, Pending 1724, Resolved 1,
  ATR Submitted 1. Treat the counters as volatile; the structural takeaway is
  the planned-vs-completed and issue-pending-vs-resolved tracking model.
- Audit calendar row shape: Sr.No, Scheme, State, District, Institute, SA
  Beneficiary, SA Period From, SA Period To, Starting Date, Ending Date.
- Scheme select IDs in the MIS: 1=SrCH/AVYAY, 2=IRCA/NAPDDR, 3=Hostels(BJRC)/PMAJAY,
  4=Schools SHRESHTA Mode 2, 5=Schools SHRESHTA Mode 1, 6=Villages/PMAJAY,
  7=OBC Hostel/YASASVI (order as rendered on the page).
- Handbook audit targets for FY22-26: GIA 2000, Scholarships 2000, PM-AJAY 900,
  PCR 600, Free coaching 40, PM DAKSH 150, SMILE 160, RVY 150 (total 6000).
- I-MESA PMU inspection targets 2021-26 total ~32,049 field inspections;
  40->49 PMU members; 12 inspection days/month; reports uploaded to the
  Ministry IT portal (the niche NETRAM fills for the hackathon).
- Pilot social audits (2020-21): 8 de-addiction centres, 6 residential/
  non-residential schools, 4 senior citizen homes, in Meghalaya, UP, Maharashtra.

## 37. Open Questions

1. Exact issue category taxonomy of the official MIS (the "Category Wise
   Report" page requires MIS login; enumeration not public, re-checked
   22 Sep 2026).
2. Whether DoSJE social audits in Odisha are executed by OSSAAT's SJC or a
   dedicated DoSJE cell within it. FY 2024-25 evidence (Annual Report 3.38)
   shows Odisha did not conduct DoSJE audits at all that year; the question
   now is which body will run them once Odisha participates.
3. Whether the department will run NETRAM alongside the existing
   socialaudit-misportal or as its successor for inspection workflows.
4. SA beneficiary semantics in the calendar (counts? names?) - the public page
   shows the column but values were not exposed for all rows.

## 38. Assumptions and Confidence

| Assumption                                                                                                                | Confidence | Basis                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Project` remains the single monitored-target entity with a widened type enum instead of a new `ImplementationUnit` table | High       | Preserves all existing modules; domain distinction achieved by type + geography + component (AGENTS.md §14 (distinct domain concepts, no overbuilding per §78)) |
| Village targets have `organisationId = NULL` and are located via village geography                                        | High       | Observed "N/A" institute column for village audits                                                                                                              |
| Scheme components are a real table rather than strings                                                                    | High       | PM-AJAY/AVYAY/SHRESHTA all have official named components with distinct target kinds                                                                            |
| `social_audit` inspection type distinct from surprise/routine                                                             | High       | Social audit is a legally distinct process with its own actors (SJC) and forums                                                                                 |
| Finding category table seeded with documentable categories                                                                | Medium     | Category report exists; enumeration not public                                                                                                                  |
| Corrective action = ATR equivalent, extended with submission content                                                      | High       | Handbook ATR requirements map 1:1 onto corrective-action lifecycle already present                                                                              |
| Seeded organisations from the audit calendar are real public records                                                      | High       | Extracted verbatim from the official calendar                                                                                                                   |
| Seeded Odisha social audit inspections represent a pilot, not existing practice                                           | High       | Annual Report 2025-26 (3.38): Odisha did not conduct DoSJE social audits in FY 2024-25                                                                          |
| Attendance/CCTV/anomaly demo rows stay synthetic                                                                          | High       | No public source exists; AGENTS.md §13 permits labelled synthetic seed data                                                                                     |
