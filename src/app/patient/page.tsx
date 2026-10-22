"use client";

import { RecordsView } from "@/components/RecordsView";

export default function PatientPage() {
  return (
    <RecordsView
      mode="patient"
      title="My health passport"
      subtitle="Your records are encrypted in your browser. Share them with your GP or physio; an admin approves."
    />
  );
}
