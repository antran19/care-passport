# Care Passport — API Specification & Architecture Guide

> **Project:** Care Passport (UNLOCKED Hackathon — RMIT x Tide)  
> **Security Protocol:** Zero-Trust Admin & Emergent Authority via Tide Threshold Cryptography (`RelationshipAttestation:1`)  
> **Authentication:** TideCloak OIDC + Sender-Constrained DPoP (`cnf.jkt` token binding)

---

## 1. Authentication & Security Architecture

All API routes (except static public routes) require strict server-side verification:
1. **Bearer Token Signature & Expiry:** Verified using TideCloak realm embedded JWKS.
2. **DPoP Proof Header (`DPoP`):** The server verifies that the client holds the private key matching the thumbprint (`cnf.jkt`) in the access token. Unbound tokens or replayed Bearer tokens are rejected with `401 Unauthorized`.
3. **Server Zero-Knowledge:** The server only stores `id` and `ciphertext`. It **never** receives plaintext data or private decryption keys.

---

## 2. API Endpoints Reference

### 2.1 Records API (`/api/records`)

#### `GET /api/records`
Retrieves all medical records for which the authenticated caller holds an active policy (read or write).
- **Authentication:** Required (`withAuth`)
- **Headers:**
  - `Authorization: Bearer <jwt>`
  - `DPoP: <dpop-proof>`
- **Response (200 OK):**
```json
{
  "records": [
    {
      "id": "rec-allergies",
      "title": "Allergies and medications (fake)",
      "sample": "Allergy: penicillin (rash)...",
      "ciphertext": "TIDE_ORK_CIPHERTEXT::...",
      "canWrite": true
    }
  ]
}
```
*Note: `sample` is only provided to record owners who hold a `write` policy.*

---

#### `POST /api/records`
Stores or updates client-side encrypted ciphertext in the vault.
- **Authentication:** Required (`withAuth`)
- **Authorization:** Caller must hold an active `write` policy for the specified record.
- **Request Body:**
```json
{
  "id": "rec-allergies",
  "ciphertext": "TIDE_ORK_CIPHERTEXT::..."
}
```
- **Responses:**
  - `201 Created`: `{ "success": true }`
  - `400 Bad Request`: Unknown record or missing ciphertext
  - `403 Forbidden`: Caller lacks a `write` policy on this record
  - `413 Payload Too Large`: Ciphertext exceeds max size limit

---

### 2.2 Relationship Policies API (`/api/policies`)

#### `GET /api/policies?record=<id>&op=<read|write>`
Fetches the signed policy permitting the caller to encrypt or decrypt the record.
- **Query Params:**
  - `record`: Record ID (`rec-allergies`, `rec-physio-plan`, `rec-blood-test`, `rec-cardio-assessment`)
  - `op`: Desired operation (`read` or `write`)
- **Responses:**
  - `200 OK`: `{ "policy": "<base64-signed-policy>", "access": "read" }`
  - `404 Not Found`: No policy grants the caller access to this record

#### `GET /api/policies?all=1`
Retrieves metadata of all active policies stored on the server.
- **Authorization:** Admin only (`tide-realm-admin`)
- **Response (200 OK):**
```json
{
  "policies": [
    {
      "id": "pol-001",
      "subjectType": "Group",
      "subjectId": "/p1-owner",
      "recordId": "rec-allergies",
      "access": "read-write",
      "grantedBy": "admin1",
      "createdAt": "2026-10-22T04:00:00.000Z"
    }
  ]
}
```

#### `POST /api/policies`
Registers a newly signed policy issued inside the Tide Enclave.
- **Authorization:** Admin only (`tide-realm-admin`)
- **Request Body:**
```json
{
  "subjectType": "Group",
  "subjectId": "/p1-care-team",
  "recordId": "rec-allergies",
  "access": "read",
  "policy": "<base64-signed-policy-bytes>"
}
```
- **Responses:**
  - `201 Created`: `{ "id": "pol-123" }`
  - `400 Bad Request`: Unsupported subject, record, or malformed policy
  - `403 Forbidden`: Caller is not a `tide-realm-admin`

