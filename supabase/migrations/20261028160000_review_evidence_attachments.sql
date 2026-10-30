-- Migration: 20261028160000_review_evidence_attachments.sql
-- Description: Adds secure evidence attachment support for reviews and revisions.
-- Includes private storage bucket configuration, tenant-isolated storage policies,
-- attachment metadata table, RLS, and guarded RPC functions.

-- 1. Ensure private storage bucket exists with size and mime-type limits
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-evidence',
  'review-evidence',
  false, -- Strictly private: all file access requires authentication and signed URLs
  10485760, -- 10 MB limit per file
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

-- 2. Helper function to extract and validate workspace UUID from object path
-- Expected storage path convention: <workspace_id>/<review_id>/rev-<revision>/<attachment_id>-<filename>
create or replace function public.storage_workspace_id(object_name text)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  folder_segment text;
begin
  folder_segment := split_part(object_name, '/', 1);
  if folder_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return folder_segment::uuid;
  end if;
  return null;
end;
$$;

-- 3. Storage RLS policies on storage.objects for 'review-evidence'
-- Workspace members can read/download attachments within their workspace only
drop policy if exists "workspace_members_select_evidence_objects" on storage.objects;
create policy "workspace_members_select_evidence_objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'review-evidence'
  and public.is_workspace_member(public.storage_workspace_id(name))
);

-- Upload restricted strictly to workspace_admin and writer (matching review authoring permissions)
drop policy if exists "workspace_members_insert_evidence_objects" on storage.objects;
create policy "workspace_members_insert_evidence_objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'review-evidence'
  and public.has_workspace_role(
    public.storage_workspace_id(name),
    array['workspace_admin', 'writer']::public.workspace_role[]
  )
);

-- Delete restricted strictly to workspace_admin and writer (matching review authoring permissions)
drop policy if exists "workspace_members_delete_evidence_objects" on storage.objects;
create policy "workspace_members_delete_evidence_objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'review-evidence'
  and public.has_workspace_role(
    public.storage_workspace_id(name),
    array['workspace_admin', 'writer']::public.workspace_role[]
  )
);

-- 4. Attachment metadata table
create table if not exists public.review_attachments (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id text not null,
  revision_number integer not null check (revision_number > 0),
  file_name text not null,
  content_type text not null check (content_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  storage_path text not null,
  uploaded_by text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, review_id) references public.reviews(workspace_id, id) on delete cascade
);

create index if not exists review_attachments_workspace_review_revision_idx
  on public.review_attachments (workspace_id, review_id, revision_number);

-- 5. Row Level Security on review_attachments
alter table public.review_attachments enable row level security;

drop policy if exists "members read review attachments" on public.review_attachments;
create policy "members read review attachments"
on public.review_attachments for select to authenticated
using (public.is_workspace_member(workspace_id));

revoke all on public.review_attachments from anon, authenticated;
grant select on public.review_attachments to authenticated;

