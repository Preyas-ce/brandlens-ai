# BrandLens AI

BrandLens AI is a brand-governance prototype for reviewing marketing and editorial content before publication. It uses authenticated, workspace-scoped Supabase persistence and retains deterministic local rule matching, evidence catalogue references, and a mandatory human decision.

> **Prototype disclosure:** Content analysis is still a local, deterministic rules engine. It is not a hosted AI model, legal or factual guarantee, or external fact-checking service. Supabase Authentication and PostgreSQL provide persistence and workspace access controls when configured and migrated. Final publication approval is a separate human decision.

## Requirements

- Node.js and npm
- A modern browser with JavaScript enabled
- A Supabase project with email/password authentication enabled

The Supabase URL and publishable (or legacy anon) key are required. Never use a service-role key in browser configuration.

## Supabase setup

1. Create a Supabase project. In **Authentication → Providers**, enable Email authentication. Configure the project Site URL and allowed redirect URLs for local development and deployed preview/production origins.
2. Install the Supabase CLI and authenticate, then link this repository to the project and apply the versioned schema:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migration creates workspace membership, review/revision/decision, guideline/evidence and audit tables, plus workspace-scoped RLS and guarded database operations.
3. Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   A project's public `anon` key can be used for `VITE_SUPABASE_PUBLISHABLE_KEY` if publishable keys are not enabled. These are public browser keys; RLS must remain enabled. Do not put service-role keys in any `VITE_*` variable or commit `.env*` files.
4. Restart Vite after changing environment values. New users sign up and verify email if confirmation is enabled. The first authenticated account creates a workspace as its admin. Admins can assign existing accounts the writer, reviewer or workspace-admin role in **Settings → Workspace members**.
5. On first access, choose whether to import browser-local data or continue without it. Import uses a server-side workspace/source marker and skips conflicting IDs; localStorage source keys are preserved. A failed import can be retried, and already-imported sources are reported by the database marker.
6. For Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` separately for Preview and Production, and add each deployed URL to Supabase Auth's redirect allowlist. Rebuild/redeploy after changing Vite environment variables.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite.

Build and type-check for production:

```powershell
npm.cmd run build
```

Run the automated unit suite:

```powershell
npm.cmd test
```

Run Supabase database/RLS tests after linking and applying migrations:

```powershell
npx supabase test db
```

The database test requires the Supabase CLI, a configured local Supabase stack, and pgTAP; it is not run by `npm test`.

Preview a production build:

```powershell
npm.cmd run preview
```

## Application routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Current review metrics, queue, and interactive verification pipeline |
| `/review` | Create or revise content and run local analysis |
| `/guidelines` | Manage workspace brand rules |
| `/approvals` | Filter the human review queue and inspect a decision |
| `/approvals/:reviewId` | Open a specific review and its human verification panel |
| `/activity` | Recent events derived from saved review status history |
| `/history` | Detailed review and workspace audit history |
| `/settings` | Workspace preferences, local storage disclosure, and demo scenario controls |
| `/auth` | Sign in or create an account |

Workspace routes require an authenticated Supabase session. The root route renders the existing dashboard after authentication.

## Review workflow

1. In **Review**, enter a title and content, then run analysis. Whitespace-only content is not accepted.
2. The local engine evaluates the submission against active workspace guidelines and the evidence catalogue. Findings include matched text, severity, rule reference, explanation, and a suggested correction where applicable.
3. The calculated report is saved as a review record and enters the human verification queue. Analysis never grants approval.
4. In **Approvals**, an authenticated reviewer inspects the exact content revision, report, rule and evidence snapshots, and then chooses **Approve**, **Request Changes**, or **Reject**. Requesting changes and rejecting require a comment. The decision is committed against the reviewed revision and content hash, with the authenticated reviewer ID and timestamp.
5. A writer can use reviewer feedback to revise a submission and run a fresh analysis. A content revision does not inherit the earlier approval; the earlier decision remains attached to its revision history.

Human decisions require reviewer or workspace-admin membership. The reviewer identity is tied to the authenticated Supabase user; display text alone does not grant authorization.

## Analysis, guidelines, and evidence

- Only active guidelines are used for new analyses. Changes to active guidelines or evidence make an outstanding report stale; it must be re-analysed before a human decision.
- The deterministic engine checks configured claim language, percentages, numeric multipliers, and time-based quantified outcomes; unsupported results are labeled Unverified when no applicable evidence is available.
- Completed reports retain their findings and guideline/evidence snapshots as historical results.
- The score starts at 100 and subtracts 20 points per critical finding, 10 per moderate finding, and 4 per minor finding, with a floor of 0. It is a heuristic indicator, not an approval threshold or proof of compliance.
- Evidence is linked only to applicable catalogue entries. Unverified or expired entries are described as **Unverified**; missing evidence is not invented. A catalogue match is not external fact-checking.
- New workspaces receive the existing sample guidelines and evidence catalogue for demonstration. Workspace content is editable and persists remotely in the authenticated workspace.

## Repeatable demo

To create a coherent demonstration without overwriting existing reviews:

1. Open **Settings** and choose **Prepare demo reviews**.
2. Confirm the action. BrandLens AI creates any missing scenario records and runs each through the same local analysis engine used for normal submissions. Repeating the action skips scenarios already present.
3. Use the dashboard and approval queue to demonstrate findings, human decisions, and review history. The clean scenario still requires a human approval; no scenario is pre-approved.
4. To reset, choose **Reset demo reviews** and confirm. This removes only review records marked as demo scenarios, including the revisions and decisions attached to those review records. Other reviews, guidelines, evidence, settings, and workspace audit events are preserved.

The scenarios demonstrate:

- Brand voice, quantified claims, terminology, and jargon findings.
- A local catalogue entry that is explicitly unverified, alongside a separate claim without applicable evidence.
- Clear editorial copy with no matching configured rules, still awaiting a human decision.

The analysis workbench and Quick Scan also include sample text templates; choosing a template only fills the input. Results and scores are calculated by the local engine after submission. A Quick Scan does not create or approve a review record.

## Persistence and data scope

The authoritative shared state is stored in the authenticated Supabase workspace. PostgreSQL tables persist reviews, content revisions/findings, status events, decisions, guidelines, evidence metadata, workspace settings and audit history. RLS scopes reads to workspace members; write operations enforce workspace roles and the human-decision gate.

Browser localStorage is used for UI preferences, the existing local data migration source, and a workspace-specific client cache:

- `brandlens.reviewRecords.v1` — submissions, current and prior revisions, findings, status transitions, and reviewer decisions.
- `brandlens.workspaceData.v1` — guidelines, evidence catalogue, workspace settings, and workspace audit events.

The local source keys are not automatically deleted after import. Workspace caches are separated by workspace ID. Clearing browser data removes the local cache but not the Supabase records. The database migration does not enable file attachments or model-backed review.

## Technology

- React 18 and TypeScript
- Vite
- React Router
- Tailwind CSS with the BrandLens palette
- Lucide React icons
- Supabase Auth and PostgreSQL (`@supabase/supabase-js`)

There is no hosted AI model or external fact-checking integration.

## Known prototype limitations

- Analysis uses configured phrase and pattern matching; it does not understand all context or independently verify claims.
- Supabase credentials, migration application, Auth email/redirect settings and Vercel environment configuration must be supplied by the deployer. This repository's automated tests do not prove live database or RLS behavior; run the documented Supabase database tests and two-user isolation checks against the configured project.
- Local migration source data remains editable in the browser until the user clears it. Imported cloud data is governed by database policies, but this prototype does not claim immutable, legally compliant audit retention.
- Attachment uploads and multilingual model review are not implemented in this phase.
