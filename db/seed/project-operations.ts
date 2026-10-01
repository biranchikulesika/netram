import type { DrizzleDB } from "@netram/data";
import * as s from "@netram/data/schema";
import { did } from "./ids";

/**
 * Per-project operational history.
 *
 * `index.ts` seeds the reference data (geography, roles, authorities,
 * programmes, projects). This module seeds what actually *happened* to each
 * project afterwards: inspection cycles, observations, findings, evidence,
 * corrective actions, complaints, funds and their releases, expenses and
 * supporting documents, risk snapshots, CCTV coverage, oversight video calls
 * and the offline operations the inspector app replayed against them.
 *
 * Two properties are load-bearing and must not be traded away:
 *
 * 1. **Deterministic.** Every id is `did("...")` and every date is literal. No
 *    `Date.now()`, no random, no iteration over a Map with insertion-order
 *    dependence. Re-running the seed on a fresh database must reproduce exactly
 *    the same rows, because the demo database is dropped and re-seeded every
 *    30 minutes and a drifting id set would invalidate offline operation ids
 *    held by the mobile app (AGENTS.md §13, §31).
 *
 * 2. **Interconnected.** Findings reference real inspections, corrective
 *    actions reference those findings, evidence references both, risk
 *    snapshots reference flags raised against the same inspections. Nothing is
 *    an orphan row that no screen can reach.
 *
 * All content is synthetic. Facility names and the organisations in
 * `index.ts` follow the official DoSJE social audit calendar because that
 * calendar is public; every person, phone number, email, invoice number,
 * document hash and location here is invented and uses the reserved
 * `.dev.netram.in` domain.
 */

/** A finding written once and expanded into its observation, evidence and CA. */
type FindingSpec = {
  /** Seed suffix, e.g. "vani-2026-02-food" -> did("finding:vani-2026-02-food"). */
  key: string;
  category: "FIN" | "FOOD" | "INFRA" | "ROLLS" | "STAFF" | "WATSAN";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  remediation: string;
  /**
   * What the organisation did about it. `open` leaves a corrective action
   * outstanding (or overdue), `done` closes it, `none` means the finding needs
   * authority review rather than a CA.
   */
  outcome: "open" | "done" | "none";
  /** Days allowed for remediation, used to derive the deadline. */
  dueInDays?: number;
  /** Rupees involved, financial categories only. */
  amountInr?: number;
};

/** One inspection cycle: when it ran, what it found. */
type CycleSpec = {
  key: string;
  /** ISO date the inspection started. */
  date: string;
  status: "closed" | "corrective_actions" | "verification" | "in_progress" | "assigned";
  trigger: string;
  type: string;
  findings: FindingSpec[];
};

type ProjectSpec = {
  /** Seed key, must match the project id minted in index.ts. */
  project: string;
  template: "hostel" | "srch" | "sa-village";
  policy: "officer" | "hidden";
  /** Field officer who owns the project. */
  officer: string;
  /** Lead inspector for this project's cycles. */
  inspector: string;
  /** Second inspector, gives cycles a realistic two-person team. */
  inspector2?: string;
  team?: string;
  /** Sanctioned capacity and current occupancy, shown on the project header. */
  photos: string[];
  cycles: CycleSpec[];
  /** Fund allocation: rupees, fiscal year, and how much has been released. */
  funds?: {
    programme: string;
    scheme: string;
    allocated: number;
    fiscalYear: string;
    description: string;
    /** [amount, ISO date, reference] */
    releases: [number, string, string][];
  };
  expenses?: {
    key: string;
    category: string;
    description: string;
    amount: number;
    date: string;
    vendor: string;
    gstin: string;
    invoice: string;
    status: "submitted" | "verified" | "void";
    /** Set for `void` expenses; also raises a financial risk event. */
    voidReason?: string;
  }[];
  cameras?: string[];
  /** Oversight video call, tied to the first cycle. */
  oversightCall?: { title: string; date: string; durationMin: number };
};

const USERS = {
  admin: "user:dept-admin",
  officerKhordha: "user:officer-khordha",
  officerCuttack: "user:officer-cuttack",
  inspector1: "user:inspector-1",
  inspector2: "user:inspector-2",
  inspector3: "user:inspector-3",
  inspector4: "user:inspector-4",
  programme: "user:programme-officer",
  sanction: "user:sanctioning-authority",
  institution: "user:institution",
  institutionGanjam: "user:institution-ganjam",
  controlRoom: "user:control-room",
  auditor: "user:auditor",
} as const;

const CATEGORIES = {
  FIN: "fcat:financial",
  FOOD: "fcat:food",
  INFRA: "fcat:infra",
  ROLLS: "fcat:rolls",
  STAFF: "fcat:staffing",
  WATSAN: "fcat:water",
} as const;

