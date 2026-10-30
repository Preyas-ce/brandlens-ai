create or replace function public.save_review_record(target_workspace uuid, payload jsonb, importing boolean default false)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_review_id text := payload ->> 'id';
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
  if v_review_id is null or (
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
  where r.workspace_id = target_workspace and r.id = v_review_id
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
    v_review_id, target_workspace, coalesce(payload ->> 'title', ''),
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
  select target_workspace, v_review_id, (revision ->> 'revision')::integer,
    revision ->> 'content', revision ->> 'contentHash',
    coalesce((revision ->> 'score')::integer, 0), revision ->> 'status',
    coalesce(revision -> 'findings', '[]'::jsonb), revision
  from jsonb_array_elements(coalesce(payload -> 'revisionHistory', '[]'::jsonb)) revision
  on conflict (workspace_id, review_id, revision_number) do nothing;

  insert into public.review_revisions(
    workspace_id, review_id, revision_number, content, content_hash, score, status, findings, revision_data
  )
  values (
    target_workspace, v_review_id, coalesce((payload ->> 'revision')::integer, 1),
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
  select target_workspace, v_review_id, event ->> 'status', (event ->> 'at')::timestamptz,
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
    select target_workspace, v_review_id, (decision ->> 'revision')::integer,
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
