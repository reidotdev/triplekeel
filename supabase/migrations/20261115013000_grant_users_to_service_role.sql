-- The Clerk webhook (/api/webhooks/clerk) writes public.users with the
-- service-role key (ADR-0006). The production project does not expose new
-- tables automatically, so service_role had no privileges on users and every
-- user.created event failed with "Unable to sync user".
--
-- Grant service_role exactly what the webhook needs: upsert on user.created
-- and user.updated, and delete on user.deleted. Revoke first, so the result is
-- the same locally (where default privileges apply) and in production.

revoke all on public.users from service_role;
grant select, insert, update, delete on public.users to service_role;
