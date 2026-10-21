# AGENTS.md — BrandLens AI Project Rules & Engineering Guidelines

## 1. Project Overview & Vision
**BrandLens AI** is an intelligent brand-governance and editorial intelligence platform. Organizations operate across distributed teams, external agencies, and generative AI tooling to create content. BrandLens AI provides rigorous pre-publication inspection against approved brand guidelines, brand voice/terminology, verifiable facts, compliance policies, and digital brand assets.

### Key Differentiator: Human Verification Gate
- **Balanced Intelligence**: AI analysis and human judgment carry equal weight.
- **Explainable Evidence**: The analysis engine highlights issues, points to exact guideline violations, and supplies concrete supporting evidence.
- **Mandatory Human Verification Gate**: AI does not autonomously publish or finalize content. A human editor/reviewer retains final authority and must sign off or request revisions through the verification gate.

---

## 2. Design Identity & Aesthetics
The visual identity fuses **premium editorial design** (reminiscent of high-end literary/architectural journals) with an **innovative creative-intelligence studio**.

### Core Color Palette
- **Obsidian**: `#171916` — Deep typographic ink, structural dark accents, primary contrast
- **Warm Ivory**: `#F6F1E8` — Primary editorial canvas, warm paper ground, elevated panels
- **Copper**: `#BC744E` — Warm accent, focus highlights, interactive focus cues
- **Forest Green**: `#244C3A` — Verification status, compliance confirmation, editorial authority
- **Muted Stone**: `#A8A095` — Structural borders, secondary metadata, subtle dividers

### Design Guardrails
- **Avoid Generic SaaS Tropes**: Reject neon blue/purple gradients, generic drop-shadow cards in endless grids, and bland dashboard templates.
- **Typography & Layout**: Emphasize distinct typographic hierarchy, intentional white space, disciplined editorial grids, and tangible craftsmanship.
- **Restrained Motion**: Subtle, purposeful micro-transitions only. Avoid distracting, slow, or excessive animations.
- **No Non-Functional Placeholders**: Every visual element must serve a legible purpose.

---

## 3. Technology Stack & Architecture
- **Framework**: React 18+ with TypeScript
- **Bundler & Tooling**: Vite
- **Styling**: Tailwind CSS configured with the BrandLens design tokens (`obsidian`, `ivory`, `copper`, `forest`, `stone`)
- **Routing**: React Router (`react-router-dom`)
- **Icons**: Lucide React (`lucide-react`)
- **Persistence**: Browser `localStorage` for state management, guideline storage, and audit logs
- **Analysis Engine**: Local deterministic/heuristic demo analysis engine with explicit, honest disclosure of engine capabilities (never misrepresent simulated rules as external cloud LLMs)
- **External Dependencies**: Zero paid APIs, no API key requirements, no paid hosting prerequisites

---

## 4. Engineering & Development Rules
1. **Functional Completeness**: Every button, switch, filter, modal, and control must have real functionality. No decorative dummy controls or dead clicks.
2. **Deterministic & Transparent Engine**: Analysis logic must clearly expose rule matching, keyword detection, guideline alignment scoring, and sentiment/voice metrics with explicit notes on local execution.
3. **Component Modularity & Clean Separation**:
   - `components/`: Pure, reusable presentation components (buttons, badges, inputs, layout containers)
   - `features/`: Domain-specific modules (analysis workbench, guidelines manager, human verification gate, audit logs)
   - `services/`: Business logic, storage adapters, and local analysis engine
   - `types/`: Strict TypeScript definitions and interfaces
4. **Preservation of Functionality**: Do not break, delete, or rewrite existing working features during incremental updates.
5. **Dependency Discipline**: Avoid unnecessary third-party packages. Use native browser APIs and standard React patterns.
6. **Validation Pipeline**: After each implementation step, run:
   - TypeScript checks (`tsc --noEmit`)
   - Build verification (`npm run build` or Vite build validation)
   - Verification that console errors and warnings are resolved

---

## 5. Working Protocol & Reporting
- **Incremental Steps**: Execute one phase at a time. Do not jump ahead into unrequested features.
- **File Inspection**: Always inspect relevant files before modifying them.
- **Standard Completion Report**:
  - **Files Changed / Created**: List all modified or created files with markdown links.
  - **Commands Run**: Detailed list of CLI commands executed.
  - **Test & Build Results**: TypeScript and build output status.
  - **Unresolved Issues / Next Steps**: Any blockers, open decisions, or planned next phase.
