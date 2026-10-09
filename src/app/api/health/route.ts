import { ok } from "@/lib/http";

export async function GET() {
  return ok({ status: "ok", service: "webwrite-api", time: new Date().toISOString() });
}
