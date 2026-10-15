import { supabasePublic } from "../../supabase/public-env";
import { userIdFromAuthorization } from "../../supabase/user";

/** When Supabase is configured, the model routes require a real signed-in user. */
export async function aiGuard(request: Request): Promise<Response | null> {
  if (!supabasePublic()) return null;
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return null;
}