const PROFILES: ProjectSpec[] = [
  // ---------------------------------------------------------------- Vani ----
  // The reference project: richest history, biometric attendance, AI anomalies.
  {
    project: "project:vani",
    template: "hostel",
    policy: "officer",
    officer: USERS.officerKhordha,
    inspector: USERS.inspector1,
    inspector2: USERS.inspector2,
    team: "team:khordha-1",
    photos: [
      "Front elevation of the residential block, showing the 120-bed upper floor and ground-floor dining hall.",
      "Dining hall interior with the stainless-steel service counter and the seated capacity of 60.",
      "Kitchen dry-store shelf, showing grain and dal stock against the register.",
      "Rear gate biometric attendance device and the boundary wall as built.",
      "Borewell and overhead water tank serving the residential block.",
    ],
    cycles: [
      {
        key: "vani-2026-01",
        date: "2026-01-22",
        status: "closed",
        trigger: "quarterly",
        type: "regular",
        findings: [
          {
            key: "vani-2026-01-staff",
            category: "STAFF",
            severity: "medium",
            description:
              "Two of the four sanctioned watchman posts were vacant for the whole of January. The muster roll showed the posts filled on paper by a single supervisor rostered across both shifts, so no physical check-in was possible for the night shift.",
            remediation:
              "Fill both sanctioned watchman posts through the district hiring process and record per-shift muster entries.",
            outcome: "done",
            dueInDays: 30,
          },
          {
            key: "vani-2026-01-watsan",
            category: "WATSAN",
            severity: "low",
            description:
              "The accessible washroom on the first floor had a non-functional shower valve and no grab rail. The ramp to the dining hall was 1:9 rather than the sanctioned 1:12.",
            remediation:
              "Replace the shower valve, fit grab rails, and re-lay the ramp to the sanctioned gradient.",
            outcome: "done",
            dueInDays: 21,
          },
        ],
      },
      {
        key: "vani-2026-03",
        date: "2026-03-11",
        status: "corrective_actions",
        trigger: "complaint",
        type: "surprise",
        findings: [
          {
            key: "vani-2026-03-food",
            category: "FOOD",
            severity: "high",
            description:
              "Weekly menu records for February showed dal and rice served on all seven days with no protein source, and the kitchen register recorded 412 kg of rice procured against 380 residents for the month. The dry-store physical count on the day of inspection was 90 kg short of the register balance.",
            remediation:
              "Explain the register-to-store variance, publish a menu with a daily protein source, and institute a weekly independent stock count with photographic evidence.",
            outcome: "open",
            dueInDays: 14,
          },
          {
            key: "vani-2026-03-rolls",
            category: "ROLLS",
            severity: "medium",
            description:
              "Eleven beneficiaries on the muster roll had not been physically present for over 60 days, and four of those had a recorded discharge date of March 2025 - over a year before the inspection. The hostel was drawing ration for them.",
            remediation:
              "Strike the long-absent and discharged entries from the roll, recover the drawn ration value, and re-verify residency monthly.",
            outcome: "open",
            dueInDays: 21,
          },
        ],
      },
      {
        key: "vani-2026-06",
        date: "2026-06-04",
        status: "in_progress",
        trigger: "scheduled",
        type: "regular",
        findings: [],
      },
    ],
    funds: {
      programme: "programme:pmajay",
      scheme: "PM-AJAY (Biju Chhatra Bhuban Ruchi)",
      allocated: 2_400_000,
      fiscalYear: "2025-26",
      description: "Construction of the 120-bed residential block, dining hall and boundary wall.",
      releases: [
        [960_000, "2025-08-14", "TR/PMJ/25-26/0041"],
        [1_440_000, "2025-12-02", "TR/PMJ/25-26/0093"],
      ],
    },
    expenses: [
      {
        key: "vani-veg-march",
        category: "Kitchen provisions",
        description: "Vegetables, pulses and cooking oil for the March 2026 cycle.",
        amount: 84_500,
        date: "2026-03-28",
        vendor: "Sundargada Wholesale Traders",
        gstin: "21AABCS1234M1Z5",
        invoice: "SWT/26-27/0318",
        status: "verified",
      },
      {
        key: "vani-chemistry-may",
        category: "Sanitation supplies",
        description: "Disinfectant, phenyl and handwash stock for the May 2026 cycle.",
        amount: 23_750,
        date: "2026-05-22",
        vendor: "Bhubaneswar Chemicals",
        gstin: "21AACCB5678N1ZP",
        invoice: "BC/26-27/0522",
        status: "submitted",
      },
      {
        key: "vani-repair-unsigned",
        category: "Minor repairs",
        description: "Labour for washroom plumbing, claimed without an invoice.",
        amount: 48_000,
        date: "2026-04-09",
        vendor: "Not registered",
        gstin: "N/A",
        invoice: "-",
        status: "void",
        voidReason:
          "No tax invoice supplied and vendor is not registered; rejected pending documentation.",
      },
    ],
    cameras: [
      "Vani Vihar - Main Gate (Entry)",
      "Vani Vihar - Dining Hall",
      "Vani Vihar - Kitchen Dry Store",
    ],
    oversightCall: {
      title: "Vani Vihar - food procurement findings review",
      date: "2026-03-18T10:30:00Z",
      durationMin: 52,
    },
  },

  // ------------------------------------------------------------ Cuttack ----
  // Suspended mid-review: the suspension must be explained by its findings.
  {
    project: "project:cuttack-girls",
    template: "hostel",
    policy: "officer",
    officer: USERS.officerCuttack,
    inspector: USERS.inspector2,
    inspector2: USERS.inspector3,
    team: "team:cuttack-1",
    photos: [
      "Senior-secondary classroom block attached to the residential wing.",
      "Residential corridor, second floor, showing the 150-bed dormitory layout.",
      "Kitchen store register with the February entries circled during verification.",
      "Rear service entrance used for vegetable and ration deliveries.",
    ],
    cycles: [
      {
        key: "cuttack-2026-02",
        date: "2026-02-11",
        status: "corrective_actions",
        trigger: "quarterly",
        type: "regular",
        findings: [
          {
            key: "cuttack-2026-02-fin",
            category: "FIN",
            severity: "critical",
            description:
              "Three vegetable invoices from the same vendor, all dated within four minutes of each other, totalled Rs 96,400 against a sanctioned monthly ceiling of Rs 60,000. The purchase register showed the entries made by the same signature as the approving signature.",
            remediation:
              "Void the split purchases, recover the excess Rs 36,400, and separate purchase approval from purchase recording.",
            outcome: "open",
            dueInDays: 10,
            amountInr: 36_400,
          },
          {
            key: "cuttack-2026-02-rolls",
            category: "ROLLS",
            severity: "high",
            description:
              "Nineteen beneficiaries present on the roll had no admission record and no guardian consent form on file. Twelve of the nineteen were also drawing against the mid-day meal scheme.",
            remediation:
              "Produce admission and consent records for the nineteen, or strike them from the roll and recover the mid-day meal claim.",
            outcome: "open",
            dueInDays: 14,
          },
          {
            key: "cuttack-2026-02-infra",
            category: "INFRA",
            severity: "medium",
            description:
              "The first-floor corridor had 22 sq ft of exposed rebar where a railing section was removed and not reinstated, and the safety audit tag on the fire extinguisher had lapsed eight months earlier.",
            remediation:
              "Reinstate the railing to design, and re-certify the fire extinguishers and the emergency lighting.",
            outcome: "done",
            dueInDays: 30,
          },
        ],
      },
      {
        key: "cuttack-2026-05",
        date: "2026-05-20",
        status: "verification",
        trigger: "suspension_review",
        type: "special",
        findings: [
          {
            key: "cuttack-2026-05-watsan",
            category: "WATSAN",
            severity: "low",
            description:
              "The girls' hostel wing had running water but the shower area drainage was blocked, leaving standing water across the floor of two dormitories.",
            remediation: "Clear the drainage line and record a weekly drainage check.",
            outcome: "done",
            dueInDays: 7,
          },
        ],
      },
    ],
    funds: {
      programme: "programme:surprise-audit",
      scheme: "Social audit / compliance review",
      allocated: 1_180_000,
      fiscalYear: "2025-26",
      description:
        "Compliance review remediation budget held pending resolution of the procurement finding.",
      releases: [[400_000, "2026-03-02", "TR/SAR/25-26/0011"]],
    },
    expenses: [
      {
        key: "cuttack-veg-feb",
        category: "Kitchen provisions",
        description: "February 2026 vegetable procurement, the invoices under review.",
        amount: 96_400,
        date: "2026-02-09",
        vendor: "Baragaon Agri Traders",
        gstin: "21AAQCB9012R1ZK",
        invoice: "BAT/26-27/0209-A",
        status: "submitted",
      },
      {
        key: "cuttack-repair-mar",
        category: "Minor repairs",
        description: "Corridor railing reinstatement and fire-system re-certification.",
        amount: 62_300,
        date: "2026-03-19",
        vendor: "Utkal Engineering Works",
        gstin: "21AACCU3344W1Z8",
        invoice: "UEW/26-27/0319",
        status: "verified",
      },
    ],
    cameras: ["Cuttack Girls' Hostel - Main Gate", "Cuttack Girls' Hostel - Kitchen"],
  },

  // ------------------------------------------------------------- Ganjam ----
  // Attendance-discrepancy host site: claimed vs biometric counts differ.
  {
    project: "project:ganjam-school",
    template: "hostel",
    policy: "officer",
    officer: USERS.programme,
    inspector: USERS.inspector3,
    inspector2: USERS.inspector4,
    team: "team:ganjam-1",
    photos: [
      "Residential block and dining hall of the model school hostel.",
      "Main biometric attendance device at the school entry.",
      "Low-attendance device at the rear gate, installed for comparison runs.",
      "Kitchen service counter during the midday meal.",
    ],
    cycles: [
      {
        key: "ganjam-2026-04",
        date: "2026-04-14",
        status: "corrective_actions",
        trigger: "attendance_anomaly",
        type: "special",
        findings: [
          {
            key: "ganjam-2026-04-staff",
            category: "STAFF",
            severity: "high",
            description:
              "The institution reported 168 present for March 2026 while the main biometric device recorded 142, a variance of 26 children (15.5%). The rear-gate device recorded 139 for the same period, so the variance is not a device fault.",
            remediation:
              "Account for each of the 26 absent children, correct the source observations, and stop reporting the claimed figure over the biometric count.",
            outcome: "open",
            dueInDays: 14,
          },
          {
            key: "ganjam-2026-04-infra",
            category: "INFRA",
            severity: "medium",
            description:
              "The boundary wall on the northern side had a 4 m section collapsed, and the gate had no lock - the rear-gate device was therefore not a meaningful control.",
            remediation:
              "Rebuild the wall section, fit a lock to the gate, and record a monthly structural check.",
            outcome: "done",
            dueInDays: 30,
          },
        ],
      },
    ],
    funds: {
      programme: "programme:pmajay",
      scheme: "PM-AJAY (Biju Chhatra Bhuban Ruchi)",
      allocated: 1_650_000,
      fiscalYear: "2025-26",
      description: "Model school hostel residential block and kitchen.",
      releases: [[825_000, "2025-11-20", "TR/PMJ/25-26/0081"]],
    },
    expenses: [
      {
        key: "ganjam-meal-may",
        category: "Mid-day meal",
        description: "May 2026 mid-day meal raw material for 90 children.",
        amount: 71_200,
        date: "2026-05-05",
        vendor: "Ganjam Cooperative Marketing",
        gstin: "21AAGFG7788V1ZQ",
        invoice: "GCM/26-27/0505",
        status: "verified",
      },
    ],
    cameras: ["Ganjam School Hostel - Main Entry", "Ganjam School Hostel - Rear Gate"],
  },

  // ----------------------------------------------------------- Rourkela ----
  // Verification site for a pending attendance correction (device outage).
  {
    project: "project:rourkela",
    template: "hostel",
    policy: "officer",
    officer: USERS.programme,
    inspector: USERS.inspector4,
    team: "team:rourkela-1",
    photos: [
      "Model girls' hostel residential block in Rourkela.",
      "Gatehouse and completed boundary wall.",
      "Indoor recreation room and dining area.",
    ],
    cycles: [
      {
        key: "rourkela-2026-06",
        date: "2026-06-09",
        status: "closed",
        trigger: "scheduled",
        type: "regular",
        findings: [
          {
            key: "rourkela-2026-06-watsan",
            category: "WATSAN",
            severity: "low",
            description:
              "The overhead tank was not cleaned within the twelve-month interval recorded in the maintenance register; the last entry was fourteen months old.",
            remediation:
              "Clean the overhead tank and set an eleven-month reminder in the register.",
            outcome: "done",
            dueInDays: 21,
          },
          {
            key: "rourkela-2026-06-rolls",
            category: "ROLLS",
            severity: "medium",
            description:
              "Four children on the roll had a recorded age of under six; two carried guardian consent forms signed by a single parent where the register indicates both guardians are required.",
            remediation: "Re-verify the four records and obtain the missing consent signatures.",
            outcome: "done",
            dueInDays: 30,
          },
        ],
      },
    ],
    funds: {
      programme: "programme:pmajay",
      scheme: "PM-AJAY (Biju Chhatra Bhuban Ruchi)",
      allocated: 2_100_000,
      fiscalYear: "2025-26",
      description: "Residential block, dining hall, boundary wall and gatehouse.",
      releases: [
        [840_000, "2025-10-08", "TR/PMJ/25-26/0062"],
        [630_000, "2026-02-11", "TR/PMJ/25-26/0101"],
      ],
    },
    expenses: [
      {
        key: "rourkela-maint-jun",
        category: "Repairs and maintenance",
        description: "Overhead tank cleaning and wall repointing.",
        amount: 38_900,
        date: "2026-06-14",
        vendor: "Rourkela Building Services",
        gstin: "21AABFR4421J1ZL",
        invoice: "RBS/26-27/0614",
        status: "verified",
      },
    ],
    cameras: ["Rourkela Hostel - Gatehouse", "Rourkela Hostel - Dining Hall"],
  },

  // --------------------------------------------------------------- Puri ----
  // Astaraag senior citizen home: published under the officer policy.
  {
    project: "project:purisch-1",
    template: "srch",
    policy: "officer",
    officer: USERS.programme,
    inspector: USERS.inspector1,
    photos: [
      "Senior citizen home residential wing and verandah.",
      "Nursing room with the residents' medication register.",
      "Accessible washroom block and the ramp to the activity hall.",
    ],
    cycles: [
      {
        key: "purisch-2026-01",
        date: "2026-01-16",
        status: "closed",
        trigger: "calendar",
        type: "regular",
        findings: [
          {
            key: "purisch-2026-01-staff",
            category: "STAFF",
            severity: "medium",
            description:
              "The visiting physician had attended on 6 of the 12 fortnightly sessions recorded in the register, and the nursing room had no second aide on duty for the night shift on eleven recorded nights.",
            remediation:
              "Restore the fortnightly visit schedule or record the approved reason for each missed session, and roster a second night aide.",
            outcome: "done",
            dueInDays: 30,
          },
          {
            key: "purisch-2026-01-food",
            category: "FOOD",
            severity: "medium",
            description:
              "The diet register showed the same soft-diet menu on all seven days for the four residents on restricted diets, with no provision recorded for the low-salt variant prescribed by the visiting physician.",
            remediation:
              "Publish a differentiated diet sheet per resident and record the daily menu photographically.",
            outcome: "done",
            dueInDays: 21,
          },
        ],
      },
      {
        key: "purisch-2026-05",
        date: "2026-05-07",
        status: "corrective_actions",
        trigger: "complaint",
        type: "surprise",
        findings: [
          {
            key: "purisch-2026-05-watsan",
            category: "WATSAN",
            severity: "high",
            description:
              "The accessible washblock was locked and its key could not be produced by any of the three staff on duty. The residents on the register as needing assisted access had been using the uncovered rear yard instead.",
            remediation:
              "Keep the assisted-access washblock unlocked and its key on the duty roster, and record a daily check.",
            outcome: "open",
            dueInDays: 3,
          },
        ],
      },
    ],
    funds: {
      programme: "programme:avyay",
      scheme: "AVYAY (IPSrC component)",
      allocated: 1_450_000,
      fiscalYear: "2025-26",
      description: "Residential wing refurbishment, nursing room and accessible washblock.",
      releases: [[580_000, "2025-12-16", "TR/AVY/25-26/0047"]],
    },
    expenses: [
      {
        key: "purisch-medical-jan",
        category: "Medical supplies",
        description:
          "Pharmacy stock for the January 2026 cycle including the prescribed low-salt diet items.",
        amount: 27_400,
        date: "2026-01-20",
        vendor: "Puri Medical Agencies",
        gstin: "21AAJCP6612M1ZT",
        invoice: "PMA/26-27/0120",
        status: "verified",
      },
    ],
    cameras: ["Astaraag Home - Entrance Hall"],
    oversightCall: {
      title: "Astaraag Home - assisted access review",
      date: "2026-05-12T09:00:00Z",
      durationMin: 35,
    },
  },

  // -------------------------------------------------------- Puri IRCA ----
  // Was an active project with no operational history at all.
  {
    project: "project:puri-irca",
    template: "hostel",
    policy: "officer",
    officer: USERS.programme,
    inspector: USERS.inspector2,
    photos: [
      "Integrated Rehabilitation Centre for Addicts - residential wing.",
      "Group-therapy hall with the session timetable on the wall.",
      "Counselling room and the pharmacy store.",
    ],
    cycles: [
      {
        key: "irca-2026-03",
        date: "2026-03-26",
        status: "corrective_actions",
        trigger: "quarterly",
        type: "regular",
        findings: [
          {
            key: "irca-2026-03-rolls",
            category: "ROLLS",
            severity: "high",
            description:
              "Nine of the 27 residents on the roll had no consent or admission form on file, and three had a discharge date recorded but remained on the roll and on the daily attendance count.",
            remediation:
              "Obtain the missing consent and admission records, and reconcile the roll against the discharge register before the next daily count.",
            outcome: "open",
            dueInDays: 14,
          },
          {
            key: "irca-2026-03-staff",
            category: "STAFF",
            severity: "medium",
            description:
              "The recovery assistant roster recorded three shifts a day but the counselling register showed group sessions on five days without a counsellor present on two of them.",
            remediation:
              "Either roster a counsellor for the additional session days or move the sessions to the days the counsellor is present.",
            outcome: "done",
            dueInDays: 21,
          },
          {
            key: "irca-2026-03-watsan",
            category: "WATSAN",
            severity: "low",
            description:
              "The pharmacy store had no temperature log and the storeroom was shared with cleaning chemicals.",
            remediation: "Separate the pharmacy store, and begin a daily temperature log.",
            outcome: "done",
            dueInDays: 21,
          },
        ],
      },
      {
        key: "irca-2026-07",
        date: "2026-07-02",
        status: "assigned",
        trigger: "scheduled",
        type: "regular",
        findings: [],
      },
    ],
    funds: {
      programme: "programme:napddr",
      scheme: "NAPDDR",
      allocated: 1_900_000,
      fiscalYear: "2025-26",
      description: "Detoxification ward, counselling room and pharmacy store.",
      releases: [
        [760_000, "2025-11-12", "TR/NAP/25-26/0033"],
        [570_000, "2026-03-18", "TR/NAP/25-26/0074"],
      ],
    },
    expenses: [
      {
        key: "irca-pharmacy-apr",
        category: "Medical supplies",
        description: "April 2026 pharmacy stock for the detox programme.",
        amount: 43_750,
        date: "2026-04-11",
        vendor: "Puri Medical Agencies",
        gstin: "21AAJCP6612M1ZT",
        invoice: "PMA/26-27/0411",
        status: "submitted",
      },
      {
        key: "irca-laundry-may",
        category: "Facility upkeep",
        description: "Bedding and laundry services for the residential wing.",
        amount: 31_500,
        date: "2026-05-16",
        vendor: "Cleanline Services",
        gstin: "21AAHFC1120N1ZW",
        invoice: "CLS/26-27/0516",
        status: "verified",
      },
    ],
    cameras: ["IRCA Puri - Gate", "IRCA Puri - Therapy Hall"],
  },

  // ------------------------------------------------------------ Rajdhani ----
  // Pending verification: findings exist but the review is not concluded.
  {
    project: "project:rajdhani",
    template: "hostel",
    policy: "hidden",
    officer: USERS.officerKhordha,
    inspector: USERS.inspector1,
    photos: [
      "Rajdhani Boys' Hostel residential block, Khordha.",
      "Common kitchen and the dining area.",
      "Fenced play area and the staff muster board.",
    ],
    cycles: [
      {
        key: "rajdhani-2026-08",
        date: "2026-08-13",
        status: "verification",
        trigger: "verification_visit",
        type: "verification",
        findings: [
          {
            key: "rajdhani-2026-08-infra",
            category: "INFRA",
            severity: "medium",
            description:
              "On-ground measurement recorded 74 usable beds against the 80 sanctioned, and the three unrecorded posts had produced no appointment letters.",
            remediation:
              "Either furnish the sanction for 74 beds or complete the works, and produce the appointment letters for the three posts.",
            outcome: "open",
            dueInDays: 45,
          },
        ],
      },
    ],
    funds: {
      programme: "programme:pmajay",
      scheme: "PM-AJAY (Biju Chhatra Bhuban Ruchi)",
      allocated: 1_720_000,
      fiscalYear: "2025-26",
      description: "Residential block and kitchen; sanction pending verification outcome.",
      releases: [[688_000, "2026-01-27", "TR/PMJ/25-26/0109"]],
    },
    // Spend against the single 2026-01-27 instalment. 603,700 of the 688,000
    // released is accounted for below, which is what leaves the sanction
    // "pending verification": the money is committed but the block is not yet
    // at the sanctioned 80 beds (see the 2026-08-13 INFRA finding).
    expenses: [
      {
        key: "rajdhani-civil-works",
        category: "Civil works",
        description:
          "Second running bill for the residential block: slab, columns and plastering for the first two floors.",
        amount: 312_000,
        date: "2026-03-11",
        vendor: "Sundarpada Buildtech",
        gstin: "21AAECS4471K1Z8",
        invoice: "SBT/26-27/0311",
        status: "verified",
      },
      {
        key: "rajdhani-kitchen-equipment",
        category: "Kitchen equipment",
        description:
          "Cooking ranges, vessels and steel counters for the common kitchen, against the works schedule.",
        amount: 96_500,
        date: "2026-04-22",
        vendor: "Utkal Kitchen Supply",
        gstin: "21AABCU7733R1ZQ",
        invoice: "UKS/26-27/0422",
        status: "verified",
      },
      {
        key: "rajdhani-electrical",
        category: "Electrical works",
        description:
          "Internal wiring, fittings and street lighting for the residential block corridor.",
        amount: 74_200,
        date: "2026-06-03",
        vendor: "Balganga Electricals",
        gstin: "21AACFB2298M1ZL",
        invoice: "BFE/26-27/0603",
        status: "submitted",
      },
      {
        key: "rajdhani-fencing",
        category: "Boundary works",
        description: "Fencing and gate for the play area and the front compound of the hostel.",
        amount: 121_000,
        date: "2026-07-14",
        vendor: "Sundarpada Buildtech",
        gstin: "21AAECS4471K1Z8",
        invoice: "SBT/26-27/0714",
        status: "verified",
      },
      {
        key: "rajdhani-labour-unsigned",
        category: "Minor repairs",
        description:
          "Watchman and cleaning labour for the partially occupied block, claimed without an invoice.",
        amount: 38_000,
        date: "2026-05-06",
        vendor: "Not registered",
        gstin: "N/A",
        invoice: "-",
        status: "void",
        voidReason:
          "Labour attendance not recorded and no tax invoice supplied; rejected pending documentation.",
      },
    ],
  },

  // ------------------------------------------------------------ Jajapur ----
  // Village target: gram panchayat records, no institute, no CCTV or devices.
  {
    project: "project:jajapur-adarsh",
    template: "sa-village",
    policy: "officer",
    officer: USERS.programme,
    inspector: USERS.auditor,
    photos: [
      "Dharmasala gram panchayat office, the administrative seat of the audited village.",
      "Adarsh Gram works completed under the PM-AJAY component.",
      "Household-level roll verification in progress.",
    ],
    cycles: [
      {
        key: "jajapur-2026-02",
        date: "2026-02-19",
        status: "closed",
        trigger: "calendar",
        type: "social_audit",
        findings: [
          {
            key: "jajapur-2026-02-rolls",
            category: "ROLLS",
            severity: "medium",
            description:
              "The panchayat roll listed 213 households, but the works register showed 226 households marked as having received a component benefit, with 13 households appearing in the works register and not on the roll.",
            remediation:
              "Reconcile the two registers, and record the basis on which the 13 additional households were included.",
            outcome: "done",
            dueInDays: 30,
          },
          {
            key: "jajapur-2026-02-infra",
            category: "INFRA",
            severity: "low",
            description:
              "Two of the eleven completed works had no completion photograph on file, and the panchayat could not produce the inspection certificate for the third.",
            remediation:
              "Obtain the completion photographs and the outstanding inspection certificate.",
            outcome: "done",
            dueInDays: 30,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Puri ----
  // A draft. Deliberately given documentation and a contact but NO operational
  // history: a draft project has not been approved, so it cannot have
  // inspections, funds, cameras or devices.
  {
    project: "project:puri-model",
    template: "hostel",
    policy: "hidden",
    officer: USERS.officerKhordha,
    inspector: USERS.inspector1,
    photos: [
      "Proposed site for the Puri model boys' hostel, at the stage of the initial site visit.",
    ],
    cycles: [],
  },
];

/**
 * ISO timestamp helper - everything in this module is date-literal, not
 * relative, so a reset always reproduces the same instants.
 *
 * Accepts either a bare `YYYY-MM-DD` day (combined with a time-of-day) or a
 * full ISO instant, which some specs (video calls) carry directly.
 */
function at(day: string, hhmm = "09:00:00"): Date {
  const d = day.includes("T") ? new Date(day) : new Date(`${day}T${hhmm}Z`);
  if (Number.isNaN(d.getTime())) {
    // Fail loudly. A silently invalid Date reaches the driver and surfaces as
    // an opaque "Invalid time value" in Drizzle's timestamp mapper, which is
    // exactly the kind of seed bug that is painful to trace.
    throw new Error(`seed: invalid date literal ${JSON.stringify(day)} (time ${hhmm})`);
  }
  return d;
}

function addDays(day: string, days: number): Date {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Deterministic content hash stand-in.
 *
 * Seeded file content is never hashed for real, but the schema requires a
 * hash and the UI displays it. Deriving it from the seed key keeps the value
 * stable across resets and obviously synthetic (64 hex chars) rather than a
 * real SHA-256 of a file that does not exist.
 */
function fakeSha(seed: string): string {
  const out: string[] = [];
  let h = 0x811c9dc5;
  for (let round = 0; round < 4; round++) {
    for (const ch of seed) {
      h ^= ch.charCodeAt(0) + round;
      h = Math.imul(h, 0x01000193) >>> 0;
      out.push(h.toString(16).padStart(8, "0"));
      if (out.length >= 8) break;
    }
  }
  return out.join("").slice(0, 64).padEnd(64, "0");
}

const EVIDENCE_BY_CATEGORY = {
  FIN: [
    { type: "document", file: "purchase-register-extract", mime: "image/jpeg" },
    { type: "document", file: "invoice-copy", mime: "application/pdf" },
  ],
  FOOD: [
    { type: "photo", file: "dry-store-physical-count", mime: "image/jpeg" },
    { type: "document", file: "weekly-menu", mime: "application/pdf" },
    { type: "photo", file: "kitchen-service-counter", mime: "image/jpeg" },
  ],
  INFRA: [
    { type: "photo", file: "defect-site", mime: "image/jpeg" },
    { type: "document", file: "sanction-drawing", mime: "application/pdf" },
  ],
  ROLLS: [
    { type: "document", file: "muster-roll-extract", mime: "application/pdf" },
    { type: "photo", file: "roll-board", mime: "image/jpeg" },
  ],
  STAFF: [
    { type: "document", file: "muster-roll-extract", mime: "application/pdf" },
    { type: "photo", file: "duty-roster", mime: "image/jpeg" },
  ],
  WATSAN: [
    { type: "photo", file: "facility-condition", mime: "image/jpeg" },
    { type: "document", file: "maintenance-register-extract", mime: "application/pdf" },
  ],
} as const;

export async function seedProjectOperations(db: DrizzleDB): Promise<void> {
  const inspectionRows: (typeof s.inspections.$inferInsert)[] = [];
  const observationRows: (typeof s.observations.$inferInsert)[] = [];
  const findingRows: (typeof s.findings.$inferInsert)[] = [];
  const evidenceRows: (typeof s.evidence.$inferInsert)[] = [];
  const caRows: (typeof s.correctiveActions.$inferInsert)[] = [];
  const caFileRows: (typeof s.correctiveActionFiles.$inferInsert)[] = [];
  const assignmentRows: (typeof s.inspectionAssignments.$inferInsert)[] = [];
  const syncRows: (typeof s.inspectionSyncOperations.$inferInsert)[] = [];
  const photoRows: (typeof s.projectPhotos.$inferInsert)[] = [];
  const riskRows: (typeof s.projectRiskSnapshots.$inferInsert)[] = [];
  const cameraRows: (typeof s.cctvCameras.$inferInsert)[] = [];
  const complaintRows: (typeof s.complaints.$inferInsert)[] = [];
  const complaintFileRows: (typeof s.complaintFiles.$inferInsert)[] = [];
  const allocRows: (typeof s.fundAllocations.$inferInsert)[] = [];
  const releaseRows: (typeof s.fundReleases.$inferInsert)[] = [];
  const expenseRows: (typeof s.expenses.$inferInsert)[] = [];
  const docRows: (typeof s.financialDocuments.$inferInsert)[] = [];
  const riskEventRows: (typeof s.financialRiskEvents.$inferInsert)[] = [];
  const vcRows: (typeof s.vcSessions.$inferInsert)[] = [];
  const participantRows: (typeof s.vcParticipants.$inferInsert)[] = [];

  for (const p of PROFILES) {
    const projectId = did(p.project);
    const orgId =
      p.project === "project:jajapur-adarsh" ? null : did(`org:${ORG_BY_PROJECT[p.project]}`);

    // ---------------------------------------------------------- photos ----
    p.photos.forEach((caption, i) => {
      const key = `${p.project}:photo:${i}`;
      photoRows.push({
        id: did(key),
        projectId,
        uploadedBy: did(p.officer),
        capturedAt: at(addDaysISO(p.cycles[0]?.date ?? "2026-01-15", -30 + i), "10:15:00"),
        caption,
        fileName: `${slug(p.project.split(":")[1])}-${i + 1}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 180_000 + i * 24_000,
        contentHash: fakeSha(key),
        storageKey: `projects/${p.project.replace("project:", "")}/${i + 1}.jpg`,
        createdAt: at(addDaysISO(p.cycles[0]?.date ?? "2026-01-15", -30 + i), "10:20:00"),
      });
    });

    // --------------------------------------------------------- cameras ----
    (p.cameras ?? []).forEach((name, i) => {
      const key = `${p.project}:camera:${i}`;
      cameraRows.push({
        id: did(key),
        name,
        provider: "netram-sim",
        protocol: "rtsp",
        endpoint: `rtsp://sim.invalid/${key}`,
        districtId: did(`district:${DISTRICT_BY_PROJECT[p.project]}`),
        status: "online",
        projectId,
        createdAt: at("2026-01-10T08:00:00Z"),
        updatedAt: at("2026-01-10T08:00:00Z"),
      });
    });

    // ------------------------------------------------- inspection cycles ----
    for (const cycle of p.cycles) {
      const inspectionId = did(`inspection:${cycle.key}`);
      const start = at(cycle.date, "06:00:00");
      const end = at(cycle.date, "14:00:00");
      const started = at(cycle.date, "06:12:00");
      const submitted =
        cycle.status === "assigned" || cycle.status === "in_progress"
          ? null
          : at(cycle.date, "13:40:00");

      inspectionRows.push({
        id: inspectionId,
        projectId,
        templateId: did(`template:${p.template}`),
        type: cycle.type,
        trigger: cycle.trigger,
        status: cycle.status,
        disclosurePolicyId: did(`policy:${p.policy}`),
        scheduledStart: start,
        scheduledEnd: end,
        startedAt: started,
        submittedAt: submitted,
        createdAt: start,
        updatedAt: submitted ?? started,
      });

      for (const [i, inspector] of [p.inspector, p.inspector2].entries()) {
        if (!inspector) continue;
        assignmentRows.push({
          id: did(`assignment:${cycle.key}:${i}`),
          inspectionId,
          userId: did(inspector),
          // "lead" carries the finding authority; the second member supports.
          role: i === 0 ? "lead_inspector" : "inspector",
          status: cycle.status === "assigned" ? "assigned" : "accepted",
          assignedAt: start,
        });
      }

      // Offline replay: what the inspector app queued while out of coverage
      // and the server accepted on reconnection (AGENTS.md §31). Operation ids
      // are client-generated, so they are part of the seed, not the server.
      if (cycle.status !== "assigned" && cycle.findings.length > 0) {
        const ops: [string, string, string, string][] = [
          ["observation.create", "accepted", "OK", "Observation recorded."],
          ["evidence.upload", "accepted", "OK", "Evidence stored and hash verified."],
          ["finding.create", "accepted", "OK", "Finding recorded against the inspection."],
        ];
        ops.forEach(([type, status, code, message], i) => {
          syncRows.push({
            id: did(`sync:${cycle.key}:${i}`),
            inspectionId,
            userId: did(p.inspector),
            operationType: type,
            payload: {
              clientOperationId: `op-${cycle.key}-${i + 1}`,
              capturedAt: at(cycle.date, "07:05:00"),
              deviceId: "inspector-android-01",
            },
            status,
            code,
            message,
            resultData: { inspectionId },
            clientTimestamp: at(cycle.date, "07:05:00"),
            processedAt: at(cycle.date, "18:20:00"),
          });
        });
      }

      // One rejected operation per closed cycle, to show the conflict path is
      // real and traceable rather than every queued operation succeeding.
      if (cycle.status === "closed" && cycle.findings.length > 1) {
        syncRows.push({
          id: did(`sync:${cycle.key}:conflict`),
          inspectionId,
          userId: did(p.inspector2 ?? p.inspector),
          operationType: "finding.create",
          payload: {
            clientOperationId: `op-${cycle.key}-conflict`,
            capturedAt: at(cycle.date, "07:40:00"),
            deviceId: "inspector-android-02",
          },
          status: "conflict",
          code: "STATE_CONFLICT",
          message:
            "The inspection was already submitted by another team member; the observation was preserved for review rather than merged.",
          resultData: { inspectionId, requiresReview: true },
          clientTimestamp: at(cycle.date, "07:40:00"),
          processedAt: at(cycle.date, "18:21:00"),
        });
      }

      // ------------------------------- observations, findings, evidence ----
      for (const f of cycle.findings) {
        const findingId = did(`finding:${f.key}`);
        const observationId = did(`observation:${f.key}`);

        observationRows.push({
          id: observationId,
          inspectionId,
          userId: did(p.inspector),
          text: f.description,
          createdAt: at(cycle.date, "08:30:00"),
        });

        findingRows.push({
          id: findingId,
          inspectionId,
          observationId,
          categoryId: did(CATEGORIES[f.category]),
          severity: f.severity,
          description: f.description,
          remediation: f.remediation,
          status: f.outcome === "done" ? "confirmed" : "action_required",
          amountInr: f.amountInr ?? null,
          responsibleOrganisationId: orgId,
          createdAt: at(cycle.date, "08:45:00"),
          updatedAt: at(cycle.date, "08:45:00"),
        });

        EVIDENCE_BY_CATEGORY[f.category].forEach((e, i) => {
          const key = `evidence:${f.key}:${i}`;
          evidenceRows.push({
            id: did(key),
            inspectionId,
            findingId,
            capturedAt: at(cycle.date, ["08:05:00", "08:20:00", "08:50:00"][i] ?? "08:05:00"),
            latitude: null,
            longitude: null,
            evidenceType: e.type,
            fileName: `${e.file}-${i + 1}.${e.mime.split("/")[1]}`,
            mimeType: e.mime,
            sizeBytes: 120_000 + i * 45_000,
            contentHash: fakeSha(key),
            deviceId: "inspector-android-01",
            // Capture-time hash equals upload-time verification, which is what
            // the integrity check actually proves (AGENTS.md §30).
            uploadState: "uploaded",
            integrityState: "verified",
            createdAt: at(cycle.date, "08:55:00"),
            storageKey: `inspections/${cycle.key}/${e.file}-${i + 1}`,
          });
        });

        if (f.outcome === "none") continue;

        const due = addDays(cycle.date, f.dueInDays ?? 21);
        const submittedAt =
          f.outcome === "done"
            ? addDays(cycle.date, Math.max(1, Math.floor((f.dueInDays ?? 21) / 2)))
            : null;
        const verifiedAt = f.outcome === "done" ? addDays(cycle.date, f.dueInDays ?? 21) : null;
        const caId = did(`ca:${f.key}`);

        caRows.push({
          id: caId,
          findingId,
          inspectionId,
          organisationId: orgId,
          status:
            f.outcome === "done"
              ? "accepted"
              : // Overdue once the deadline has already passed as of seeding.
                new Date("2026-09-30T00:00:00Z") > due
                ? "overdue"
                : "submitted",
          deadline: due,
          submittedAt,
          createdAt: at(cycle.date, "09:00:00"),
          updatedAt: (verifiedAt ?? submittedAt ?? at(cycle.date, "09:00:00")) as Date,
          actionSummary: f.remediation,
          verifiedAt,
          verifiedByUserId: verifiedAt ? did(USERS.admin) : null,
          reviewRemarks: verifiedAt
            ? "Verified on the re-inspection walk-through; evidence supplied and accepted."
            : null,
        });

        if (f.outcome === "done") {
          const key = `cafile:${f.key}`;
          caFileRows.push({
            id: did(key),
            correctiveActionId: caId,
            fileName: "remediation-evidence.pdf",
            mimeType: "application/pdf",
            sizeBytes: 320_000,
            contentHash: fakeSha(key),
            storageKey: `corrective-actions/${f.key}/remediation-evidence.pdf`,
            createdAt: submittedAt ?? at(cycle.date, "09:00:00"),
          });
        }
      }
    }

    // ----------------------------------------------------------- funds ----
    if (p.funds) {
      const allocationId = did(`allocation:${p.project}`);
      allocRows.push({
        id: allocationId,
        projectId,
        programmeId: did(p.funds.programme),
        organisationId: orgId,
        allocatedAmount: String(p.funds.allocated),
        fiscalYear: p.funds.fiscalYear,
        currency: "INR",
        sanctionedById: did(USERS.sanction),
        sanctionedAt: at("2025-08-01T11:00:00Z"),
        status: "released",
        description: p.funds.description,
        notes: null,
        createdById: did(USERS.sanction),
        createdAt: at("2025-08-01T11:00:00Z"),
        updatedAt: at("2025-12-15T11:00:00Z"),
        scheme: p.funds.scheme,
      });

      p.funds.releases.forEach(([amount, date, ref], i) => {
        releaseRows.push({
          id: did(`release:${p.project}:${i}`),
          allocationId,
          releasedAmount: String(amount),
          releaseDate: at(date),
          referenceNumber: ref,
          releasedById: did(USERS.sanction),
          remarks:
            i === 0 ? "First instalment against the sanctioned allocation." : "Second instalment.",
          status: "released",
          createdAt: at(date, "12:00:00"),
          updatedAt: at(date, "12:00:00"),
        });
      });
    }

    // ------------------------------------- expenses, documents, risk ----
    for (const e of p.expenses ?? []) {
      const expenseId = did(`expense:${e.key}`);
      const allocationId = did(`allocation:${p.project}`);
      expenseRows.push({
        id: expenseId,
        projectId,
        organisationId: orgId,
        allocationId: p.funds ? allocationId : null,
        category: e.category,
        description: e.description,
        amount: String(e.amount),
        transactionDate: at(e.date),
        vendorName: e.vendor,
        vendorGstin: e.gstin === "N/A" ? null : e.gstin,
        invoiceNumber: e.invoice === "-" ? null : e.invoice,
        invoiceDate: at(e.date),
        paymentReference: `UTR${fakeSha(e.key).slice(0, 12).toUpperCase()}`,
        paymentMethod: "NEFT",
        status: e.status,
        submittedById: did(USERS.institution),
        submittedAt: at(addDaysISO(e.date, 1), "10:00:00"),
        verifiedById: e.status === "verified" ? did(USERS.admin) : null,
        verifiedAt: e.status === "verified" ? at(addDaysISO(e.date, 4), "15:00:00") : null,
        voidReason: e.voidReason ?? null,
        voidedById: e.status === "void" ? did(USERS.admin) : null,
        voidedAt: e.status === "void" ? at(addDaysISO(e.date, 5), "15:00:00") : null,
        createdById: did(USERS.institution),
        createdAt: at(addDaysISO(e.date, 1), "10:05:00"),
        updatedAt: at(addDaysISO(e.date, 5), "15:00:00"),
      });

      if (e.status !== "void") {
        const key = `findoc:${e.key}`;
        docRows.push({
          id: did(key),
          expenseId,
          projectId,
          documentType: "tax_invoice",
          fileName: `${slug(e.key)}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 145_000,
          sha256Hash: fakeSha(key),
          storageKey: `financial/${p.project.replace("project:", "")}/${slug(e.key)}.pdf`,
          verificationStatus: e.status === "verified" ? "verified" : "pending",
          uploadedById: did(USERS.institution),
          uploadedAt: at(addDaysISO(e.date, 1), "10:10:00"),
          verifiedById: e.status === "verified" ? did(USERS.admin) : null,
          verifiedAt: e.status === "verified" ? at(addDaysISO(e.date, 4), "15:05:00") : null,
          rejectionReason: null,
          duplicateOfId: null,
          createdAt: at(addDaysISO(e.date, 1), "10:10:00"),
        });
      }

      // The voided expense is the thing the financial risk rules are for.
      if (e.status === "void") {
        riskEventRows.push({
          id: did(`riskevent:${e.key}`),
          ruleId: did("rule:exp-001"),
          projectId,
          organisationId: orgId,
          expenseId,
          documentId: null,
          allocationId: p.funds ? allocationId : null,
          scoreContribution: 15,
          detail: {
            rule: "EXP-001",
            reason: e.voidReason,
            vendor: e.vendor,
            amount: e.amount,
          },
          status: "open",
          resolvedById: null,
          resolvedAt: null,
          createdAt: at(addDaysISO(e.date, 5), "15:10:00"),
        });
      }
    }

    // ------------------------------------------- complaints + attachments ----
    const complaintSpec = COMPLAINTS[p.project];
    if (complaintSpec) {
      const complaintId = did(`complaint:${complaintSpec.key}`);
      complaintRows.push({
        id: complaintId,
        projectId,
        complainantName: complaintSpec.name,
        contactInfo: complaintSpec.contact,
        trackingCode: `CMP/${complaintSpec.key.toUpperCase()}`,
        description: complaintSpec.description,
        status: complaintSpec.status,
        receivedAt: at(complaintSpec.date, "11:00:00"),
        resolutionText: complaintSpec.resolution ?? null,
        resolvedAt: complaintSpec.resolution
          ? at(addDaysISO(complaintSpec.date, complaintSpec.resolvedInDays ?? 20), "16:00:00")
          : null,
        createdAt: at(complaintSpec.date, "11:00:00"),
        updatedAt: at(
          addDaysISO(complaintSpec.date, complaintSpec.resolvedInDays ?? 20),
          "16:00:00",
        ),
      });

      complaintSpec.attachments.forEach((a, i) => {
        const key = `cfile:${complaintSpec.key}:${i}`;
        complaintFileRows.push({
          id: did(key),
          complaintId,
          fileName: a,
          mimeType: a.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
          sizeBytes: 210_000 + i * 30_000,
          contentHash: fakeSha(key),
          storageKey: `complaints/${complaintSpec.key}/${a}`,
          createdAt: at(complaintSpec.date, "11:05:00"),
        });
      });
    }

    // ------------------------------------------------- risk snapshots ----
    // Score composition is hand-set per project so the risk page explains
    // itself instead of showing an unexplained integer.
    const risk = RISK[p.project];
    if (risk) {
      risk.forEach(([date, total, level, parts, explanation], i) => {
        riskRows.push({
          id: did(`risk:${p.project}:${i}`),
          projectId,
          calculatedAt: at(date, "05:00:00"),
          scoringVersion: "risk-v1",
          totalScore: total,
          riskLevel: level,
          financialScore: parts[0],
          inspectionQualityScore: parts[1],
          attendanceAnomalyScore: parts[2],
          complaintDensityScore: parts[3],
          aiAnomalyScore: parts[4],
          financialSignals: { rulesTriggered: riskEventRows.length > 0 ? ["EXP-001"] : [] },
          inspectionQualitySignals: { findings: countFindings(p), overdue: countOverdue(p) },
          attendanceAnomalySignals: { variancePct: parts[2] > 0 ? 15.5 : 0 },
          complaintDensitySignals: { openComplaints: complaintSpec?.status === "resolved" ? 0 : 1 },
          aiAnomalySignals: { conflicts: 0 },
          // Object rows, not bare strings: the risk UI reads a dimension key
          // and its weight off each entry.
          topContributors: (riskEventRows.length > 0
            ? [
                { dimension: "financial", weight: 15, source: "EXP-001" },
                { dimension: "inspection_quality", weight: 40, source: "finding" },
              ]
            : [{ dimension: "inspection_quality", weight: 30, source: "finding" }]) as Array<
            Record<string, unknown>
          >,
          explanation,
          inspectionFlagId: null,
          scheduledInspectionId: p.cycles[0] ? did(`inspection:${p.cycles[0].key}`) : null,
          createdAt: at(date, "05:00:00"),
        });
      });
    }

    // ---------------------------------------- oversight video call ----
    if (p.oversightCall && p.cycles[0]) {
      const sessionId = did(`vc:${p.project}`);
      const startedAt = at(p.oversightCall.date);
      vcRows.push({
        id: sessionId,
        inspectionId: did(`inspection:${p.cycles[0].key}`),
        projectId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + p.oversightCall.durationMin * 60_000),
        title: p.oversightCall.title,
        status: "ended",
        hostUserId: did(USERS.admin),
        roomName: `netram-${p.project.replace("project:", "")}`,
        provider: "netram-vc",
        scheduledAt: startedAt,
        metadata: { purpose: "oversight_review" },
        createdAt: startedAt,
        updatedAt: new Date(startedAt.getTime() + p.oversightCall.durationMin * 60_000),
      });

      [USERS.admin, p.inspector, p.officer].forEach((u, i) => {
        participantRows.push({
          id: did(`vcp:${p.project}:${i}`),
          sessionId,
          userId: did(u),
          role: i === 0 ? "host" : "participant",
          joinedAt: new Date(startedAt.getTime() + i * 45_000),
          leftAt: new Date(startedAt.getTime() + (p.oversightCall!.durationMin - 2) * 60_000),
          createdAt: startedAt,
        });
      });
    }
  }

  // Everything is inserted in one pass, conflict-ignored, so a re-run against
  // an already-seeded database is a no-op rather than a duplicate-key failure.
  await db.insert(s.inspections).values(inspectionRows).onConflictDoNothing();
  await db.insert(s.inspectionAssignments).values(assignmentRows).onConflictDoNothing();
  await db.insert(s.observations).values(observationRows).onConflictDoNothing();
  await db.insert(s.findings).values(findingRows).onConflictDoNothing();
  await db.insert(s.evidence).values(evidenceRows).onConflictDoNothing();
  await db.insert(s.correctiveActions).values(caRows).onConflictDoNothing();
  await db.insert(s.correctiveActionFiles).values(caFileRows).onConflictDoNothing();
  await db.insert(s.inspectionSyncOperations).values(syncRows).onConflictDoNothing();
  await db.insert(s.projectPhotos).values(photoRows).onConflictDoNothing();
  await db.insert(s.cctvCameras).values(cameraRows).onConflictDoNothing();
  await db.insert(s.complaints).values(complaintRows).onConflictDoNothing();
  await db.insert(s.complaintFiles).values(complaintFileRows).onConflictDoNothing();
  await db.insert(s.fundAllocations).values(allocRows).onConflictDoNothing();
  await db.insert(s.fundReleases).values(releaseRows).onConflictDoNothing();
  await db.insert(s.expenses).values(expenseRows).onConflictDoNothing();
  await db.insert(s.financialDocuments).values(docRows).onConflictDoNothing();
  await db.insert(s.financialRiskEvents).values(riskEventRows).onConflictDoNothing();
  await db.insert(s.projectRiskSnapshots).values(riskRows).onConflictDoNothing();
  await db.insert(s.vcSessions).values(vcRows).onConflictDoNothing();
  await db.insert(s.vcParticipants).values(participantRows).onConflictDoNothing();
}

/** Organisation that operates each project, keyed to the ids in index.ts. */
const ORG_BY_PROJECT: Record<string, string> = {
  "project:vani": "vani",
  "project:rajdhani": "rajdhani",
  "project:cuttack-girls": "cuttack-girls",
  "project:puri-model": "puri-model",
  "project:ganjam-school": "ganjam-school",
  "project:rourkela": "rourkela",
  "project:purisch-1": "nilachal",
  "project:puri-irca": "nilachal",
  "project:jajapur-adarsh": "nilachal",
};

const DISTRICT_BY_PROJECT: Record<string, string> = {
  "project:vani": "khordha",
  "project:rajdhani": "khordha",
  "project:cuttack-girls": "cuttack",
  "project:puri-model": "puri",
  "project:ganjam-school": "ganjam",
  "project:rourkela": "sundargarh",
  "project:purisch-1": "puri",
  "project:puri-irca": "puri",
  "project:jajapur-adarsh": "jajapur",
};

type ComplaintSpec = {
  key: string;
  name: string;
  contact: string;
  description: string;
  status: "received" | "under_review" | "resolved" | "escalated" | "closed";
  date: string;
  resolution?: string;
  resolvedInDays?: number;
  attachments: string[];
};

/**
 * Complaints are oversight inputs, not findings (AGENTS.md §35). None of these
 * is treated as proof of misconduct; the two that are "resolved" record a
 * review outcome, and the one that is "escalated" went to inspection - which is
 * exactly the distinction the seed is meant to demonstrate.
 */
const COMPLAINTS: Record<string, ComplaintSpec> = {
  "project:vani": {
    key: "vani-ration",
    name: "Reported by resident guardian (withheld)",
    contact: "complaint.vani.1@dev.netram.in",
    description:
      "Claims that the quantity of rice served to residents has fallen over the past two months and that the kitchen register is being written up after the fact.",
    status: "resolved",
    date: "2026-03-06",
    resolvedInDays: 26,
    resolution:
      "Reviewed against the dry-store stock record. The register variance was confirmed and a food finding was raised on the surprise inspection of 11 March. The complaint itself was not treated as proof; the finding rests on the physical count.",
    attachments: ["guardian-statement.pdf", "ration-slip-photo.jpg"],
  },
  "project:cuttack-girls": {
    key: "cuttack-guard",
    name: "Reported by ward staff (withheld)",
    contact: "complaint.cuttack.1@dev.netram.in",
    description:
      "Reports that purchases are split across several small invoices to stay under a review threshold, and that the same person records and approves them.",
    status: "escalated",
    date: "2026-02-05",
    attachments: ["invoice-copies.pdf"],
  },
  "project:purisch-1": {
    key: "purisch-access",
    name: "Reported by visiting family member (withheld)",
    contact: "complaint.purisch.1@dev.netram.in",
    description:
      "Reports that the accessible washblock is kept locked and that residents needing assistance are not being helped to use it.",
    status: "resolved",
    date: "2026-05-05",
    resolvedInDays: 18,
    resolution:
      "Confirmed on the surprise inspection of 7 May and raised as a high-severity WATSAN finding. The complaint was treated as a prompt for verification, not as a determination.",
    attachments: [],
  },
  "project:ganjam-school": {
    key: "ganjam-attendance",
    name: "Reported by parent (withheld)",
    contact: "complaint.ganjam.1@dev.netram.in",
    description:
      "Reports that children are marked present who are not in the hostel, over a period of several weeks.",
    status: "under_review",
    date: "2026-04-06",
    attachments: ["parent-statement.pdf", "attendance-slip.jpg"],
  },
  "project:rajdhani": {
    key: "rajdhani-capacity",
    name: "Reported by applicant (withheld)",
    contact: "complaint.rajdhani.1@dev.netram.in",
    description:
      "An applicant states that the hostel was told it is full, while the applicant was directed to report to an adjoining block not shown in the sanction.",
    status: "under_review",
    date: "2026-08-04",
    attachments: [],
  },
};

/**
 * Risk snapshots per project: [date, total, level, [fin, insp, att, complaint, ai], explanation].
 */
const RISK: Record<
  string,
  [string, number, string, [number, number, number, number, number], string][]
> = {
  "project:vani": [
    [
      "2026-02-01",
      34,
      "medium",
      [8, 40, 0, 0, 0],
      "Occupancy and staffing findings from the January cycle; no financial or attendance signal yet.",
    ],
    [
      "2026-04-01",
      68,
      "high",
      [12, 70, 0, 20, 30],
      "Food procurement and roll integrity findings, a resolved complaint, and camera conflict detections on the dining hall. Highest contributing dimension is inspection quality.",
    ],
    [
      "2026-07-01",
      71,
      "high",
      [14, 70, 0, 20, 30],
      "Unchanged from April: the March corrective actions remain open, so the risk score has not recovered.",
    ],
  ],
  "project:cuttack-girls": [
    [
      "2026-03-01",
      82,
      "critical",
      [30, 85, 0, 25, 0],
      "Split-invoice procurement finding and a 19-record roll mismatch. The project is suspended pending review; score is dominated by inspection quality and financial signals.",
    ],
    [
      "2026-06-01",
      74,
      "high",
      [26, 80, 0, 25, 0],
      "Partially recovered after the railing and fire-system remediation, but the procurement and roll findings are still open.",
    ],
  ],
  "project:ganjam-school": [
    [
      "2026-05-01",
      61,
      "high",
      [8, 55, 70, 20, 0],
      "Attendance discrepancy is the dominant signal: 168 claimed against 142 biometric, corroborated by the second device, so it is not device error.",
    ],
    [
      "2026-08-01",
      58,
      "high",
      [8, 50, 70, 20, 0],
      "Marginally lower after the wall and gate remediation; the attendance variance is unresolved.",
    ],
  ],
  "project:rourkela": [
    [
      "2026-07-01",
      28,
      "medium",
      [6, 30, 20, 0, 0],
      "All findings from the June cycle are closed. Attendance correction for the March device outage is pending an authority decision.",
    ],
  ],
  "project:purisch-1": [
    [
      "2026-02-01",
      41,
      "medium",
      [5, 55, 0, 20, 0],
      "Staffing and diet findings from the January cycle; records are published under the officer disclosure policy.",
    ],
    [
      "2026-06-01",
      63,
      "high",
      [5, 75, 0, 25, 0],
      "The assisted-access finding and an unresolved complaint raise both the inspection-quality and complaint-density dimensions.",
    ],
  ],
  "project:puri-irca": [
    [
      "2026-04-01",
      66,
      "high",
      [10, 70, 0, 25, 0],
      "Roll integrity finding against an active project with no prior inspection history; the second cycle is still assigned.",
    ],
    [
      "2026-08-01",
      49,
      "medium",
      [10, 55, 0, 25, 0],
      "Recovered after the counselling-roster and pharmacy-store remediations, but the roll finding remains open.",
    ],
  ],
  "project:rajdhani": [
    [
      "2026-09-01",
      45,
      "medium",
      [10, 60, 0, 0, 0],
      "Capacity and staffing-verification finding; the project is still Pending Verification, so findings are hidden until the inspection starts.",
    ],
  ],
  "project:jajapur-adarsh": [
    [
      "2026-03-01",
      33,
      "medium",
      [4, 45, 0, 0, 0],
      "Roll-versus-works register reconciliation and missing completion evidence, both now closed.",
    ],
  ],
};

function countFindings(p: ProjectSpec): number {
  return p.cycles.reduce((n, c) => n + c.findings.length, 0);
}

function countOverdue(p: ProjectSpec): number {
  const now = new Date("2026-09-30T00:00:00Z");
  return p.cycles.reduce(
    (n, c) =>
      n +
      c.findings.filter((f) => {
        if (f.outcome === "done") return false;
        return now > addDays(c.date, f.dueInDays ?? 21);
      }).length,
    0,
  );
}

function addDaysISO(day: string, days: number): string {
  return addDays(day, days).toISOString().slice(0, 10);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
