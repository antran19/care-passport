import { MOCK_USERS, type MockUser } from "./mockData";
import { RECORDS, type RecordMeta } from "../care/data";

const PREFIX = "TIDE_ORK_CIPHERTEXT::";

export interface MockStoredRecord {
  id: string;
  ciphertext: string;
  updatedAt: string;
  updatedBy: string;
}

export interface MockPolicy {
  id: string;
  subjectType: "Group" | "User";
  subjectId: string;
  recordId: string;
  access: "read" | "write" | "read-write";
  policy: string;
  grantedBy: string;
  createdAt: string;
}

export interface MockShareRequest {
  id: string;
  recordId: string;
  requestedBy: string;
  to: "gp" | "physio" | "care-team";
  status: "pending" | "approved" | "rejected" | "revoked";
  createdAt: string;
  resolvedBy?: string;
}

export interface MockAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  recordId: string;
  details: string;
}

class MockStateStore {
  records: Map<string, MockStoredRecord> = new Map();
  policies: MockPolicy[] = [];
  shareRequests: MockShareRequest[] = [];
  auditLogs: MockAuditEntry[] = [];
  currentUser: MockUser = MOCK_USERS.patient1;

  constructor() {
    this.reset();
  }

  reset() {
    this.records.clear();
    this.policies = [
      // Patient 1 owns their records by default
      {
        id: "pol-owner-p1-allergies",
        subjectType: "Group",
        subjectId: "/p1-owner",
        recordId: "rec-allergies",
        access: "read-write",
        policy: "bW9ja19wb2xpY3lfcDFfb3duZXJfYWxsZXJnaWVzX3NpZ25lZF9ieV9zdGV3YXJk",
        grantedBy: "admin1",
        createdAt: new Date().toISOString(),
      },
      {
        id: "pol-owner-p1-physio",
        subjectType: "Group",
        subjectId: "/p1-owner",
        recordId: "rec-physio-plan",
        access: "read-write",
        policy: "bW9ja19wb2xpY3lfcDFfb3duZXJfcGh5c2lvX3NpZ25lZF9ieV9zdGV3YXJk",
        grantedBy: "admin1",
        createdAt: new Date().toISOString(),
      },
      {
        id: "pol-owner-p1-blood",
        subjectType: "Group",
        subjectId: "/p1-owner",
        recordId: "rec-blood-test",
        access: "read-write",
        policy: "bW9ja19wb2xpY3lfcDFfb3duZXJfYmxvb2Rfc2lnbmVkX2J5X3N0ZXdhcmQ=",
        grantedBy: "admin1",
        createdAt: new Date().toISOString(),
      },
    ];

    // Seed encrypted ciphertext for allergy record so GP / Admin can immediately test decrypt
    const allergySample = RECORDS[0].sample;
    this.records.set("rec-allergies", {
      id: "rec-allergies",
      ciphertext: `${PREFIX}${btoa(allergySample)}`,
      updatedAt: new Date().toISOString(),
      updatedBy: "patient1",
    });

    this.shareRequests = [];
    this.auditLogs = [
      {
        id: "audit-init-0",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        actor: "system",
        action: "BOOTSTRAP_MOCK",
        recordId: "*",
        details: "Mock environment initialized with Emergent Authority contract",
      },
    ];
  }

  setUser(username: string) {
    if (MOCK_USERS[username]) {
      this.currentUser = MOCK_USERS[username];
    }
  }

  encrypt(plaintext: string, recordId: string): string {
    const encoded = btoa(unescape(encodeURIComponent(plaintext)));
    const ct = `${PREFIX}${encoded}`;
    this.records.set(recordId, {
      id: recordId,
      ciphertext: ct,
      updatedAt: new Date().toISOString(),
      updatedBy: this.currentUser.username,
    });
    return ct;
  }

  decrypt(ciphertext: string, recordId: string): string {
    // Zero-Trust check: Admin can NEVER decrypt patient records!
    if (this.currentUser.role === "admin") {
      const err = new Error(
        "TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Emergent Authority ORK quorum rejected decryption key request"
      );
      (err as any).cause =
        "subjectId does not match: caller holds role tide-realm-admin which is not granted decryption rights in RelationshipAttestation:1 contract";
      throw err;
    }

    // Check if current user belongs to an authorized group for this record
    const hasGroupAccess = this.policies.some((p) => {
      if (p.recordId !== recordId) return false;
      if (p.access === "write") return false; // write-only cannot decrypt
      if (p.subjectType === "Group") {
        return this.currentUser.groups.includes(p.subjectId);
      }
      return false;
    });

    if (!hasGroupAccess) {
      const err = new Error(
        "TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs to decrypt"
      );
      (err as any).cause = `subjectId does not match: user ${this.currentUser.username} is not in authorized care team group for record ${recordId}`;
      throw err;
    }

    if (!ciphertext.startsWith(PREFIX)) {
      throw new Error("Invalid ciphertext format");
    }

    const payload = ciphertext.slice(PREFIX.length);
    return decodeURIComponent(escape(atob(payload)));
  }
}

export const mockState = new MockStateStore();
