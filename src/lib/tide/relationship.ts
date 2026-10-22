// Relationship policies for Care Passport, built on the ORK's built-in contract
// `RelationshipAttestation:1`. Adapted from the Tide pack's relationship.ts so it uses the public
// useTideCloak() hook functions instead of the SDK's private client.
//
// Browser only: every call needs the logged-in user's credential, which lives in the Tide enclave.
// A refusal by the contract arrives as TIDE-TIDEJS-NET-THRESHOLD_FAILURE ("Could not reach enough
// VVK ORKs"). It is not an outage: the contract's message is in the error's `cause`. Do not retry.
import { Models } from "@tideorg/js";
import { PolicySignRequest } from "heimdall-tide";

// Fixed by the contract. Changing any of these makes the network refuse the policy or the request.
export const RELATIONSHIP_CONTRACT_ID = "RelationshipAttestation:1";
export const RELATIONSHIP_MODEL_IDS = ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"];
export const ENCRYPT_ROLE = "_tide_encryptor"; // REALM roles
export const DECRYPT_ROLE = "_tide_decryptor";

export type RelationshipSubject =
  | { type: "User"; id: string }
  | { type: "Group"; id: string } // FULL PATH exactly as the `groups` claim carries it, e.g. "/p1-owner"
  | { type: "Role"; id: string; clientId?: string };

export type RelationshipAccess = "read" | "write" | "read-write";
const ROLES_FOR: Record<RelationshipAccess, string[]> = {
  read: [DECRYPT_ROLE],
  write: [ENCRYPT_ROLE],
  "read-write": [ENCRYPT_ROLE, DECRYPT_ROLE],
};
const SIGN_REQUEST_EXPIRY_SECONDS = 604800;

export interface RelationshipGrant {
  vendorId: string;
  subject: RelationshipSubject;
  /** The record this subject may open. It is also the only tag every item must carry. */
  recordId: string;
  access: RelationshipAccess;
  /** Optional: seconds since the epoch after which the policy stops working. */
  expiry?: number;
}

/** The slice of useTideCloak() this file needs. */
export interface TideCtx {
  initializeTideRequest: <T extends { encode: () => Uint8Array }>(request: T) => Promise<T>;
  approveTideRequests: (
    requests: { id: string; request: Uint8Array }[],
  ) => Promise<{ id: string; approved?: { request: Uint8Array }; denied?: boolean; pending?: boolean }[]>;
  executeTideRequest: (
    request: { encode: () => Uint8Array } | Uint8Array,
    waitForAll?: boolean,
  ) => Promise<Uint8Array[]>;
  doEncrypt: (data: any, decryptionPolicy?: Uint8Array) => Promise<any>;
  doDecrypt: (data: any, decryptionPolicy?: Uint8Array) => Promise<any>;
}

export const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
export const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function buildRelationshipPolicy(grant: RelationshipGrant) {
  const subject = grant.subject;
  if (!subject || !["User", "Group", "Role"].includes(subject.type)) throw new Error('subject.type must be "User", "Group" or "Role"');
  if (!subject.id) throw new Error(`subject.id (the ${subject.type.toLowerCase()}) is required`);
  if (!grant.recordId) throw new Error("recordId is required");
  if (!ROLES_FOR[grant.access]) throw new Error('access must be "read", "write" or "read-write"');
  // The SDK only writes its own latest policy version. Never hard-code it.
  const version = (Models.Policy as unknown as { latestVersion: string }).latestVersion;
  return new Models.Policy({
    version,
    contractId: RELATIONSHIP_CONTRACT_ID,
    modelId: RELATIONSHIP_MODEL_IDS,
    keyId: grant.vendorId,
    approvalType: Models.ApprovalType.IMPLICIT,
    executionType: Models.ExecutionType.PRIVATE,
    // All STRING params. `roles` is JSON written as a string, not an array.
    // The param is named assignmentId whatever kind of record it is.
    params: new Map<string, string>([
      ["subjectType", subject.type],
      ["subjectId", subject.id],
      ...(subject.type === "Role" && subject.clientId ? ([["clientId", subject.clientId]] as [string, string][]) : []),
      ["assignmentId", grant.recordId],
      ["roles", JSON.stringify(ROLES_FOR[grant.access])],
    ]),
    ...(grant.expiry ? { expiry: grant.expiry } : {}),
  } as ConstructorParameters<typeof Models.Policy>[0]);
}

/**
 * Sign a relationship policy. Run in a realm admin's browser: it opens the Tide enclave, where the
 * admin approves. That approval IS the grant. Returns the signed policy as base64.
 *
 * `adminPolicy` is the realm's signed admin policy, fetched with the admin's token from
 * GET {auth-server-url}/admin/realms/{realm}/iga/role-policies/name/tide-realm-admin (field `policy`).
 */
export async function signRelationshipPolicy(ctx: TideCtx, grant: RelationshipGrant, adminPolicy: Uint8Array): Promise<string> {
  const policy = buildRelationshipPolicy(grant);

  // The contract is built into the ORK, so the request carries the policy and nothing else.
  const request = PolicySignRequest.New(policy);
  request.setCustomExpiry(SIGN_REQUEST_EXPIRY_SECONDS);

  const initialised = await ctx.initializeTideRequest(request);
  const encoded = initialised.encode();
  const id = Models.BaseTideRequest.decode(encoded).getUniqueId();

  const [approval] = await ctx.approveTideRequests([{ id, request: encoded }]);
  if (!approval || !approval.approved) {
    throw new Error(`the grant was not approved (${approval?.denied ? "denied" : approval?.pending ? "pending" : "no response"})`);
  }

  // Attach the admin policy to the APPROVED request, as raw bytes.
  const approved = Models.BaseTideRequest.decode(approval.approved.request);
  approved.addPolicy(adminPolicy);

  const signatures = await ctx.executeTideRequest(approved, true);
  if (!signatures?.[0]) throw new Error("the network returned no signature");

  policy.signature = signatures[0];
  return toBase64(policy.toBytes());
}

// The record id is the ONLY tag. A second tag, or a different one, is rejected by the contract.
// Errors from the network are thrown unchanged: show them, do not replace them.
export async function encryptForRecord(ctx: TideCtx, data: string, recordId: string, signedPolicyB64: string): Promise<string> {
  const [out] = await ctx.doEncrypt([{ data, tags: [recordId] }], fromBase64(signedPolicyB64));
  return typeof out === "string" ? out : toBase64(out);
}

export async function decryptForRecord(ctx: TideCtx, encrypted: string, recordId: string, signedPolicyB64: string): Promise<string> {
  const [out] = await ctx.doDecrypt([{ encrypted, tags: [recordId] }], fromBase64(signedPolicyB64));
  return typeof out === "string" ? out : new TextDecoder().decode(out);
}

/** True when the error is the contract (or the network) refusing, not an outage. */
export function isRefusal(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? "")}` : String(e);
  return /THRESHOLD_FAILURE|not found in doken|not found in list of roles|subjectId does not match|Tags do not contain/i.test(msg);
}

export function describeRefusal(e: unknown): string {
  const raw = e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? "")}` : String(e);
  const m = raw.match(/(Tags do not contain[^.]*\.|[^'"\n]*not found in (?:doken|list of roles)[^.\n]*\.?|subjectId does not match[^\n]*)/i);
  return m ? m[0].trim() : raw.slice(0, 240);
}
