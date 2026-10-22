# Care Passport

UNLOCKED hackathon (RMIT x Tide). A patient keeps control of their health records: records are encrypted in the browser, the patient shares them with a GP or a physio, and **a realm admin cannot read them**. All data in this repo is fake.

## Demo

| Part | What it shows | File |
|---|---|---|
| 1. Real Tide realm | Tide sign-in, admin signs access policies in the enclave, **admin tries to read and is refused by the Tide network** (about 1 min) | [`Care Passport - Google Chrome 2026-10-22 14-36-44.mp4`](<Care Passport - Google Chrome 2026-10-22 14-36-44.mp4>) (stored with Git LFS) |
| 2. Mock mode (simulated) | Encrypt, share, admin approves, GP reads, revoke, GP refused, admin blocked, with a fake Tide | [`care-passport-part2-mock-demo.gif`](care-passport-part2-mock-demo.gif) |

Part 2 is **simulated** (`NEXT_PUBLIC_MOCK=1`). See [What is real and what is not](#what-is-real-and-what-is-not).

## What each part is for, and how data flows

There are five parts. Each one has one job.

| Part | Job | Where |
|---|---|---|
| **TideCloak realm** | Sign-in (OIDC + DPoP), users, groups, roles, and governed changes (IGA change requests) | Docker container, `scripts/` |
| **Tide ORK network** | Holds the key shares. Encrypts and decrypts only if the contract says yes | Run by Tide, called from the browser |
| **Browser app** (Next.js pages) | Where users act. All encryption and decryption happens here | `src/app/*`, `src/components/*`, `src/lib/tide/relationship.ts` |
| **Server** (Next.js API routes) | Stores ciphertext and signed policies. Checks who is calling. Never decrypts | `src/app/api/*`, `src/lib/care/store.ts`, `src/lib/auth/*` |
| **Mock layer** | A fake Tide inside the browser, for demos and UI work without the realm | `src/lib/mock/*` |

### Flow 1: sign-in
```
Browser -> TideCloak realm -> Tide enclave (user types the Tide password there, not in our app)
Browser <- access token (+ "doken", the Tide credential) bound to the browser's DPoP key
```
The token carries `groups`, `tideuserkey` and the realm roles. Every API call is sent with `secureFetch`, which adds a DPoP proof.

### Flow 2: admin grants access (signs a policy)
```
Admin browser  builds a policy: group, record id, read/write, expiry
Admin browser  -> Tide enclave: admin approves with their Tide credential  (this IS the grant)
Admin browser  -> POST /api/policies  (admin only)  -> server stores the signed policy
```
The server cannot create a valid policy on its own: the network checks the signature on every use.

### Flow 3: patient encrypts, then reads back
```
Patient browser  GET /api/policies?record=...&op=write   -> signed policy
Patient browser  doEncrypt(data, tag = record id, policy) -> Tide ORKs run the contract -> ciphertext
Patient browser  POST /api/records  { id, ciphertext }   -> server stores ciphertext only
...
Patient browser  GET /api/records -> ciphertext;  doDecrypt(ciphertext, tag, policy) -> plaintext (in the browser)
```
The contract `RelationshipAttestation:1` checks, on every ORK: the caller is in the policy's **group**, holds the realm **role** (`_tide_encryptor` to write, `_tide_decryptor` to read), the policy permits that operation, and the data has exactly one tag (the record id).

### Flow 4: share with the GP or physio, and revoke
```
Patient  POST /api/share-requests {record, to}     -> request stored as "pending"
Admin    sees the request on /admin, approves      -> Flow 2 with group /p1-care-team, read-only, 24 h expiry
Admin    adds gp1 / physio1 to group /p1-care-team (TideCloak change request, approved in the enclave)
GP       fetches the care-team policy -> doDecrypt -> reads the record
Revoke:  admin deletes the policy (PATCH status = revoked); remove the user from the group
```
Who is in the group decides who passes the contract, so **whoever controls group membership controls access**.

### Flow 5: "admin tries to read"
```
Admin browser  GET /api/admin/raw   -> server returns ciphertext only (no key exists on the server)
Admin browser  GET /api/policies?record=...  -> 404, no policy names the admin
Admin browser  doDecrypt(ciphertext)         -> Tide ORKs refuse
```
On the real realm this is shown with a **self-encrypted note** (written by a user with their own key, `/selftest`), because the group-policy encrypt path is not working yet (see below). The network answers `encrypted data signature failed` for the admin.

## What is real and what is not

Verified on a real Tide realm (local Docker, IGA, multiAdmin, DPoP strict):

- Tide sign-in for `admin`, `patient1`, `gp1`, `physio1`.
- Groups, roles and role changes as change requests approved in the enclave.
- The admin signs relationship policies in the enclave; the server stores them.
- Self-encryption (no policy) works for `gp1`, and the admin is refused when it tries to decrypt `gp1`'s note.

**Not working on the real realm: encrypt/decrypt through a group policy.** The Tide network answers every ORK with:

```
TIDE-TIDEJS-NET-THRESHOLD_FAILURE ... [TIDE-ORK-INTERNAL-UNEXPECTED] Doken signature failed
  at /Authentication/Key/v1/PreSign?vuid=58848829-8e65-4a8b-8a37-ee5941357cad
```

What we found (2026-10-22):

- It happened for `patient1` (group `/p1-owner`, roles `_tide_encryptor` and `_tide_decryptor`), and for `admin` while it temporarily had that same group and roles. Self-encryption also fails for `patient1`, but works for `gp1`, who has neither the group nor `_tide_encryptor` (an earlier self-encryption success was recorded without noting which account). Our reading is that the fault follows the group or the `_tide_encryptor` role in the credential; this is not proven.
- Ruled out: Tide nodes unreachable, wrong clock, wrong adapter file (matches the live realm), stale policy (re-signed), pending change requests, incognito mode, missing roles or group membership.
- We could not resolve it before the deadline. Needs the Tide team.

So the **share, GP read and revoke flows are implemented but were not seen working on the live network.** Part 2 of the demo shows them in mock mode.

### Mock mode (simulated)

```bash
NEXT_PUBLIC_MOCK=1 npm run dev        # PowerShell: $env:NEXT_PUBLIC_MOCK="1"; npm run dev
```

A floating bar switches role (`patient1`, `gp1`, `physio1`, `admin1`). Crypto is fake, state lives in the browser and is lost on a full page reload (menu links reload the page; switch role on the page you are on, and use client navigation to keep state). Mock mode skips the real enclave signing. Never use it as evidence about Tide.

## Real limits of the design

- **Revoking one record is not instant.** A revoked user who kept a policy copy can use it until it expires (24 h for care-team policies). Removing a user from the group takes effect when they next sign in.
- **One admin can approve their own access.** With a single admin there is no quorum. The default quorum (70% of admins, at least 1) needs several admins; we ran with one.
- **Whoever controls group membership controls access.** Those changes are governed (change requests) but the approver is trusted.
- **The policy list is visible.** Policies name the group and the record id in clear.
- **Mock is not proof.** It imitates the contract; it does not run it.
- All data is fake. This is a hackathon demo, not a medical product.

## Run it

```bash
npm install
npm run init                              # TideCloak (Docker), realm, data/tidecloak.json
bash scripts/care-passport-seed.sh        # demo users and groups
npm run dev                               # http://localhost:3000
npm run typecheck && npm test             # type check and API tests
```

Pages: `/patient`, `/gp`, `/physio`, `/admin`, `/admin-attack`, and `/selftest` (diagnostic: self-encryption, no policy).
Only the machine running the realm can sign in to it. Team members use mock mode.

## Repo map

| Path | Purpose |
|---|---|
| `src/lib/tide/relationship.ts` | Policy building and signing, encrypt, decrypt, error helpers |
| `src/lib/care/` | Fake records, file store (`data/care/`, git-ignored) |
| `src/lib/auth/` | JWT and DPoP verification (`withAuth`, `withRole`) |
| `src/app/api/` | `policies`, `records`, `share-requests`, `vault`, `audit-logs`, `admin/raw` |
| `src/lib/mock/` | Mock Tide for demos |
| `docs/API.md` | API reference |
| `TASKS.md`, `HANDOFF.md` | Team split and hand-off notes |
