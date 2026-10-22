"use client";

import { useTideCloak } from "@tidecloak/nextjs";
import type { ReactNode } from "react";

export const card: React.CSSProperties = {
  background: "#171717",
  border: "1px solid #2a2a2a",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  marginBottom: "1rem",
};
export const btn: React.CSSProperties = {
  background: "#0f6e6e",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "0.5rem 0.9rem",
  cursor: "pointer",
  fontSize: "0.9rem",
};
export const btnGhost: React.CSSProperties = { ...btn, background: "#2a2a2a" };
export const btnDanger: React.CSSProperties = { ...btn, background: "#9b2c2c" };
export const mono: React.CSSProperties = {
  fontFamily: "ui-monospace, Consolas, monospace",
  fontSize: "0.8rem",
  wordBreak: "break-all",
  color: "#9ca3af",
};

const NAV: [string, string][] = [
  ["/patient", "Patient"],
  ["/gp", "GP"],
  ["/physio", "Physio"],
  ["/admin", "Admin"],
  ["/admin-attack", "Admin tries to read"],
];

/** Page frame: login gate, header, nav. Children render only when logged in. */
export function CareShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { authenticated, login, logout, isInitializing, getValueFromIdToken } = useTideCloak();

  if (isInitializing) return <p>Loading...</p>;
  if (!authenticated) {
    return (
      <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
        <h1>Care Passport</h1>
        <p>Log in with your Tide account to continue.</p>
        <button onClick={login} style={btn}>
          Login with Tide
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "1.5rem auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#999", fontSize: "0.9rem" }}>{getValueFromIdToken("preferred_username")}</span>
          <button onClick={logout} style={btnGhost}>
            Logout
          </button>
        </div>
      </div>
      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "0.75rem 0 1.25rem" }}>
        {NAV.map(([href, label]) => (
          <a key={href} href={href} style={{ color: "#5eead4", fontSize: "0.9rem" }}>
            {label}
          </a>
        ))}
      </nav>
      {subtitle && <p style={{ color: "#9ca3af", marginTop: 0 }}>{subtitle}</p>}
      {children}
    </div>
  );
}
