"use client";

import { RecordsView } from "@/components/RecordsView";

export default function GpPage() {
  return (
    <RecordsView
      mode="clinician"
      title="GP: shared records"
      subtitle="You can only open records the patient shared with your care team. Revoked access is refused by the network."
    />
  );
}
