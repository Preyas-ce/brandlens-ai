# AGENTS.md — BrandLens AI Engineering Guide

This file is the source of truth for coding agents working in this repository. Read it before making changes. Inspect the current implementation before assuming a feature, folder, API, or workflow exists.

## 1. Product purpose and non-negotiable principles

BrandLens AI is a pre-publication brand-governance prototype. It helps creators and reviewers inspect marketing/editorial drafts against workspace rules and an evidence catalogue, keep revisions traceable, and record a human review decision.

### Human verification gate

- Automated analysis is advisory. It must never approve or publish content by itself.
- An authorized human reviewer owns the final **Approve**, **Request Changes**, or **Reject** decision.
- Decisions must remain associated with the exact review revision they evaluated. A changed draft or stale guideline/evidence configuration must not inherit an earlier approval.
- Preserve the submitter's original content. Suggestions are optional and must not silently overwrite user work.
- Missing evidence means **Unverified**, not **False**. Do not invent sources or claim that a catalogue match independently proves a statement.

### Honest description of current capabilities

- The analysis engine is deterministic, rule-based, and runs in the browser.
- There is no hosted LLM, semantic AI service, live web fact-checker, OCR pipeline, or automatic evidence-document verification in the current product.
- The interface supports English, Hindi, and Gujarati translations. This does not mean that analysis or user-submitted content is multilingual.
- Evidence attachments are stored for people to inspect. A file is not automatically parsed or treated as proof.
- The backend enforces workspace access and reviewer-decision rules, but it persists the client-generated analysis snapshot rather than independently recomputing the report. Do not describe the current analysis result as tamper-proof or security-grade compliance evidence.

Never add marketing copy, UI claims, README text, or submission language that overstates these capabilities.

## 2. Visual identity and design guardrails

BrandLens uses a premium editorial/creative-studio visual language.

### Core palette

- **Obsidian:** `#171916`
- **Warm Ivory:** `#F6F1E8`
- **Copper:** `#BC744E`
- **Forest Green:** `#244C3A`
- **Muted Stone:** `#A8A095`

### Design rules

- Avoid generic blue/purple-gradient SaaS styling and repetitive dashboard-card grids.
- Use editorial hierarchy, intentional whitespace, restrained borders, and a clear typographic system.
- Use motion only when it improves orientation or feedback; respect reduced-motion preferences.
- Keep controls accessible by keyboard and provide useful labels, focus states, and error/empty/loading states.
- Do not introduce decorative controls that do not work.
- Preserve the current visual language when editing existing pages. Reuse existing components and design tokens before creating new patterns.

## 3. Current technical architecture

- **Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS, Lucide React.
- **Authentication:** Supabase Auth (email/password and password recovery).
- **Shared persistence:** Supabase PostgreSQL, workspace membership, RLS, and guarded RPC/database functions.
- **Evidence files:** Private Supabase Storage bucket `review-evidence`; metadata is associated with workspace/review/revision and authorized access uses short-lived signed URLs.
- **Analysis:** Local deterministic browser-side engine; no external AI or fact-checking API.
- **Browser storage:** localStorage is used for UI preferences, language preference, legacy import-source data, and a workspace-specific client cache. Supabase is authoritative for shared workspace records.

### Main repository areas

- `src/components/` — reusable UI and product components.
- `src/contexts/` — authentication, workspace, and interface-language context.
- `src/pages/` — route-level screens.
- `src/services/` — analysis, authentication, Supabase, workspace, persistence, and attachment services.
- `src/types/` — shared TypeScript types.
- `supabase/migrations/` — versioned database schema and policy changes.
- `supabase/tests/` — database/RLS tests.
- `tests/` — frontend/unit and demo-simulation tests.

Do not assume a separate `features/` directory exists. Confirm the current tree before introducing a new architecture.

## 4. Workspace roles and data access

The current workspace roles are:

- `workspace_admin` — manages workspace configuration and members; can perform reviewer decisions.
- `writer` — creates and revises review submissions and manages evidence attachments.
- `reviewer` — inspects submissions and records human review decisions.

Authorization must be enforced by Supabase RLS and guarded database operations, not only by hiding frontend controls. Always scope data access to the active workspace. Do not trust a client-supplied workspace ID, role, uploader name, review status, or reviewer identity without server-side authorization/validation.

## 5. Security and environment variables

