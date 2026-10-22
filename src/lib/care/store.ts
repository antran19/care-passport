import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { JWTPayload } from "jose";

// Filesystem store (survives dev hot reload). Replace with a real database for production.
const DIR = join(process.cwd(), "data", "care");
mkdirSync(DIR, { recursive: true });

function load<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf-8")) as T;
  } catch {
    return fallback;
  }
}
function save(name: string, value: unknown) {
  writeFileSync(join(DIR, `${name}.json`), JSON.stringify(value, null, 2));
}

export interface StoredRecord {
  id: string;
  ciphertext: string;
  updatedAt: string;
  updatedBy: string;
}
export interface StoredPolicy {
  id: string;
  subjectType: "User" | "Group" | "Role";
  subjectId: string;
  recordId: string;
  access: "read" | "write" | "read-write";
  policy: string; // signed policy, base64
  grantedBy: string;
  createdAt: string;
}
export interface ShareRequest {
  id: string;
  recordId: string;
  requestedBy: string;
  to: "gp" | "physio" | "care-team";
  status: "pending" | "approved" | "rejected" | "revoked";
  createdAt: string;
  resolvedBy?: string;
}

export const records = {
  all: () => load<StoredRecord[]>("records", []),
  get: (id: string) => records.all().find((r) => r.id === id),
  put(rec: Omit<StoredRecord, "updatedAt">) {
    const list = records.all().filter((r) => r.id !== rec.id);
    list.push({ ...rec, updatedAt: new Date().toISOString() });
    save("records", list);
  },
};

export const policies = {
  all: () => load<StoredPolicy[]>("policies", []),
  add(p: Omit<StoredPolicy, "id" | "createdAt">): StoredPolicy {
    const list = policies
      .all()
      .filter((x) => !(x.subjectType === p.subjectType && x.subjectId === p.subjectId && x.recordId === p.recordId));
    const entry = { ...p, id: randomUUID(), createdAt: new Date().toISOString() };
    list.push(entry);
    save("policies", list);
    return entry;
  },
  remove(id: string): boolean {
    const list = policies.all();
    const next = list.filter((x) => x.id !== id);
    save("policies", next);
    return next.length !== list.length;
  },
};

export const shares = {
  all: () => load<ShareRequest[]>("shares", []),
  add(s: Omit<ShareRequest, "id" | "createdAt" | "status">): ShareRequest {
    const entry: ShareRequest = { ...s, id: randomUUID(), status: "pending", createdAt: new Date().toISOString() };
    save("shares", [...shares.all(), entry]);
    return entry;
  },
  update(id: string, patch: Partial<ShareRequest>): ShareRequest | undefined {
    const list = shares.all();
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return undefined;
    list[i] = { ...list[i], ...patch };
    save("shares", list);
    return list[i];
  },
};

/** Which stored policies apply to the caller, judged only from the VERIFIED token. */
export function policiesFor(jwt: JWTPayload, recordId: string, needs: "read" | "write"): StoredPolicy[] {
  const groups = Array.isArray(jwt.groups) ? (jwt.groups as string[]) : [];
  const key = typeof jwt.tideuserkey === "string" ? jwt.tideuserkey : "";
  return policies.all().filter((p) => {
    if (p.recordId !== recordId) return false;
    if (needs === "read" && p.access === "write") return false;
    if (needs === "write" && p.access === "read") return false;
    if (p.subjectType === "Group") return groups.includes(p.subjectId);
    if (p.subjectType === "User") return !!key && p.subjectId === key;
    return false;
  });
}

export const ADMIN_ROLE = "tide-realm-admin";
export const who = (jwt: JWTPayload) => String(jwt.preferred_username ?? jwt.sub ?? "unknown");
