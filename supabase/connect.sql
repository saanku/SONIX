-- Apply in the Sonix project's Supabase SQL editor as its administrator.
-- Does not delete or modify accounts, libraries, or saved music.
begin;
drop policy if exists "Connect account receive" on realtime.messages;
drop policy if exists "Connect account send" on realtime.messages;
create policy "Connect account receive" on realtime.messages
for select to authenticated using (
  realtime.topic() = 'connect:' || (select auth.uid())::text
  and extension in ('broadcast', 'presence')
);
create policy "Connect account send" on realtime.messages
for insert to authenticated with check (
  realtime.topic() = 'connect:' || (select auth.uid())::text
  and extension in ('broadcast', 'presence')
);
-- Prevent unrelated broad policies from opening Connect topics to other accounts.
drop policy if exists "Connect account boundary receive" on realtime.messages;
drop policy if exists "Connect account boundary send" on realtime.messages;
create policy "Connect account boundary receive" on realtime.messages
as restrictive for select to public using (
 realtime.topic() not like 'connect:%' or realtime.topic() = 'connect:' || (select auth.uid())::text
);
create policy "Connect account boundary send" on realtime.messages
as restrictive for insert to public with check (
 realtime.topic() not like 'connect:%' or realtime.topic() = 'connect:' || (select auth.uid())::text
);
commit;