- Never commit `.env.local`, real environment files, passwords, access tokens, or private keys.
- Never expose Supabase `service_role` keys or server secrets in frontend code, browser storage, logs, or any `VITE_*` variable.
- The Supabase publishable key (or legacy public `anon` key) is designed for browser use; RLS is required.
- **Every `VITE_*` variable is public in the built frontend.** The `VITE_JUDGE_DEMO_EMAIL` and `VITE_JUDGE_DEMO_PASSWORD` values therefore act as public demo credentials. Use only a dedicated, low-privilege Judge Demo account. Never use an owner's or personal account.
- Keep `.env.example` limited to clearly marked placeholders. Do not insert actual secrets in examples or docs.
- Authentication redirects must be configured in the hosted Supabase Auth URL allowlist as well as any local CLI configuration.
- Do not weaken RLS or storage policies to make a UI operation appear to work.

## 6. Supabase migration rules

- Add schema changes as new timestamped SQL migrations in `supabase/migrations/`.
- Do not rewrite a migration that may already have been applied to a shared/production database. Add a corrective migration instead.
- Enable RLS on every workspace-owned table and make policies enforce workspace membership and the required role.
- Revoke direct client writes where the design relies on guarded RPCs. Grant only the minimum required table/function privileges.
- For `SECURITY DEFINER` functions, use an explicit safe `search_path` (the existing migrations use an empty search path) and schema-qualify referenced objects.
- Validate the authenticated user, active workspace, requested review, revision, allowed status transition, and role inside the database operation.
- Keep storage buckets private. Scope object paths and policies to the workspace. Never make evidence files public to bypass authorization.
- Treat Storage and PostgreSQL as separate services; document and handle partial failures/cleanup rather than assuming a cross-service transaction.

## 7. Analysis, evidence, and review behavior

- Keep the local analysis deterministic and explainable. New checks must be grounded in explicit implemented rules.
- Explain findings with the matched text, rule reference, severity, and helpful suggested language when available.
- Do not label an unsupported claim as false. Use **Unverified** when the configured evidence catalogue cannot support it.
- Scores are heuristic indicators; never use them as automatic approval gates or proof of factual accuracy.
- Keep guideline/evidence snapshots and revision history coherent. Re-analysis is required after a content change or relevant rules/configuration change.
- Attachments currently accept PDF, PNG, JPEG/JPG, and WebP up to 10 MiB per file. They are for human inspection only; do not imply OCR, document extraction, source validation, or automatic verification unless those features are genuinely implemented and tested.
- The current visual/accessibility checks are limited heuristics, not a complete rendered-page or WCAG audit.

## 8. Interface language rules

- Supported interface language codes are `en`, `hi`, and `gu`.
- Add a new user-visible string to the translation dictionaries in `src/contexts/LanguageProvider.tsx` for all supported languages.
- Preserve translation-key parity where practical. The application falls back to English when a key is missing, but missing translations should be corrected rather than used as a workflow.
- Do not imply that user content or analysis is translated simply because the interface language changes.
- Keep language preference handling resilient when localStorage is unavailable.

## 9. Implementation workflow

1. Read this file and inspect the relevant page, service, context, type, migration, and test code before editing.
2. Make the smallest coherent change. Preserve existing behavior unless the task explicitly changes it.
3. Reuse existing components, types, translation keys, and service boundaries.
4. Handle loading, empty, error, success, disabled, and repeated-action states where relevant.
5. Avoid adding dependencies unless the existing stack cannot reasonably meet the need.
6. Update or add tests for changed behavior. Do not claim that an unrun test passed.
7. Keep README, environment examples, and UI disclosures aligned with actual implementation.

### Validation commands

On Windows PowerShell:

```powershell
npm.cmd test
npm.cmd run build
```

For database migrations and RLS tests, use a configured Supabase CLI/local stack:

```powershell
npx supabase start
npx supabase test db
```

The frontend unit suite does not replace Supabase database, RLS, Storage, or production integration checks. Report exactly which commands were run and which live checks remain unverified.

## 10. Completion report

For each implementation task, report:

- **Files changed:** paths and a concise description.
- **Behavior changed:** what users will notice.
- **Validation:** exact commands run and their actual results.
- **Remaining limitations:** anything not tested or not implemented.
- **Operational notes:** new environment variables, Supabase migrations, redirect URLs, or deployment steps.

Never report a build, database migration, deployment, or test as successful unless its result was actually observed.
