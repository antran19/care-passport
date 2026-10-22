"use client";

import { RecordsView } from "@/components/RecordsView";

export default function PatientPage() {
  return (
    <RecordsView
      mode="patient"
      title="Không gian bệnh nhân"
      subtitle="Bạn sở hữu hồ sơ sức khỏe. Chia sẻ khi cần thiết và theo dõi yêu cầu ngay tại đây."
    />
  );
}
