import { handle, ok } from "@/lib/http";

// Tokens are stateless, so logout is client-side (drop the token). Kept as an
// endpoint so the frontend has a single place to call and we can add a token
// denylist later without changing clients.
export async function POST() {
  return handle(async () => ok({ success: true }));
}
