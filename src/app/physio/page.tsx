"use client";

import { RecordsView } from "@/components/RecordsView";

export default function PhysioPage() {
  return (
    <RecordsView
      mode="clinician"
      title="Physio: shared records"
      subtitle="You can only open records the patient shared with your care team. Revoked access is refused by the network."
    />
  );
}
