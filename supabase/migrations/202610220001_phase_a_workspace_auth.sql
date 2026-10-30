create extension if not exists pgcrypto with schema extensions;

create type public.workspace_role as enum ('workspace_admin', 'writer', 'reviewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  settings jsonb not null,
  analysis_config_hash text not null default '',
  config_version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table public.guidelines (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.evidence_records (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.reviews (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  status text not null,
  current_revision integer not null check (current_revision > 0),
  current_content_hash text not null,
  analysis_content_hash text not null default '',
  analysis_config_hash text not null default '',
  analysis_config_version bigint not null default 1,
  record_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.review_revisions (
  workspace_id uuid not null,
  review_id text not null,
  revision_number integer not null check (revision_number > 0),
  content text not null,
  content_hash text not null,
  score integer not null check (score between 0 and 100),
  status text not null,
  findings jsonb not null default '[]'::jsonb,
  revision_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, review_id, revision_number),
  foreign key (workspace_id, review_id) references public.reviews(workspace_id, id) on delete cascade
);

create table public.review_status_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  review_id text not null,
  status text not null,
  event_at timestamptz not null,
  actor text not null,
  event_data jsonb not null,
  foreign key (workspace_id, review_id) references public.reviews(workspace_id, id) on delete cascade,
  unique (workspace_id, review_id, event_at, status)
);

create table public.review_decisions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  review_id text not null,
  revision_number integer not null,
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  reviewer_user_id uuid references auth.users(id),
  reviewer_name text not null,
  comment text not null default '',
  content_hash text not null,
  content text not null,
  decided_at timestamptz not null,
  decision_data jsonb not null,
  foreign key (workspace_id, review_id, revision_number)
    references public.review_revisions(workspace_id, review_id, revision_number) on delete cascade
);

create table public.workspace_audit_events (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_at timestamptz not null,
  record_data jsonb not null,
  primary key (workspace_id, id)
);

create table public.workspace_imports (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id text not null,
  imported_by uuid not null references auth.users(id),
  imported_at timestamptz not null default now(),
  imported_records integer not null default 0,
  primary key (workspace_id, source_id)
);

create index reviews_workspace_status_idx on public.reviews(workspace_id, status);
create index review_events_workspace_time_idx on public.review_status_events(workspace_id, event_at desc);
create index audit_workspace_time_idx on public.workspace_audit_events(workspace_id, event_at desc);

create function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = (select auth.uid())
  );
$$;

