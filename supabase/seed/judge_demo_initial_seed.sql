-- ==============================================================================
-- BRANDLENS AI — PERMANENT JUDGE DEMO WORKSPACE INITIAL SEED SCRIPT
-- Target Workspace: 2ca5874e-4711-4354-8b81-873847edbd55
-- ==============================================================================

begin;

do $$
declare
  v_ws uuid := '2ca5874e-4711-4354-8b81-873847edbd55'::uuid;
  v_demo_ids text[] := array['DOC-DEMO-NEEDS-REVIEW', 'DOC-DEMO-EVIDENCE-REVIEW', 'DOC-DEMO-CLEAN-APPROVAL'];
  v_base_time timestamptz := '2026-10-30T00:00:00.000Z'::timestamptz;
  v_config_hash text := 'fnv1a-60a065f7';
  v_config_version bigint := 1;

  v_hash_needs_review text := 'fnv1a-014f3bd2';
  v_hash_evidence_review text := 'fnv1a-0f9dfe37';
  v_hash_clean_approval text := 'fnv1a-5c473dda';

  v_canonical_settings jsonb := jsonb_build_object(
    'workspaceName', 'BrandLens Judge Evaluation Workspace',
    'language', 'en',
    'strictness', 'standard',
    'notificationEmail', '',
    'autoScanUploads', false,
    'requireEvidenceApproval', true,
    'customGuidelinesPrompt', ''
  );

  v_g101 jsonb := '{"id":"R-101","title":"Support superlatives with evidence","description":"Comparative or absolute praise needs a named, approved source or a concrete capability.","category":"Brand voice and tone","ruleType":"guidance","phrases":["best in class","world leading","industry leading","revolutionary","unmatched","unprecedented","number one"],"approvedPhrase":"","severity":"moderate","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g102 jsonb := '{"id":"R-102","title":"Use the approved BrandLens AI wordmark","description":"Use the exact approved product name “BrandLens AI”.","category":"Approved and prohibited terminology","ruleType":"approved_terminology","phrases":["brandlens","brand lens","BrandLens"],"approvedPhrase":"BrandLens AI","severity":"moderate","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g103 jsonb := '{"id":"R-103","title":"Qualify guarantees and quantified claims","description":"Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.","category":"Approved factual claims and promotional statements","ruleType":"claim_evidence","phrases":["guarantee","guaranteed","guarantees","promise","promises","always","never fail","zero risk","no downtime","uptime"],"approvedPhrase":"","severity":"critical","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g104 jsonb := '{"id":"R-104","title":"Avoid disallowed corporate jargon","description":"Prefer direct editorial language to the disallowed terms listed here.","category":"Approved and prohibited terminology","ruleType":"prohibited_term","phrases":["synergy","synergies","boil the ocean","low-hanging fruit"],"approvedPhrase":"","severity":"minor","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g105 jsonb := '{"id":"R-105","title":"Verify time-sensitive statements","description":"Current, latest, or dated statements need an applicable source with a review date.","category":"Approved factual claims and promotional statements","ruleType":"guidance","phrases":["current","currently","latest","as of","today’s","this year’s"],"approvedPhrase":"","severity":"moderate","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g106 jsonb := '{"id":"R-106","title":"Use clear, accessible calls to action","description":"Link labels should describe their destination; extended all-caps text can reduce readability.","category":"Accessibility guidelines","ruleType":"guidance","phrases":["click here","read more","learn more"],"approvedPhrase":"","severity":"minor","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g107 jsonb := '{"id":"R-107","title":"Protect the editorial color palette","description":"Visual materials should respect the Warm Ivory and Obsidian palette with restrained copper and forest accents.","category":"Visual identity guidance","ruleType":"guidance","phrases":[],"approvedPhrase":"","severity":"minor","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g108 jsonb := '{"id":"R-108","title":"Lead with clear, human-centered messaging","description":"Explain the benefit plainly and retain human accountability for final publication decisions.","category":"Messaging principles","ruleType":"guidance","phrases":[],"approvedPhrase":"","severity":"minor","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_g109 jsonb := '{"id":"R-109","title":"Follow general brand governance","description":"Content must remain accurate, attributable, and subject to the human verification gate.","category":"General brand rules","ruleType":"guidance","phrases":[],"approvedPhrase":"","severity":"moderate","isActive":true,"createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;

  v_evd102 jsonb := '{"id":"EVD-R102","title":"BrandLens AI wordmark reference (pending verification)","description":"Workspace wording reference for product name spelling; pending verification.","sourceName":"Seeded workspace terminology directive","sourceUrl":"","associatedClaim":"Brand name spelling","guidelineId":"R-102","verificationStatus":"unverified","lastReviewedAt":"","reviewDueAt":"","createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
  v_evd103 jsonb := '{"id":"EVD-R103","title":"Availability wording sample","description":"An internal demo phrase; it is not an independent SLA or performance record.","sourceName":"Seeded workspace wording example","sourceUrl":"","associatedClaim":"99.99% availability target","guidelineId":"R-103","verificationStatus":"unverified","lastReviewedAt":"","reviewDueAt":"","createdAt":"2026-10-30T00:00:00.000Z","updatedAt":"2026-10-30T00:00:00.000Z"}'::jsonb;
begin
  -- 1. Acquire transaction-scoped advisory lock on workspace UUID
  perform pg_advisory_xact_lock(hashtextextended(v_ws::text, 0));

  -- 2. Verify workspace existence and acquire row lock
  perform 1 from public.workspaces where id = v_ws for update;
  if not found then
    raise exception 'Initial seed precondition failed: target workspace % does not exist.', v_ws;
  end if;

  -- 3. Lock any existing review rows and abort if demo reviews already exist
  perform 1 from public.reviews where workspace_id = v_ws and id = any(v_demo_ids) for update;
  if found then
    raise exception 'Initial seed precondition failed: workspace % already contains demonstration review records. Run restoration SQL instead.', v_ws;
  end if;

  -- 4. Validate or insert workspace_settings
  if exists (select 1 from public.workspace_settings where workspace_id = v_ws) then
    perform 1 from public.workspace_settings where workspace_id = v_ws for update;
    if exists (
      select 1 from public.workspace_settings
      where workspace_id = v_ws
        and (
          settings is distinct from v_canonical_settings
          or analysis_config_hash is distinct from v_config_hash
          or config_version is distinct from v_config_version
        )
    ) then
      raise exception 'Initial seed precondition failed: workspace_settings exists with non-canonical values (hash: %, version: %). Aborting to protect existing configuration.', v_config_hash, v_config_version;
    end if;
  else
    insert into public.workspace_settings (workspace_id, settings, analysis_config_hash, config_version, updated_at)
    values (v_ws, v_canonical_settings, v_config_hash, v_config_version, v_base_time);
  end if;

  -- 5. Validate existing guidelines (locking rows, aborting on non-canonical IDs or altered data)
  perform 1 from public.guidelines where workspace_id = v_ws for update;
  if exists (
    select 1 from public.guidelines
    where workspace_id = v_ws
      and id not in ('R-101', 'R-102', 'R-103', 'R-104', 'R-105', 'R-106', 'R-107', 'R-108', 'R-109')
  ) then
    raise exception 'Initial seed precondition failed: unexpected custom guidelines found in workspace %. Aborting.', v_ws;
  end if;

  if exists (
    select 1 from public.guidelines g
    where g.workspace_id = v_ws
      and (
        (g.id = 'R-101' and g.record_data is distinct from v_g101) or
        (g.id = 'R-102' and g.record_data is distinct from v_g102) or
        (g.id = 'R-103' and g.record_data is distinct from v_g103) or
        (g.id = 'R-104' and g.record_data is distinct from v_g104) or
        (g.id = 'R-105' and g.record_data is distinct from v_g105) or
        (g.id = 'R-106' and g.record_data is distinct from v_g106) or
        (g.id = 'R-107' and g.record_data is distinct from v_g107) or
        (g.id = 'R-108' and g.record_data is distinct from v_g108) or
        (g.id = 'R-109' and g.record_data is distinct from v_g109)
      )
  ) then
    raise exception 'Initial seed precondition failed: altered canonical guideline data found in workspace %. Aborting.', v_ws;
  end if;

  -- Insert missing guidelines directly
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-101') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-101', v_g101, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-102') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-102', v_g102, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-103') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-103', v_g103, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-104') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-104', v_g104, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-105') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-105', v_g105, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-106') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-106', v_g106, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-107') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-107', v_g107, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-108') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-108', v_g108, v_base_time);
  end if;
  if not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-109') then
    insert into public.guidelines (workspace_id, id, record_data, updated_at) values (v_ws, 'R-109', v_g109, v_base_time);
  end if;

  -- 6. Validate existing evidence records
  perform 1 from public.evidence_records where workspace_id = v_ws for update;
  if exists (
    select 1 from public.evidence_records
    where workspace_id = v_ws
      and id not in ('EVD-R102', 'EVD-R103')
  ) then
    raise exception 'Initial seed precondition failed: unexpected custom evidence records found in workspace %. Aborting.', v_ws;
  end if;

  if exists (
    select 1 from public.evidence_records e
    where e.workspace_id = v_ws
      and (
        (e.id = 'EVD-R102' and e.record_data is distinct from v_evd102) or
        (e.id = 'EVD-R103' and e.record_data is distinct from v_evd103)
      )
  ) then
    raise exception 'Initial seed precondition failed: altered canonical evidence data found in workspace %. Aborting.', v_ws;
  end if;

  -- Insert missing evidence records directly
  if not exists (select 1 from public.evidence_records where workspace_id = v_ws and id = 'EVD-R102') then
    insert into public.evidence_records (workspace_id, id, record_data, updated_at) values (v_ws, 'EVD-R102', v_evd102, v_base_time);
  end if;
  if not exists (select 1 from public.evidence_records where workspace_id = v_ws and id = 'EVD-R103') then
    insert into public.evidence_records (workspace_id, id, record_data, updated_at) values (v_ws, 'EVD-R103', v_evd103, v_base_time);
  end if;

  -- 7. Post-Insertion Configuration Assertions (Exact ID sets and JSON contents)
  if not exists (
    select 1 from public.workspace_settings
    where workspace_id = v_ws
      and settings is not distinct from v_canonical_settings
      and analysis_config_hash is not distinct from v_config_hash
      and config_version is not distinct from v_config_version
  ) then
    raise exception 'Post-assertion failed: workspace_settings does not strictly match canonical configuration.';
  end if;

  if (select count(*) from public.guidelines where workspace_id = v_ws) <> 9
     or exists (select 1 from public.guidelines where workspace_id = v_ws and id not in ('R-101', 'R-102', 'R-103', 'R-104', 'R-105', 'R-106', 'R-107', 'R-108', 'R-109'))
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-101' and record_data is not distinct from v_g101)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-102' and record_data is not distinct from v_g102)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-103' and record_data is not distinct from v_g103)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-104' and record_data is not distinct from v_g104)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-105' and record_data is not distinct from v_g105)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-106' and record_data is not distinct from v_g106)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-107' and record_data is not distinct from v_g107)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-108' and record_data is not distinct from v_g108)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-109' and record_data is not distinct from v_g109) then
    raise exception 'Post-assertion failed: guidelines do not strictly match the 9 canonical records.';
  end if;

  if (select count(*) from public.evidence_records where workspace_id = v_ws) <> 2
     or exists (select 1 from public.evidence_records where workspace_id = v_ws and id not in ('EVD-R102', 'EVD-R103'))
     or not exists (select 1 from public.evidence_records where workspace_id = v_ws and id = 'EVD-R102' and record_data is not distinct from v_evd102)
     or not exists (select 1 from public.evidence_records where workspace_id = v_ws and id = 'EVD-R103' and record_data is not distinct from v_evd103) then
    raise exception 'Post-assertion failed: evidence records do not strictly match canonical baseline.';
  end if;

  -- 8. Seed Demonstration Review Records
  -- 8.1 DOC-DEMO-NEEDS-REVIEW
  insert into public.reviews (
    id, workspace_id, title, status, current_revision, current_content_hash,
    analysis_content_hash, analysis_config_hash, analysis_config_version, record_data, updated_at
  ) values (
    'DOC-DEMO-NEEDS-REVIEW',
    v_ws,
    'Demo · Launch claim review',
    'awaiting_human_verification',
    1,
    v_hash_needs_review,
    v_hash_needs_review,
    v_config_hash,
    v_config_version,
    jsonb_build_object(
      'id', 'DOC-DEMO-NEEDS-REVIEW',
      'demoScenarioId', 'needs-review',
      'title', 'Demo · Launch claim review',
      'contentType', 'Advertisement',
      'campaign', 'Demo campaign · Product launch',
      'author', 'BrandLens Demo Writer',
      'submittedAt', '2026-10-30T09:00:00.000Z',
      'currentContent', 'Our revolutionary platform guarantees 35% higher productivity with perfect cross-team synergy across every Brandlens project.',
      'originalContent', 'Our revolutionary platform guarantees 35% higher productivity with perfect cross-team synergy across every Brandlens project.',
      'suggestedContent', 'Our platform helps teams achieve measurable productivity gains with coordinated workflows across BrandLens AI projects.',
      'score', 36,
      'status', 'awaiting_human_verification',
      'aiSummary', '5 findings: 2 critical, 2 moderate, and 1 minor. Unsupported claims without applicable verified evidence are Unverified, not false.',
      'revision', 1,
      'contentHash', v_hash_needs_review,
      'analysisContentHash', v_hash_needs_review,
      'analysisConfigHash', v_config_hash,
      'analysisConfigVersion', v_config_version,
      'findings', jsonb_build_array(
        jsonb_build_object('id', 'R-101-4-13-Qualify or remove unsupported wording', 'ruleId', 'R-101', 'ruleTitle', 'Support superlatives with evidence', 'category', 'Voice & Claims', 'severity', 'moderate', 'quote', 'revolutionary', 'startIndex', 4, 'endIndex', 17, 'reason', 'This comparative or absolute claim is not supported by applicable verified evidence in the local catalogue. The wording is Unverified, not established as false.', 'evidenceReference', 'R-101 — local guideline', 'evidenceStatus', 'rule-only', 'suggestion', '', 'suggestionLabel', 'Qualify or remove unsupported wording', 'guidelineSnapshot', jsonb_build_object('id', 'R-101', 'title', 'Support superlatives with evidence', 'description', 'Comparative or absolute praise needs a named, approved source or a concrete capability.', 'category', 'Brand voice and tone')),
        jsonb_build_object('id', 'R-103-27-10-Qualify or remove unsupported wording', 'ruleId', 'R-103', 'ruleTitle', 'Qualify guarantees and quantified claims', 'category', 'Evidence', 'severity', 'critical', 'quote', 'guarantees', 'startIndex', 27, 'endIndex', 37, 'reason', 'This guarantee or absolute claim has no applicable verified evidence in the local catalogue, so it is Unverified.', 'evidenceReference', null, 'evidenceStatus', 'unverified', 'suggestion', '', 'suggestionLabel', 'Qualify or remove unsupported wording', 'guidelineSnapshot', jsonb_build_object('id', 'R-103', 'title', 'Qualify guarantees and quantified claims', 'description', 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.', 'category', 'Approved factual claims and promotional statements')),
        jsonb_build_object('id', 'R-103-38-3-Add a source or remove the figure', 'ruleId', 'R-103', 'ruleTitle', 'Qualify guarantees and quantified claims', 'category', 'Evidence', 'severity', 'critical', 'quote', '35%', 'startIndex', 38, 'endIndex', 41, 'reason', 'A percentage needs approved, current evidence matching this specific figure and context. No applicable verified source is available, so this figure is Unverified.', 'evidenceReference', null, 'evidenceStatus', 'unverified', 'suggestion', '', 'suggestionLabel', 'Add a source or remove the figure', 'guidelineSnapshot', jsonb_build_object('id', 'R-103', 'title', 'Qualify guarantees and quantified claims', 'description', 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.', 'category', 'Approved factual claims and promotional statements')),
        jsonb_build_object('id', 'R-104-86-7-Replace disallowed jargon', 'ruleId', 'R-104', 'ruleTitle', 'Avoid disallowed corporate jargon', 'category', 'Terminology', 'severity', 'minor', 'quote', 'synergy', 'startIndex', 86, 'endIndex', 93, 'reason', '“synergy” appears in the configured disallowed terminology list.', 'evidenceReference', 'R-104 — local guideline', 'evidenceStatus', 'rule-only', 'suggestion', '', 'suggestionLabel', 'Replace disallowed jargon', 'guidelineSnapshot', jsonb_build_object('id', 'R-104', 'title', 'Avoid disallowed corporate jargon', 'description', 'Prefer direct editorial language to the disallowed terms listed here.', 'category', 'Approved and prohibited terminology')),
        jsonb_build_object('id', 'R-102-107-9-Apply approved wordmark', 'ruleId', 'R-102', 'ruleTitle', 'Use the approved BrandLens AI wordmark', 'category', 'Terminology', 'severity', 'moderate', 'quote', 'Brandlens', 'startIndex', 107, 'endIndex', 116, 'reason', 'This spelling differs from the approved “BrandLens AI” wordmark in the local terminology directive.', 'evidenceReference', 'R-102 — local guideline', 'evidenceStatus', 'rule-only', 'suggestion', 'BrandLens AI', 'suggestionLabel', 'Apply approved wordmark', 'guidelineSnapshot', jsonb_build_object('id', 'R-102', 'title', 'Use the approved BrandLens AI wordmark', 'description', 'Use the exact approved product name “BrandLens AI”.', 'category', 'Approved and prohibited terminology'))
      ),
      'statusHistory', jsonb_build_array(
        jsonb_build_object('status', 'submitted', 'at', '2026-10-30T09:00:00.000Z', 'actor', 'System Demo Engine', 'revision', 1, 'note', 'Document submitted for editorial intelligence scan.'),
        jsonb_build_object('status', 'analysis_complete', 'at', '2026-10-30T09:01:00.000Z', 'actor', 'Deterministic Engine', 'revision', 1, 'note', 'Completed deterministic analysis across 9 active guidelines.'),
        jsonb_build_object('status', 'issues_found', 'at', '2026-10-30T09:01:30.000Z', 'actor', 'Deterministic Engine', 'revision', 1, 'note', 'Flagged 5 findings: 2 critical, 2 moderate, 1 minor.'),
        jsonb_build_object('status', 'awaiting_human_verification', 'at', '2026-10-30T09:02:00.000Z', 'actor', 'Workflow Router', 'revision', 1, 'note', 'Transferred to Human Verification Gate.')
      ),
      'revisionHistory', '[]'::jsonb,
      'decisionHistory', '[]'::jsonb
    ),
    '2026-10-30T09:02:00.000Z'::timestamptz
  );

  -- 8.2 DOC-DEMO-EVIDENCE-REVIEW
  insert into public.reviews (
    id, workspace_id, title, status, current_revision, current_content_hash,
    analysis_content_hash, analysis_config_hash, analysis_config_version, record_data, updated_at
  ) values (
    'DOC-DEMO-EVIDENCE-REVIEW',
    v_ws,
    'Demo · Evidence verification',
    'awaiting_human_verification',
    1,
    v_hash_evidence_review,
    v_hash_evidence_review,
    v_config_hash,
    v_config_version,
    jsonb_build_object(
      'id', 'DOC-DEMO-EVIDENCE-REVIEW',
      'demoScenarioId', 'evidence-review',
      'title', 'Demo · Evidence verification',
      'contentType', 'Landing page',
      'campaign', 'Demo campaign · Evidence review',
      'author', 'BrandLens Demo Writer',
      'submittedAt', '2026-10-30T09:05:00.000Z',
      'currentContent', 'BrandLens AI guarantees 99.99% availability and delivers 35% higher productivity across distributed enterprise workflows.',
      'originalContent', 'BrandLens AI guarantees 99.99% availability and delivers 35% higher productivity across distributed enterprise workflows.',
      'suggestedContent', 'BrandLens AI targets high availability and helps distributed enterprise teams improve workflow coordination.',
      'score', 40,
      'status', 'awaiting_human_verification',
      'aiSummary', '3 findings: 3 critical, 0 moderate, and 0 minor. Unsupported claims without applicable verified evidence are Unverified, not false.',
      'revision', 1,
      'contentHash', v_hash_evidence_review,
      'analysisContentHash', v_hash_evidence_review,
      'analysisConfigHash', v_config_hash,
      'analysisConfigVersion', v_config_version,
      'findings', jsonb_build_array(
        jsonb_build_object('id', 'R-103-13-10-Qualify or remove unsupported wording', 'ruleId', 'R-103', 'ruleTitle', 'Qualify guarantees and quantified claims', 'category', 'Evidence', 'severity', 'critical', 'quote', 'guarantees', 'startIndex', 13, 'endIndex', 23, 'reason', 'This guarantee or absolute claim has no applicable verified evidence in the local catalogue, so it is Unverified.', 'evidenceReference', null, 'evidenceStatus', 'unverified', 'suggestion', '', 'suggestionLabel', 'Qualify or remove unsupported wording', 'guidelineSnapshot', jsonb_build_object('id', 'R-103', 'title', 'Qualify guarantees and quantified claims', 'description', 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.', 'category', 'Approved factual claims and promotional statements')),
        jsonb_build_object(
          'id', 'R-103-24-6-Add a source or remove the figure',
          'ruleId', 'R-103',
          'ruleTitle', 'Qualify guarantees and quantified claims',
          'category', 'Evidence',
          'severity', 'critical',
          'quote', '99.99%',
          'startIndex', 24,
          'endIndex', 30,
          'reason', 'A relevant catalogue entry exists (EVD-R103) but is unverified; the figure remains Unverified.',
          'evidenceReference', 'EVD-R103 — Availability wording sample',
          'evidenceStatus', 'unverified',
          'suggestion', '',
          'suggestionLabel', 'Check against cited source',
          'guidelineSnapshot', jsonb_build_object('id', 'R-103', 'title', 'Qualify guarantees and quantified claims', 'description', 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.', 'category', 'Approved factual claims and promotional statements'),
          'evidenceSnapshot', jsonb_build_object(
            'id', 'EVD-R103',
            'title', 'Availability wording sample',
            'sourceName', 'Seeded workspace wording example',
            'sourceUrl', '',
            'associatedClaim', '99.99% availability target',
            'verificationStatus', 'unverified',
            'lastReviewedAt', '',
            'reviewDueAt', ''
          )
        ),
        jsonb_build_object('id', 'R-103-57-3-Add a source or remove the figure', 'ruleId', 'R-103', 'ruleTitle', 'Qualify guarantees and quantified claims', 'category', 'Evidence', 'severity', 'critical', 'quote', '35%', 'startIndex', 57, 'endIndex', 60, 'reason', 'A percentage needs approved, current evidence matching this specific figure and context. No applicable verified source is available, so this figure is Unverified.', 'evidenceReference', null, 'evidenceStatus', 'unverified', 'suggestion', '', 'suggestionLabel', 'Add a source or remove the figure', 'guidelineSnapshot', jsonb_build_object('id', 'R-103', 'title', 'Qualify guarantees and quantified claims', 'description', 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.', 'category', 'Approved factual claims and promotional statements'))
      ),
      'statusHistory', jsonb_build_array(
        jsonb_build_object('status', 'submitted', 'at', '2026-10-30T09:05:00.000Z', 'actor', 'System Demo Engine', 'revision', 1, 'note', 'Document submitted for evidence verification check.'),
        jsonb_build_object('status', 'analysis_complete', 'at', '2026-10-30T09:06:00.000Z', 'actor', 'Deterministic Engine', 'revision', 1, 'note', 'Completed evidence alignment check.'),
        jsonb_build_object('status', 'issues_found', 'at', '2026-10-30T09:06:30.000Z', 'actor', 'Deterministic Engine', 'revision', 1, 'note', 'Flagged 3 critical unverified claims.'),
        jsonb_build_object('status', 'awaiting_human_verification', 'at', '2026-10-30T09:07:00.000Z', 'actor', 'Workflow Router', 'revision', 1, 'note', 'Requires human sign-off on unverified claims.')
      ),
      'revisionHistory', '[]'::jsonb,
      'decisionHistory', '[]'::jsonb
    ),
    '2026-10-30T09:07:00.000Z'::timestamptz
  );

  -- 8.3 DOC-DEMO-CLEAN-APPROVAL
  insert into public.reviews (
    id, workspace_id, title, status, current_revision, current_content_hash,
    analysis_content_hash, analysis_config_hash, analysis_config_version, record_data, updated_at
  ) values (
    'DOC-DEMO-CLEAN-APPROVAL',
    v_ws,
    'Demo · Clean launch statement',
    'awaiting_human_verification',
    1,
    v_hash_clean_approval,
    v_hash_clean_approval,
    v_config_hash,
    v_config_version,
    jsonb_build_object(
      'id', 'DOC-DEMO-CLEAN-APPROVAL',
      'demoScenarioId', 'clean-approval',
      'title', 'Demo · Clean launch statement',
      'contentType', 'Email',
      'campaign', 'Demo campaign · Editorial governance',
      'author', 'BrandLens Demo Writer',
      'submittedAt', '2026-10-30T09:10:00.000Z',
      'currentContent', 'BrandLens AI helps editorial and marketing teams review draft copy against approved guidelines before publication.',
      'originalContent', 'BrandLens AI helps editorial and marketing teams review draft copy against approved guidelines before publication.',
      'suggestedContent', '',
      'score', 100,
      'status', 'awaiting_human_verification',
      'aiSummary', 'No configured active local rules matched this draft. This heuristic result is not a guarantee of compliance or factual accuracy.',
      'revision', 1,
      'contentHash', v_hash_clean_approval,
      'analysisContentHash', v_hash_clean_approval,
      'analysisConfigHash', v_config_hash,
      'analysisConfigVersion', v_config_version,
      'findings', '[]'::jsonb,
      'statusHistory', jsonb_build_array(
        jsonb_build_object('status', 'submitted', 'at', '2026-10-30T09:10:00.000Z', 'actor', 'System Demo Engine', 'revision', 1, 'note', 'Document submitted for baseline brand check.'),
        jsonb_build_object('status', 'analysis_complete', 'at', '2026-10-30T09:10:45.000Z', 'actor', 'Deterministic Engine', 'revision', 1, 'note', 'Completed deterministic check.'),
        jsonb_build_object('status', 'validation_complete', 'at', '2026-10-30T09:10:55.000Z', 'actor', 'Deterministic Engine', 'revision', 1, 'note', 'Zero violations detected (100% compliance). disposition: ready for verification.'),
        jsonb_build_object('status', 'awaiting_human_verification', 'at', '2026-10-30T09:11:00.000Z', 'actor', 'Workflow Router', 'revision', 1, 'note', 'Awaiting human verification sign-off.')
      ),
      'revisionHistory', '[]'::jsonb,
      'decisionHistory', '[]'::jsonb
    ),
    '2026-10-30T09:11:00.000Z'::timestamptz
  );

  -- 9. Seed Initial Revision 1 Snapshots (public.review_revisions)
  insert into public.review_revisions (
    workspace_id, review_id, revision_number, content, content_hash, score, status, findings, revision_data, created_at
  ) values
    (v_ws, 'DOC-DEMO-NEEDS-REVIEW', 1,
     'Our revolutionary platform guarantees 35% higher productivity with perfect cross-team synergy across every Brandlens project.',
     v_hash_needs_review, 36, 'awaiting_human_verification',
     (select record_data -> 'findings' from public.reviews where workspace_id = v_ws and id = 'DOC-DEMO-NEEDS-REVIEW'),
     (select record_data from public.reviews where workspace_id = v_ws and id = 'DOC-DEMO-NEEDS-REVIEW'),
     '2026-10-30T09:02:00.000Z'::timestamptz),

    (v_ws, 'DOC-DEMO-EVIDENCE-REVIEW', 1,
     'BrandLens AI guarantees 99.99% availability and delivers 35% higher productivity across distributed enterprise workflows.',
     v_hash_evidence_review, 40, 'awaiting_human_verification',
     (select record_data -> 'findings' from public.reviews where workspace_id = v_ws and id = 'DOC-DEMO-EVIDENCE-REVIEW'),
     (select record_data from public.reviews where workspace_id = v_ws and id = 'DOC-DEMO-EVIDENCE-REVIEW'),
     '2026-10-30T09:07:00.000Z'::timestamptz),

    (v_ws, 'DOC-DEMO-CLEAN-APPROVAL', 1,
     'BrandLens AI helps editorial and marketing teams review draft copy against approved guidelines before publication.',
     v_hash_clean_approval, 100, 'awaiting_human_verification',
     '[]'::jsonb,
     (select record_data from public.reviews where workspace_id = v_ws and id = 'DOC-DEMO-CLEAN-APPROVAL'),
     '2026-10-30T09:11:00.000Z'::timestamptz);

  -- 10. Seed Relational Status Events (public.review_status_events)
  insert into public.review_status_events (workspace_id, review_id, status, event_at, actor, event_data) values
    (v_ws, 'DOC-DEMO-NEEDS-REVIEW', 'submitted', '2026-10-30T09:00:00.000Z'::timestamptz, 'System Demo Engine', '{"revision":1,"note":"Document submitted for editorial intelligence scan."}'::jsonb),
    (v_ws, 'DOC-DEMO-NEEDS-REVIEW', 'analysis_complete', '2026-10-30T09:01:00.000Z'::timestamptz, 'Deterministic Engine', '{"revision":1,"note":"Completed deterministic analysis across 9 active guidelines."}'::jsonb),
    (v_ws, 'DOC-DEMO-NEEDS-REVIEW', 'issues_found', '2026-10-30T09:01:30.000Z'::timestamptz, 'Deterministic Engine', '{"revision":1,"note":"Flagged 5 findings: 2 critical, 2 moderate, 1 minor."}'::jsonb),
    (v_ws, 'DOC-DEMO-NEEDS-REVIEW', 'awaiting_human_verification', '2026-10-30T09:02:00.000Z'::timestamptz, 'Workflow Router', '{"revision":1,"note":"Transferred to Human Verification Gate."}'::jsonb),

    (v_ws, 'DOC-DEMO-EVIDENCE-REVIEW', 'submitted', '2026-10-30T09:05:00.000Z'::timestamptz, 'System Demo Engine', '{"revision":1,"note":"Document submitted for evidence verification check."}'::jsonb),
    (v_ws, 'DOC-DEMO-EVIDENCE-REVIEW', 'analysis_complete', '2026-10-30T09:06:00.000Z'::timestamptz, 'Deterministic Engine', '{"revision":1,"note":"Completed evidence alignment check."}'::jsonb),
    (v_ws, 'DOC-DEMO-EVIDENCE-REVIEW', 'issues_found', '2026-10-30T09:06:30.000Z'::timestamptz, 'Deterministic Engine', '{"revision":1,"note":"Flagged 3 critical unverified claims."}'::jsonb),
    (v_ws, 'DOC-DEMO-EVIDENCE-REVIEW', 'awaiting_human_verification', '2026-10-30T09:07:00.000Z'::timestamptz, 'Workflow Router', '{"revision":1,"note":"Requires human sign-off on unverified claims."}'::jsonb),

    (v_ws, 'DOC-DEMO-CLEAN-APPROVAL', 'submitted', '2026-10-30T09:10:00.000Z'::timestamptz, 'System Demo Engine', '{"revision":1,"note":"Document submitted for baseline brand check."}'::jsonb),
    (v_ws, 'DOC-DEMO-CLEAN-APPROVAL', 'analysis_complete', '2026-10-30T09:10:45.000Z'::timestamptz, 'Deterministic Engine', '{"revision":1,"note":"Completed deterministic check."}'::jsonb),
    (v_ws, 'DOC-DEMO-CLEAN-APPROVAL', 'validation_complete', '2026-10-30T09:10:55.000Z'::timestamptz, 'Deterministic Engine', '{"revision":1,"note":"Zero violations detected (100% compliance). disposition: ready for verification."}'::jsonb),
    (v_ws, 'DOC-DEMO-CLEAN-APPROVAL', 'awaiting_human_verification', '2026-10-30T09:11:00.000Z'::timestamptz, 'Workflow Router', '{"revision":1,"note":"Awaiting human verification sign-off."}'::jsonb);


  -- 11. Post-Insertion Assertions
  -- 11.1 Assert workspace_settings matches canonical settings, hash fnv1a-60a065f7, and version 1
  if not exists (
    select 1 from public.workspace_settings
    where workspace_id = v_ws
      and settings is not distinct from v_canonical_settings
      and analysis_config_hash = v_config_hash
      and config_version = v_config_version
  ) then
    raise exception 'Post-seed assertion failed: workspace_settings does not match canonical configuration.';
  end if;

  -- 11.2 Assert public.guidelines has count 9, no non-canonical IDs, and all 9 exist with matching record_data
  if (select count(*) from public.guidelines where workspace_id = v_ws) <> 9
     or exists (select 1 from public.guidelines where workspace_id = v_ws and id not in ('R-101', 'R-102', 'R-103', 'R-104', 'R-105', 'R-106', 'R-107', 'R-108', 'R-109'))
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-101' and record_data is not distinct from v_g101)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-102' and record_data is not distinct from v_g102)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-103' and record_data is not distinct from v_g103)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-104' and record_data is not distinct from v_g104)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-105' and record_data is not distinct from v_g105)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-106' and record_data is not distinct from v_g106)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-107' and record_data is not distinct from v_g107)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-108' and record_data is not distinct from v_g108)
     or not exists (select 1 from public.guidelines where workspace_id = v_ws and id = 'R-109' and record_data is not distinct from v_g109) then
    raise exception 'Post-seed assertion failed: guidelines table does not strictly match canonical set R-101 through R-109.';
  end if;

  -- 11.3 Assert public.evidence_records has count 2, no non-canonical IDs, and both exist with matching record_data
  if (select count(*) from public.evidence_records where workspace_id = v_ws) <> 2
     or exists (select 1 from public.evidence_records where workspace_id = v_ws and id not in ('EVD-R102', 'EVD-R103'))
     or not exists (select 1 from public.evidence_records where workspace_id = v_ws and id = 'EVD-R102' and record_data is not distinct from v_evd102)
     or not exists (select 1 from public.evidence_records where workspace_id = v_ws and id = 'EVD-R103' and record_data is not distinct from v_evd103) then
    raise exception 'Post-seed assertion failed: evidence_records table does not strictly match canonical set EVD-R102 and EVD-R103.';
  end if;

  -- 11.4 Assert public.reviews has count 3, status awaiting_human_verification, current_revision 1, titles matching record_data.title
  if exists (
    select 1 from public.reviews
    where workspace_id = v_ws and id = any(v_demo_ids)
      and (
        status <> 'awaiting_human_verification'
        or current_revision <> 1
        or (id = 'DOC-DEMO-NEEDS-REVIEW' and (title is distinct from 'Demo · Launch claim review' or title is distinct from (record_data ->> 'title')))
        or (id = 'DOC-DEMO-EVIDENCE-REVIEW' and (title is distinct from 'Demo · Evidence verification' or title is distinct from (record_data ->> 'title')))
        or (id = 'DOC-DEMO-CLEAN-APPROVAL' and (title is distinct from 'Demo · Clean launch statement' or title is distinct from (record_data ->> 'title')))
      )
  ) or (select count(*) from public.reviews where workspace_id = v_ws and id = any(v_demo_ids)) <> 3 then
    raise exception 'Post-seed assertion failed: review records do not strictly match canonical baseline.';
  end if;

  -- 11.5 Assert public.review_revisions has count 3 (revision 1 for each) with exact timestamps
  if (select count(*) from public.review_revisions where workspace_id = v_ws and review_id = any(v_demo_ids) and revision_number = 1) <> 3
     or exists (
       select 1 from public.review_revisions
       where workspace_id = v_ws and revision_number = 1
         and (
           (review_id = 'DOC-DEMO-NEEDS-REVIEW' and created_at <> '2026-10-30 09:02:00+00'::timestamptz) or
           (review_id = 'DOC-DEMO-EVIDENCE-REVIEW' and created_at <> '2026-10-30 09:07:00+00'::timestamptz) or
           (review_id = 'DOC-DEMO-CLEAN-APPROVAL' and created_at <> '2026-10-30 09:11:00+00'::timestamptz)
         )
     ) then
    raise exception 'Post-seed assertion failed: revision 1 snapshots do not match canonical timestamps or count.';
  end if;

  -- 11.6 Assert public.review_status_events has count 12 for the demo reviews
  if (select count(*) from public.review_status_events where workspace_id = v_ws and review_id = any(v_demo_ids)) <> 12 then
    raise exception 'Post-seed assertion failed: expected exactly 12 review status events, found %.', (select count(*) from public.review_status_events where workspace_id = v_ws and review_id = any(v_demo_ids));
  end if;

  raise notice 'Successfully seeded BrandLens Judge Evaluation Workspace (%).', v_ws;
end $$;

commit;
