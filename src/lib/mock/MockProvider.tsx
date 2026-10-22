"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { mockState, type MockStoredRecord } from "./mockTide";
import { MOCK_USERS, type MockUser } from "./mockData";
import { RECORDS } from "../care/data";

export interface TideCloakContextValue {
  authenticated: boolean;
  login: () => void;
  logout: () => void;
  isInitializing: boolean;
  token?: string;
  getValueFromIdToken: (claim: string) => any;
  hasClientRole: (role: string, client?: string) => boolean;
  hasRealmRole: (role: string) => boolean;
  getVendorId: () => string;
  secureFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  doEncrypt: (data: any, decryptionPolicy?: Uint8Array) => Promise<any>;
  doDecrypt: (data: any, decryptionPolicy?: Uint8Array) => Promise<any>;
  initializeTideRequest: (req: any) => Promise<any>;
  approveTideRequests: (reqs: any[]) => Promise<any[]>;
  executeTideRequest: (req: any, waitForAll?: boolean) => Promise<any[]>;
}

const MockTideContext = createContext<TideCloakContextValue | null>(null);

export function useMockTide() {
  const ctx = useContext(MockTideContext);
  if (!ctx) throw new Error("useMockTide must be used within MockProvider");
  return ctx;
}

export function useMockTideSafe() {
  return useContext(MockTideContext);
}

