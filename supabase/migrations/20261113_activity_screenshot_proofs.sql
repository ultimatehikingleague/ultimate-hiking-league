begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-screenshot-proofs', 'activity-screenshot-proofs', false, 8388608,
        array['image/png', 'image/jpeg', 'image/webp']);

create policy activity_screenshot_proofs_no_anon on storage.objects
as restrictive for all to anon
using (bucket_id <> 'activity-screenshot-proofs')
with check (bucket_id <> 'activity-screenshot-proofs');

-- Restrictive policies also narrow any pre-existing permissive grants.
create policy activity_screenshot_proofs_scope on storage.objects
as restrictive for all to authenticated
using (
  bucket_id <> 'activity-screenshot-proofs'
  or (select auth.uid())::text = (storage.foldername(name))[1]
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
)
with check (
  bucket_id <> 'activity-screenshot-proofs'
  or (
    (select auth.uid())::text = (storage.foldername(name))[1]
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-3]\.(png|jpg|webp)$'
  )
);

create policy activity_screenshot_proofs_read on storage.objects for select to authenticated
using (bucket_id = 'activity-screenshot-proofs');

create policy activity_screenshot_proofs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'activity-screenshot-proofs'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-3]\.(png|jpg|webp)$'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- Prevent legacy update/delete policies from mutating accepted originals.
create policy activity_screenshot_proofs_no_update on storage.objects
as restrictive for update to public
using (bucket_id <> 'activity-screenshot-proofs')
with check (bucket_id <> 'activity-screenshot-proofs');

create policy activity_screenshot_proofs_no_delete on storage.objects
as restrictive for delete to public using (bucket_id <> 'activity-screenshot-proofs');

create unique index record_submissions_screenshot_attempt_uidx
on public.record_submissions (proof_image_url)
where proof_image_url like 'activity-screenshot:%';

commit;
