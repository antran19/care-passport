"use client";

import { useTideCloak } from "@tidecloak/nextjs";

export default function HomePage() {
  const { authenticated, getValueFromIdToken, login, logout, isInitializing } =
    useTideCloak();

  if (isInitializing) {
    return <p>Loading...</p>;
  }

  if (!authenticated) {
    return (
      <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
        <h1>Care Passport</h1>
        <p style={{ color: "#999", marginBottom: "2rem" }}>
          Your health records, encrypted. You decide who can read them.
        </p>
        <button onClick={login} style={btnStyle}>
          Login with Tide
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
      <h1>Care Passport</h1>
      <p>Welcome, {getValueFromIdToken("preferred_username")}</p>
      <nav style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1rem", flexWrap: "wrap" }}>
        <a href="/patient" style={btnStyle}>Patient</a>
        <a href="/gp" style={btnStyle}>GP</a>
        <a href="/physio" style={btnStyle}>Physio</a>
        <a href="/admin" style={btnStyle}>Admin</a>
        <a href="/admin-attack" style={btnStyle}>Admin tries to read</a>
        <button onClick={logout} style={{ ...btnStyle, background: "#333" }}>
          Logout
        </button>
      </nav>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "0.75rem 1.5rem",
  fontSize: "1rem",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};
