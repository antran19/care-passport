# Care Passport

UNLOCKED hackathon (RMIT x Tide). A patient keeps control of their health records: the records are encrypted in the browser, the patient shares them with a GP or a physio, and **a realm admin cannot read them**. All data in this repo is fake.

## The idea in one minute

- **Patient** encrypts a record in the browser. The server stores ciphertext only.
- **Share**: the patient sends a share request. An admin approves it by signing a policy inside the Tide enclave. The care team (GP, physio) can then decrypt.
- **Revoke**: removing someone from the care-team group stops them passing the check on their next sign-in. Care-team policies also expire after 24 hours.
- **Admin tries to read**: a button that shows the admin is blocked. The server holds ciphertext only, and no policy names the admin.

## Architecture

```
Patient browser --encrypt(record id as tag, policy)--> Tide ORK network
       |                                                     ^
       | ciphertext                                          | contract RelationshipAttestation:1
       v                                                     | checks: group, role, tag, policy
Next.js API (ciphertext + signed policies only)              |
       ^                                                     |
Admin browser --signs policy in the Tide enclave (IGA) ------+
```

- `RelationshipAttestation:1` is a built-in Tide contract. A policy names a **group** (`/p1-owner` read-write, `/p1-care-team` read), one record id, and the allowed operation.
- Roles `_tide_encryptor` (write) and `_tide_decryptor` (read) are also required.
- The server never decrypts. It verifies the token and DPoP proof on every route (`src/lib/auth/middleware.ts`).

| Piece | Where |
|---|---|
| Tide helpers (policy, encrypt, decrypt) | `src/lib/tide/relationship.ts` |
| Fake data and file store | `src/lib/care/` |
| API | `src/app/api/{policies,records,share-requests,admin/raw}` |
| Pages | `/patient`, `/gp`, `/physio`, `/admin`, `/admin-attack` |
| Realm seed (users, groups) | `scripts/care-passport-seed.sh` |

## Run it

```bash
npm install
npm run init     # starts TideCloak (Docker), creates the realm, exports data/tidecloak.json
npm run dev      # http://localhost:3000
bash scripts/care-passport-seed.sh   # demo users patient1, gp1, physio1 and groups
```

The realm runs on one machine (Docker). Only that machine can sign in to it. Team members work against the UI without Tide.

## What works and what does not (honest status)

Verified end to end on a real Tide realm:

- Real Tide sign-in for `admin`, `patient1`, `gp1`, `physio1`.
- Realm in IGA multiAdmin mode; role and group changes are change requests approved in the Tide enclave.
- The admin signs relationship policies in the enclave. Two owner policies are stored (`rec-allergies`, `rec-physio-plan`).
- Admin tries to read: blocked (no ciphertext readable by the server, no policy names the admin).

**Not verified: encrypt and decrypt.** On 2026-10-22, every encrypt request failed on the Tide network with:

```
TIDE-TIDEJS-NET-THRESHOLD_FAILURE ... 19 of 20 failed
[TIDE-ORK-INTERNAL-UNEXPECTED] Doken signature failed
  at /Authentication/Key/v1/PreSign?vuid=58848829-8e65-4a8b-8a37-ee5941357cad
```

What we checked:

- It fails for `patient1` and also for `admin`, both given the roles and the `/p1-owner` group (so it is not one account).
- Groups, roles and signed policies are correct; no change request is pending.
- The Tide ORK nodes are reachable and the local clock matches theirs.
- Fresh sign-ins did not help.

We could not resolve it before the deadline and have asked the Tide team. Because of this, the **share, GP read and revoke flows are implemented but were not seen working against the live network**.

## Real limits of the design

- **Revoking one record is not instant.** A revoked user who kept a policy copy can still use it until it expires (24 hours for care-team policies). Removing a user from the group takes effect when they next sign in.
- **One admin can approve their own access.** With a single admin there is no quorum. Quorum (default 70% of admins, at least 1) needs at least three admins; we ran with one.
- **Whoever controls group membership controls access.** Adding someone to `/p1-care-team` is granting them the record. Those changes are governed (change requests), but the approver is trusted.
- **The policy list is visible.** Policies name the group and the record id in clear.
- All data is fake. This is a hackathon demo, not a medical product.