export function MockProvider({ children }: { children: React.ReactNode }) {

  const [currentUserKey, setCurrentUserKey] = useState<string>("patient1");
  const [version, setVersion] = useState(0);

  const triggerUpdate = useCallback(() => setVersion((v) => v + 1), []);

  const switchUser = (key: string) => {
    setCurrentUserKey(key);
    mockState.setUser(key);
    triggerUpdate();
  };

  const user = MOCK_USERS[currentUserKey] || MOCK_USERS.patient1;

  const secureFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === "string" ? input : input.toString();
      const url = new URL(urlStr, "http://localhost:3000");
      const method = (init?.method || "GET").toUpperCase();

      // Simulate slight network latency
      await new Promise((r) => setTimeout(r, 40));

      // 1. GET /api/records
      if (url.pathname === "/api/records" && method === "GET") {
        const canWrite = user.groups.includes("/p1-owner");
        const canRead = canWrite || user.groups.includes("/p1-care-team");

        const list = RECORDS.filter((r) => {
          if (canWrite) return true;
          if (canRead) {
            // Patient 1 care team can read Patient 1 records
            return r.patientId === "patient1";
          }
          return false;
        }).map((r) => ({
          id: r.id,
          title: r.title,
          sample: canWrite ? r.sample : undefined,
          ciphertext: mockState.records.get(r.id)?.ciphertext ?? null,
          canWrite,
        }));

        return new Response(JSON.stringify({ records: list }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 2. POST /api/records
      if (url.pathname === "/api/records" && method === "POST") {
        if (!user.groups.includes("/p1-owner")) {
          return new Response(JSON.stringify({ error: "Forbidden: write policy required" }), { status: 403 });
        }
        const body = JSON.parse(init?.body as string);
        mockState.records.set(body.id, {
          id: body.id,
          ciphertext: body.ciphertext,
          updatedAt: new Date().toISOString(),
          updatedBy: user.username,
        });
        triggerUpdate();
        return new Response(JSON.stringify({ success: true }), { status: 201 });
      }

      // 3. GET /api/policies
      if (url.pathname === "/api/policies" && method === "GET") {
        if (url.searchParams.get("all") === "1") {
          if (user.role !== "admin") {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
          }
          return new Response(JSON.stringify({ policies: mockState.policies }), { status: 200 });
        }
        const recordId = url.searchParams.get("record");
        const op = url.searchParams.get("op") || "read";

        // Find applicable policy for current user
        const pol = mockState.policies.find((p) => {
          if (p.recordId !== recordId) return false;
          if (op === "write" && p.access === "read") return false;
          if (p.subjectType === "Group") {
            return user.groups.includes(p.subjectId);
          }
          return false;
        });

        if (!pol) {
          return new Response(JSON.stringify({ error: "No policy grants you access to this record" }), { status: 404 });
        }
        return new Response(JSON.stringify({ policy: pol.policy, access: pol.access }), { status: 200 });
      }

      // 4. POST /api/policies
      if (url.pathname === "/api/policies" && method === "POST") {
        if (user.role !== "admin") {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        const body = JSON.parse(init?.body as string);
        const newPol = {
          id: `pol-${Date.now()}`,
          subjectType: body.subjectType,
          subjectId: body.subjectId,
          recordId: body.recordId,
          access: body.access,
          policy: body.policy,
          grantedBy: user.username,
          createdAt: new Date().toISOString(),
        };
        mockState.policies.push(newPol);
        mockState.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: user.username,
          action: "POLICY_ADDED",
          recordId: body.recordId,
          details: `Granted ${body.access} to ${body.subjectType} ${body.subjectId}`,
        });
        triggerUpdate();
        return new Response(JSON.stringify({ id: newPol.id }), { status: 201 });
      }

      // 5. DELETE /api/policies
      if (url.pathname === "/api/policies" && method === "DELETE") {
        if (user.role !== "admin") {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        const id = url.searchParams.get("id");
        mockState.policies = mockState.policies.filter((p) => p.id !== id);
        mockState.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: user.username,
          action: "POLICY_REMOVED",
          recordId: id || "*",
          details: `Admin revoked policy ${id}`,
        });
        triggerUpdate();
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      // 6. GET /api/share-requests
      if (url.pathname === "/api/share-requests" && method === "GET") {
        const reqs = user.role === "admin"
          ? mockState.shareRequests
          : mockState.shareRequests.filter((s) => s.requestedBy === user.username);
        return new Response(JSON.stringify({ requests: reqs }), { status: 200 });
      }

      // 7. POST /api/share-requests
      if (url.pathname === "/api/share-requests" && method === "POST") {
        const body = JSON.parse(init?.body as string);
        const req = {
          id: `req-${Date.now()}`,
          recordId: body.recordId,
          requestedBy: user.username,
          to: body.to,
          status: "pending" as const,
          createdAt: new Date().toISOString(),
        };
        mockState.shareRequests.push(req);
        mockState.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: user.username,
          action: "SHARE_REQUEST_CREATED",
          recordId: body.recordId,
          details: `Created share request for ${body.to}`,
        });
        triggerUpdate();
        return new Response(JSON.stringify({ request: req }), { status: 201 });
      }

      // 8. PATCH /api/share-requests
      if (url.pathname === "/api/share-requests" && method === "PATCH") {
        if (user.role !== "admin") {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        const body = JSON.parse(init?.body as string);
        const req = mockState.shareRequests.find((s) => s.id === String(body.id));
        if (!req) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        req.status = body.status;
        req.resolvedBy = user.username;

        // When approved, add Care Team policy so GP can read
        if (body.status === "approved") {
          mockState.policies.push({
            id: `pol-care-${Date.now()}`,
            subjectType: "Group",
            subjectId: "/p1-care-team",
            recordId: req.recordId,
            access: "read",
            policy: btoa(`signed_policy_care_team_${req.recordId}`),
            grantedBy: user.username,
            createdAt: new Date().toISOString(),
          });
        }
        // When revoked, remove Care Team policy
        if (body.status === "revoked") {
          mockState.policies = mockState.policies.filter(
            (p) => !(p.subjectId === "/p1-care-team" && p.recordId === req.recordId)
          );
        }

        mockState.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: user.username,
          action: `SHARE_REQUEST_${body.status.toUpperCase()}`,
          recordId: req.recordId,
          details: `Share request ${req.id} resolved as ${body.status}`,
        });
        triggerUpdate();
        return new Response(JSON.stringify({ request: req }), { status: 200 });
      }

      // 9. GET /api/admin/raw
      if (url.pathname === "/api/admin/raw") {
        if (user.role !== "admin") {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        mockState.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: user.username,
          action: "ADMIN_RAW_READ",
          recordId: "*",
          details: "Admin inspected database raw ciphertexts",
        });
        const list = RECORDS.map((r) => ({
          id: r.id,
          title: r.title,
          ciphertext: mockState.records.get(r.id)?.ciphertext ?? null,
        }));
        return new Response(JSON.stringify({ records: list }), { status: 200 });
      }

      // 10. GET /api/audit-logs
      if (url.pathname === "/api/audit-logs") {
        if (user.role !== "admin") {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        return new Response(JSON.stringify({ logs: mockState.auditLogs }), { status: 200 });
      }

      // 11. Mock Keycloak admin policy endpoint
      if (url.pathname.includes("/iga/role-policies/name/tide-realm-admin")) {
        return new Response(JSON.stringify({ policy: btoa("mock_iga_admin_policy_bytes_signed_by_care_steward") }), { status: 200 });
      }

      return fetch(input, init);
    },
    [user, triggerUpdate]
  );

  const value = useMemo<TideCloakContextValue>(
    () => ({
      authenticated: true,
      login: () => {},
      logout: () => {},
      isInitializing: false,
      token: `mock-token-${user.username}`,
      getValueFromIdToken: (claim: string) => {
        if (claim === "preferred_username") return user.username;
        if (claim === "name") return user.name;
        if (claim === "groups") return user.groups;
        return undefined;
      },
      hasClientRole: (role: string) => {
        if (role === "tide-realm-admin") return user.role === "admin";
        return user.realmRoles.includes(role);
      },
      hasRealmRole: (role: string) => user.realmRoles.includes(role),
      getVendorId: () => "mock-care-passport-vendor",
      secureFetch,
      doEncrypt: async (items: { data: string; tags: string[] }[]) => {
        return items.map((it) => mockState.encrypt(it.data, it.tags[0]));
      },
      doDecrypt: async (items: { encrypted: string; tags: string[] }[]) => {
        return items.map((it) => mockState.decrypt(it.encrypted, it.tags[0]));
      },
      initializeTideRequest: async (req: any) => ({
        ...req,
        encode: () => new Uint8Array([10, 20, 30]),
      }),
      approveTideRequests: async (reqs: any[]) =>
        reqs.map((r) => ({ id: r.id, approved: { request: new Uint8Array([10, 20, 30]) } })),
      executeTideRequest: async () => [new Uint8Array([1, 2, 3, 4])],
    }),
    [user, secureFetch]
  );

  return (
    <MockTideContext.Provider value={value}>
      {children}
      {/* Floating Mock Role Switcher for seamless demo testing */}
      <aside
        aria-label="Mock Mode Role Switcher"
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
          zIndex: 99999,
          background: "#121212",
          border: "1px solid #0f6e6e",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          fontSize: "0.85rem",
        }}
      >
        <span style={{ color: "#5eead4", fontWeight: 600 }}>🛠️ Mock Role:</span>
        {(Object.keys(MOCK_USERS) as (keyof typeof MOCK_USERS)[]).map((k) => (
          <button
            key={k}
            onClick={() => switchUser(k)}
            style={{
              background: currentUserKey === k ? "#0f6e6e" : "#222",
              color: currentUserKey === k ? "#fff" : "#9ca3af",
              border: currentUserKey === k ? "1px solid #5eead4" : "1px solid #333",
              borderRadius: 4,
              padding: "4px 8px",
              cursor: "pointer",
              fontWeight: currentUserKey === k ? "bold" : "normal",
            }}
          >
            {k}
          </button>
        ))}
      </aside>
    </MockTideContext.Provider>
  );
}
