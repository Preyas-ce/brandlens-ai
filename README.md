# BrandLens AI

BrandLens AI is a local-first brand-governance prototype for reviewing marketing and editorial content before publication. Its editorial interface brings deterministic rule matching, evidence catalogue references, and a mandatory human decision into one workflow.

> **Prototype disclosure:** Content analysis is a local, deterministic rules engine. It is not a hosted AI model, legal or factual guarantee, or external fact-checking service. Final publication approval is a separate human decision. Data is stored in browser `localStorage`, which is not a secure production database and can be edited or cleared by the user.

## Requirements

- Node.js and npm
- A modern browser with JavaScript enabled

No API keys, paid services, or external AI providers are required.

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

Preview a production build:

```powershell
npm.cmd run preview
```

The current `package.json` does not define automated test or lint scripts.

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

The root route redirects to `/dashboard`.

## Review workflow

1. In **Review**, enter a title and content, then run analysis. Whitespace-only content is not accepted.
2. The local engine evaluates the submission against active workspace guidelines and the evidence catalogue. Findings include matched text, severity, rule reference, explanation, and a suggested correction where applicable.
3. The calculated report is saved as a review record and enters the human verification queue. Analysis never grants approval.
4. In **Approvals**, a reviewer inspects the exact content revision, report, rule and evidence snapshots, and then chooses **Approve**, **Request Changes**, or **Reject**. Requesting changes and rejecting require a comment. Approval is recorded against the reviewed revision, with the configured demo reviewer name and decision timestamp.
5. A writer can use reviewer feedback to revise a submission and run a fresh analysis. A content revision does not inherit the earlier approval; the earlier decision remains attached to its revision history.

The named reviewer is a workspace demo identity, not verified authentication. The prototype does not provide production authorization or tamper-proof audit records.

## Analysis, guidelines, and evidence

- Only active guidelines are used for new analyses. Changes to active guidelines or evidence make an outstanding report stale; it must be re-analysed before a human decision.
- The deterministic engine checks configured claim language, percentages, numeric multipliers, and time-based quantified outcomes; unsupported results are labeled Unverified when no applicable evidence is available.
- Completed reports retain their findings and guideline/evidence snapshots as historical results.
- The score starts at 100 and subtracts 20 points per critical finding, 10 per moderate finding, and 4 per minor finding, with a floor of 0. It is a heuristic indicator, not an approval threshold or proof of compliance.
- Evidence is linked only to applicable catalogue entries. Unverified or expired entries are described as **Unverified**; missing evidence is not invented. A catalogue match is not external fact-checking.
- The default workspace provides sample guidelines and a sample evidence catalogue for demonstration. Workspace content is editable and persists locally.

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

The prototype stores its shared state in browser-local keys:

- `brandlens.reviewRecords.v1` — submissions, current and prior revisions, findings, status transitions, and reviewer decisions.
- `brandlens.workspaceData.v1` — guidelines, evidence catalogue, workspace settings, and workspace audit events.

Data is scoped to the current browser profile and origin. Clearing site data removes it. Do not use this prototype for confidential content or rely on local records as a secure or immutable system of record.

## Technology

- React 18 and TypeScript
- Vite
- React Router
- Tailwind CSS with the BrandLens palette
- Lucide React icons

There is no backend service or third-party AI dependency.

## Known prototype limitations

- Analysis uses configured phrase and pattern matching; it does not understand all context or independently verify claims.
- Browser storage has no server-side backup, production access control, or tamper resistance.
- The demo reviewer identity is configurable display text, not authentication.
- Automated test and lint commands are not currently configured in `package.json`.
