// Demo data only (fake). Record ids double as the single encryption tag, so keep them stable.
export const OWNER_GROUP = "/p1-owner"; // patient1: read-write
export const CARE_GROUP = "/p1-care-team"; // GP + physio: read only

export interface RecordMeta {
  id: string;
  patientId: string;
  title: string;
  /** Fake plaintext the patient encrypts in their own browser. The server never sees it. */
  sample: string;
}

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
];

export const recordById = (id: string) => RECORDS.find((r) => r.id === id);