#### `DELETE /api/policies?id=<policyId>`
Revokes a stored policy from circulation.
- **Authorization:** Admin only (`tide-realm-admin`)
- **Responses:**
  - `200 OK`: `{ "success": true }`
  - `404 Not Found`: Policy ID does not exist

---

### 2.3 Share Requests API (`/api/share-requests`)

#### `GET /api/share-requests`
Lists sharing requests.
- **Access Control:**
  - **Admin:** Views all pending and resolved share requests across the system.
  - **Patient:** Views only requests originated by their own account.
- **Response (200 OK):**
```json
{
  "requests": [
    {
      "id": "req-001",
      "recordId": "rec-allergies",
      "requestedBy": "patient1",
      "to": "gp",
      "status": "pending",
      "createdAt": "2026-10-22T04:10:00.000Z"
    }
  ]
}
```

#### `POST /api/share-requests`
Submits a patient-initiated request to share a medical record with a clinician or Care Team.
- **Authorization:** Patient must hold a `write` policy on the record.
- **Request Body:**
```json
{
  "recordId": "rec-allergies",
  "to": "gp"
}
```
- **Response (201 Created):** `{ "request": { ... } }`

#### `PATCH /api/share-requests`
Care Steward (Admin) resolves or revokes a sharing request.
- **Authorization:** Admin only (`tide-realm-admin`)
- **Request Body:**
```json
{
  "id": "req-001",
  "status": "approved"
}
```
*Valid statuses: `approved`, `rejected`, `revoked`.*

---

### 2.4 Zero-Trust Raw Inspection API (`/api/admin/raw`)

#### `GET /api/admin/raw`
Demonstrates what a privileged database/server administrator sees when accessing patient data.
- **Authorization:** `tide-realm-admin`
- **Audit Logging:** Every call automatically appends an immutable `ADMIN_RAW_READ` event to the Governance Audit Trail.
- **Response (200 OK):**
```json
{
  "records": [
    {
      "id": "rec-allergies",
      "title": "Allergies and medications (fake)",
      "ciphertext": "TIDE_ORK_CIPHERTEXT::..."
    }
  ]
}
```
*Crucial: The server returns raw ciphertexts only. Even if the Admin calls `doDecrypt()`, the Tide ORK network refuses key release (`TIDE-TIDEJS-NET-THRESHOLD_FAILURE`).*

---

### 2.5 Governance Audit Trail API (`/api/audit-logs`)

#### `GET /api/audit-logs`
Retrieves the complete immutable audit trail of all governance actions (Care Steward actions, share requests, and admin raw accesses).
- **Authorization:** `tide-realm-admin`
- **Response (200 OK):**
```json
{
  "logs": [
    {
      "id": "audit-001",
      "timestamp": "2026-10-22T04:15:00.000Z",
      "actor": "admin1",
      "action": "SHARE_REQUEST_APPROVED",
      "recordId": "rec-allergies",
      "details": "Share request req-001 resolved as approved (recipient: gp)"
    }
  ]
}
```

---

## 3. Cryptographic Governance & Group Mappings

| Subject Group | Members | Permitted Operations | Contract Role |
| :--- | :--- | :--- | :--- |
| `/p1-owner` | `patient1` | `read-write` (Encrypt & Decrypt) | `_tide_encryptor`, `_tide_decryptor` |
| `/p1-care-team` | `gp1`, `physio1` (when granted) | `read` (Decrypt only) | `_tide_decryptor` |
| `/p2-owner` | `patient2` (Demo) | `read-write` | `_tide_encryptor`, `_tide_decryptor` |
| Admins | `admin1`, `admin2`, `admin3` | `sign` policies in Enclave (Quorum 2/3) | `tide-realm-admin` |

---

## 4. Contract Refusal Error Handling

When an unauthorized subject (such as an Admin) attempts to decrypt client-side:
- **Error:** `TIDE-TIDEJS-NET-THRESHOLD_FAILURE`
- **Nature:** Deliberate cryptographic refusal by Tide ORK threshold nodes.
- **Handling Rule:** **DO NOT RETRY.** Catch via `isRefusal(err)` and render the red alert banner proving Emergent Authority enforcement.
