# BrandLens AI

BrandLens AI is a brand-governance prototype for reviewing marketing and editorial content before publication. It combines workspace-scoped collaboration, deterministic rule checks, an evidence catalogue, revision history, and a mandatory human verification decision.

> **Prototype disclosure:** The current analysis engine runs locally in the browser using deterministic rules and heuristics. It is not a hosted AI model, external fact-checking service, legal review, or guarantee of factual accuracy or policy compliance. Supabase provides authentication and shared persistence when the project is configured and its migrations are applied. A human reviewer—not the score—owns the final decision.

## What the prototype includes

- Supabase email/password authentication and workspace membership.
- Workspace roles for `workspace_admin`, `writer`, and `reviewer`.
- Shared persistence for reviews, revisions, status events, decisions, guidelines, evidence metadata, workspace settings, and audit history.
- A local content workbench that checks text against configured guidelines and the workspace evidence catalogue.
- Findings with matched text, severity, rule references, explanations, and optional editorial suggestions.
- A human verification queue with **Approve**, **Request Changes**, and **Reject** decisions.
- Revision-bound review decisions, with checks against changed content and stale rule/evidence configuration.
- Private PDF and image attachments associated with a review revision for human inspection.
- English, Hindi, and Gujarati interface translations.
- Demo scenarios and a prepared Judge Demo entry point when its environment variables are configured.

The feature list describes code in this repository. It does not imply that every production integration has been independently tested on every deployment.

## Architecture at a glance

- **Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS, and Lucide React.
- **Authentication:** Supabase Auth.
- **Shared data:** Supabase PostgreSQL, workspace membership, row-level security (RLS), and guarded database functions/RPCs.
- **Evidence files:** A private Supabase Storage bucket named `review-evidence`, with workspace-scoped access policies and short-lived signed URLs.
- **Analysis:** A deterministic client-side rules engine. It does not call an external LLM or fact-checking API.
- **Browser storage:** localStorage is used for UI preferences, the language preference, the legacy local-data import source, and a workspace-specific client cache. It is not the authoritative shared database.

The browser calculates the analysis report and sends it to the backend for persistence. The backend enforces workspace access and reviewer-decision rules, but it does not independently rerun the analysis engine. Treat analysis output as an assistive prototype signal, not a tamper-proof compliance result.

## Requirements

- Node.js and npm
- A modern browser with JavaScript enabled
- A Supabase project
- Supabase CLI for applying migrations and running database tests

## Environment configuration

Copy `.env.example` to `.env.local` and replace the placeholders:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY

