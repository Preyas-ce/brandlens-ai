create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(4);

insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'writer@example.test', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'reviewer@example.test', '', now(), now(), now());
insert into public.workspaces(id, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Writer workspace'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other workspace');
insert into public.workspace_members(workspace_id, user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'writer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'reviewer');
insert into public.guidelines(workspace_id, id, record_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RULE-A', '{"id":"RULE-A"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RULE-B', '{"id":"RULE-B"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select extensions.is(
  (select count(*)::integer from public.guidelines),
  1,
  'writer reads only rows belonging to their workspace'
);
select extensions.throws_ok(
  $$select public.decide_review_record(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'DOC-1', 'approved', 'writer@example.test', '',
    'hash', null
  )$$,
  'P0001',
  'Reviewer or workspace-admin access is required.',
  'writer cannot make reviewer decisions'
);

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select public.save_review_record(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"id":"DOC-1","status":"awaiting_human_verification"}', false
  )$$,
  'P0001',
  'Writer or workspace-admin access is required.',
  'reviewer cannot write or revise review records'
);
select extensions.throws_ok(
  $$insert into public.guidelines(workspace_id, id, record_data)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'INJECTED', '{"id":"INJECTED"}')$$,
  '42501',
  null,
  'authenticated users cannot bypass guarded workspace write functions'
);

reset role;
select * from extensions.finish();
rollback;
