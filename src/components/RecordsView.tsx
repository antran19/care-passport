"use client";

import { useCallback, useEffect, useState } from "react";
import { useTideCloak } from "@/lib/mock";
import { abs } from "@/lib/care/client";
import { CareShell, btn, mono } from "./CareShell";
import { decryptForRecord, encryptForRecord, isRefusal, describeRefusal, type TideCtx } from "@/lib/tide/relationship";

interface Rec { id: string; title: string; sample?: string; ciphertext: string | null; canWrite: boolean }
interface ShareRequest { id: string; recordId: string; requestedBy: string; to: string; status: string; createdAt: string }

const statusLabels: Record<string, string> = { pending: "Đang chờ duyệt", approved: "Đang chia sẻ", rejected: "Đã từ chối", revoked: "Đã thu hồi" };

export function RecordsView({ title, subtitle, mode }: { title: string; subtitle?: string; mode: "patient" | "clinician" }) {
  const tide = useTideCloak();
  const { authenticated, secureFetch } = tide;
  const ctx = tide as unknown as TideCtx;
  const [recs, setRecs] = useState<Rec[]>([]);
  const [requests, setRequests] = useState<ShareRequest[]>([]);
  const [plain, setPlain] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, { text: string; kind: string }>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await secureFetch(abs("/api/records"));
      if (!res.ok) throw new Error("Không thể tải hồ sơ lúc này. Vui lòng thử tải lại.");
      setRecs((await res.json()).records);
      if (mode === "patient") {
        const sharesRes = await secureFetch(abs("/api/share-requests"));
        if (sharesRes.ok) setRequests((await sharesRes.json()).requests);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không thể tải hồ sơ lúc này.");
    } finally { setLoading(false); }
  }, [secureFetch, mode]);

  useEffect(() => { if (authenticated) void load(); }, [authenticated, load]);

  const policyFor = async (recordId: string, op: "read" | "write") => {
    const res = await secureFetch(abs(`/api/policies?record=${recordId}&op=${op}`));
    if (!res.ok) throw new Error("NO_ACCESS");
    return (await res.json()).policy as string;
  };

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setMsg((m) => ({ ...m, [id]: { text: "Đang xử lý yêu cầu bảo mật…", kind: "info" } }));
    try { await fn(); }
    catch (e) {
      const denied = e instanceof Error && (e.message === "NO_ACCESS" || isRefusal(e));
      const text = denied ? "Bạn không có quyền xem hồ sơ này. Quyền truy cập chưa được cấp hoặc đã bị thu hồi." : e instanceof Error && !e.message.includes("Failed to fetch") ? e.message : "Có sự cố khi xử lý. Vui lòng thử lại sau.";
      setMsg((m) => ({ ...m, [id]: { text, kind: denied ? "error" : "error" } }));
    } finally { setBusyId(""); }
  };

  const encrypt = (r: Rec) => run(r.id, async () => {
    const policy = await policyFor(r.id, "write");
    const ciphertext = await encryptForRecord(ctx, r.sample ?? "", r.id, policy);
    const res = await secureFetch(abs("/api/records"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, ciphertext }) });
    if (!res.ok) throw new Error("Không thể lưu bản mã của hồ sơ.");
    setMsg((m) => ({ ...m, [r.id]: { text: "Đã mã hóa trên trình duyệt và lưu bản mã an toàn.", kind: "success" } }));
    await load();
  });

  const decrypt = (r: Rec) => run(r.id, async () => {
    if (!r.ciphertext) throw new Error("Hồ sơ chưa có dữ liệu được mã hóa.");
    const policy = await policyFor(r.id, "read");
    const text = await decryptForRecord(ctx, r.ciphertext, r.id, policy);
    setPlain((p) => ({ ...p, [r.id]: text }));
    setMsg((m) => ({ ...m, [r.id]: { text: "Hồ sơ đã được giải mã an toàn trên trình duyệt.", kind: "success" } }));
  });

  const share = (r: Rec, to: "gp" | "physio") => run(r.id, async () => {
    const res = await secureFetch(abs("/api/share-requests"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId: r.id, to }) });
    if (!res.ok) throw new Error("Không thể gửi yêu cầu chia sẻ. Vui lòng thử lại.");
    setMsg((m) => ({ ...m, [r.id]: { text: "Đã gửi yêu cầu. Care Steward cần phê duyệt trước khi nhóm chăm sóc có thể xem hồ sơ.", kind: "success" } }));
    const sharesRes = await secureFetch(abs("/api/share-requests"));
    if (sharesRes.ok) setRequests((await sharesRes.json()).requests);
  });

  return <CareShell title={title} subtitle={subtitle}>
    {mode === "patient" && <div className="alert-strip">Dữ liệu minh họa · Tất cả hồ sơ trong demo đều là dữ liệu giả. Nội dung được mã hóa trên trình duyệt của bạn.</div>}
    <div className="panel-title"><div><span className="eyebrow-small">{mode === "patient" ? "HỒ SƠ CỦA TÔI" : "HỒ SƠ ĐƯỢC CHIA SẺ"}</span><h2>{mode === "patient" ? "Hồ sơ sức khỏe" : "Không gian chăm sóc"}</h2><p>{loading ? "Đang đồng bộ quyền truy cập…" : `${recs.length} hồ sơ khả dụng trong phiên này`}</p></div><button className="action-button" onClick={() => void load()} disabled={loading}>↻　Làm mới</button></div>
    {loadError && <div role="alert" className="feedback error"><span className="feedback-icon">!</span>{loadError}</div>}
    {loading ? <div className="empty-state"><span className="spinner" style={{ display: "inline-block", verticalAlign: "middle" }} /><strong>Đang tải hồ sơ an toàn</strong><p>Đang kiểm tra quyền truy cập với mạng Tide.</p></div> : recs.length === 0 ? <div className="empty-state"><span>⌑</span><strong>{mode === "patient" ? "Chưa có hồ sơ khả dụng" : "Chưa có hồ sơ được chia sẻ"}</strong><p>{mode === "patient" ? "Quản trị viên cần ký chính sách chủ hồ sơ trước." : "Khi bệnh nhân chia sẻ hồ sơ, hồ sơ sẽ xuất hiện tại đây."}</p></div> : <div className="record-list">{recs.map((r, index) => <article className="record-card" key={r.id}>
      <div className="record-card-header"><div className="record-info"><span className="record-icon">{index === 1 ? "⌁" : "▤"}</span><div><h3>{r.title}</h3><p>{mode === "patient" ? "Hồ sơ cá nhân · Bệnh nhân 01" : "Được bệnh nhân cấp quyền · Chỉ đọc"}</p></div></div><span className={`status-pill ${r.ciphertext ? "" : "neutral"}`}>{r.ciphertext ? "● Đã mã hóa" : "○ Chưa mã hóa"}</span></div>
      <div className="record-metadata"><span>MÃ HỒ SƠ <code style={mono}>{r.id}</code></span><i className="metadata-dot" /><span>{r.ciphertext ? "Nội dung được bảo vệ" : "Chưa có dữ liệu lưu"}</span></div>
      {r.ciphertext && !plain[r.id] && <div className="ciphertext-box">{`TIDE ENCRYPTED · ${r.ciphertext.slice(0, 94)}${r.ciphertext.length > 94 ? "…" : ""}`}</div>}
      {plain[r.id] && <div className="plaintext-box"><strong>✓ NỘI DUNG ĐÃ GIẢI MÃ TRÊN THIẾT BỊ</strong>{plain[r.id]}</div>}
      <div className="action-row">{r.canWrite && <button className="action-button primary" disabled={!!busyId} onClick={() => encrypt(r)}>{busyId === r.id ? "Đang xử lý…" : r.ciphertext ? "↻　Mã hóa lại" : "⌑　Mã hóa hồ sơ"}</button>}{r.ciphertext && <button className="action-button" disabled={!!busyId} onClick={() => plain[r.id] ? setPlain((p) => { const n = { ...p }; delete n[r.id]; return n; }) : decrypt(r)}>{plain[r.id] ? "Ẩn nội dung" : "⌕　Mở hồ sơ"}</button>}{mode === "patient" && r.canWrite && <><button className="action-button" disabled={!!busyId} onClick={() => share(r, "gp")}>＋　Chia sẻ với GP</button><button className="action-button" disabled={!!busyId} onClick={() => share(r, "physio")}>＋　Chia sẻ với physio</button></>}</div>
      {msg[r.id] && <div role={msg[r.id].kind === "error" ? "alert" : "status"} className={`feedback ${msg[r.id].kind}`}><span className="feedback-icon">{msg[r.id].kind === "error" ? "!" : msg[r.id].kind === "success" ? "✓" : "·"}</span>{msg[r.id].text}</div>}
    </article>)}</div>}

    {mode === "patient" && <section className="panel-card" style={{ marginTop: 18 }}><div className="panel-title"><div><span className="eyebrow-small">QUYỀN TRUY CẬP</span><h2>Yêu cầu chia sẻ</h2><p>Việc chia sẻ chỉ có hiệu lực sau khi Care Steward phê duyệt.</p></div><span className="status-pill neutral">{requests.length} yêu cầu</span></div>{requests.length === 0 ? <div className="empty-state" style={{ padding: 18 }}><strong>Chưa có yêu cầu chia sẻ</strong><p>Chọn “Chia sẻ với GP” hoặc “Chia sẻ với physio” trên hồ sơ.</p></div> : <div className="share-request-list">{requests.map((request) => <div className="share-request-row" key={request.id}><div><strong>{request.recordId}</strong><small>Người nhận: {request.to === "gp" ? "Bác sĩ GP" : request.to === "physio" ? "Vật lý trị liệu" : "Nhóm chăm sóc"} · {new Date(request.createdAt).toLocaleDateString("vi-VN")}</small></div><span className={`status-pill ${request.status === "pending" ? "pending" : request.status === "revoked" || request.status === "rejected" ? "revoked" : ""}`}>{statusLabels[request.status] ?? request.status}</span></div>)}</div>}<p className="inline-note" style={{ marginBottom: 0, marginTop: 13 }}>Bạn có thể yêu cầu Care Steward thu hồi quyền chia sẻ. Sau khi thu hồi, quyền giải mã sẽ bị mạng Tide từ chối.</p></section>}
  </CareShell>;
}
