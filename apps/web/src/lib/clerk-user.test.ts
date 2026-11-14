import { describe, expect, it } from "vitest";
import { toUserRow } from "./clerk-user";

describe("toUserRow", () => {
  it("uses the primary email and Clerk profile timestamps", () => {
    expect(
      toUserRow({
        id: "user_123",
        first_name: "Ada",
        last_name: "Lovelace",
        image_url: "https://images.example/ada.png",
        primary_email_address_id: "email_2",
        email_addresses: [
          { id: "email_1", email_address: "old@example.com" },
          { id: "email_2", email_address: "ada@example.com" },
        ],
        created_at: 1_700_000_000_000,
        updated_at: 1_700_000_100_000,
      }),
    ).toEqual({
      user_id: "user_123",
      email: "ada@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      image_url: "https://images.example/ada.png",
      clerk_created_at: "2023-11-14T22:13:20.000Z",
      clerk_updated_at: "2023-11-14T22:15:00.000Z",
    });
  });

  it("falls back to the first email when Clerk has no primary address", () => {
    expect(
      toUserRow({
        id: "user_456",
        first_name: null,
        last_name: null,
        image_url: "",
        primary_email_address_id: null,
        email_addresses: [
          { id: "email_1", email_address: "first@example.com" },
        ],
        created_at: 0,
        updated_at: 0,
      }).email,
    ).toBe("first@example.com");
  });
});
