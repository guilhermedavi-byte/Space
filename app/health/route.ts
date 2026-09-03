import { isServerEnvironmentConfigured } from "@/lib/env/server";

export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", service: "space-sales-intelligence", environment: isServerEnvironmentConfigured() ? "configured" : "missing_variables", timestamp: new Date().toISOString() }, { status: 200 });
}