# Optional: enables the public Judge Demo sign-in
VITE_JUDGE_DEMO_EMAIL=judge@example.com
VITE_JUDGE_DEMO_PASSWORD=YOUR_DEDICATED_JUDGE_DEMO_PASSWORD
```

Use the Supabase publishable key (or the legacy public `anon` key where applicable). **Never put a Supabase `service_role` key or another server secret in a `VITE_*` variable.** Vite exposes `VITE_*` values in the client-side application bundle. This also means the Judge Demo email and password are visible to visitors of the deployed site, even when the hosting dashboard labels the variable “Secret”. Configure only a dedicated, low-privilege Judge Demo account; never use a personal or workspace-owner password.

The Judge Demo account must already exist in Supabase Auth and be assigned to the intended evaluation workspace with reviewer access. The optional Judge Demo variables only enable the preconfigured sign-in path; they do not create the account or assign its workspace role.

Do not commit `.env.local` or other real environment files. The repository's `.gitignore` excludes local environment files; commit only safe placeholders in `.env.example`.

## Supabase setup

1. Create a Supabase project. In **Authentication → Providers**, enable Email authentication. Choose the email-confirmation setting appropriate for the project.
2. Configure the hosted Supabase Auth **Site URL** and **Redirect URLs** for local development and the deployed production/preview origins. The local CLI configuration includes localhost; it does not automatically configure the hosted project's dashboard settings.
3. Install the Supabase CLI and authenticate. Link the repository to the intended project and apply all versioned migrations:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migrations create workspace membership and profile structures; review, revision, decision, guideline, evidence, and audit tables; workspace-scoped RLS and guarded database operations; and the private evidence-attachment bucket and policies.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Restart Vite after changing environment values.
5. On Vercel, set the required `VITE_*` variables for the appropriate deployment environments. Add the deployed origins to Supabase Auth's redirect allowlist. Redeploy after changing Vite environment variables because they are included at build time.
6. Create the dedicated Judge Demo Supabase Auth account and give it access to the prepared reviewer workspace before enabling `VITE_JUDGE_DEMO_EMAIL` and `VITE_JUDGE_DEMO_PASSWORD`.

The first authenticated account initializes a workspace as its administrator. Workspace administrators can manage members and roles in **Settings → Workspace members**. Existing accounts must be invited/assigned through the workspace flow; setting an environment variable alone does not create an account.

## Run locally

Install dependencies and start the Vite development server:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite.

Build and type-check:

```powershell
npm.cmd run build
```

Run the automated unit suite:

```powershell
npm.cmd test
```

Run the Supabase database tests against a configured local Supabase stack:

```powershell
npx supabase start
npx supabase test db
```

The database/RLS tests are separate from `npm.cmd test`. A passing frontend unit suite does not prove that the hosted project's migrations, storage policies, or two-user workspace isolation are configured correctly. Run the database tests and perform environment-specific integration checks before a release.

Preview a production build:

```powershell
npm.cmd run preview
```

On macOS/Linux, the equivalent commands can generally be run as `npm` rather than `npm.cmd`.

## Application routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Workspace overview, review metrics, queue, and verification pipeline |
| `/review` | Create or revise content, run local analysis, and attach supporting files |
| `/guidelines` | Manage workspace brand rules |
| `/approvals` | Human review queue |
| `/approvals/:reviewId` | Inspect a review, revision, attachments, and verification controls |
| `/activity` | Recent events derived from saved review status history |
| `/history` | Review and workspace audit history |
| `/settings` | Workspace preferences, members/roles, local-data import, and demo controls |
| `/auth` | Sign in, create an account, or recover a password |

Workspace routes require an authenticated Supabase session, except for explicitly exposed demo-preview experiences. The root route directs users into the application flow.

## Review workflow

1. In **Review**, enter a title and content, then run analysis. Empty or whitespace-only content is not accepted.
2. The browser-based rules engine compares the submission with active workspace guidelines and the evidence catalogue. Findings can include matched text, severity, a rule reference, an explanation, and a suggested edit.
3. The review and its analysis snapshot are saved to the authenticated workspace and enter the human verification queue. Analysis does not grant approval.
4. In **Approvals**, an authorized reviewer inspects the exact submitted revision and chooses **Approve**, **Request Changes**, or **Reject**. Requesting changes and rejecting require a comment.
5. A writer can revise the submission and run a fresh analysis. A new revision does not inherit an earlier approval; prior decisions remain associated with the revision they evaluated.

The database checks workspace membership and role permissions for protected operations. Reviewer decisions are tied to the reviewed content/revision state and current rule configuration so that a changed or stale submission must be reviewed again.

## Analysis, guidelines, and evidence

- Only active guidelines are used for new analyses.
- The local deterministic engine checks configured phrase, terminology, claim, percentage, multiplier, time-based outcome, and selected text-accessibility patterns. The checks are limited to the rules implemented in the current code.
- Where no applicable approved evidence is available, relevant claims are labeled **Unverified**. The engine does not infer that an unsupported claim is false.
- A matching catalogue entry is a reference for the human reviewer; it is not independent external fact-checking.
- Completed review records retain findings and applicable guideline/evidence snapshots as historical context.
- The consistency score starts at 100 and subtracts 20 points per critical finding, 10 per moderate finding, and 4 per minor finding, with a floor of 0. It is a heuristic indicator—not an approval threshold, factual-accuracy score, or proof of compliance.
- The accessibility checks are text/rule based. They are not a full browser, rendered-page, image, or DOM accessibility audit.

## Evidence attachments

The review workbench and verification gate include an attachment interface for supporting material:

- Supported formats: PDF, PNG, JPEG/JPG, and WebP.
- Maximum size: 10 MiB per file.
- Files are stored in the private Supabase Storage bucket `review-evidence`.
- Attachment metadata is associated with a workspace, review, and revision.
- Workspace members with read access can inspect/download files through short-lived signed URLs. Upload and delete operations are restricted to workspace administrators and writers.
- Storage access is governed by Supabase authentication and workspace policies; the bucket is not public.

Attachments are supplied for people to inspect. BrandLens AI does not currently perform OCR, extract source content, validate a document's authenticity, or automatically use an attachment to mark a claim as verified. A reviewer must examine the material and make the decision. Apply the attachment migration by running `npx supabase db push` before using this feature in a Supabase project.

## Interface languages

The interface has English (`en`), Hindi (`hi`), and Gujarati (`gu`) translation dictionaries. The selected interface language is stored in the browser. This is UI localization only: it does not translate user-submitted content or provide Hindi/Gujarati model-based analysis. Where a translation key is not available, the interface falls back to English.

## Persistence and data scope

Supabase is the authoritative shared store for authenticated workspace data, including reviews, revisions/findings, status events, decisions, guidelines, evidence catalogue records, settings, membership, and audit history. PostgreSQL RLS scopes access to workspace members, while guarded database functions enforce role-specific writes and reviewer decisions.

Browser localStorage remains in use for:

- UI preferences and the selected interface language.
- Existing browser-local data that a user may choose to import into a workspace.
- A workspace-specific client cache used by the application.

The local cache is not the authoritative shared source of truth. Clearing browser data removes local preferences/cache but does not delete data already saved to Supabase. The import flow uses a workspace/source marker to avoid repeating an already completed import; it does not automatically erase the original browser-local source data.

## Repeatable demo

To create a coherent demonstration without overwriting existing reviews:

1. Open **Settings** and choose **Prepare demo reviews**.
2. Confirm the action. BrandLens AI creates missing scenario records and runs them through the same local analysis engine used for normal submissions. Repeating the action skips scenarios already present.
3. Use the dashboard and approval queue to demonstrate findings, human decisions, and review history. The clean scenario still requires a human decision; no scenario is pre-approved.
4. To reset, choose **Reset demo reviews** and confirm. This is intended to remove only records marked as demo scenarios and their attached review lifecycle data; inspect the confirmation before proceeding.

The scenarios demonstrate brand voice, quantified claim language, evidence gaps, and clean editorial copy. They are examples evaluated by the current local rules; their results are not prewritten AI reports.

## Technology

- React 18 and TypeScript
- Vite and React Router
- Tailwind CSS and the BrandLens design tokens
- Lucide React
- Supabase Auth, PostgreSQL, RLS, RPCs, and Storage
- Node.js test runner for the frontend unit suite

## Known prototype limitations

- Analysis is deterministic and runs in the browser; there is no hosted LLM, semantic model, live web research, or external fact-checker.
- The backend persists the submitted analysis snapshot and enforces workspace/decision authorization, but does not independently recompute the local report. Do not treat client-generated findings or scores as a tamper-proof compliance control.
- Missing evidence is marked **Unverified**; the product does not establish that a claim is true or false.
- Attachments are human-review materials only. OCR, automatic document parsing, authenticity checks, malware scanning, and automated claim-to-document verification are not part of this prototype.
- Hindi and Gujarati support covers the interface dictionaries, not the analysis engine or user-authored content.
- The repository's unit tests do not prove live Supabase configuration, hosted RLS isolation, storage upload/download, or production email delivery. Test those against the target project before relying on them.
- The product is a functional prototype, not a certified legal, security, accessibility, or regulatory-compliance system.