-- 6. Guarded RPC: add_review_attachment
create or replace function public.add_review_attachment(
  target_workspace uuid,
  target_review_id text,
  p_revision integer,
  p_attachment_id text,
  p_file_name text,
  p_content_type text,
  p_file_size bigint,
  p_storage_path text,
  p_uploader text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_attachment jsonb;
  v_review_exists boolean;
  v_user_id uuid;
  v_derived_uploader text;
  v_now timestamptz := now();
  v_clean_review_id text;
  v_clean_id text;
  v_clean_filename text;
  v_clean_storage_path text;
  v_path_segments text[];
  v_expected_rev_segment text;
begin
  -- 1. Validate required target identifiers
  if target_workspace is null then
    raise exception 'A valid workspace identifier is required.';
  end if;

  v_clean_review_id := trim(coalesce(target_review_id, ''));
  if length(v_clean_review_id) = 0 then
    raise exception 'A valid review identifier is required.';
  end if;

  -- 2. Authorization: Only workspace_admin and writer can attach evidence
  if not public.has_workspace_role(target_workspace, array['workspace_admin', 'writer']::public.workspace_role[]) then
    raise exception 'Permission denied to attach evidence in this workspace.';
  end if;

  -- 3. Validate target review exists within this workspace
  select exists (
    select 1 from public.reviews
    where workspace_id = target_workspace and id = v_clean_review_id
  ) into v_review_exists;

  if not v_review_exists then
    raise exception 'Review % does not exist in this workspace.', v_clean_review_id;
  end if;

  -- 4. Validate revision number is positive
  if p_revision is null or p_revision <= 0 then
    raise exception 'Invalid revision number %.', p_revision;
  end if;

  -- 5. Validate identifiers and filenames are nonempty after trimming
  v_clean_id := trim(coalesce(p_attachment_id, ''));
  if length(v_clean_id) = 0 or length(v_clean_id) > 120 then
    raise exception 'A valid attachment identifier is required.';
  end if;

  v_clean_filename := trim(coalesce(p_file_name, ''));
  if length(v_clean_filename) = 0 or length(v_clean_filename) > 255 then
    raise exception 'A valid attachment file name is required.';
  end if;

  -- 6. Validate MIME type against whitelist
  if p_content_type not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') then
    raise exception 'Unsupported file type %.', p_content_type;
  end if;

  -- 7. Validate file size (10 MB limit)
  if p_file_size is null or p_file_size <= 0 or p_file_size > 10485760 then
    raise exception 'File size % exceeds maximum limit of 10 MB.', p_file_size;
  end if;

  -- 8. Explicitly validate storage path structure and target associations (null-safe)
  v_clean_storage_path := trim(coalesce(p_storage_path, ''));
  if length(v_clean_storage_path) = 0 then
    raise exception 'A valid storage path is required.';
  end if;

  v_path_segments := string_to_array(v_clean_storage_path, '/');
  if array_length(v_path_segments, 1) is distinct from 4 then
    raise exception 'Storage path % is malformed. Expected format: <workspace_id>/<review_id>/rev-<revision>/<attachment_id>-<filename>', v_clean_storage_path;
  end if;

  v_expected_rev_segment := 'rev-' || p_revision::text;

  if public.storage_workspace_id(v_clean_storage_path) is distinct from target_workspace
     or v_path_segments[2] is distinct from v_clean_review_id
     or v_path_segments[3] is distinct from v_expected_rev_segment then
    raise exception 'Storage path % does not match workspace %, review %, or revision %.', v_clean_storage_path, target_workspace, v_clean_review_id, p_revision;
  end if;

  if substr(v_path_segments[4], 1, length(v_clean_id) + 1) is distinct from (v_clean_id || '-') then
    raise exception 'Storage path % does not match attachment id %.', v_clean_storage_path, v_clean_id;
  end if;

  -- 9. Authenticated uploader derivation (do not trust arbitrary client string)
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Authentication is required to attach evidence.';
  end if;

  select coalesce(
    (select username from public.profiles where id = v_user_id),
    (select email from auth.users where id = v_user_id),
    'user_' || substr(replace(v_user_id::text, '-', ''), 1, 12)
  ) into v_derived_uploader;

  -- 10. Insert or update attachment metadata in public.review_attachments
  insert into public.review_attachments (
    id, workspace_id, review_id, revision_number,
    file_name, content_type, file_size, storage_path, uploaded_by, created_at
  )
  values (
    v_clean_id, target_workspace, v_clean_review_id, p_revision,
    v_clean_filename, p_content_type, p_file_size, v_clean_storage_path, v_derived_uploader, v_now
  )
  on conflict (workspace_id, id) do update set
    revision_number = excluded.revision_number,
    file_name = excluded.file_name,
    content_type = excluded.content_type,
    file_size = excluded.file_size,
    storage_path = excluded.storage_path,
    uploaded_by = excluded.uploaded_by;

  v_attachment := jsonb_build_object(
    'id', v_clean_id,
    'workspaceId', target_workspace,
    'reviewId', v_clean_review_id,
    'revision', p_revision,
    'fileName', v_clean_filename,
    'contentType', p_content_type,
    'fileSize', p_file_size,
    'storagePath', v_clean_storage_path,
    'uploadedBy', v_derived_uploader,
    'createdAt', v_now
  );

  -- 11. Update reviews.record_data safely checking jsonb_typeof to prevent scalar errors
  update public.reviews
  set record_data = jsonb_set(
    record_data,
    '{attachments}',
    case
      when jsonb_typeof(record_data -> 'attachments') = 'array' then
        (
          select jsonb_agg(elem)
          from (
            select elem from jsonb_array_elements(record_data -> 'attachments') elem
            where (elem ->> 'id') is distinct from v_clean_id
            union all
            select v_attachment
          ) s
        )
      else jsonb_build_array(v_attachment)
    end
  ),
  updated_at = now()
  where workspace_id = target_workspace and id = v_clean_review_id;

  return v_attachment;
end;
$$;

-- 7. Guarded RPC: delete_review_attachment
create or replace function public.delete_review_attachment(
  target_workspace uuid,
  target_review_id text,
  p_attachment_id text
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_exists boolean;
  v_clean_review_id text;
  v_clean_id text;
begin
  -- 1. Validate required target identifiers
  if target_workspace is null then
    raise exception 'A valid workspace identifier is required.';
  end if;

  v_clean_review_id := trim(coalesce(target_review_id, ''));
  if length(v_clean_review_id) = 0 then
    raise exception 'A valid review identifier is required.';
  end if;

  v_clean_id := trim(coalesce(p_attachment_id, ''));
  if length(v_clean_id) = 0 then
    raise exception 'A valid attachment identifier is required.';
  end if;

  -- 2. Authorization: Only workspace_admin and writer can delete attachments
  if not public.has_workspace_role(target_workspace, array['workspace_admin', 'writer']::public.workspace_role[]) then
    raise exception 'Permission denied to delete evidence attachment in this workspace.';
  end if;

  -- 3. Verify attachment exists on this review and workspace
  select exists (
    select 1 from public.review_attachments
    where workspace_id = target_workspace and review_id = v_clean_review_id and id = v_clean_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Attachment % not found on review % in this workspace.', v_clean_id, v_clean_review_id;
  end if;

  -- 4. Delete from public.review_attachments
  delete from public.review_attachments
  where workspace_id = target_workspace and id = v_clean_id and review_id = v_clean_review_id;

  -- 5. Update reviews.record_data safely checking jsonb_typeof and null-safe id comparison
  update public.reviews
  set record_data = jsonb_set(
    record_data,
    '{attachments}',
    case
      when jsonb_typeof(record_data -> 'attachments') = 'array' then
        coalesce(
          (
            select jsonb_agg(elem)
            from jsonb_array_elements(record_data -> 'attachments') elem
            where (elem ->> 'id') is distinct from v_clean_id
          ),
          '[]'::jsonb
        )
      else '[]'::jsonb
    end
  ),
  updated_at = now()
  where workspace_id = target_workspace and id = v_clean_review_id;

  return true;
end;
$$;

-- 8. Execution grants
revoke all on function public.storage_workspace_id(text) from public, anon;
revoke all on function public.add_review_attachment(uuid, text, integer, text, text, text, bigint, text, text) from public, anon;
revoke all on function public.delete_review_attachment(uuid, text, text) from public, anon;

grant execute on function public.storage_workspace_id(text) to authenticated;
grant execute on function public.add_review_attachment(uuid, text, integer, text, text, text, bigint, text, text) to authenticated;
grant execute on function public.delete_review_attachment(uuid, text, text) to authenticated;
