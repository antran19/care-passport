"use client";

import { useCallback, useEffect, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { abs } from "@/lib/care/client";
import { CareShell, card, btn, btnGhost, mono } from "./CareShell";
import { decryptForRecord, encryptForRecord, isRefusal, describeRefusal, type TideCtx } from "@/lib/tide/relationship";

interface Rec {
  id: string;
  title: string;
  sample?: string;
  ciphertext: string | null;
  canWrite: boolean;
}

/**
 * Patient view (canWrite records: encrypt, share) and clinician view (read-only: decrypt).
 * The policy is fetched from our server, but the NETWORK decides on every encrypt/decrypt.
 */
export function RecordsView({ title, subtitle, mode }: { title: string; subtitle: string; mode: "patient" | "clinician" }) {
  const tide = useTideCloak();
  const { authenticated, secureFetch } = tide;
  const ctx = tide as unknown as TideCtx;

  const [recs, setRecs] = useState<Rec[]>([]);
  const [plain, setPlain] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await secureFetch(abs("/api/records"));
    if (res.ok) setRecs((await res.json()).records);
    else setNote(`Could not load records (${res.status}).`);
  }, [secureFetch]);

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, load]);

  const policyFor = async (recordId: string, op: "read" | "write") => {
    const res = await secureFetch(abs(`/api/policies?record=${recordId}&op=${op}`));
    if (!res.ok) throw new Error((await res.json()).error ?? "No policy for this record");
    return (await res.json()).policy as string;
  };

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(true);
    setMsg((m) => ({ ...m, [id]: "Working..." }));
    try {
      await fn();
    } catch (e) {
      // A contract refusal is a "no", not an outage: show it plainly and do not retry.
      setMsg((m) => ({ ...m, [id]: isRefusal(e) ? `Access denied by the Tide network: ${describeRefusal(e)}` : `Error: ${e instanceof Error ? e.message : e}` }));
    } finally {
      setBusy(false);
    }
  };

  const encrypt = (r: Rec) =>
    run(r.id, async () => {
      const policy = await policyFor(r.id, "write");
      const ciphertext = await encryptForRecord(ctx, r.sample ?? "", r.id, policy);
      const res = await secureFetch(abs("/api/records"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, ciphertext }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Store failed");
      setMsg((m) => ({ ...m, [r.id]: "Encrypted in your browser and stored. The server only holds ciphertext." }));
      await load();
    });

  const decrypt = (r: Rec) =>
    run(r.id, async () => {
      if (!r.ciphertext) throw new Error("Nothing stored yet");
      const policy = await policyFor(r.id, "read");
      const text = await decryptForRecord(ctx, r.ciphertext, r.id, policy);
      setPlain((p) => ({ ...p, [r.id]: text }));
      setMsg((m) => ({ ...m, [r.id]: "Decrypted in your browser." }));
    });

  const share = (r: Rec, to: "gp" | "physio" | "care-team") =>
    run(r.id, async () => {
      const res = await secureFetch(abs("/api/share-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: r.id, to }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      setMsg((m) => ({ ...m, [r.id]: `Share request sent (${to}). An admin must approve it.` }));
    });

  return (
    <CareShell title={title} subtitle={subtitle}>
      {note && <p style={{ color: "#f87171" }}>{note}</p>}
      {recs.length === 0 && (
        <div style={card}>
          <p style={{ margin: 0, color: "#9ca3af" }}>
            {mode === "patient"
              ? "No records yet. An admin must first sign your owner policy (Admin page)."
              : "Nothing is shared with you right now."}
          </p>
        </div>
      )}
      {recs.map((r) => (
        <div key={r.id} style={card}>
          <strong>{r.title}</strong>
          <div style={{ ...mono, margin: "0.4rem 0" }}>
            {r.ciphertext ? `ciphertext: ${r.ciphertext.slice(0, 64)}...` : "not stored yet"}
          </div>
          {plain[r.id] && (
            <p style={{ background: "#0b3d3d", padding: "0.5rem 0.75rem", borderRadius: 6 }}>{plain[r.id]}</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {r.canWrite && (
              <button style={btn} disabled={busy} onClick={() => encrypt(r)}>
                Encrypt demo data
              </button>
            )}
            <button style={btnGhost} disabled={busy || !r.ciphertext} onClick={() => decrypt(r)}>
              Decrypt
            </button>
            {mode === "patient" && r.canWrite && (
              <>
                <button style={btnGhost} disabled={busy} onClick={() => share(r, "gp")}>
                  Share with GP
                </button>
                <button style={btnGhost} disabled={busy} onClick={() => share(r, "physio")}>
                  Share with physio
                </button>
              </>
            )}
          </div>
          {msg[r.id] && <p style={{ color: "#60a5fa", fontSize: "0.9rem", marginBottom: 0 }}>{msg[r.id]}</p>}
        </div>
      ))}
    </CareShell>
  );
}
