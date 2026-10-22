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

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action:
    | "POLICY_ADDED"
    | "POLICY_REMOVED"
    | "SHARE_REQUEST_CREATED"
    | "SHARE_REQUEST_APPROVED"
    | "SHARE_REQUEST_REJECTED"
    | "SHARE_REQUEST_REVOKED"
    | "ADMIN_RAW_READ";
  recordId: string;
  details: string;
}

export const audit = {
  all: () => load<AuditEntry[]>("audit", []),
  log(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
    const item: AuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    save("audit", [item, ...audit.all()]);
    return item;
  },
};

export const records = {
  all: () => load<StoredRecord[]>("records", []),
  get: (id: string) => records.all().find((r) => r.id === id),
  put(rec: Omit<StoredRecord, "updatedAt">) {
    const list = records.all().filter((r) => r.id !== rec.id);
    list.push({ ...rec, updatedAt: new Date().toISOString() });
    save("records", list);
  },
};

// Self-encrypted notes (tag "vault", no policy): bound to the user who wrote them. Used by the
// "admin tries to read" demo with real network refusals.
export interface VaultEntry {
  owner: string;
  ciphertext: string;
  updatedAt: string;
}
export const vault = {
  all: () => load<VaultEntry[]>("vault", []),
  put(owner: string, ciphertext: string) {
    const list = vault.all().filter((v) => v.owner !== owner);
    list.push({ owner, ciphertext, updatedAt: new Date().toISOString() });
    save("vault", list);
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
    audit.log({
      actor: p.grantedBy,
      action: "POLICY_ADDED",
      recordId: p.recordId,
      details: `Granted ${p.access} to ${p.subjectType} ${p.subjectId}`,
    });
    return entry;
  },
  remove(id: string, actor: string = "system"): boolean {
    const list = policies.all();
    const target = list.find((x) => x.id === id);
    const next = list.filter((x) => x.id !== id);
    save("policies", next);
    if (target) {
      audit.log({
        actor,
        action: "POLICY_REMOVED",
        recordId: target.recordId,
        details: `Revoked policy for ${target.subjectType} ${target.subjectId}`,
      });
    }
    return next.length !== list.length;
  },
};

export const shares = {
  all: () => load<ShareRequest[]>("shares", []),
  add(s: Omit<ShareRequest, "id" | "createdAt" | "status">): ShareRequest {
    const entry: ShareRequest = { ...s, id: randomUUID(), status: "pending", createdAt: new Date().toISOString() };
    save("shares", [...shares.all(), entry]);
    audit.log({
      actor: s.requestedBy,
      action: "SHARE_REQUEST_CREATED",
      recordId: s.recordId,
      details: `Created share request to ${s.to}`,
    });
    return entry;
  },
  update(id: string, patch: Partial<ShareRequest>, actor: string = "system"): ShareRequest | undefined {
    const list = shares.all();
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return undefined;
    list[i] = { ...list[i], ...patch };
    save("shares", list);
    if (patch.status) {
      const actionMap: Record<string, AuditEntry["action"]> = {
        approved: "SHARE_REQUEST_APPROVED",
        rejected: "SHARE_REQUEST_REJECTED",
        revoked: "SHARE_REQUEST_REVOKED",
      };
      const action = actionMap[patch.status];
      if (action) {
        audit.log({
          actor,
          action,
          recordId: list[i].recordId,
          details: `Share request status updated to ${patch.status} (recipient: ${list[i].to})`,
        });
      }
    }
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
