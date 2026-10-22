"use client";

import { useState } from "react";
import { useTideCloak } from "@/lib/mock";
import { abs } from "@/lib/care/client";

import { CareShell, card, btn, mono } from "@/components/CareShell";

import { isRefusal, describeRefusal } from "@/lib/tide/relationship";
import { RECORDS } from "@/lib/care/data";

interface Attempt {
  recordId: string;
  title: string;
  serverSees: string;
  policyLookup: string;
  networkDecrypt: string;
  blocked: boolean;
}

/** Proof that a realm admin cannot read patient data: the server holds ciphertext, no policy applies to the admin, and the network refuses. */
export default function AdminAttackPage() {
  const { secureFetch, doDecrypt } = useTideCloak();
  const [rows, setRows] = useState<Attempt[]>([]);
  const [busy, setBusy] = useState(false);

  const attack = async () => {
    setBusy(true);
    const out: Attempt[] = [];
    try {
      const raw = await secureFetch(abs("/api/admin/raw"));
      const body = raw.ok ? await raw.json() : { records: [], vault: [] };
      const server: { id: string; ciphertext: string | null }[] = body.records ?? [];
      for (const r of RECORDS) {
        const ct = server.find((s) => s.id === r.id)?.ciphertext ?? null;
        const pol = await secureFetch(abs(`/api/policies?record=${r.id}&op=read`));
        let net = "skipped (nothing to decrypt)";
        let blocked = true;
        if (ct) {
          try {
            // Best an admin can do: ask the network to decrypt with no policy that names them.
            await doDecrypt([{ encrypted: ct, tags: [r.id] }]);
            net = "DECRYPTED (this should not happen)";
            blocked = false;
          } catch (e) {
            net = `refused: ${isRefusal(e) ? describeRefusal(e) : e instanceof Error ? e.message.slice(0, 160) : String(e)}`;
          }
        }
        out.push({
          recordId: r.id,
          title: r.title,
          serverSees: ct ? `ciphertext only: ${ct.slice(0, 48)}...` : "no data stored yet",
          policyLookup: pol.ok ? "a policy applies to this admin (unexpected)" : `none (HTTP ${pol.status}): no policy names the admin`,
          networkDecrypt: net,
          blocked: blocked && !pol.ok,
        });
      }
      // Self-encrypted notes written by patients: bound to the writer's own key, no policy involved.
      const vaultEntries: { owner: string; ciphertext: string }[] = body.vault ?? [];
      for (const v of vaultEntries) {
        let net: string;
        let blocked = true;
        try {
          await doDecrypt([{ encrypted: v.ciphertext, tags: ["vault"] }]);
          net = "DECRYPTED (this should not happen)";
          blocked = false;
        } catch (e) {
          net = `refused: ${isRefusal(e) ? describeRefusal(e) : e instanceof Error ? e.message.slice(0, 160) : String(e)}`;
        }
        out.push({
          recordId: `vault-${v.owner}`,
          title: `Private note written by ${v.owner} (fake text, encrypted with their own key)`,
          serverSees: `ciphertext only: ${v.ciphertext.slice(0, 48)}...`,
          policyLookup: "n/a (key is bound to the writer, no policy exists)",
          networkDecrypt: net,
          blocked,
        });
      }
    } finally {
      setRows(out);
      setBusy(false);
    }
  };

  return (
    <CareShell
      title="Admin tries to read"
      subtitle="Log in as the admin and press the button. The admin can sign grants, but is not a reader of patient data."
    >
      <button style={btn} disabled={busy} onClick={attack}>
        {busy ? "Trying..." : "Try to read patient records as admin"}
      </button>
      {rows.map((r) => (
        <div key={r.recordId} style={{ ...card, marginTop: "1rem", borderColor: r.blocked ? "#16a34a" : "#dc2626" }}>
          <strong>{r.title}</strong> {r.blocked ? <span style={{ color: "#34d399" }}>BLOCKED</span> : <span style={{ color: "#f87171" }}>NOT BLOCKED</span>}
          <div style={{ ...mono, marginTop: 6 }}>server sees: {r.serverSees}</div>
          <div style={mono}>policy lookup: {r.policyLookup}</div>
          <div style={mono}>network decrypt: {r.networkDecrypt}</div>
        </div>
      ))}
    </CareShell>
  );
}
