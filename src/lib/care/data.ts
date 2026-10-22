// Demo data only (fake). Record ids double as the single encryption tag, so keep them stable.
export const OWNER_GROUP = "/p1-owner"; // patient1: read-write
export const CARE_GROUP = "/p1-care-team"; // GP + physio: read only
export const P2_OWNER_GROUP = "/p2-owner"; // patient2: read-write

export interface RecordMeta {
  id: string;
  patientId: string;
  title: string;
  /** Fake plaintext the patient encrypts in their own browser. The server never sees it. */
  sample: string;
}

export interface PatientMeta {
  id: string;
  name: string;
  ownerGroup: string;
}

export const PATIENTS: PatientMeta[] = [
  { id: "patient1", name: "Nguyen Van A (Patient 1)", ownerGroup: OWNER_GROUP },
  { id: "patient2", name: "Tran Thi B (Patient 2 - Multi-patient Demo)", ownerGroup: P2_OWNER_GROUP },
];

export const RECORDS: RecordMeta[] = [
  {
    id: "rec-allergies",
    patientId: "patient1",
    title: "Allergies and medications (fake)",
    sample: "Allergy: penicillin (rash). Medication: salbutamol inhaler as needed. Fake demo data.",
  },
  {
    id: "rec-physio-plan",
    patientId: "patient1",
    title: "Knee rehabilitation plan (fake)",
    sample: "Week 1-2: range of motion. Week 3-6: quad strengthening, 3x per week. Fake demo data.",
  },
  {
    id: "rec-blood-test",
    patientId: "patient1",
    title: "Comprehensive Metabolic Panel & CBC (fake)",
    sample: "WBC: 6.5 x10^9/L. Glucose: 5.2 mmol/L. HbA1c: 5.4%. Kidney function normal. Fake demo data.",
  },
  {
    id: "rec-cardio-assessment",
    patientId: "patient2",
    title: "Cardiology Holter & ECG Report (fake)",
    sample: "Patient: Patient 2 (Demo). Sinus rhythm, average HR 72 bpm, no ischemic ST changes. Fake demo data.",
  },
];

export const recordById = (id: string) => RECORDS.find((r) => r.id === id);
export const recordsByPatient = (patientId: string) => RECORDS.filter((r) => r.patientId === patientId);

