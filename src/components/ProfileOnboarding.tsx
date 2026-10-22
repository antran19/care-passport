"use client";

/**
 * Post-signup profile collection for a Tide app.
 *
 * Tide's IdP asserts ONLY a username (the vuid): no email, no name. This modal collects the
 * details inside the app, after login, and is skippable.
 *
 * Rules this file follows:
 *  1. It writes through the ACCOUNT API with the USER'S OWN TOKEN, never the Admin API (AP-41);
 *     on an IGA realm an admin write returns 202 and only queues a change request.
 *  2. It is dismissible.
 *  3. It never invents a placeholder email (AP-85).
 */

import { useEffect, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";

const DISMISS_KEY = "tide.profile-onboarding.dismissed";

type Props = {
  /** Base TideCloak URL, e.g. from the adapter's `auth-server-url`. */
  baseUrl: string;
  realm: string;
  /** Fields the app actually wants. Only ask for what you will use. */
  fields?: Array<"email" | "firstName" | "lastName">;
  /** Set true only if the app cannot function without these. Defaults to skippable. */
  required?: boolean;
  onDone?: () => void;
};

export function ProfileOnboarding({
  baseUrl,
  realm,
  fields = ["firstName", "lastName"],
  required = false,
  onDone,
}: Props) {
  const { authenticated, getValueFromToken, token } = useTideCloak();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ email: "", firstName: "", lastName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    if (!required && localStorage.getItem(DISMISS_KEY) === "1") return;

    // getValueFromToken(key), NOT tokenParsed (which does not exist and fails silently).
    const hasName = getValueFromToken("given_name") || getValueFromToken("name");
    const hasEmail = getValueFromToken("email");

    const missing =
      (fields.includes("firstName") && !hasName) ||
      (fields.includes("email") && !hasEmail);

    if (missing) {
      setValues((v) => ({
        ...v,
        email: (getValueFromToken("email") as string) || "",
        firstName: (getValueFromToken("given_name") as string) || "",
        lastName: (getValueFromToken("family_name") as string) || "",
      }));
      setOpen(true);
    }
  }, [authenticated, fields, required, getValueFromToken]);

  if (!open) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
    onDone?.();
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      for (const f of fields) if (values[f]) body[f] = values[f].trim();

      const res = await fetch(`${baseUrl}/realms/${realm}/account/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "Not authorised to update your profile. Check the token includes the `account` audience.",
        );
      }
      if (res.status === 202) {
        throw new Error(
          "Your changes were queued for approval and are not saved yet. An administrator must approve them.",
        );
      }
      if (!res.ok) throw new Error(`Could not save your details (${res.status}).`);

      setOpen(false);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const label: Record<string, string> = {
    email: "Email",
    firstName: "First name",
    lastName: "Last name",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tide-onboarding-title"
      style={{
        position: "fixed", inset: 0, display: "grid", placeItems: "center",
        background: "rgba(0,0,0,.45)", zIndex: 1000, padding: "1rem",
      }}
    >
      <div style={{ background: "var(--card-bg, #fff)", color: "var(--card-fg, #111)",
                    borderRadius: 12, padding: "1.5rem", width: "min(28rem, 100%)" }}>
        <h2 id="tide-onboarding-title" style={{ margin: "0 0 .25rem", fontSize: "1.15rem" }}>
          Welcome to Care Passport
        </h2>
        <p style={{ margin: "0 0 1rem", opacity: .75, fontSize: ".9rem" }}>
          {required
            ? "We need a few details before you continue."
            : "Optional — you can do this later in settings."}
        </p>

        {fields.map((f) => (
          <label key={f} style={{ display: "block", marginBottom: ".75rem" }}>
            <span style={{ display: "block", fontSize: ".85rem", marginBottom: ".25rem" }}>
              {label[f]}
            </span>
            <input
              type={f === "email" ? "email" : "text"}
              value={values[f]}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              autoComplete={f === "email" ? "email" : f === "firstName" ? "given-name" : "family-name"}
              style={{ width: "100%", padding: ".5rem .6rem", borderRadius: 6,
                       border: "1px solid var(--border, #ccc)", background: "transparent",
                       color: "inherit", boxSizing: "border-box" }}
            />
          </label>
        ))}

        {error && (
          <p role="alert" style={{ color: "#c0392b", fontSize: ".85rem", margin: ".5rem 0" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          {!required && (
            <button type="button" onClick={dismiss} disabled={busy}
                    style={{ padding: ".5rem .9rem", borderRadius: 6, border: "1px solid var(--border,#ccc)",
                             background: "transparent", color: "inherit", cursor: "pointer" }}>
              Not now
            </button>
          )}
          <button type="button" onClick={save} disabled={busy}
                  style={{ padding: ".5rem .9rem", borderRadius: 6, border: "none",
                           background: "var(--accent, #1f6feb)", color: "#fff", cursor: "pointer" }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
