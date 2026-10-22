"use client";

import { useCallback, useEffect, useState } from "react";
import { useTideCloak } from "@/lib/mock";
import { abs } from "@/lib/care/client";
import tcConfig from "../../../data/tidecloak.json";
import { CareShell } from "@/components/CareShell";
import { fromBase64, signRelationshipPolicy, isRefusal, describeRefusal, type TideCtx, type RelationshipAccess } from "@/lib/tide/relationship";
import { RECORDS, OWNER_GROUP, CARE_GROUP } from "@/lib/care/data";

interface StoredPolicyMeta { id: string; subjectId: string; recordId: string; access: string; grantedBy: string; createdAt: string }
interface ShareRequest { id: string; recordId: string; requestedBy: string; to: string; status: string; createdAt: string }
interface AuditEntry { id: string; timestamp: string; actor: string; action: string; recordId: string; details: string }
const CARE_POLICY_TTL_SECONDS = 24 * 3600;

export default function AdminPage() {
  const tide = useTideCloak();
  const { authenticated, secureFetch, hasClientRole, getVendorId } = tide;
  const ctx = tide as unknown as TideCtx;
  const isAdmin = authenticated && hasClientRole("tide-realm-admin", "realm-management");
  const [pols, setPols] = useState<StoredPolicyMeta[]>([]);
  const [reqs, setReqs] = useState<ShareRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([secureFetch(abs("/api/policies?all=1")), secureFetch(abs("/api/share-requests")), secureFetch(abs("/api/audit-logs"))]);
      if (!a.ok || !b.ok || !c.ok) throw new Error("Không thể tải toàn bộ dữ liệu quản trị. Hãy kiểm tra quyền quản trị của tài khoản.");
      setPols((await a.json()).policies); setReqs((await b.json()).requests); setAuditLogs((await c.json()).logs);
    } catch (e) { setMsg({ text: e instanceof Error ? e.message : "Không thể tải dữ liệu quản trị.", error: true }); }
    finally { setLoading(false); }
  }, [secureFetch]);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const adminPolicy = async () => {
    const base = String(tcConfig["auth-server-url"]).replace(/\/+$/, "");
    const res = await secureFetch(`${base}/admin/realms/${tcConfig.realm}/iga/role-policies/name/tide-realm-admin`);
    if (!res.ok) throw new Error("Không đọc được chính sách ký quản trị. Hãy xác nhận tài khoản có vai trò admin.");
    return fromBase64((await res.json()).policy);
  };

  const grant = async (recordId: string, subjectId: string, access: RelationshipAccess, ttl?: number) => {
    const signed = await signRelationshipPolicy(ctx, { vendorId: getVendorId(), subject: { type: "Group", id: subjectId }, recordId, access, ...(ttl ? { expiry: Math.floor(Date.now() / 1000) + ttl } : {}) }, await adminPolicy());
    const res = await secureFetch(abs("/api/policies"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectType: "Group", subjectId, recordId, access, policy: signed }) });
    if (!res.ok) throw new Error("Không thể lưu chính sách quyền truy cập.");
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true); setMsg({ text: `${label} · Đang chờ xác nhận từ Tide enclave…`, error: false });
    try { await fn(); setMsg({ text: `${label} thành công. Nhật ký quyền truy cập đã được cập nhật.`, error: false }); await load(); }
    catch (e) { const refused = isRefusal(e); setMsg({ text: refused ? `Tide enclave đã từ chối yêu cầu: ${describeRefusal(e)}` : e instanceof Error ? e.message : "Đã xảy ra lỗi khi xử lý." , error: true }); }
    finally { setBusy(false); }
  };

  const patch = (id: string, status: string) => secureFetch(abs("/api/share-requests"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
  const approve = (r: ShareRequest) => run("Duyệt chia sẻ", async () => { await grant(r.recordId, CARE_GROUP, "read", CARE_POLICY_TTL_SECONDS); const res = await patch(r.id, "approved"); if (!res.ok) throw new Error("Đã ký chính sách nhưng không cập nhật được trạng thái yêu cầu."); });
  const revoke = (r: ShareRequest) => run("Thu hồi quyền", async () => { const p = pols.find((x) => x.recordId === r.recordId && x.subjectId === CARE_GROUP); if (p) { const res = await secureFetch(abs(`/api/policies?id=${p.id}`), { method: "DELETE" }); if (!res.ok) throw new Error("Không thể thu hồi chính sách."); } const res = await patch(r.id, "revoked"); if (!res.ok) throw new Error("Không thể cập nhật trạng thái thu hồi."); });
  const reject = (r: ShareRequest) => run("Từ chối yêu cầu", async () => { const res = await patch(r.id, "rejected"); if (!res.ok) throw new Error("Không thể cập nhật trạng thái yêu cầu."); });

  if (authenticated && !isAdmin) return <CareShell title="Quản trị viên" subtitle="Care Steward · Bảng điều khiển quản trị"><div className="feedback error"><span className="feedback-icon">!</span>Tài khoản này chưa có quyền Care Steward. Hãy chuyển sang tài khoản admin1 trong Mock Role.</div></CareShell>;

  return <CareShell title="Quản trị viên" subtitle="Care Steward · Phê duyệt quyền truy cập minh bạch trong Tide enclave.">
    {msg && <div role={msg.error ? "alert" : "status"} className={`feedback ${msg.error ? "error" : "info"}`} style={{ marginBottom: 15 }}><span className="feedback-icon">{msg.error ? "!" : "·"}</span>{msg.text}</div>}
    {loading ? <div className="empty-state"><span className="spinner" style={{ display: "inline-block", verticalAlign: "middle" }} /><strong>Đang tải bảng quản trị</strong><p>Đang đồng bộ chính sách, yêu cầu và nhật ký.</p></div> : <div className="admin-grid">
      <section className="panel-card"><div className="panel-title"><div><span className="eyebrow-small">01 · CHỦ SỞ HỮU</span><h2>Chính sách hồ sơ</h2><p>Ký quyền đọc và ghi cho bệnh nhân.</p></div></div>{RECORDS.filter((r) => r.patientId === "patient1").map((r) => { const done = pols.some((p) => p.recordId === r.id && p.subjectId === OWNER_GROUP); return <div className="policy-row" key={r.id}><span>{r.title}<small style={{ display: "block", color: "var(--muted)", fontSize: 9, marginTop: 3 }}>{done ? "✓ Chính sách đã ký" : "Chưa ký chính sách"}</small></span><button className={`action-button ${done ? "" : "primary"}`} disabled={busy} onClick={() => run("Ký chính sách chủ sở hữu", () => grant(r.id, OWNER_GROUP, "read-write"))}>{done ? "Ký lại" : "Ký quyền"}</button></div>; })}</section>
      <section className="panel-card"><div className="panel-title"><div><span className="eyebrow-small">02 · YÊU CẦU</span><h2>Chia sẻ cần phê duyệt</h2><p>{reqs.filter((r) => r.status === "pending").length} yêu cầu đang chờ.</p></div></div>{reqs.length === 0 ? <div className="empty-state" style={{ padding: 18 }}><strong>Chưa có yêu cầu mới</strong><p>Yêu cầu chia sẻ từ bệnh nhân sẽ hiển thị tại đây.</p></div> : reqs.map((r) => <div className="request-card" key={r.id}><div className="request-card-head"><strong>{r.recordId}</strong><span className={`status-pill ${r.status === "pending" ? "pending" : r.status === "revoked" || r.status === "rejected" ? "revoked" : ""}`}>{r.status === "pending" ? "Chờ duyệt" : r.status === "approved" ? "Đang chia sẻ" : r.status === "revoked" ? "Đã thu hồi" : "Đã từ chối"}</span></div><p>{r.requestedBy} yêu cầu chia sẻ với {r.to === "gp" ? "bác sĩ GP" : r.to === "physio" ? "vật lý trị liệu" : "nhóm chăm sóc"}</p>{r.status === "pending" && <div className="action-row"><button className="action-button primary" disabled={busy} onClick={() => approve(r)}>✓　Duyệt và ký</button><button className="action-button" disabled={busy} onClick={() => reject(r)}>Từ chối</button></div>}{r.status === "approved" && <div className="action-row"><button className="action-button danger" disabled={busy} onClick={() => revoke(r)}>Thu hồi chia sẻ</button></div>}</div>)}<p className="inline-note" style={{ marginBottom: 0 }}>Quyền nhóm <strong>{CARE_GROUP}</strong> chỉ đọc, tự hết hạn sau 24 giờ. Việc gỡ thành viên khỏi nhóm có hiệu lực sau lần đăng nhập tiếp theo.</p></section>
      <section className="panel-card"><div className="panel-title"><div><span className="eyebrow-small">03 · CHÍNH SÁCH ĐÃ LƯU</span><h2>Quyền truy cập hiện hành</h2></div><span className="status-pill neutral">{pols.length} chính sách</span></div>{pols.length === 0 ? <p className="inline-note">Chưa có chính sách nào được lưu.</p> : pols.map((p) => <div className="mono-line" key={p.id}>{p.recordId}　/　{p.subjectId}　/　{p.access}　/　{p.grantedBy}</div>)}</section>
      <section className="panel-card"><div className="panel-title"><div><span className="eyebrow-small">04 · MINH BẠCH</span><h2>Nhật ký kiểm toán</h2><p>Mọi lần cấp quyền và thu hồi đều được ghi nhận.</p></div><span className="status-pill neutral">{auditLogs.length} sự kiện</span></div>{auditLogs.length === 0 ? <div className="empty-state" style={{ padding: 18 }}><strong>Chưa có sự kiện</strong><p>Hoạt động quản trị sẽ xuất hiện trong nhật ký.</p></div> : <div className="audit-list">{auditLogs.map((log) => <div className="audit-row" key={log.id}><div className="audit-row-head"><span className={`audit-action ${log.action.includes("REVOK") || log.action.includes("REJECT") ? "danger" : ""}`}>{log.action.replaceAll("_", " ")}</span><time>{new Date(log.timestamp).toLocaleString("vi-VN")}</time></div><p>{log.details}</p><code>người thực hiện: {log.actor}　·　hồ sơ: {log.recordId}</code></div>)}</div>}</section>
    </div>}
  </CareShell>;
}
