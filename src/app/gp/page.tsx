"use client";

import { RecordsView } from "@/components/RecordsView";

export default function GpPage() {
  return (
    <RecordsView
      mode="clinician"
      title="Không gian bác sĩ GP"
      subtitle="Chỉ mở được hồ sơ bệnh nhân đã chia sẻ với nhóm chăm sóc. Quyền đã thu hồi sẽ bị mạng từ chối."
    />
  );
}
