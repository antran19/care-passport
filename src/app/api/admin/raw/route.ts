import { withRole } from "@/lib/auth/middleware";
import { records, audit, who } from "@/lib/care/store";
import { RECORDS } from "@/lib/care/data";

// What a server operator (or realm admin) can see: ciphertext only. Used by the "admin tries to read"
// demo. There is no key here, and no route in this app decrypts on the server.
export const GET = withRole("tide-realm-admin", async (_req, jwt) => {
  audit.log({
    actor: who(jwt),
    action: "ADMIN_RAW_READ",
    recordId: "*",
    details: "Admin inspected database raw ciphertexts",
  });
  return Response.json({
    records: RECORDS.map((r) => ({ id: r.id, title: r.title, ciphertext: records.get(r.id)?.ciphertext ?? null })),
  });
});

