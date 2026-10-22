import { withAuth } from "@/lib/auth/middleware";
import { vault, who } from "@/lib/care/store";

// Ciphertext the caller encrypted for themselves (self-encryption). The server never decrypts it.
export const GET = withAuth(async (_req, jwt) => {
  const mine = vault.all().find((v) => v.owner === who(jwt));
  return Response.json({ ciphertext: mine?.ciphertext ?? null });
});

export const POST = withAuth(async (req, jwt) => {
  let b: { ciphertext?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof b.ciphertext !== "string" || b.ciphertext.length < 20 || b.ciphertext.length > 20000) {
    return Response.json({ error: "Bad ciphertext" }, { status: 400 });
  }
  vault.put(who(jwt), b.ciphertext);
  return Response.json({ success: true }, { status: 201 });
});
