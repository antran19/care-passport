import { withAuth } from "@/lib/auth/middleware";
import { hasRole } from "@/lib/auth/tideJWT";
import { policies, policiesFor, ADMIN_ROLE, who } from "@/lib/care/store";
import { recordById, OWNER_GROUP, CARE_GROUP } from "@/lib/care/data";

// GET /api/policies?record=<id>&op=read|write  -> the caller's applicable signed policy (or 404)
// GET /api/policies?all=1                       -> admin only: every stored policy (metadata)
export const GET = withAuth(async (req, jwt) => {
  const url = new URL(req.url);
  if (url.searchParams.get("all") === "1") {
    if (!hasRole(jwt, ADMIN_ROLE)) return Response.json({ error: "Forbidden" }, { status: 403 });
    return Response.json({ policies: policies.all().map(({ policy: _p, ...meta }) => meta) });
  }
  const recordId = url.searchParams.get("record") ?? "";
  const op = url.searchParams.get("op") === "write" ? "write" : "read";
  if (!recordById(recordId)) return Response.json({ error: "Unknown record" }, { status: 404 });
  const found = policiesFor(jwt, recordId, op)[0];
  if (!found) return Response.json({ error: "No policy grants you access to this record" }, { status: 404 });
  return Response.json({ policy: found.policy, access: found.access });
});

// POST /api/policies  (admin only) body: { subjectType, subjectId, recordId, access, policy }
// The network verifies the signature on every use; the server only checks who may store it
// and that the request names a subject and record this app knows about.
export const POST = withAuth(async (req, jwt) => {
  if (!hasRole(jwt, ADMIN_ROLE)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  const okSubject = b.subjectType === "Group" && [OWNER_GROUP, CARE_GROUP].includes(b.subjectId);
  if (!okSubject) return Response.json({ error: "Unsupported subject" }, { status: 400 });
  if (!recordById(b.recordId)) return Response.json({ error: "Unknown record" }, { status: 400 });
  if (!["read", "write", "read-write"].includes(b.access)) return Response.json({ error: "Bad access" }, { status: 400 });
  if (typeof b.policy !== "string" || b.policy.length < 20) return Response.json({ error: "Missing policy" }, { status: 400 });
  const saved = policies.add({
    subjectType: "Group",
    subjectId: b.subjectId,
    recordId: b.recordId,
    access: b.access,
    policy: b.policy,
    grantedBy: who(jwt),
  });
  return Response.json({ id: saved.id }, { status: 201 });
});

// DELETE /api/policies?id=<id>  (admin only). Stops the app handing the policy out. It is NOT a
// guarantee on its own: remove the user from the group as well (see the README).
export const DELETE = withAuth(async (req, jwt) => {
  if (!hasRole(jwt, ADMIN_ROLE)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return policies.remove(id) ? Response.json({ success: true }) : Response.json({ error: "Not found" }, { status: 404 });
});
