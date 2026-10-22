"use client";

import { RecordsView } from "@/components/RecordsView";

export default function PhysioPage() {
  return (
    <RecordsView
      mode="clinician"
      title="Không gian vật lý trị liệu"
      subtitle="Chỉ mở được hồ sơ bệnh nhân đã chia sẻ với nhóm chăm sóc. Quyền đã thu hồi sẽ bị mạng từ chối."
    />
  );
}
