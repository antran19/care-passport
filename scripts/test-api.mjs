/**
 * Care Passport — Backend API & Policy Verification Suite
 * Tests access control, zero-trust enforcement, and audit logs.
 */

import { records, policies, shares, audit, policiesFor } from "../src/lib/care/store.js";
import { RECORDS, OWNER_GROUP, CARE_GROUP } from "../src/lib/care/data.js";
import { mockState } from "../src/lib/mock/mockTide.js";
import { isRefusal, describeRefusal } from "../src/lib/tide/relationship.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log("=================================================");
console.log("  CARE PASSPORT — BACKEND SECURITY TEST SUITE    ");
console.log("=================================================\n");

// --- TEST SUITE 1: Data Model & Seed Validation ---
console.log("Test Suite 1: Data Model & Seed Validation");
assert(RECORDS.length >= 3, `Expanded seed contains at least 3 records (found ${RECORDS.length})`);
assert(RECORDS.some((r) => r.patientId === "patient1"), "Contains records for patient1");
assert(RECORDS.some((r) => r.patientId === "patient2"), "Contains records for patient2 (multi-patient demo)");

// --- TEST SUITE 2: Access Control & Policies ---
console.log("\nTest Suite 2: Access Control & Policies");
const patientJwt = { sub: "patient1", preferred_username: "patient1", groups: [OWNER_GROUP] };
const gpJwt = { sub: "gp1", preferred_username: "gp1", groups: [CARE_GROUP] };
const physioJwt = { sub: "physio1", preferred_username: "physio1", groups: [] };
const adminJwt = { sub: "admin1", preferred_username: "admin1", groups: [], realm_access: { roles: ["tide-realm-admin"] } };

// Reset mock state
mockState.reset();

// Seed patient owner policy for rec-allergies
policies.add({
  subjectType: "Group",
  subjectId: OWNER_GROUP,
  recordId: "rec-allergies",
  access: "read-write",
  policy: "signed_owner_policy_rec_allergies_base64",
  grantedBy: "admin1",
});

// 1. Patient has write policy
const patientWritePolicies = policiesFor(patientJwt, "rec-allergies", "write");
assert(patientWritePolicies.length > 0, "Patient with /p1-owner holds write policy for rec-allergies");


// 2. GP without care-team policy cannot read yet
const gpPoliciesBefore = policiesFor(gpJwt, "rec-allergies", "read");
assert(gpPoliciesBefore.length === 0, "GP has no read policy before sharing");

// 3. Physio without care-team membership cannot read
const physioPolicies = policiesFor(physioJwt, "rec-allergies", "read");
assert(physioPolicies.length === 0, "Physio not in care team has no read policy");

// 4. Admin has no read policy for patient data
const adminPolicies = policiesFor(adminJwt, "rec-allergies", "read");
assert(adminPolicies.length === 0, "Admin holds NO read policy for patient data (Zero-Trust)");

// --- TEST SUITE 3: Share Request & Governance Audit Logging ---
console.log("\nTest Suite 3: Share Request & Governance Audit Logging");
const initialAuditCount = audit.all().length;

// Patient creates share request
const req = shares.add({ recordId: "rec-allergies", requestedBy: "patient1", to: "gp" });
assert(req.id && req.status === "pending", "Share request created with pending status");

// Check audit log recorded SHARE_REQUEST_CREATED
const auditAfterShare = audit.all();
assert(auditAfterShare.length === initialAuditCount + 1, "Audit log count incremented on share request");
assert(auditAfterShare[0].action === "SHARE_REQUEST_CREATED", `Audit action is SHARE_REQUEST_CREATED (got ${auditAfterShare[0].action})`);

// Admin approves share request
shares.update(req.id, { status: "approved" }, "admin1");
const auditAfterApprove = audit.all();
assert(auditAfterApprove[0].action === "SHARE_REQUEST_APPROVED", "Audit action is SHARE_REQUEST_APPROVED");

// Admin grants signed policy to CARE_GROUP
policies.add({
  subjectType: "Group",
  subjectId: CARE_GROUP,
  recordId: "rec-allergies",
  access: "read",
  policy: "signed_care_team_policy_base64",
  grantedBy: "admin1",
});
const auditAfterPolicy = audit.all();
assert(auditAfterPolicy[0].action === "POLICY_ADDED", "Audit action is POLICY_ADDED");

// Now GP can read
const gpPoliciesAfter = policiesFor(gpJwt, "rec-allergies", "read");
assert(gpPoliciesAfter.length > 0, "GP with /p1-care-team now holds valid read policy");

// Admin revokes policy
policies.remove(policies.all().find((p) => p.subjectId === CARE_GROUP && p.recordId === "rec-allergies")?.id || "", "admin1");
const auditAfterRevoke = audit.all();
assert(auditAfterRevoke[0].action === "POLICY_REMOVED", "Audit action is POLICY_REMOVED");

// --- TEST SUITE 4: Zero-Trust Admin Attack Simulation ---
console.log("\nTest Suite 4: Zero-Trust Admin Attack Simulation");
mockState.setUser("admin1");
let adminBlocked = false;
let capturedError = null;

try {
  mockState.decrypt("TIDE_ORK_CIPHERTEXT::dGVzdA==", "rec-allergies");
} catch (e) {
  adminBlocked = true;
  capturedError = e;
}

assert(adminBlocked, "Admin decrypt attempt was BLOCKED by Emergent Authority");
assert(isRefusal(capturedError), `Error is classified as contract refusal: ${capturedError?.message?.slice(0, 40)}...`);
assert(describeRefusal(capturedError).includes("role"), "Refusal details identify unauthorized role");

console.log("\n=================================================");
console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All security and backend verification checks PASSED!\n");
}