create function public.has_workspace_role(target_workspace uuid, allowed_roles public.workspace_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

create function public.bootstrap_workspace(p_workspace_name text default 'BrandLens Workspace')
returns table (workspace_id uuid, workspace_name text, member_role public.workspace_role)
language plpgsql security definer
set search_path = ''
as $$
declare
  chosen public.workspaces%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  select w.* into chosen
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = auth.uid()
  order by w.created_at
  limit 1;

  if chosen.id is null then
    insert into public.workspaces(name)
    values (coalesce(nullif(trim(p_workspace_name), ''), 'BrandLens Workspace'))
    returning * into chosen;
    insert into public.workspace_members(workspace_id, user_id, role)
    values (chosen.id, auth.uid(), 'workspace_admin');
  end if;

  return query
  select chosen.id, chosen.name, m.role
  from public.workspace_members m
  where m.workspace_id = chosen.id and m.user_id = auth.uid();
end;
$$;

create function public.delete_review_records(target_workspace uuid, review_ids text[])
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.has_workspace_role(
    target_workspace,
    array['workspace_admin', 'writer']::public.workspace_role[]
  ) then
    raise exception 'Writer or workspace-admin access is required.';
  end if;

  if not public.has_workspace_role(
    target_workspace,
    array['workspace_admin']::public.workspace_role[]
  ) and exists (
    select 1
    from public.reviews r
    where r.workspace_id = target_workspace
      and r.id = any(coalesce(review_ids, array[]::text[]))
      and nullif(r.record_data ->> 'demoScenarioId', '') is null
  ) then
    raise exception 'Writers can delete only marked demo review records.';
  end if;

  delete from public.reviews
  where workspace_id = target_workspace
    and id = any(coalesce(review_ids, array[]::text[]));
end;
$$;

create function public.assign_workspace_member(
  target_workspace uuid,
  member_email text,
  chosen_role public.workspace_role
)
returns table (user_id uuid, member_role public.workspace_role)
language plpgsql security definer
set search_path = ''
as $$
declare
  target_user uuid;
begin
  if not public.has_workspace_role(target_workspace, array['workspace_admin']::public.workspace_role[]) then
    raise exception 'Workspace-admin access is required to manage members.';
  end if;
  select u.id into target_user
  from auth.users u
  where lower(u.email) = lower(trim(member_email))
    and u.email_confirmed_at is not null
  limit 1;
  if target_user is null then
    raise exception 'No account was found for that email. The member must sign up first.';
  end if;
  insert into public.workspace_members(workspace_id, user_id, role)
  values (target_workspace, target_user, chosen_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;
  return query select target_user, chosen_role;
end;
$$;

create function public.save_review_record(target_workspace uuid, payload jsonb, importing boolean default false)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  review_id text := payload ->> 'id';
  existing jsonb;
  current_config_version bigint;
  item jsonb;
  prior_count integer;
  revision_count integer;
  history_index integer;
begin
  if not public.has_workspace_role(target_workspace, array['workspace_admin', 'writer']::public.workspace_role[]) then
    raise exception 'Writer or workspace-admin access is required.';
  end if;
  if importing and current_setting('brandlens.import_mode', true) is distinct from 'on' then
    raise exception 'Historical record import must use the explicit workspace import operation.';
  end if;
  if review_id is null or (
    not importing and payload ->> 'status' not in ('draft', 'awaiting_human_verification')
  ) then
    raise exception 'Only a saved draft or analysed review can be persisted through this operation.';
  end if;
  if not importing and payload ->> 'status' = 'awaiting_human_verification'
     and coalesce((select s.analysis_config_hash from public.workspace_settings s where s.workspace_id = target_workspace), '') is distinct from coalesce(payload ->> 'analysisConfigHash', '') then
    raise exception 'Workspace rules or evidence changed after analysis. Re-analyse before submitting.';
  end if;

  select r.record_data into existing
  from public.reviews r
  where r.workspace_id = target_workspace and r.id = review_id
  for update;

  if existing is not null then
    if coalesce(existing -> 'decisionHistory', '[]'::jsonb) <> coalesce(payload -> 'decisionHistory', '[]'::jsonb)
       or coalesce(existing -> 'approvedRevision', 'null'::jsonb) <> coalesce(payload -> 'approvedRevision', 'null'::jsonb)
       or coalesce(existing -> 'approvedContentHash', 'null'::jsonb) <> coalesce(payload -> 'approvedContentHash', 'null'::jsonb) then
      raise exception 'Review decisions and approvals can only be changed through the reviewer decision operation.';
    end if;
    prior_count := jsonb_array_length(coalesce(existing -> 'statusHistory', '[]'::jsonb));
    if jsonb_array_length(coalesce(payload -> 'statusHistory', '[]'::jsonb)) < prior_count then
      raise exception 'Review status history cannot be removed.';
    end if;
    for history_index in 0..prior_count - 1
    loop
      if payload -> 'statusHistory' -> history_index is distinct from existing -> 'statusHistory' -> history_index then
        raise exception 'Existing review status history cannot be changed.';
      end if;
    end loop;
    revision_count := jsonb_array_length(coalesce(existing -> 'revisionHistory', '[]'::jsonb));
    if jsonb_array_length(coalesce(payload -> 'revisionHistory', '[]'::jsonb)) < revision_count then
      raise exception 'Review revision history cannot be removed.';
    end if;
    for history_index in 0..revision_count - 1
    loop
      if payload -> 'revisionHistory' -> history_index is distinct from existing -> 'revisionHistory' -> history_index then
        raise exception 'Existing review revision snapshots cannot be changed.';
      end if;
    end loop;
  elsif not importing and jsonb_array_length(coalesce(payload -> 'decisionHistory', '[]'::jsonb)) > 0 then
    raise exception 'A new review cannot include prior reviewer decisions.';
  end if;
  if existing is not null and (
    coalesce(existing -> 'signedBy', 'null'::jsonb) <> coalesce(payload -> 'signedBy', 'null'::jsonb)
    or coalesce(existing -> 'signedNote', 'null'::jsonb) <> coalesce(payload -> 'signedNote', 'null'::jsonb)
    or coalesce(existing -> 'verifiedAt', 'null'::jsonb) <> coalesce(payload -> 'verifiedAt', 'null'::jsonb)
  ) then
    raise exception 'Reviewer signature metadata can only be changed through the reviewer decision operation.';
  end if;
  if existing is null and not importing and (
    payload ? 'approvedRevision' or payload ? 'approvedContentHash'
    or payload ? 'signedBy' or payload ? 'verifiedAt'
  ) then
    raise exception 'A new review cannot be created with a prior human approval.';
  end if;
  if existing is not null and not importing and (
    (existing ->> 'status' in ('awaiting_human_verification', 'draft') and payload ->> 'status' not in ('draft', 'awaiting_human_verification'))
    or (existing ->> 'status' in ('approved', 'changes_requested') and payload ->> 'status' <> 'draft')
    or existing ->> 'status' = 'rejected'
  ) then
    raise exception 'The requested review status transition is not allowed.';
  end if;

  select coalesce(s.config_version, 1) into current_config_version
  from public.workspace_settings s where s.workspace_id = target_workspace;
  current_config_version := coalesce(current_config_version, 1);

  insert into public.reviews(
    id, workspace_id, title, status, current_revision, current_content_hash,
    analysis_content_hash, analysis_config_hash, analysis_config_version, record_data
  )
  values (
    review_id, target_workspace, coalesce(payload ->> 'title', ''),
    payload ->> 'status', coalesce((payload ->> 'revision')::integer, 1),
    coalesce(payload ->> 'contentHash', ''), coalesce(payload ->> 'analysisContentHash', ''),
    coalesce(payload ->> 'analysisConfigHash', ''), current_config_version, payload
  )
  on conflict (workspace_id, id) do update set
    title = excluded.title,
    status = excluded.status,
    current_revision = excluded.current_revision,
    current_content_hash = excluded.current_content_hash,
    analysis_content_hash = excluded.analysis_content_hash,
    analysis_config_hash = excluded.analysis_config_hash,
    analysis_config_version = case
      when excluded.status = 'awaiting_human_verification' then current_config_version
      else public.reviews.analysis_config_version
    end,
    record_data = excluded.record_data,
    updated_at = now();
  insert into public.review_revisions(
    workspace_id, review_id, revision_number, content, content_hash, score, status, findings, revision_data
  )
  select target_workspace, review_id, (revision ->> 'revision')::integer,
    revision ->> 'content', revision ->> 'contentHash',
    coalesce((revision ->> 'score')::integer, 0), revision ->> 'status',
    coalesce(revision -> 'findings', '[]'::jsonb), revision
  from jsonb_array_elements(coalesce(payload -> 'revisionHistory', '[]'::jsonb)) revision
  on conflict (workspace_id, review_id, revision_number) do nothing;

  insert into public.review_revisions(
    workspace_id, review_id, revision_number, content, content_hash, score, status, findings, revision_data
  )
  values (
    target_workspace, review_id, coalesce((payload ->> 'revision')::integer, 1),
    coalesce(payload ->> 'currentContent', ''), coalesce(payload ->> 'contentHash', ''),
    coalesce((payload ->> 'score')::integer, 0), payload ->> 'status',
    coalesce(payload -> 'findings', '[]'::jsonb), payload
  )
  on conflict (workspace_id, review_id, revision_number) do update set
    content = excluded.content,
    content_hash = excluded.content_hash,
    score = excluded.score,
    status = excluded.status,
    findings = excluded.findings,
    revision_data = excluded.revision_data;

  insert into public.review_status_events(workspace_id, review_id, status, event_at, actor, event_data)
  select target_workspace, review_id, event ->> 'status', (event ->> 'at')::timestamptz,
    coalesce(event ->> 'actor', ''), event
  from jsonb_array_elements(coalesce(payload -> 'statusHistory', '[]'::jsonb)) event
  on conflict (workspace_id, review_id, event_at, status) do nothing;
  if not importing and jsonb_array_length(coalesce(payload -> 'statusHistory', '[]'::jsonb)) > 0 then
    if payload ->> 'status' is distinct from payload -> 'statusHistory' -> (jsonb_array_length(payload -> 'statusHistory') - 1) ->> 'status' then
      raise exception 'Review status must match the latest status history event.';
    end if;
    prior_count := case when existing is null then 0 else jsonb_array_length(coalesce(existing -> 'statusHistory', '[]'::jsonb)) end;
    for history_index in prior_count..jsonb_array_length(payload -> 'statusHistory') - 1
    loop
      if payload -> 'statusHistory' -> history_index ->> 'status' in ('approved', 'changes_requested', 'rejected') then
        raise exception 'Reviewer decisions cannot be added through a writer operation.';
      end if;
    end loop;
  end if;

  if importing then
    insert into public.review_decisions(
      workspace_id, review_id, revision_number, decision, reviewer_user_id, reviewer_name,
      comment, content_hash, content, decided_at, decision_data
    )
    select target_workspace, review_id, (decision ->> 'revision')::integer,
      case when decision ->> 'decision' = 'revision_requested' then 'changes_requested' else decision ->> 'decision' end,
      null, coalesce(decision ->> 'reviewer', 'Previous reviewer'),
      coalesce(decision ->> 'comment', ''), coalesce(decision ->> 'contentHash', ''),
      coalesce(decision ->> 'content', ''), coalesce((decision ->> 'decidedAt')::timestamptz, now()), decision
    from jsonb_array_elements(coalesce(payload -> 'decisionHistory', '[]'::jsonb)) decision
    on conflict do nothing;
  end if;

  return payload;
end;
$$;

create function public.decide_review_record(
  target_workspace uuid,
  target_review_id text,
  chosen_decision text,
  reviewer_name text,
  reviewer_comment text,
  reviewed_content_hash text,
  suggested_draft text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  current_record jsonb;
  current_config_version bigint;
  current_revision integer;
  current_content text;
  event_at timestamptz := now();
  decision_event jsonb;
  status_event jsonb;
  updated_record jsonb;
begin
  if not public.has_workspace_role(target_workspace, array['workspace_admin', 'reviewer']::public.workspace_role[]) then
    raise exception 'Reviewer or workspace-admin access is required.';
  end if;
  if chosen_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Unsupported review decision.';
  end if;
  if chosen_decision <> 'approved' and length(trim(coalesce(reviewer_comment, ''))) = 0 then
    raise exception 'A reviewer comment is required for this decision.';
  end if;

  select r.record_data, r.analysis_config_version, r.current_revision, r.record_data ->> 'currentContent'
  into current_record, current_config_version, current_revision, current_content
  from public.reviews r
  where r.workspace_id = target_workspace and r.id = target_review_id
  for update;
  if current_record is null then raise exception 'Review not found.'; end if;
  if current_record ->> 'status' <> 'awaiting_human_verification' then
    raise exception 'This review is not awaiting a human decision.';
  end if;
    if nullif(trim(coalesce(reviewed_content_hash, '')), '') is null
     or (current_record ->> 'contentHash') is distinct from reviewed_content_hash
     or (current_record ->> 'analysisContentHash') is distinct from reviewed_content_hash then
    raise exception 'The reviewed content differs from the analysed revision.';
  end if;
  if current_config_version <> coalesce((select s.config_version from public.workspace_settings s where s.workspace_id = target_workspace), 1)
     or current_record ->> 'analysisConfigHash' is distinct from coalesce((
       select s.analysis_config_hash from public.workspace_settings s where s.workspace_id = target_workspace
     ), '') then
    raise exception 'Workspace rules or evidence changed. Re-analyse before deciding.';
  end if;
  if reviewer_name is null or length(trim(reviewer_name)) = 0 then
    raise exception 'A reviewer name is required.';
  end if;

  decision_event := jsonb_build_object(
    'decision', chosen_decision, 'reviewer', trim(reviewer_name),
    'comment', trim(coalesce(reviewer_comment, '')), 'decidedAt', event_at,
    'revision', current_revision, 'contentHash', reviewed_content_hash, 'content', current_content
  );
  if chosen_decision = 'changes_requested' and nullif(trim(suggested_draft), '') is not null then
    decision_event := decision_event || jsonb_build_object('suggestedDraft', trim(suggested_draft));
    current_record := jsonb_set(current_record, '{suggestedContent}', to_jsonb(trim(suggested_draft)));
  end if;
  status_event := jsonb_build_object(
    'status', chosen_decision, 'at', event_at, 'actor', trim(reviewer_name),
    'revision', current_revision, 'note', trim(coalesce(reviewer_comment, ''))
  );
  updated_record := jsonb_set(
    jsonb_set(
      jsonb_set(current_record, '{status}', to_jsonb(chosen_decision)),
      '{statusHistory}', coalesce(current_record -> 'statusHistory', '[]'::jsonb) || jsonb_build_array(status_event)
    ),
    '{decisionHistory}', coalesce(current_record -> 'decisionHistory', '[]'::jsonb) || jsonb_build_array(decision_event)
  );
  updated_record := updated_record || jsonb_build_object(
    'signedBy', trim(reviewer_name), 'signedNote', trim(coalesce(reviewer_comment, '')), 'verifiedAt', event_at
  );
  if chosen_decision = 'approved' then
    updated_record := updated_record || jsonb_build_object(
      'approvedRevision', current_revision, 'approvedContentHash', reviewed_content_hash
    );
  end if;

  update public.reviews set status = chosen_decision, record_data = updated_record, updated_at = now()
  where workspace_id = target_workspace and id = target_review_id;
  insert into public.review_status_events(workspace_id, review_id, status, event_at, actor, event_data)
  values (target_workspace, target_review_id, chosen_decision, event_at, trim(reviewer_name), status_event);
  insert into public.review_decisions(
    workspace_id, review_id, revision_number, decision, reviewer_user_id, reviewer_name,
    comment, content_hash, content, decided_at, decision_data
  ) values (
    target_workspace, target_review_id, current_revision, chosen_decision, auth.uid(),
    trim(reviewer_name), trim(coalesce(reviewer_comment, '')), reviewed_content_hash,
    current_content, event_at, decision_event
  );
  return updated_record;
end;
$$;

create function public.save_workspace_data(target_workspace uuid, payload jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  item jsonb;
begin
  if not public.has_workspace_role(target_workspace, array['workspace_admin', 'writer']::public.workspace_role[]) then
    raise exception 'Writer or workspace-admin access is required.';
  end if;
    if not public.has_workspace_role(target_workspace, array['workspace_admin']::public.workspace_role[]) then
    raise exception 'Workspace-admin access is required to change workspace settings, guidelines, and evidence.';
  end if;
  insert into public.workspace_settings(workspace_id, settings, analysis_config_hash)
  values (target_workspace, coalesce(payload -> 'settings', '{}'::jsonb), coalesce(payload ->> 'analysisConfigHash', ''))
  on conflict (workspace_id) do update set
    settings = excluded.settings,
    analysis_config_hash = excluded.analysis_config_hash,
    config_version = public.workspace_settings.config_version + 1,
    updated_at = now();
  if public.has_workspace_role(target_workspace, array['workspace_admin']::public.workspace_role[]) then
    update public.workspaces
    set name = coalesce(nullif(trim(payload -> 'settings' ->> 'workspaceName'), ''), name)
    where id = target_workspace;
  end if;

  for item in select value from jsonb_array_elements(coalesce(payload -> 'guidelines', '[]'::jsonb))
  loop
    insert into public.guidelines(workspace_id, id, record_data)
    values (target_workspace, item ->> 'id', item)
    on conflict (workspace_id, id) do update set record_data = excluded.record_data, updated_at = now();
  end loop;
  delete from public.guidelines g
  where g.workspace_id = target_workspace
    and not exists (
      select 1 from jsonb_array_elements(coalesce(payload -> 'guidelines', '[]'::jsonb)) input
      where input ->> 'id' = g.id
    );
  for item in select value from jsonb_array_elements(coalesce(payload -> 'evidence', '[]'::jsonb))
  loop
    insert into public.evidence_records(workspace_id, id, record_data)
    values (target_workspace, item ->> 'id', item)
    on conflict (workspace_id, id) do update set record_data = excluded.record_data, updated_at = now();
  end loop;
  delete from public.evidence_records e
  where e.workspace_id = target_workspace
    and not exists (
      select 1 from jsonb_array_elements(coalesce(payload -> 'evidence', '[]'::jsonb)) input
      where input ->> 'id' = e.id
    );
  for item in select value from jsonb_array_elements(coalesce(payload -> 'auditEvents', '[]'::jsonb))
  loop
    insert into public.workspace_audit_events(workspace_id, id, event_at, record_data)
    values (target_workspace, item ->> 'id', (item ->> 'timestamp')::timestamptz, item)
    on conflict (workspace_id, id) do nothing;
  end loop;
end;
$$;

create function public.import_local_workspace_data(target_workspace uuid, source text, payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  item jsonb;
  record_item jsonb;
  imported_decisions jsonb;
  imported_status_event jsonb;
  has_legacy_decisions boolean;
  imported_count integer := 0;
begin
    if not public.has_workspace_role(target_workspace, array['workspace_admin']::public.workspace_role[]) then
    raise exception 'Workspace-admin access is required to import local workspace data.';
  end if;
  if source is null or length(source) = 0 then raise exception 'Import source identifier is required.'; end if;

  insert into public.workspace_imports(workspace_id, source_id, imported_by)
  values (target_workspace, source, auth.uid())
  on conflict do nothing;
  if not found then
    return jsonb_build_object('alreadyImported', true, 'importedRecords', 0);
  end if;
  perform set_config('brandlens.import_mode', 'on', true);

  insert into public.workspace_settings(workspace_id, settings, analysis_config_hash)
  select target_workspace, coalesce(payload -> 'workspace' -> 'settings', '{}'::jsonb),
    coalesce(payload ->> 'analysisConfigHash', '')
  where payload -> 'workspace' is not null
  on conflict (workspace_id) do nothing;
  update public.workspaces
  set name = coalesce(nullif(trim(payload -> 'workspace' -> 'settings' ->> 'workspaceName'), ''), name)
  where id = target_workspace and payload -> 'workspace' -> 'settings' is not null;
  for item in select value from jsonb_array_elements(coalesce(payload -> 'workspace' -> 'guidelines', '[]'::jsonb))
  loop
    insert into public.guidelines(workspace_id, id, record_data)
    values (target_workspace, item ->> 'id', item) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(payload -> 'workspace' -> 'evidence', '[]'::jsonb))
  loop
    insert into public.evidence_records(workspace_id, id, record_data)
    values (target_workspace, item ->> 'id', item) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(payload -> 'workspace' -> 'auditEvents', '[]'::jsonb))
  loop
    insert into public.workspace_audit_events(workspace_id, id, event_at, record_data)
    values (target_workspace, item ->> 'id', (item ->> 'timestamp')::timestamptz, item) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(payload -> 'records', '[]'::jsonb))
  loop
    if not exists (select 1 from public.reviews r where r.workspace_id = target_workspace and r.id = item ->> 'id') then
      record_item := item;
      has_legacy_decisions := jsonb_array_length(coalesce(item -> 'decisionHistory', '[]'::jsonb)) > 0
        or item ->> 'status' in ('approved', 'changes_requested', 'rejected');
      select coalesce(jsonb_agg(decision || jsonb_build_object('legacyLocalUnverified', true)), '[]'::jsonb)
      into imported_decisions
      from jsonb_array_elements(coalesce(item -> 'decisionHistory', '[]'::jsonb)) decision;
      imported_status_event := jsonb_build_object(
        'status', 'draft', 'at', now(), 'actor', 'Local data import',
        'revision', coalesce((record_item ->> 'revision')::integer, 1),
        'note', case when has_legacy_decisions
          then 'Prior local decision retained as unverified history; re-analysis and a new human decision are required.'
          else 'Imported analysis is not treated as a cloud review; re-analyse before human verification.'
        end
      );
      record_item := (record_item - 'signedBy' - 'signedNote' - 'verifiedAt' - 'approvedRevision' - 'approvedContentHash')
        || jsonb_build_object(
          'status', 'draft',
          'analysisContentHash', '',
          'analysisConfigHash', '',
          'legacyImportNeedsAnalysis', true,
          'legacyApprovalUntrusted', has_legacy_decisions
        );
      record_item := jsonb_set(record_item, '{statusHistory}', coalesce(record_item -> 'statusHistory', '[]'::jsonb) || jsonb_build_array(imported_status_event));
      item := jsonb_set(record_item, '{decisionHistory}', imported_decisions);
      perform public.save_review_record(target_workspace, item, true);
      imported_count := imported_count + 1;
    end if;
  end loop;

  update public.workspace_imports set imported_records = imported_count
  where workspace_id = target_workspace and source_id = source;
  return jsonb_build_object('alreadyImported', false, 'importedRecords', imported_count);
end;
$$;

create function public.delete_review_record(
  target_workspace uuid,
  target_review_id text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.has_workspace_role(
    target_workspace,
    array['workspace_admin', 'writer']::public.workspace_role[]
  ) then
    raise exception 'Writer or workspace-admin access is required.';
  end if;

  if not public.has_workspace_role(
    target_workspace,
    array['workspace_admin']::public.workspace_role[]
  ) and exists (
    select 1
    from public.reviews r
    where r.workspace_id = target_workspace
      and r.id = target_review_id
      and nullif(r.record_data ->> 'demoScenarioId', '') is null
  ) then
    raise exception 'Writers can delete only marked demo review records.';
  end if;

  delete from public.reviews
  where workspace_id = target_workspace
    and id = target_review_id;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.guidelines enable row level security;
alter table public.evidence_records enable row level security;
alter table public.reviews enable row level security;
alter table public.review_revisions enable row level security;
alter table public.review_status_events enable row level security;
alter table public.review_decisions enable row level security;
alter table public.workspace_audit_events enable row level security;
alter table public.workspace_imports enable row level security;

create policy "members read their workspaces" on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy "members read workspace memberships" on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace settings" on public.workspace_settings
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace guidelines" on public.guidelines
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace evidence" on public.evidence_records
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace reviews" on public.reviews
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace revisions" on public.review_revisions
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace review events" on public.review_status_events
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace decisions" on public.review_decisions
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read workspace audit events" on public.workspace_audit_events
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "admins read workspace import markers" on public.workspace_imports
for select to authenticated using (public.has_workspace_role(workspace_id, array['workspace_admin']::public.workspace_role[]));

revoke all on public.workspaces, public.workspace_members, public.workspace_settings,
  public.guidelines, public.evidence_records, public.reviews, public.review_revisions,
  public.review_status_events, public.review_decisions, public.workspace_audit_events,
  public.workspace_imports from anon, authenticated;
grant select on public.workspaces, public.workspace_members, public.workspace_settings,
  public.guidelines, public.evidence_records, public.reviews, public.review_revisions,
  public.review_status_events, public.review_decisions, public.workspace_audit_events,
  public.workspace_imports to authenticated;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.has_workspace_role(uuid, public.workspace_role[]) from public, anon;
revoke all on function public.bootstrap_workspace(text) from public, anon;
revoke all on function public.save_review_record(uuid, jsonb, boolean) from public, anon;
revoke all on function public.decide_review_record(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.save_workspace_data(uuid, jsonb) from public, anon;
revoke all on function public.import_local_workspace_data(uuid, text, jsonb) from public, anon;
revoke all on function public.delete_review_record(uuid, text) from public, anon;
revoke all on function public.delete_review_records(uuid, text[]) from public, anon;
revoke all on function public.assign_workspace_member(uuid, text, public.workspace_role) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;
grant execute on function public.bootstrap_workspace(text) to authenticated;
grant execute on function public.save_review_record(uuid, jsonb, boolean) to authenticated;
grant execute on function public.decide_review_record(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.save_workspace_data(uuid, jsonb) to authenticated;
grant execute on function public.import_local_workspace_data(uuid, text, jsonb) to authenticated;
grant execute on function public.delete_review_record(uuid, text) to authenticated;
grant execute on function public.delete_review_records(uuid, text[]) to authenticated;
grant execute on function public.assign_workspace_member(uuid, text, public.workspace_role) to authenticated;
