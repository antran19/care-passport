"use client";

import { useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { abs } from "@/lib/care/client";
import { CareShell, card, btn, mono } from "@/components/CareShell";

/**
 * Diagnostic: self-encryption needs NO policy (tag "vault" + roles _tide_vault.selfencrypt/selfdecrypt).
 * If this works while the policy-based encrypt fails, the doken is fine and the fault is in the policy path.
 */
export default function SelfTestPage() {
  const { doEncrypt, doDecrypt, secureFetch } = useTideCloak();
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setOut("Working...");
    try {
      const [enc] = await doEncrypt([{ data: "self-test (fake)", tags: ["vault"] }]);
      const [dec] = await doDecrypt([{ encrypted: enc, tags: ["vault"] }]);
      // Keep the ciphertext on the server so the admin page can try (and fail) to read it.
      const res = await secureFetch(abs("/api/vault"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciphertext: enc }),
      });
      setOut(`OK: encrypted and decrypted without a policy. Result: ${dec}. Stored on server: ${res.ok ? "yes" : `no (${res.status})`}`);
    } catch (e) {
      setOut(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareShell title="Self-encryption test" subtitle="Diagnostic only: encrypts a fake string for the logged-in user, no policy involved.">
      <button style={btn} disabled={busy} onClick={run}>
        {busy ? "Trying..." : "Run self-encrypt and decrypt"}
      </button>
      {out && (
        <div style={{ ...card, marginTop: "1rem" }}>
          <div style={{ ...mono, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{out}</div>
        </div>
      )}
    </CareShell>
  );
}
