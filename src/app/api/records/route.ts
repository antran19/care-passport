import { withAuth } from "@/lib/auth/middleware";
import { records, policiesFor, who } from "@/lib/care/store";
import { RECORDS, recordById } from "@/lib/care/data";

// GET /api/records -> only the records the caller holds a policy for, with ciphertext.
export const GET = withAuth(async (_req, jwt) => {
  const out = RECORDS.filter(
    (r) => policiesFor(jwt, r.id, "read").length > 0 || policiesFor(jwt, r.id, "write").length > 0,
  ).map((r) => {
    const canWrite = policiesFor(jwt, r.id, "write").length > 0;
    return {
      id: r.id,
      title: r.title,
      sample: canWrite ? r.sample : undefined,
      ciphertext: records.get(r.id)?.ciphertext ?? null,
      canWrite,
    };
  });
  return Response.json({ records: out });
});

// POST /api/records  body: { id, ciphertext }  -> store ciphertext (needs a write policy)
export const POST = withAuth(async (req, jwt) => {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!b || typeof b !== "object") return Response.json({ error: "Invalid payload" }, { status: 400 });
  if (!recordById(b.id)) return Response.json({ error: "Unknown record" }, { status: 400 });
  if (policiesFor(jwt, b.id, "write").length === 0) return Response.json({ error: "Forbidden: write policy required" }, { status: 403 });
  if (typeof b.ciphertext !== "string" || !b.ciphertext.trim()) return Response.json({ error: "Missing or invalid ciphertext" }, { status: 400 });
  if (b.ciphertext.length > 500000) return Response.json({ error: "Ciphertext exceeds max size" }, { status: 413 });
  records.put({ id: b.id, ciphertext: b.ciphertext, updatedBy: who(jwt) });
  return Response.json({ success: true }, { status: 201 });
});

