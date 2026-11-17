-- Public read policies (announcements, plans, features, packs, app_settings) call
-- private.is_admin(). Signed-out visitors (anon) need to reach it, otherwise those reads
-- fail with 401. Without a session it simply returns false. Other private functions stay
-- closed to anon.
grant usage on schema private to anon;
grant execute on function private.is_admin() to anon;
