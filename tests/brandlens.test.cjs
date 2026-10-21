require('./register-typescript.cjs');

const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const { randomUUID } = require('node:crypto');

const store = new Map();
global.window = {
  crypto: { randomUUID },
  localStorage: {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
  dispatchEvent: () => true,
};

const { analyzeLocalContent, getLocalEvidenceCatalogue } = require('../src/services/localReviewEngine.ts');
const { getEvidenceCitationRewrite } = require('../src/services/evidenceCitation.ts');
const {
  decideReviewRecord,
  readReviewRecords,
  resubmitReviewRecord,
  saveReviewDraft,
  saveReviewRecord,
} = require('../src/services/reviewStorage.ts');
const { createAuditTrailExport } = require('../src/services/auditTrailExport.ts');
const { getWorkspaceAnalysisConfigHash } = require('../src/services/workspaceStorage.ts');

beforeEach(() => {
  window.localStorage.clear();
});

test('local analysis covers requested high-risk rules and applies exact severity scoring', () => {
  const result = analyzeLocalContent(
    'A revolutionary offer guarantees 100% growth. Enjoy synergy, click here, ignore the competitors!!',
    { foreground: '#000000', background: '#FFFFFF', accent: '#0000FF' },
  );
  const ruleIds = new Set(result.findings.map((finding) => finding.ruleId));

  for (const ruleId of ['R-101', 'R-103', 'R-104', 'R-106', 'R-107', 'R-108']) {
    assert.ok(ruleIds.has(ruleId), `expected a finding from ${ruleId}`);
  }

  const expectedScore = Math.max(0, 100 - 20 * result.findings.filter((item) => item.severity === 'critical').length
    - 10 * result.findings.filter((item) => item.severity === 'moderate').length
    - 4 * result.findings.filter((item) => item.severity === 'minor').length);
  assert.equal(result.score, expectedScore);
  assert.ok(result.findings.length >= 8, 'the combined sample should exercise multiple matched terms');
});

test('repeated matches each contribute to findings and the score', () => {
  const result = analyzeLocalContent('Synergy helps teams; synergy improves collaboration.');
  const matches = result.findings.filter((finding) => finding.ruleId === 'R-104');

  assert.equal(matches.length, 2);
  assert.equal(result.score, 92);
});

test('consistency scoring never drops below zero', () => {
  const result = analyzeLocalContent('Guarantees 100% growth. '.repeat(6));

  assert.ok(result.findings.length > 5);
  assert.equal(result.score, 0);
});

test('unverified evidence rewrites use a placeholder and preserve the finding status', () => {
  const content = 'We target 99.99% availability.';
  const result = analyzeLocalContent(content);
  const finding = result.findings.find((candidate) => candidate.quote.includes('99.99%'));
  assert.ok(finding);
  assert.equal(finding.evidenceStatus, 'unverified');

  const rewrite = getEvidenceCitationRewrite(content, finding, getLocalEvidenceCatalogue());
  assert.ok(rewrite);
  assert.match(rewrite.text, /\[approved evidence required\]/);
  assert.doesNotMatch(rewrite.text, /EVD-01/);
  assert.doesNotMatch(rewrite.text, /\[Evidence citation:/);
  assert.equal(finding.evidenceStatus, 'unverified');
});

test('editing and re-analysing an approved record creates a new unapproved revision', () => {
  const configHash = getWorkspaceAnalysisConfigHash();
  const originalContent = 'Clear and helpful editorial copy.';
  const submission = {
    title: 'Approval lifecycle test',
    contentType: 'Social post',
    campaign: '',
    author: 'Regression test',
    content: originalContent,
  };
  const analysis = analyzeLocalContent(originalContent);
  const created = saveReviewRecord(submission, analysis.score, analysis.findings, analysis.summary, configHash);
  const approved = decideReviewRecord(created.id, 'approved', 'Test reviewer', '', configHash);

  assert.equal(approved.status, 'approved');
  assert.equal(approved.approvedRevision, 1);

  const revisedContent = `${originalContent} Updated wording.`;
  saveReviewDraft(created.id, revisedContent);
  const revisedAnalysis = analyzeLocalContent(revisedContent);
  const resubmitted = resubmitReviewRecord(
    created.id,
    { ...submission, content: revisedContent },
    revisedAnalysis.score,
    revisedAnalysis.findings,
    revisedAnalysis.summary,
    revisedAnalysis.configHash,
  );

  assert.equal(resubmitted.revision, 2);
  assert.equal(resubmitted.status, 'awaiting_human_verification');
  assert.equal(resubmitted.approvedRevision, 1);
  assert.equal(resubmitted.decisionHistory.length, 1);
  assert.equal(resubmitted.decisionHistory[0].revision, 1);
  assert.equal(readReviewRecords()[0].status, 'awaiting_human_verification');
});

test('audit export keeps live and seeded records separated and tags nested lifecycle events', () => {
  const liveRecord = {
    id: 'DOC-LIVE',
    events: [{ id: 'DOC-LIVE-event-1' }],
  };
  const seededRecord = { id: 'AUD-5881' };
  const exported = createAuditTrailExport([liveRecord], [seededRecord]);

  assert.deepEqual(exported.liveAuditRecords.map((record) => record.id), ['DOC-LIVE']);
  assert.deepEqual(exported.seededExampleRecords.map((record) => record.id), ['AUD-5881']);
  assert.equal(exported.liveAuditRecords[0].recordOrigin, 'live');
  assert.equal(exported.liveAuditRecords[0].events[0].recordOrigin, 'live');
  assert.equal(exported.seededExampleRecords[0].recordOrigin, 'seeded_example');
  assert.equal('AUD-5881', exported.seededExampleRecords[0].id);
  assert.equal(exported.liveAuditRecords.some((record) => record.id.startsWith('AUD-')), false);
});
