export type ClerkUserRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  primary_email_address_id: string | null;
  email_addresses: Array<{ id: string; email_address: string }>;
  created_at: number;
  updated_at: number;
};

export type UserRow = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  clerk_created_at: string;
  clerk_updated_at: string;
};

export function toUserRow(user: ClerkUserRecord): UserRow {
  const primaryEmail = user.email_addresses.find(
    (address) => address.id === user.primary_email_address_id,
  );

  return {
    user_id: user.id,
    email:
      primaryEmail?.email_address ??
      user.email_addresses[0]?.email_address ??
      null,
    first_name: user.first_name,
    last_name: user.last_name,
    image_url: user.image_url,
    clerk_created_at: new Date(user.created_at).toISOString(),
    clerk_updated_at: new Date(user.updated_at).toISOString(),
  };
}
