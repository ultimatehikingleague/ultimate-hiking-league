-- Apply only to an isolated development database pending production approval.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-originals', 'activity-originals', false, 4194304, array['application/octet-stream'])
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'activity-originals' and public) then
    raise exception 'activity-originals must be private';
  end if;
end;
$$;

-- Restricts this bucket even when a legacy permissive upload policy matches.
-- The server checks the user's session and existing submission RLS before serving originals.
create policy activity_originals_server_only on storage.objects
as restrictive for all to public
using (bucket_id <> 'activity-originals')
with check (bucket_id <> 'activity-originals');

-- Each attempt has a stable reference. Intentional re-submissions get a new attempt ID.
create unique index record_submissions_activity_attempt_uidx
on public.record_submissions (proof_image_url)
where proof_image_url like 'activity-original:%';

commit;
