// tests/judge_seeding_local_simulation.test.cjs
// Tests and simulates the exact SQL Seeding and Restoration logic locally against application contracts

require('./register-typescript.cjs');
const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const store = new Map();
global.window = {
  localStorage: {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  dispatchEvent: () => {},
};

const { analyzeLocalContent } = require('../src/services/localReviewEngine.ts');
const { hashReviewContent } = require('../src/services/reviewStorage.ts');
const { getWorkspaceAnalysisConfigHash, DEFAULT_WORKSPACE_SETTINGS } = require('../src/services/workspaceStorage.ts');

describe('BrandLens AI — Judge Demo Workspace Seeding and Restoration Regression Suite', () => {
  const TARGET_WORKSPACE_ID = '2ca5874e-4711-4354-8b81-873847edbd55';
  const CANONICAL_CONFIG_HASH = 'fnv1a-60a065f7';
  const CANONICAL_CONFIG_VERSION = 1;
  const CANONICAL_SETTINGS = {
    workspaceName: 'BrandLens Judge Evaluation Workspace',
    language: 'en',
    strictness: 'standard',
    notificationEmail: '',
    autoScanUploads: false,
    requireEvidenceApproval: true,
    customGuidelinesPrompt: '',
  };

  const fixedTimestamp = '2026-10-30T00:00:00.000Z';
  const CANONICAL_GUIDELINES = [
    { id: 'R-101', title: 'Support superlatives with evidence', description: 'Comparative or absolute praise needs a named, approved source or a concrete capability.', category: 'Brand voice and tone', ruleType: 'guidance', phrases: ['best in class', 'world leading', 'industry leading', 'revolutionary', 'unmatched', 'unprecedented', 'number one'], approvedPhrase: '', severity: 'moderate', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-102', title: 'Use the approved BrandLens AI wordmark', description: 'Use the exact approved product name “BrandLens AI”.', category: 'Approved and prohibited terminology', ruleType: 'approved_terminology', phrases: ['brandlens', 'brand lens', 'BrandLens'], approvedPhrase: 'BrandLens AI', severity: 'moderate', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-103', title: 'Qualify guarantees and quantified claims', description: 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.', category: 'Approved factual claims and promotional statements', ruleType: 'claim_evidence', phrases: ['guarantee', 'guaranteed', 'guarantees', 'promise', 'promises', 'always', 'never fail', 'zero risk', 'no downtime', 'uptime'], approvedPhrase: '', severity: 'critical', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-104', title: 'Avoid disallowed corporate jargon', description: 'Prefer direct editorial language to the disallowed terms listed here.', category: 'Approved and prohibited terminology', ruleType: 'prohibited_term', phrases: ['synergy', 'synergies', 'boil the ocean', 'low-hanging fruit'], approvedPhrase: '', severity: 'minor', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-105', title: 'Verify time-sensitive statements', description: 'Current, latest, or dated statements need an applicable source with a review date.', category: 'Approved factual claims and promotional statements', ruleType: 'guidance', phrases: ['current', 'currently', 'latest', 'as of', 'today’s', 'this year’s'], approvedPhrase: '', severity: 'moderate', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-106', title: 'Use clear, accessible calls to action', description: 'Link labels should describe their destination; extended all-caps text can reduce readability.', category: 'Accessibility guidelines', ruleType: 'guidance', phrases: ['click here', 'read more', 'learn more'], approvedPhrase: '', severity: 'minor', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-107', title: 'Protect the editorial color palette', description: 'Visual materials should respect the Warm Ivory and Obsidian palette with restrained copper and forest accents.', category: 'Visual identity guidance', ruleType: 'guidance', phrases: [], approvedPhrase: '', severity: 'minor', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-108', title: 'Lead with clear, human-centered messaging', description: 'Explain the benefit plainly and retain human accountability for final publication decisions.', category: 'Messaging principles', ruleType: 'guidance', phrases: [], approvedPhrase: '', severity: 'minor', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'R-109', title: 'Follow general brand governance', description: 'Content must remain accurate, attributable, and subject to the human verification gate.', category: 'General brand rules', ruleType: 'guidance', phrases: [], approvedPhrase: '', severity: 'moderate', isActive: true, createdAt: fixedTimestamp, updatedAt: fixedTimestamp }
  ];

  const CANONICAL_EVIDENCE = [
    { id: 'EVD-R102', title: 'BrandLens AI wordmark reference (pending verification)', description: 'Workspace wording reference for product name spelling; pending verification.', sourceName: 'Seeded workspace terminology directive', sourceUrl: '', associatedClaim: 'Brand name spelling', guidelineId: 'R-102', verificationStatus: 'unverified', lastReviewedAt: '', reviewDueAt: '', createdAt: fixedTimestamp, updatedAt: fixedTimestamp },
    { id: 'EVD-R103', title: 'Availability wording sample', description: 'An internal demo phrase; it is not an independent SLA or performance record.', sourceName: 'Seeded workspace wording example', sourceUrl: '', associatedClaim: '99.99% availability target', guidelineId: 'R-103', verificationStatus: 'unverified', lastReviewedAt: '', reviewDueAt: '', createdAt: fixedTimestamp, updatedAt: fixedTimestamp }
  ];

  const SEEDED_DOCS = {
    needsReview: {
      id: 'DOC-DEMO-NEEDS-REVIEW',
      title: 'Demo · Launch claim review',
      content: 'Our revolutionary platform guarantees 35% higher productivity with perfect cross-team synergy across every Brandlens project.',
      expectedHash: 'fnv1a-014f3bd2',
      expectedScore: 36,
      expectedFindingsCount: 5,
      expectedRevision1CreatedAt: '2026-10-30T09:02:00.000Z',
    },
    evidenceReview: {
      id: 'DOC-DEMO-EVIDENCE-REVIEW',
      title: 'Demo · Evidence verification',
      content: 'BrandLens AI guarantees 99.99% availability and delivers 35% higher productivity across distributed enterprise workflows.',
      expectedHash: 'fnv1a-0f9dfe37',
      expectedScore: 40,
      expectedFindingsCount: 3,
      expectedRevision1CreatedAt: '2026-10-30T09:07:00.000Z',
    },
    cleanApproval: {
      id: 'DOC-DEMO-CLEAN-APPROVAL',
      title: 'Demo · Clean launch statement',
      content: 'BrandLens AI helps editorial and marketing teams review draft copy against approved guidelines before publication.',
      expectedHash: 'fnv1a-5c473dda',
      expectedScore: 100,
      expectedFindingsCount: 0,
      expectedRevision1CreatedAt: '2026-10-30T09:11:00.000Z',
    },
  };

  test('Validates exact content hashes, engine analysis scores, and finding offsets for all 3 demo documents', () => {
    // 1. DOC-DEMO-NEEDS-REVIEW
    const d1 = SEEDED_DOCS.needsReview;
    const h1 = hashReviewContent(d1.content);
    assert.equal(h1, d1.expectedHash, 'DOC-DEMO-NEEDS-REVIEW content hash must strictly match');
    const a1 = analyzeLocalContent(d1.content);
    assert.equal(a1.score, d1.expectedScore, 'DOC-DEMO-NEEDS-REVIEW score must equal 36 (100 - 2x20 - 2x10 - 1x4)');
    assert.equal(a1.findings.length, d1.expectedFindingsCount, 'DOC-DEMO-NEEDS-REVIEW must have 5 findings');

    for (const f of a1.findings) {
      assert.ok(typeof f.startIndex === 'number' && typeof f.endIndex === 'number', 'Indices must be numbers');
      assert.ok(f.startIndex >= 0 && f.endIndex <= d1.content.length, 'Offsets within bounds');
      assert.equal(d1.content.slice(f.startIndex, f.endIndex), f.quote, `Finding quote "${f.quote}" must match sliced content`);
    }

    assert.equal(a1.findings[0].quote, 'revolutionary');
    assert.equal(a1.findings[0].startIndex, 4);
    assert.equal(a1.findings[0].endIndex, 17);

    assert.equal(a1.findings[1].quote, 'guarantees');
    assert.equal(a1.findings[1].startIndex, 27);
    assert.equal(a1.findings[1].endIndex, 37);

    assert.equal(a1.findings[2].quote, '35%');
    assert.equal(a1.findings[2].startIndex, 38);
    assert.equal(a1.findings[2].endIndex, 41);

    assert.equal(a1.findings[3].quote, 'synergy');
    assert.equal(a1.findings[3].startIndex, 86);
    assert.equal(a1.findings[3].endIndex, 93);

    assert.equal(a1.findings[4].quote, 'Brandlens');
    assert.equal(a1.findings[4].startIndex, 107);
    assert.equal(a1.findings[4].endIndex, 116);
    assert.equal(a1.findings[4].suggestion, 'BrandLens AI');

    // 2. DOC-DEMO-EVIDENCE-REVIEW
    const d2 = SEEDED_DOCS.evidenceReview;
    const h2 = hashReviewContent(d2.content);
    assert.equal(h2, d2.expectedHash, 'DOC-DEMO-EVIDENCE-REVIEW content hash must strictly match');
    const a2 = analyzeLocalContent(d2.content);
    assert.equal(a2.score, d2.expectedScore, 'DOC-DEMO-EVIDENCE-REVIEW score must equal 40 (100 - 3x20)');
    assert.equal(a2.findings.length, d2.expectedFindingsCount, 'DOC-DEMO-EVIDENCE-REVIEW must have 3 findings');

    for (const f of a2.findings) {
      assert.equal(d2.content.slice(f.startIndex, f.endIndex), f.quote, `Finding quote "${f.quote}" must match slice`);
    }
    assert.equal(a2.findings[0].quote, 'guarantees');
    assert.equal(a2.findings[0].startIndex, 13);
    assert.equal(a2.findings[0].endIndex, 23);

    assert.equal(a2.findings[1].quote, '99.99%');
    assert.equal(a2.findings[1].startIndex, 24);
    assert.equal(a2.findings[1].endIndex, 30);

    assert.equal(a2.findings[2].quote, '35%');
    assert.equal(a2.findings[2].startIndex, 57);
    assert.equal(a2.findings[2].endIndex, 60);

    // 3. DOC-DEMO-CLEAN-APPROVAL
    const d3 = SEEDED_DOCS.cleanApproval;
    const h3 = hashReviewContent(d3.content);
    assert.equal(h3, d3.expectedHash, 'DOC-DEMO-CLEAN-APPROVAL content hash must strictly match');
    const a3 = analyzeLocalContent(d3.content);
    assert.equal(a3.score, d3.expectedScore, 'DOC-DEMO-CLEAN-APPROVAL score must equal 100');
    assert.equal(a3.findings.length, 0, 'DOC-DEMO-CLEAN-APPROVAL must have 0 findings');
  });

  test('Regression guard: Fails if content changes without recalculating hash', () => {
    const mutated = SEEDED_DOCS.needsReview.content + ' ';
    const mutatedHash = hashReviewContent(mutated);
    assert.notEqual(mutatedHash, SEEDED_DOCS.needsReview.expectedHash, 'A whitespace addition must produce a different hash');
  });

  test('Validates canonical workspace configuration hash calculation and EVD-R103 reference', () => {
    const workspaceData = {
      settings: DEFAULT_WORKSPACE_SETTINGS,
      guidelines: CANONICAL_GUIDELINES,
      evidence: CANONICAL_EVIDENCE,
      auditEvents: [],
    };
    store.set('brandlens.workspaceData.v1', JSON.stringify(workspaceData));

    const derivedHash = getWorkspaceAnalysisConfigHash();
    assert.equal(derivedHash, CANONICAL_CONFIG_HASH, 'Analysis config hash must match canonical fixed timestamp hash');

    const evdR103 = CANONICAL_EVIDENCE.find(e => e.id === 'EVD-R103');
    assert.ok(evdR103, 'EVD-R103 exists');
    assert.equal(evdR103.guidelineId, 'R-103', 'EVD-R103 associated with R-103');
    assert.equal(evdR103.verificationStatus, 'unverified', 'EVD-R103 status is unverified');
  });

  test('Initial seed post-insertion exact ID set and record_data assertions', () => {
    const simulateInitialSeedPostAssertions = (guidelines, evidence, settings) => {
      // 1. Settings assertion
      if (
        !settings ||
        settings.analysis_config_hash !== CANONICAL_CONFIG_HASH ||
        settings.config_version !== CANONICAL_CONFIG_VERSION ||
        JSON.stringify(settings.settings) !== JSON.stringify(CANONICAL_SETTINGS)
      ) {
        throw new Error('Post-assertion failed: workspace_settings does not strictly match canonical configuration.');
      }

      // 2. Guideline count and exact ID assertions
      const EXPECTED_G_IDS = ['R-101', 'R-102', 'R-103', 'R-104', 'R-105', 'R-106', 'R-107', 'R-108', 'R-109'];
      if (guidelines.length !== 9) {
        throw new Error('Post-assertion failed: workspace does not contain exactly 9 guidelines.');
      }
      for (const expectedId of EXPECTED_G_IDS) {
        const found = guidelines.find(g => g.id === expectedId);
        if (!found) {
          throw new Error(`Post-assertion failed: canonical guideline ${expectedId} is missing.`);
        }
        const canonicalG = CANONICAL_GUIDELINES.find(cg => cg.id === expectedId);
        if (JSON.stringify(found.record_data) !== JSON.stringify(canonicalG)) {
          throw new Error(`Post-assertion failed: canonical guideline ${expectedId} record_data differs.`);
        }
      }
      if (guidelines.some(g => !EXPECTED_G_IDS.includes(g.id))) {
        throw new Error('Post-assertion failed: unexpected non-canonical guideline ID found.');
      }

      // 3. Evidence count and exact ID assertions
      const EXPECTED_E_IDS = ['EVD-R102', 'EVD-R103'];
      if (evidence.length !== 2) {
        throw new Error('Post-assertion failed: workspace does not contain exactly 2 evidence records.');
      }
      for (const expectedId of EXPECTED_E_IDS) {
        const found = evidence.find(e => e.id === expectedId);
        if (!found) {
          throw new Error(`Post-assertion failed: canonical evidence ${expectedId} is missing.`);
        }
        const canonicalE = CANONICAL_EVIDENCE.find(ce => ce.id === expectedId);
        if (JSON.stringify(found.record_data) !== JSON.stringify(canonicalE)) {
          throw new Error(`Post-assertion failed: canonical evidence ${expectedId} record_data differs.`);
        }
      }
      if (evidence.some(e => !EXPECTED_E_IDS.includes(e.id))) {
        throw new Error('Post-assertion failed: unexpected non-canonical evidence ID found.');
      }

      return 'POST_ASSERTIONS_PASS';
    };

    const validGuidelines = CANONICAL_GUIDELINES.map(g => ({ id: g.id, record_data: g }));
    const validEvidence = CANONICAL_EVIDENCE.map(e => ({ id: e.id, record_data: e }));
    const validSettings = {
      analysis_config_hash: CANONICAL_CONFIG_HASH,
      config_version: CANONICAL_CONFIG_VERSION,
      settings: CANONICAL_SETTINGS,
    };

    assert.equal(simulateInitialSeedPostAssertions(validGuidelines, validEvidence, validSettings), 'POST_ASSERTIONS_PASS');

    // 9 guidelines containing 8 canonical IDs plus 1 unexpected ID
    const nineGuidelinesOneUnexpected = validGuidelines.slice(0, 8).concat([{ id: 'R-EXTRA-999', record_data: {} }]);
    assert.throws(() => simulateInitialSeedPostAssertions(nineGuidelinesOneUnexpected, validEvidence, validSettings), /canonical guideline R-109 is missing|unexpected non-canonical guideline ID/);

    // 2 evidence containing 1 canonical ID plus 1 unexpected ID
    const twoEvidenceOneUnexpected = [validEvidence[0], { id: 'EVD-EXTRA-999', record_data: {} }];
    assert.throws(() => simulateInitialSeedPostAssertions(validGuidelines, twoEvidenceOneUnexpected, validSettings), /canonical evidence EVD-R103 is missing|unexpected non-canonical evidence ID/);

    // Missing expected canonical ID
    assert.throws(() => simulateInitialSeedPostAssertions(validGuidelines.slice(0, 8), validEvidence, validSettings), /does not contain exactly 9 guidelines/);

    // Altered guideline record_data
    const alteredG = structuredClone(validGuidelines);
    alteredG[0].record_data.severity = 'minor';
    assert.throws(() => simulateInitialSeedPostAssertions(alteredG, validEvidence, validSettings), /canonical guideline R-101 record_data differs/);

    // Altered evidence record_data
    const alteredE = structuredClone(validEvidence);
    alteredE[0].record_data.title = 'Altered';
    assert.throws(() => simulateInitialSeedPostAssertions(validGuidelines, alteredE, validSettings), /canonical evidence EVD-R102 record_data differs/);
  });

  test('Restoration validation: null-safe title comparison, stale event removal, exact 12 canonical events, and Revision 1 timestamps', () => {
    const DEMO_IDS = ['DOC-DEMO-NEEDS-REVIEW', 'DOC-DEMO-EVIDENCE-REVIEW', 'DOC-DEMO-CLEAN-APPROVAL'];
    const EXPECTED_TITLES = {
      'DOC-DEMO-NEEDS-REVIEW': 'Demo · Launch claim review',
      'DOC-DEMO-EVIDENCE-REVIEW': 'Demo · Evidence verification',
      'DOC-DEMO-CLEAN-APPROVAL': 'Demo · Clean launch statement',
    };
    const EXPECTED_REV1_TIMESTAMPS = {
      'DOC-DEMO-NEEDS-REVIEW': '2026-10-30T09:02:00.000Z',
      'DOC-DEMO-EVIDENCE-REVIEW': '2026-10-30T09:07:00.000Z',
      'DOC-DEMO-CLEAN-APPROVAL': '2026-10-30T09:11:00.000Z',
    };

    const CANONICAL_STATUS_EVENTS = [
      // DOC-DEMO-NEEDS-REVIEW (4 events)
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'submitted', event_at: '2026-10-30T09:00:00.000Z', actor: 'System Demo Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'analysis_complete', event_at: '2026-10-30T09:01:00.000Z', actor: 'Deterministic Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'issues_found', event_at: '2026-10-30T09:01:30.000Z', actor: 'Deterministic Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'awaiting_human_verification', event_at: '2026-10-30T09:02:00.000Z', actor: 'Workflow Router' },
      // DOC-DEMO-EVIDENCE-REVIEW (4 events)
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'submitted', event_at: '2026-10-30T09:05:00.000Z', actor: 'System Demo Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'analysis_complete', event_at: '2026-10-30T09:06:00.000Z', actor: 'Deterministic Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'issues_found', event_at: '2026-10-30T09:06:30.000Z', actor: 'Deterministic Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'awaiting_human_verification', event_at: '2026-10-30T09:07:00.000Z', actor: 'Workflow Router' },
      // DOC-DEMO-CLEAN-APPROVAL (4 events)
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'submitted', event_at: '2026-10-30T09:10:00.000Z', actor: 'System Demo Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'analysis_complete', event_at: '2026-10-30T09:10:45.000Z', actor: 'Deterministic Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'validation_complete', event_at: '2026-10-30T09:10:55.000Z', actor: 'Deterministic Engine' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'awaiting_human_verification', event_at: '2026-10-30T09:11:00.000Z', actor: 'Workflow Router' },
    ];

    const simulateFullRestoration = (state) => {
      // 1. Workspace existence
      if (!state.workspaces.some(w => w.id === TARGET_WORKSPACE_ID)) {
        throw new Error('Workspace does not exist.');
      }
      // 2. Settings row exists and null-safe equality
      const settingsRow = state.settings.find(s => s.workspace_id === TARGET_WORKSPACE_ID);
      if (!settingsRow) throw new Error('workspace_settings row is missing.');
      if (
        settingsRow.analysis_config_hash !== CANONICAL_CONFIG_HASH ||
        settingsRow.config_version !== CANONICAL_CONFIG_VERSION ||
        JSON.stringify(settingsRow.settings) !== JSON.stringify(CANONICAL_SETTINGS)
      ) {
        throw new Error('workspace_settings is non-canonical.');
      }

      // 3. Guideline validation: reject any ID outside R-101..R-109, verify exact count 9, verify each expected ID exists and matches
      const EXPECTED_G_IDS = ['R-101', 'R-102', 'R-103', 'R-104', 'R-105', 'R-106', 'R-107', 'R-108', 'R-109'];
      if (state.guidelines.some(g => !EXPECTED_G_IDS.includes(g.id))) {
        throw new Error('Restoration precondition failed: unexpected guideline ID found.');
      }
      if (state.guidelines.length !== 9) {
        throw new Error('Restoration precondition failed: guidelines count is not exactly 9.');
      }
      for (const id of EXPECTED_G_IDS) {
        const found = state.guidelines.find(g => g.id === id);
        if (!found) throw new Error(`Restoration precondition failed: missing canonical guideline ID ${id}.`);
        const canonicalG = CANONICAL_GUIDELINES.find(cg => cg.id === id);
        if (JSON.stringify(found.record_data) !== JSON.stringify(canonicalG)) {
          throw new Error(`Restoration precondition failed: guideline ${id} record_data differs.`);
        }
      }

      // 4. Evidence validation: reject any ID outside EVD-R102..EVD-R103, verify exact count 2, verify both expected IDs exist and match
      const EXPECTED_E_IDS = ['EVD-R102', 'EVD-R103'];
      if (state.evidence.some(e => !EXPECTED_E_IDS.includes(e.id))) {
        throw new Error('Restoration precondition failed: unexpected evidence ID found.');
      }
      if (state.evidence.length !== 2) {
        throw new Error('Restoration precondition failed: evidence count is not exactly 2.');
      }
      for (const id of EXPECTED_E_IDS) {
        const found = state.evidence.find(e => e.id === id);
        if (!found) throw new Error(`Restoration precondition failed: missing canonical evidence ID ${id}.`);
        const canonicalE = CANONICAL_EVIDENCE.find(ce => ce.id === id);
        if (JSON.stringify(found.record_data) !== JSON.stringify(canonicalE)) {
          throw new Error(`Restoration precondition failed: evidence ${id} record_data differs.`);
        }
      }

      // 5. Individual review existence
      for (const id of DEMO_IDS) {
        if (!state.reviews.some(r => r.workspace_id === TARGET_WORKSPACE_ID && r.id === id)) {
          throw new Error(`Review ${id} is missing.`);
        }
      }

      // 6. Individual Revision 1 existence
      for (const id of DEMO_IDS) {
        if (!state.revisions.some(r => r.workspace_id === TARGET_WORKSPACE_ID && r.review_id === id && r.revision_number === 1)) {
          throw new Error(`Revision 1 missing for ${id}.`);
        }
      }

      // Execution:
      // a. Delete decisions for demo reviews
      state.decisions = state.decisions.filter(d => !DEMO_IDS.includes(d.review_id));
      // b. Delete revisions > 1 for demo reviews
      state.revisions = state.revisions.filter(r => !(DEMO_IDS.includes(r.review_id) && r.revision_number > 1));
      // c. Remove ALL status events for demo reviews (clearing stale non-decision events as well)
      state.review_status_events = state.review_status_events.filter(e => !(e.workspace_id === TARGET_WORKSPACE_ID && DEMO_IDS.includes(e.review_id)));
      // d. Reconstruct exact original 12 canonical status events
      state.review_status_events.push(...CANONICAL_STATUS_EVENTS);

      // e. Update reviews with title reset and canonical state
      state.reviews = state.reviews.map(r => {
        if (!DEMO_IDS.includes(r.id)) return r;
        const canonicalTitle = EXPECTED_TITLES[r.id];
        return {
          ...r,
          title: canonicalTitle,
          status: 'awaiting_human_verification',
          current_revision: 1,
          record_data: {
            ...r.record_data,
            title: canonicalTitle,
            status: 'awaiting_human_verification',
          },
        };
      });

      // f. Reconstruct Revision 1 with exact created_at timestamps
      state.revisions = state.revisions.map(rev => {
        if (!DEMO_IDS.includes(rev.review_id)) return rev;
        return {
          ...rev,
          status: 'awaiting_human_verification',
          created_at: EXPECTED_REV1_TIMESTAMPS[rev.review_id],
        };
      });

      // 7. Post-restoration title assertion (null-safe IS DISTINCT FROM comparison)
      for (const id of DEMO_IDS) {
        const r = state.reviews.find(rev => rev.id === id);
        const canonicalTitle = EXPECTED_TITLES[id];
        const jsonTitle = r.record_data?.title;

        // Simulate PostgreSQL IS DISTINCT FROM null-safe comparison
        const titleMismatchCanonical = r.title === null || r.title === undefined || r.title !== canonicalTitle;
        const titleMismatchJson = r.title === null || r.title === undefined || jsonTitle === null || jsonTitle === undefined || r.title !== jsonTitle;

        if (titleMismatchCanonical || titleMismatchJson) {
          throw new Error(`Post-restoration assertion failed: review title does not strictly match canonical definition or record_data.title for ${id}.`);
        }
      }

      return 'FULL_RESTORATION_PASS';
    };

    const initialStatusEvents = [
      // 12 canonical events initially
      ...CANONICAL_STATUS_EVENTS,
      // Stale non-decision event added during test (e.g. user re-submitted draft revision 2)
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'draft', event_at: '2026-10-30T10:00:00.000Z', actor: 'Judge Editor' },
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'submitted', event_at: '2026-10-30T10:01:00.000Z', actor: 'Judge Editor' },
      // Stale decision event
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'approved', event_at: '2026-10-30T10:05:00.000Z', actor: 'Judge Reviewer' },
      // Unrelated review event
      { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-USER-CUSTOM', status: 'approved', event_at: '2026-10-30T10:10:00.000Z', actor: 'Other User' },
    ];

    const baseState = {
      workspaces: [{ id: TARGET_WORKSPACE_ID }],
      settings: [{ workspace_id: TARGET_WORKSPACE_ID, analysis_config_hash: CANONICAL_CONFIG_HASH, config_version: CANONICAL_CONFIG_VERSION, settings: CANONICAL_SETTINGS }],
      guidelines: CANONICAL_GUIDELINES.map(g => ({ workspace_id: TARGET_WORKSPACE_ID, id: g.id, record_data: g })),
      evidence: CANONICAL_EVIDENCE.map(e => ({ workspace_id: TARGET_WORKSPACE_ID, id: e.id, record_data: e })),
      reviews: [
        { id: 'DOC-DEMO-NEEDS-REVIEW', workspace_id: TARGET_WORKSPACE_ID, title: 'Mutated Title', status: 'approved', record_data: { title: 'Mutated Title' } },
        { id: 'DOC-DEMO-EVIDENCE-REVIEW', workspace_id: TARGET_WORKSPACE_ID, title: 'Demo · Evidence verification', status: 'changes_requested', record_data: { title: 'Demo · Evidence verification' } },
        { id: 'DOC-DEMO-CLEAN-APPROVAL', workspace_id: TARGET_WORKSPACE_ID, title: 'Demo · Clean launch statement', status: 'approved', record_data: { title: 'Demo · Clean launch statement' } },
        { id: 'DOC-USER-CUSTOM', workspace_id: TARGET_WORKSPACE_ID, title: 'Custom User Doc', status: 'approved', record_data: { title: 'Custom User Doc' } },
      ],
      revisions: [
        { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', revision_number: 1, created_at: '2026-10-30T09:00:00.000Z' },
        { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-NEEDS-REVIEW', revision_number: 2, created_at: '2026-10-30T10:00:00.000Z' },
        { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-EVIDENCE-REVIEW', revision_number: 1, created_at: '2026-10-30T09:00:00.000Z' },
        { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-DEMO-CLEAN-APPROVAL', revision_number: 1, created_at: '2026-10-30T09:00:00.000Z' },
        { workspace_id: TARGET_WORKSPACE_ID, review_id: 'DOC-USER-CUSTOM', revision_number: 1, created_at: '2026-10-30T09:00:00.000Z' },
      ],
      decisions: [{ review_id: 'DOC-DEMO-NEEDS-REVIEW', decision: 'approved' }, { review_id: 'DOC-USER-CUSTOM', decision: 'approved' }],
      review_status_events: structuredClone(initialStatusEvents),
      workspace_audit_events: [{ id: 'AUDIT-1', type: 'seed', event_at: '2026-10-30T09:00:00.000Z' }],
    };

    // 1. Success test: Cleans stale events, recreates exact 12 canonical events, resets titles and Revision 1 timestamps
    const testState1 = structuredClone(baseState);
    assert.equal(simulateFullRestoration(testState1), 'FULL_RESTORATION_PASS');

    // Verify exactly 12 events for demo reviews + 1 unrelated review event = 13 total events
    assert.equal(testState1.review_status_events.length, 13);
    const demoEvents = testState1.review_status_events.filter(e => DEMO_IDS.includes(e.review_id));
    assert.equal(demoEvents.length, 12, 'Exactly 12 canonical status events reconstructed for demo reviews');
    const unrelatedEvent = testState1.review_status_events.find(e => e.review_id === 'DOC-USER-CUSTOM');
    assert.ok(unrelatedEvent, 'Unrelated review status events preserved');

    // Verify workspace_audit_events completely untouched
    assert.equal(testState1.workspace_audit_events.length, 1);
    assert.equal(testState1.workspace_audit_events[0].id, 'AUDIT-1', 'Audit events preserved without deletion');

    // Verify exact Revision 1 timestamps
    const rev1Needs = testState1.revisions.find(r => r.review_id === 'DOC-DEMO-NEEDS-REVIEW' && r.revision_number === 1);
    assert.equal(rev1Needs.created_at, '2026-10-30T09:02:00.000Z', 'NEEDS-REVIEW Revision 1 created_at matches exact seed timestamp');
    const rev1Evidence = testState1.revisions.find(r => r.review_id === 'DOC-DEMO-EVIDENCE-REVIEW' && r.revision_number === 1);
    assert.equal(rev1Evidence.created_at, '2026-10-30T09:07:00.000Z', 'EVIDENCE-REVIEW Revision 1 created_at matches exact seed timestamp');
    const rev1Clean = testState1.revisions.find(r => r.review_id === 'DOC-DEMO-CLEAN-APPROVAL' && r.revision_number === 1);
    assert.equal(rev1Clean.created_at, '2026-10-30T09:11:00.000Z', 'CLEAN-APPROVAL Revision 1 created_at matches exact seed timestamp');

    // 2. Failure test: NULL or missing record_data.title triggers assertion failure
    const nullTitleState = structuredClone(baseState);
    delete nullTitleState.reviews[0].record_data.title;
    // Simulate faulty restoration that left record_data.title undefined
    nullTitleState.reviews[0].title = EXPECTED_TITLES['DOC-DEMO-NEEDS-REVIEW'];
    assert.throws(() => {
      // Simulate postcondition
      const r = nullTitleState.reviews[0];
      const jsonTitle = r.record_data?.title;
      if (isDistinctFrom(r.title, EXPECTED_TITLES[r.id]) || isDistinctFrom(r.title, jsonTitle)) {
        throw new Error('Post-restoration assertion failed: review title does not strictly match canonical definition or record_data.title.');
      }
    }, /Post-restoration assertion failed/);

    // 3. Failure test: Mismatched top-level title and record_data.title
    const mismatchedTitleState = structuredClone(baseState);
    mismatchedTitleState.reviews[0].title = EXPECTED_TITLES['DOC-DEMO-NEEDS-REVIEW'];
    mismatchedTitleState.reviews[0].record_data.title = 'Different JSON Title';
    assert.throws(() => {
      const r = mismatchedTitleState.reviews[0];
      const jsonTitle = r.record_data?.title;
      if (isDistinctFrom(r.title, EXPECTED_TITLES[r.id]) || isDistinctFrom(r.title, jsonTitle)) {
        throw new Error('Post-restoration assertion failed: review title does not strictly match canonical definition or record_data.title.');
      }
    }, /Post-restoration assertion failed/);
  });

  test('Static audit of permanent SQL files: supabase/seed/judge_demo_initial_seed.sql and supabase/seed/judge_demo_restore.sql', () => {
    const fs = require('fs');
    const path = require('path');

    const seedPath = path.resolve(__dirname, '../supabase/seed/judge_demo_initial_seed.sql');
    const restorePath = path.resolve(__dirname, '../supabase/seed/judge_demo_restore.sql');

    assert.ok(fs.existsSync(seedPath), 'judge_demo_initial_seed.sql exists on disk');
    assert.ok(fs.existsSync(restorePath), 'judge_demo_restore.sql exists on disk');

    const seedSql = fs.readFileSync(seedPath, 'utf8');
    const restoreSql = fs.readFileSync(restorePath, 'utf8');

    const bothSql = [seedSql, restoreSql];

    // 1. Target workspace lock and UUID
    for (const sql of bothSql) {
      assert.ok(sql.includes(TARGET_WORKSPACE_ID), 'Must explicitly target workspace 2ca5874e-4711-4354-8b81-873847edbd55');
      assert.ok(sql.includes('perform pg_advisory_xact_lock'), 'Must acquire transaction-scoped advisory lock');
      assert.ok(sql.includes('perform 1 from public.workspaces where id = v_ws for update;'), 'Must verify and lock workspace row');
    }

    // 2. Real table names vs nonexistent tables
    for (const sql of bothSql) {
      assert.ok(sql.includes('public.guidelines'), 'Must reference real table public.guidelines');
      assert.ok(sql.includes('public.reviews'), 'Must reference real table public.reviews');
      assert.ok(sql.includes('public.review_revisions'), 'Must reference real table public.review_revisions');
      assert.ok(sql.includes('public.review_status_events'), 'Must reference real table public.review_status_events');
      assert.ok(sql.includes('public.evidence_records'), 'Must reference real table public.evidence_records');

      assert.equal(sql.includes('public.brand_guidelines'), false, 'Must NOT reference nonexistent public.brand_guidelines');
      assert.equal(sql.includes('document_type'), false, 'Must NOT reference nonexistent column document_type');
      assert.equal(sql.includes('snapshot_data'), false, 'Must NOT reference nonexistent column snapshot_data');
      assert.equal(sql.includes('storage_uri'), false, 'Must NOT reference nonexistent column storage_uri');
      assert.equal(sql.includes('review_status_events (workspace_id, review_id, status, notes'), false, 'Must NOT use nonexistent notes column');
    }

    // 3. Exact canonical content, hashes, and configuration
    for (const sql of bothSql) {
      assert.ok(sql.includes(CANONICAL_CONFIG_HASH), 'Must enforce config hash fnv1a-60a065f7');
      assert.ok(sql.includes(SEEDED_DOCS.needsReview.expectedHash), 'Must reference NEEDS-REVIEW hash fnv1a-014f3bd2');
      assert.ok(sql.includes(SEEDED_DOCS.evidenceReview.expectedHash), 'Must reference EVIDENCE-REVIEW hash fnv1a-0f9dfe37');
      assert.ok(sql.includes(SEEDED_DOCS.cleanApproval.expectedHash), 'Must reference CLEAN-APPROVAL hash fnv1a-5c473dda');

      assert.ok(sql.includes(SEEDED_DOCS.needsReview.content), 'Must contain exact NEEDS-REVIEW content');
      assert.ok(sql.includes(SEEDED_DOCS.evidenceReview.content), 'Must contain exact EVIDENCE-REVIEW content');
      assert.ok(sql.includes(SEEDED_DOCS.cleanApproval.content), 'Must contain exact CLEAN-APPROVAL content');

      assert.ok(sql.includes('Demo · Launch claim review'), 'Must contain canonical title Demo · Launch claim review');
      assert.ok(sql.includes('Demo · Evidence verification'), 'Must contain canonical title Demo · Evidence verification');
      assert.ok(sql.includes('Demo · Clean launch statement'), 'Must contain canonical title Demo · Clean launch statement');
    }

    // 4. Null-safe comparisons
    for (const sql of bothSql) {
      assert.ok(sql.includes('is distinct from'), 'Must use null-safe IS DISTINCT FROM');
      assert.ok(sql.includes('is not distinct from'), 'Must use null-safe IS NOT DISTINCT FROM');
    }

    // 5. Preconditions: individual review checks and revision 1 checks in restoreSql
    assert.ok(restoreSql.includes("where workspace_id = v_ws and id = 'DOC-DEMO-NEEDS-REVIEW' for update;"), 'Checks DOC-DEMO-NEEDS-REVIEW individually');
    assert.ok(restoreSql.includes("where workspace_id = v_ws and id = 'DOC-DEMO-EVIDENCE-REVIEW' for update;"), 'Checks DOC-DEMO-EVIDENCE-REVIEW individually');
    assert.ok(restoreSql.includes("where workspace_id = v_ws and id = 'DOC-DEMO-CLEAN-APPROVAL' for update;"), 'Checks DOC-DEMO-CLEAN-APPROVAL individually');

    assert.ok(restoreSql.includes("where workspace_id = v_ws and review_id = 'DOC-DEMO-NEEDS-REVIEW' and revision_number = 1 for update;"), 'Checks revision 1 individually');
    assert.ok(restoreSql.includes("where workspace_id = v_ws and review_id = 'DOC-DEMO-EVIDENCE-REVIEW' and revision_number = 1 for update;"), 'Checks revision 1 individually');
    assert.ok(restoreSql.includes("where workspace_id = v_ws and review_id = 'DOC-DEMO-CLEAN-APPROVAL' and revision_number = 1 for update;"), 'Checks revision 1 individually');

    // 6. Preservation checks
    assert.equal(restoreSql.includes('delete from public.review_attachments'), false, 'Must NOT delete review_attachments');
    assert.equal(restoreSql.includes('workspace_audit_events'), false, 'Must NOT mutate workspace_audit_events');
    assert.equal(seedSql.includes('workspace_audit_events'), false, 'Must NOT mutate workspace_audit_events');

    // 7. Status events schema compliance and parsed 12 canonical events matching
    assert.ok(seedSql.includes('insert into public.review_status_events (workspace_id, review_id, status, event_at, actor, event_data)'), 'Seed status events schema');
    assert.ok(restoreSql.includes('insert into public.review_status_events (workspace_id, review_id, status, event_at, actor, event_data)'), 'Restore status events schema');

    const EXPECTED_STATUS_EVENTS = [
      { review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'submitted', event_at: '2026-10-30T09:00:00.000Z', actor: 'System Demo Engine', revision: 1, note: 'Document submitted for editorial intelligence scan.' },
      { review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'analysis_complete', event_at: '2026-10-30T09:01:00.000Z', actor: 'Deterministic Engine', revision: 1, note: 'Completed deterministic analysis across 9 active guidelines.' },
      { review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'issues_found', event_at: '2026-10-30T09:01:30.000Z', actor: 'Deterministic Engine', revision: 1, note: 'Flagged 5 findings: 2 critical, 2 moderate, 1 minor.' },
      { review_id: 'DOC-DEMO-NEEDS-REVIEW', status: 'awaiting_human_verification', event_at: '2026-10-30T09:02:00.000Z', actor: 'Workflow Router', revision: 1, note: 'Transferred to Human Verification Gate.' },

      { review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'submitted', event_at: '2026-10-30T09:05:00.000Z', actor: 'System Demo Engine', revision: 1, note: 'Document submitted for evidence verification check.' },
      { review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'analysis_complete', event_at: '2026-10-30T09:06:00.000Z', actor: 'Deterministic Engine', revision: 1, note: 'Completed evidence alignment check.' },
      { review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'issues_found', event_at: '2026-10-30T09:06:30.000Z', actor: 'Deterministic Engine', revision: 1, note: 'Flagged 3 critical unverified claims.' },
      { review_id: 'DOC-DEMO-EVIDENCE-REVIEW', status: 'awaiting_human_verification', event_at: '2026-10-30T09:07:00.000Z', actor: 'Workflow Router', revision: 1, note: 'Requires human sign-off on unverified claims.' },

      { review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'submitted', event_at: '2026-10-30T09:10:00.000Z', actor: 'System Demo Engine', revision: 1, note: 'Document submitted for baseline brand check.' },
      { review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'analysis_complete', event_at: '2026-10-30T09:10:45.000Z', actor: 'Deterministic Engine', revision: 1, note: 'Completed deterministic check.' },
      { review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'validation_complete', event_at: '2026-10-30T09:10:55.000Z', actor: 'Deterministic Engine', revision: 1, note: 'Zero violations detected (100% compliance). disposition: ready for verification.' },
      { review_id: 'DOC-DEMO-CLEAN-APPROVAL', status: 'awaiting_human_verification', event_at: '2026-10-30T09:11:00.000Z', actor: 'Workflow Router', revision: 1, note: 'Awaiting human verification sign-off.' },
    ];

    const CANONICAL_ACTOR_MAP = {
      'submitted': 'System Demo Engine',
      'analysis_complete': 'Deterministic Engine',
      'issues_found': 'Deterministic Engine',
      'validation_complete': 'Deterministic Engine',
      'awaiting_human_verification': 'Workflow Router',
    };

    function parseStatusHistory(sqlText) {
      const results = [];
      const re = /jsonb_build_object\('status',\s*'([^']+)',\s*'at',\s*'([^']+)',\s*'actor',\s*'([^']+)',\s*'revision',\s*(\d+),\s*'note',\s*'([^']+)'\)/g;
      let m;
      while ((m = re.exec(sqlText)) !== null) {
        results.push({
          status: m[1],
          at: m[2],
          actor: m[3],
          revision: Number(m[4]),
          note: m[5],
        });
      }
      return results;
    }

    function parseRelationalEvents(sqlText) {
      const results = [];
      const re = /\(v_ws,\s*'(DOC-DEMO-[A-Z-]+)',\s*'([^']+)',\s*'([^']+)'::timestamptz,\s*'([^']+)',\s*'(\{.*?\})'::jsonb\)/g;
      let m;
      while ((m = re.exec(sqlText)) !== null) {
        const data = JSON.parse(m[5]);
        results.push({
          review_id: m[1],
          status: m[2],
          event_at: m[3],
          actor: m[4],
          revision: data.revision,
          note: data.note,
        });
      }
      return results;
    }

    const seedHistory = parseStatusHistory(seedSql);
    const restoreHistory = parseStatusHistory(restoreSql);
    const seedRelational = parseRelationalEvents(seedSql);
    const restoreRelational = parseRelationalEvents(restoreSql);

    assert.equal(seedHistory.length, 12, 'Seed SQL has exactly 12 parsed statusHistory items');
    assert.equal(restoreHistory.length, 12, 'Restore SQL has exactly 12 parsed statusHistory items');
    assert.equal(seedRelational.length, 12, 'Seed SQL has exactly 12 parsed relational events');
    assert.equal(restoreRelational.length, 12, 'Restore SQL has exactly 12 parsed relational events');

    // Deep equality across parsed events from both SQL files
    assert.deepEqual(seedHistory, restoreHistory, 'statusHistory entries in seed and restore SQL must be identical');
    assert.deepEqual(seedRelational, restoreRelational, 'relational events in seed and restore SQL must be identical');

    for (let i = 0; i < 12; i++) {
      const expected = EXPECTED_STATUS_EVENTS[i];
      const h = seedHistory[i];
      const r = seedRelational[i];

      // Verify canonical actor mapping
      assert.equal(CANONICAL_ACTOR_MAP[expected.status], expected.actor, 'Canonical actor map matches expected');
      assert.equal(h.actor, CANONICAL_ACTOR_MAP[h.status], `History actor for ${h.status} must match canonical actor map`);
      assert.equal(r.actor, CANONICAL_ACTOR_MAP[r.status], `Relational actor for ${r.status} must match canonical actor map`);

      // Verify alignment between embedded statusHistory and relational event row
      assert.equal(h.status, r.status, `Status must align at index ${i}`);
      assert.equal(h.at, r.event_at, `Timestamp must align at index ${i}`);
      assert.equal(h.actor, r.actor, `Actor must align at index ${i}`);
      assert.equal(h.revision, r.revision, `Revision must align at index ${i}`);
      assert.equal(h.note, r.note, `Note must align at index ${i}`);

      // Verify against canonical expected event
      assert.equal(r.review_id, expected.review_id, `Review ID must match at index ${i}`);
      assert.equal(r.status, expected.status, `Status must match at index ${i}`);
      assert.equal(r.event_at, expected.event_at, `Timestamp must match at index ${i}`);
      assert.equal(r.actor, expected.actor, `Actor must match at index ${i}`);
      assert.equal(r.note, expected.note, `Note must match at index ${i}`);
    }

    // 8. Restoration updated_at timestamps match canonical seed
    assert.ok(
      restoreSql.includes("updated_at = '2026-10-30 09:02:00+00'::timestamptz\n  where workspace_id = v_ws and id = 'DOC-DEMO-NEEDS-REVIEW'"),
      'Restore DOC-DEMO-NEEDS-REVIEW updated_at matches canonical seed timestamp'
    );
    assert.ok(
      restoreSql.includes("updated_at = '2026-10-30 09:07:00+00'::timestamptz\n  where workspace_id = v_ws and id = 'DOC-DEMO-EVIDENCE-REVIEW'"),
      'Restore DOC-DEMO-EVIDENCE-REVIEW updated_at matches canonical seed timestamp'
    );
    assert.ok(
      restoreSql.includes("updated_at = '2026-10-30 09:11:00+00'::timestamptz\n  where workspace_id = v_ws and id = 'DOC-DEMO-CLEAN-APPROVAL'"),
      'Restore DOC-DEMO-CLEAN-APPROVAL updated_at matches canonical seed timestamp'
    );

    // 9. Null-safe post-restoration assertion for updated_at
    assert.ok(
      restoreSql.includes("updated_at is distinct from '2026-10-30 09:02:00+00'::timestamptz"),
      'Post-restoration null-safe assertion for DOC-DEMO-NEEDS-REVIEW updated_at'
    );
    assert.ok(
      restoreSql.includes("updated_at is distinct from '2026-10-30 09:07:00+00'::timestamptz"),
      'Post-restoration null-safe assertion for DOC-DEMO-EVIDENCE-REVIEW updated_at'
    );
    assert.ok(
      restoreSql.includes("updated_at is distinct from '2026-10-30 09:11:00+00'::timestamptz"),
      'Post-restoration null-safe assertion for DOC-DEMO-CLEAN-APPROVAL updated_at'
    );
  });
});

// Helper for simulating PostgreSQL IS DISTINCT FROM null-safe comparison
function isDistinctFrom(a, b) {
  if (a === null || a === undefined) {
    return b !== null && b !== undefined;
  }
  if (b === null || b === undefined) {
    return true;
  }
  return a !== b;
}
