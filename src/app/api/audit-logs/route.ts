import { withRole } from "@/lib/auth/middleware";
import { audit } from "@/lib/care/store";

// GET /api/audit-logs — Admin only: retrieve the complete governance audit trail
export const GET = withRole("tide-realm-admin", async () => {
  return Response.json({ logs: audit.all() });
});
