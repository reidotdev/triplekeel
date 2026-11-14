import { Webhook } from "svix";
import { type ClerkUserRecord, toUserRow } from "@/src/lib/clerk-user";
import { createSupabaseAdmin } from "@/src/lib/supabase-admin";

type ClerkWebhookEvent = { type: string; data: unknown };

function isClerkUserRecord(data: unknown): data is ClerkUserRecord {
  if (!data || typeof data !== "object") return false;
  const user = data as Partial<ClerkUserRecord>;
  return (
    typeof user.id === "string" &&
    (user.first_name === null || typeof user.first_name === "string") &&
    (user.last_name === null || typeof user.last_name === "string") &&
    typeof user.image_url === "string" &&
    (user.primary_email_address_id === null ||
      typeof user.primary_email_address_id === "string") &&
    Array.isArray(user.email_addresses) &&
    user.email_addresses.every(
      (address) =>
        address &&
        typeof address.id === "string" &&
        typeof address.email_address === "string",
    ) &&
    typeof user.created_at === "number" &&
    typeof user.updated_at === "number"
  );
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret)
    return Response.json(
      { error: "Webhook is not configured" },
      { status: 500 },
    );

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return Response.json(
      { error: "Missing webhook signature headers" },
      { status: 400 },
    );
  }

  let event: ClerkWebhookEvent;
  try {
    const body = await request.text();
    new Webhook(secret).verify(body, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    });
    event = JSON.parse(body) as ClerkWebhookEvent;
  } catch {
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    if (!isClerkUserRecord(event.data)) {
      return Response.json(
        { error: "Invalid Clerk user event" },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("users")
      .upsert(toUserRow(event.data), {
        onConflict: "user_id",
      });
    if (error) {
      console.error("Clerk user sync failed", error.code);
      return Response.json({ error: "Unable to sync user" }, { status: 500 });
    }
  } else if (event.type === "user.deleted") {
    const deletedUser = event.data as { id?: unknown } | null;
    if (!deletedUser || typeof deletedUser.id !== "string") {
      return Response.json(
        { error: "Deleted user event has no id" },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("user_id", deletedUser.id);
    if (error) {
      console.error("Clerk user deletion failed", error.code);
      return Response.json({ error: "Unable to delete user" }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
