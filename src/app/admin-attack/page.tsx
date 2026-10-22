"use client";

import { useState } from "react";
import { useTideCloak } from "@/lib/mock";
import { abs } from "@/lib/care/client";
import { CareShell } from "@/components/CareShell";
import { isRefusal } from "@/lib/tide/relationship";
import { RECORDS } from "@/lib/care/data";

interface Attempt { recordId: string; title: string; serverSees: string; policyLookup: string; networkDecrypt: string; blocked: boolean }

/** Demonstrates that administrative database access does not grant decryption rights. */
export default function AdminAttackPage() {
  const { secureFetch, doDecrypt } = useTideCloak();
  const [rows, setRows] = useState<Attempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const attack = async () => {
    setBusy(true); setError(""); setRows([]);
    try {
      const raw = await secureFetch(abs("/api/admin/raw"));
      if (!raw.ok) throw new Error("Không thể truy cập bản dữ liệu thô. Hãy đăng nhập bằng tài khoản Care Steward.");
      const server: { id: string; ciphertext: string | null }[] = (await raw.json()).records;
      const out: Attempt[] = [];
      for (const r of RECORDS.filter((record) => record.patientId === "patient1")) {
        const ct = server.find((s) => s.id === r.id)?.ciphertext ?? null;
        const pol = await secureFetch(abs(`/api/policies?record=${r.id}&op=read`));
        let net = "Chưa có dữ liệu mã hóa để thử giải mã";
        let blocked = true;
        if (ct) {
          try { await doDecrypt([{ encrypted: ct, tags: [r.id] }]); net = "Không an toàn: nội dung đã được giải mã"; blocked = false; }
          catch (e) { net = isRefusal(e) ? "Mạng Tide từ chối yêu cầu giải mã" : "Không thể giải mã bằng quyền quản trị"; }
        }
        out.push({ recordId: r.id, title: r.title, serverSees: ct ? `Chỉ có ciphertext: ${ct.slice(0, 48)}…` : "Chưa lưu dữ liệu", policyLookup: pol.ok ? "Có policy áp dụng (cần kiểm tra cấu hình)" : "Không có policy cấp quyền cho admin", networkDecrypt: net, blocked: blocked && !pol.ok });
      }
      setRows(out);
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể hoàn tất kiểm tra bảo mật."); }
    finally { setBusy(false); }
  };

  return <CareShell title="Kiểm tra Zero-Trust" subtitle="Bằng chứng thực tế: quyền quản trị hệ thống không cấp quyền đọc dữ liệu bệnh nhân.">
    <div className="attack-banner"><span className="eyebrow-small" style={{ color: "#ee9999" }}>BÀI KIỂM TRA BẢO MẬT</span><h2>Quản trị viên thử đọc hồ sơ</h2><p>Quản trị viên có thể xem bản mã trên máy chủ, nhưng không có chính sách giải mã của bệnh nhân. Mạng Tide sẽ từ chối yêu cầu.</p></div>
    <section className="panel-card"><div className="panel-title"><div><span className="eyebrow-small">THỬ NGHIỆM TƯƠNG TÁC</span><h2>Chạy kiểm tra quyền truy cập</h2><p>Đăng nhập admin1 để xem bản mã và thử yêu cầu giải mã.</p></div></div><button className="action-button danger" disabled={busy} onClick={attack}>{busy ? "Đang kiểm tra quyền…" : "⌕　Admin thử đọc hồ sơ"}</button>{error && <div role="alert" className="feedback error"><span className="feedback-icon">!</span>{error}</div>}</section>
    {rows.length > 0 && <><div className="panel-title" style={{ marginTop: 23 }}><div><span className="eyebrow-small">KẾT QUẢ THỬ NGHIỆM</span><h2>Quyền truy cập bị chặn</h2></div><span className="status-pill">{rows.filter((r) => r.blocked).length}/{rows.length} ĐÃ CHẶN</span></div><div className="record-list">{rows.map((r) => <article className={`panel-card attack-result ${r.blocked ? "" : "failed"}`} key={r.recordId}><div className="attack-result-head"><strong>{r.title}</strong><span className={`result-blocked ${r.blocked ? "" : "failed"}`}>{r.blocked ? "✓ BỊ TỪ CHỐI" : "! CẦN KIỂM TRA"}</span></div><div className="attack-rows"><div>Máy chủ nhìn thấy　{r.serverSees}</div><div>Chính sách đọc　　{r.policyLookup}</div><div>Kết quả mạng　　　{r.networkDecrypt}</div></div></article>)}</div></>}
    <section className="panel-card" style={{ marginTop: 15 }}><span className="eyebrow-small">NGUYÊN TẮC THIẾT KẾ</span><p className="inline-note" style={{ marginBottom: 0, marginTop: 8 }}>Dữ liệu được mã hóa trong trình duyệt bệnh nhân. Máy chủ chỉ lưu bản mã và metadata chính sách. Mỗi lần giải mã cần có quyền phù hợp; vai trò quản trị hệ thống tự nó không phải là quyền đọc hồ sơ.</p></section>
  </CareShell>;
}
