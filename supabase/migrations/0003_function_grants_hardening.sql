-- FoodBuddy — 0003_function_grants_hardening
-- Postgres grants EXECUTE to PUBLIC by default on new functions, so the
-- targeted "revoke ... from anon" in 0002 was ineffective (anon inherited
-- access via PUBLIC). Flagged by Supabase security advisor 0028/0029.
--
-- Model after this migration:
--   * handle_new_user(): trigger-only — no client role may call it via RPC.
--   * set_updated_at(): trigger-only — same.
--   * is_list_owner / is_list_member / can_edit_list: EXECUTE for
--     `authenticated` ONLY (required — RLS policy expressions evaluate them
--     as the calling role). They return booleans about the caller's own
--     list membership, so authenticated RPC exposure is acceptable.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

revoke execute on function public.is_list_owner(uuid)  from public, anon;
revoke execute on function public.is_list_member(uuid) from public, anon;
revoke execute on function public.can_edit_list(uuid)  from public, anon;

grant execute on function public.is_list_owner(uuid)  to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.can_edit_list(uuid)  to authenticated;
