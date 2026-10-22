"use client";

import { useCallback, useEffect, useState } from "react";
import { useTideCloak } from "@/lib/mock";
import { abs } from "@/lib/care/client";


import tcConfig from "../../../data/tidecloak.json";
import { CareShell, card, btn, btnGhost, btnDanger, mono } from "@/components/CareShell";
import { fromBase64, signRelationshipPolicy, isRefusal, describeRefusal, type TideCtx, type RelationshipAccess } from "@/lib/tide/relationship";
import { RECORDS, OWNER_GROUP, CARE_GROUP } from "@/lib/care/data";

interface StoredPolicyMeta {
  id: string;
  subjectId: string;
  recordId: string;
  access: string;
  grantedBy: string;
  createdAt: string;
}
interface ShareRequest {
  id: string;
  recordId: string;
  requestedBy: string;
  to: string;
  status: string;
  createdAt: string;
}
interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  recordId: string;
  details: string;
}

const CARE_POLICY_TTL_SECONDS = 24 * 3600; // short expiry: revoking one record is not instant, so access ends by itself

export default function AdminPage() {
  const tide = useTideCloak();
  const { authenticated, secureFetch, hasClientRole, getVendorId } = tide;
  const ctx = tide as unknown as TideCtx;
  const isAdmin = authenticated && hasClientRole("tide-realm-admin", "realm-management");

  const [pols, setPols] = useState<StoredPolicyMeta[]>([]);
  const [reqs, setReqs] = useState<ShareRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      secureFetch(abs("/api/policies?all=1")),
      secureFetch(abs("/api/share-requests")),
      secureFetch(abs("/api/audit-logs")),
    ]);
    if (a.ok) setPols((await a.json()).policies);
    if (b.ok) setReqs((await b.json()).requests);
    if (c.ok) setAuditLogs((await c.json()).logs);
  }, [secureFetch]);


  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);


  // The realm's signed admin policy authorises the signing. Fetched with the admin's own token.
  const adminPolicy = async () => {
    const base = String(tcConfig["auth-server-url"]).replace(/\/+$/, "");
    const res = await secureFetch(`${base}/admin/realms/${tcConfig.realm}/iga/role-policies/name/tide-realm-admin`);
    if (!res.ok) throw new Error(`Could not read the admin policy (${res.status}). Are you a tide-realm-admin?`);
    return fromBase64((await res.json()).policy);
  };

  const grant = async (recordId: string, subjectId: string, access: RelationshipAccess, ttl?: number) => {
    const signed = await signRelationshipPolicy(
      ctx,
      {
        vendorId: getVendorId(),
        subject: { type: "Group", id: subjectId },
        recordId,
        access,
        ...(ttl ? { expiry: Math.floor(Date.now() / 1000) + ttl } : {}),
      },
      await adminPolicy(),
    );
    const res = await secureFetch(abs("/api/policies"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectType: "Group", subjectId, recordId, access, policy: signed }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Could not store the policy");
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(`${label}: waiting for the Tide enclave (allow pop-ups)...`);
    try {
      await fn();
      setMsg(`${label}: done.`);
      await load();
    } catch (e) {
      setMsg(`${label} failed: ${isRefusal(e) ? describeRefusal(e) : e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const patch = (id: string, status: string) =>
    secureFetch(abs("/api/share-requests"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

  const approve = (r: ShareRequest) =>
    run("Approve share", async () => {
      await grant(r.recordId, CARE_GROUP, "read", CARE_POLICY_TTL_SECONDS);
      await patch(r.id, "approved");
    });

  const revoke = (r: ShareRequest) =>
    run("Revoke share", async () => {
      const p = pols.find((x) => x.recordId === r.recordId && x.subjectId === CARE_GROUP);
      if (p) await secureFetch(abs(`/api/policies?id=${p.id}`), { method: "DELETE" });
      await patch(r.id, "revoked");
    });

  if (authenticated && !isAdmin) {
    return (
      <CareShell title="Admin">
        <div style={card}>You are not a tide-realm-admin, so you cannot sign policies. Log in with the admin account.</div>
      </CareShell>
    );
  }

  return (
    <CareShell title="Admin" subtitle="Signing a policy in the Tide enclave IS the grant. Quorum applies when the realm has several admins.">
      {msg && <p style={{ color: "#60a5fa" }}>{msg}</p>}

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>1. Owner policies (patient1 reads and writes own records)</h3>
        {RECORDS.map((r) => {
          const done = pols.some((p) => p.recordId === r.id && p.subjectId === OWNER_GROUP);
          return (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.5rem 0" }}>
              <span>
                {r.title} {done && <span style={{ color: "#34d399" }}>signed</span>}
              </span>
              <button style={btn} disabled={busy} onClick={() => run(`Owner policy ${r.id}`, () => grant(r.id, OWNER_GROUP, "read-write"))}>
                {done ? "Sign again" : "Sign owner policy"}
              </button>
            </div>
          );
        })}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>2. Share requests</h3>
        {reqs.length === 0 && <p style={{ color: "#9ca3af", margin: 0 }}>No requests yet.</p>}
        {reqs.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid #2a2a2a", padding: "0.5rem 0" }}>
            <div>
              <strong>{r.recordId}</strong> to {r.to} from {r.requestedBy} <span style={mono}>[{r.status}]</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {r.status === "pending" && (
                <>
                  <button style={btn} disabled={busy} onClick={() => approve(r)}>
                    Approve (sign care-team policy)
                  </button>
                  <button style={btnGhost} disabled={busy} onClick={() => run("Reject", async () => void (await patch(r.id, "rejected")))}>
                    Reject
                  </button>
                </>
              )}
              {r.status === "approved" && (
                <button style={btnDanger} disabled={busy} onClick={() => revoke(r)}>
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}
        <p style={{ color: "#9ca3af", fontSize: "0.85rem", marginBottom: 0 }}>
          Who is in the care team is decided by group {CARE_GROUP}: add or remove gp1 / physio1 in the TideCloak admin console
          (a change request you approve). Removal takes effect after they sign in again.
        </p>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>3. Stored policies</h3>
        {pols.length === 0 && <p style={{ color: "#9ca3af", margin: 0 }}>None.</p>}
        {pols.map((p) => (
          <div key={p.id} style={mono}>
            {p.recordId} / {p.subjectId} / {p.access} / by {p.grantedBy}
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0, color: "#5eead4" }}>4. Governance Audit Trail (Transparency Log)</h3>
          <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{auditLogs.length} events logged</span>
        </div>
        <p style={{ color: "#9ca3af", fontSize: "0.85rem", marginTop: 0 }}>
          Immutable log of all grant approvals, revocations, and administrative access. Eliminates unilateral admin power by creating a transparent trail.
        </p>
        {auditLogs.length === 0 && <p style={{ color: "#9ca3af", margin: 0 }}>No audit logs recorded yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {auditLogs.map((log) => (
            <div
              key={log.id}
              style={{
                background: "#121212",
                border: "1px solid #2a2a2a",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: log.action.includes("REVOKED") ? "#f87171" : "#34d399" }}>
                  {log.action}
                </span>
                <span style={{ color: "#666", fontSize: "0.75rem" }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ color: "#ccc" }}>{log.details}</div>
              <div style={{ ...mono, fontSize: "0.75rem", marginTop: 4, color: "#666" }}>
                actor: {log.actor} | record: {log.recordId}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CareShell>
  );
}

