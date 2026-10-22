import { withAuth } from "@/lib/auth/middleware";
import { hasRole } from "@/lib/auth/tideJWT";
import { shares, policiesFor, ADMIN_ROLE, who } from "@/lib/care/store";
import { recordById } from "@/lib/care/data";

// GET: admin sees all requests; everyone else sees only their own.
export const GET = withAuth(async (_req, jwt) => {
  const all = shares.all();
  return Response.json({ requests: hasRole(jwt, ADMIN_ROLE) ? all : all.filter((s) => s.requestedBy === who(jwt)) });
});

// POST { recordId, to }: the patient asks to share a record. Needs a write policy on it (= its owner).
export const POST = withAuth(async (req, jwt) => {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!b || typeof b !== "object") return Response.json({ error: "Invalid payload" }, { status: 400 });
  if (!recordById(b.recordId)) return Response.json({ error: "Unknown record" }, { status: 400 });
  if (!["gp", "physio", "care-team"].includes(b.to)) return Response.json({ error: "Bad recipient" }, { status: 400 });
  if (policiesFor(jwt, b.recordId, "write").length === 0) return Response.json({ error: "Forbidden: write policy required" }, { status: 403 });
  return Response.json({ request: shares.add({ recordId: b.recordId, requestedBy: who(jwt), to: b.to }) }, { status: 201 });
});

// PATCH { id, status }: admin only.
export const PATCH = withAuth(async (req, jwt) => {
  if (!hasRole(jwt, ADMIN_ROLE)) return Response.json({ error: "Forbidden" }, { status: 403 });
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!b || typeof b !== "object") return Response.json({ error: "Invalid payload" }, { status: 400 });
  if (!["approved", "rejected", "revoked"].includes(b.status)) return Response.json({ error: "Bad status" }, { status: 400 });
  const updated = shares.update(String(b.id), { status: b.status, resolvedBy: who(jwt) }, who(jwt));
  return updated ? Response.json({ request: updated }) : Response.json({ error: "Not found" }, { status: 404 });
});

