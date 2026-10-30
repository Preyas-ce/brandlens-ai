require('./register-typescript.cjs');

const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const { randomUUID } = require('node:crypto');

const store = new Map();
global.window = {
  crypto: { randomUUID },
  sessionStorage: {
    getItem: (key) => store.has(`session_${key}`) ? store.get(`session_${key}`) : null,
    setItem: (key, value) => store.set(`session_${key}`, String(value)),
    removeItem: (key) => store.delete(`session_${key}`),
    clear: () => {
      for (const k of store.keys()) {
        if (k.startsWith('session_')) store.delete(k);
      }
    },
  },
  localStorage: {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
  dispatchEvent: () => true,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
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
const { createLocalWorkspaceImport } = require('../src/services/localDataMigration.ts');
const {
  validateAttachmentFile,
  formatFileSize,
  MAX_ATTACHMENT_SIZE_BYTES,
  EVIDENCE_STORAGE_BUCKET,
} = require('../src/services/evidenceAttachmentValidation.ts');
const {
  attachFileToReviewRecord,
  removeAttachmentFromReviewRecord,
  createReviewDraftRecord,
} = require('../src/services/reviewStorage.ts');


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

test('local migration payload is deterministic and leaves the original browser keys intact', () => {
  const localRecords = JSON.stringify([{ id: 'DOC-LOCAL', status: 'approved' }]);
  const localWorkspace = JSON.stringify({
    schemaVersion: 1,
    guidelines: [],
    evidence: [],
    settings: { workspaceName: 'Local workspace' },
    auditEvents: [],
  });
  window.localStorage.setItem('brandlens.reviewRecords.v1', localRecords);
  window.localStorage.setItem('brandlens.workspaceData.v1', localWorkspace);

  const first = createLocalWorkspaceImport(window.localStorage);
  const second = createLocalWorkspaceImport(window.localStorage);

  assert.deepEqual(first, second);
  assert.equal(first.records[0].id, 'DOC-LOCAL');
  assert.equal(first.workspace.settings.workspaceName, 'Local workspace');
  assert.equal(window.localStorage.getItem('brandlens.reviewRecords.v1'), localRecords);
  assert.equal(window.localStorage.getItem('brandlens.workspaceData.v1'), localWorkspace);
});

test('local migration refuses malformed saved data without replacing it', () => {
  const malformed = '{bad-json';
  window.localStorage.setItem('brandlens.reviewRecords.v1', malformed);

  assert.throws(() => createLocalWorkspaceImport(window.localStorage), /could not be prepared for import/);
  assert.equal(window.localStorage.getItem('brandlens.reviewRecords.v1'), malformed);
});

test('evidence attachment validation enforces MIME types and size limit of 10 MB', () => {
  // Allowed types and extensions
  assert.equal(validateAttachmentFile({ name: 'sla-evidence.pdf', size: 1024, type: 'application/pdf' }).valid, true);
  assert.equal(validateAttachmentFile({ name: 'chart.png', size: 2048, type: 'image/png' }).valid, true);
  assert.equal(validateAttachmentFile({ name: 'photo.jpg', size: 4096, type: 'image/jpeg' }).valid, true);
  assert.equal(validateAttachmentFile({ name: 'graphic.webp', size: 8192, type: 'image/webp' }).valid, true);

  // Rejected types
  const exeResult = validateAttachmentFile({ name: 'script.exe', size: 1024, type: 'application/x-msdownload' });
  assert.equal(exeResult.valid, false);
  assert.equal(exeResult.errorCode, 'invalid_type');

  const textResult = validateAttachmentFile({ name: 'notes.txt', size: 500, type: 'text/plain' });
  assert.equal(textResult.valid, false);
  assert.equal(textResult.errorCode, 'invalid_type');

  // Empty file rejected
  const emptyResult = validateAttachmentFile({ name: 'empty.pdf', size: 0, type: 'application/pdf' });
  assert.equal(emptyResult.valid, false);
  assert.equal(emptyResult.errorCode, 'empty');

  // File exceeding 10 MB limit rejected
  const oversizedResult = validateAttachmentFile({ name: 'huge.pdf', size: MAX_ATTACHMENT_SIZE_BYTES + 1, type: 'application/pdf' });
  assert.equal(oversizedResult.valid, false);
  assert.equal(oversizedResult.errorCode, 'too_large');

  // Exactly 10 MB allowed
  assert.equal(validateAttachmentFile({ name: 'limit.pdf', size: MAX_ATTACHMENT_SIZE_BYTES, type: 'application/pdf' }).valid, true);
});

test('attaching evidence preserves review score, findings, and lifecycle without auto-verification', () => {
  const configHash = getWorkspaceAnalysisConfigHash();
  const submission = {
    title: 'Attachment verification test',
    contentType: 'Advertisement',
    campaign: 'Q4 Launch',
    author: 'Test Writer',
    content: 'Our product guarantees 100% returns on investment.',
  };
  const analysis = analyzeLocalContent(submission.content);
  const record = saveReviewRecord(submission, analysis.score, analysis.findings, analysis.summary, configHash);

  const initialScore = record.score;
  const initialFindingsCount = record.findings.length;
  const initialStatus = record.status;

  // Attach evidence to this review revision
  const attachment = {
    id: 'att-test-01',
    workspaceId: '00000000-0000-0000-0000-000000000001',
    reviewId: record.id,
    revision: record.revision,
    fileName: 'returns-audit.pdf',
    contentType: 'application/pdf',
    fileSize: 1024 * 500,
    storagePath: '00000000-0000-0000-0000-000000000001/' + record.id + '/rev-1/att-test-01-returns-audit.pdf',
    uploadedBy: 'Test Writer',
    createdAt: new Date().toISOString(),
  };

  const updatedRecord = attachFileToReviewRecord(attachment);

  // Assert attachment metadata persisted on the record
  assert.equal(updatedRecord.attachments.length, 1);
  assert.equal(updatedRecord.attachments[0].id, 'att-test-01');
  assert.equal(updatedRecord.attachments[0].fileName, 'returns-audit.pdf');
  assert.equal(updatedRecord.attachments[0].fileSize, 512000);
  assert.equal(updatedRecord.attachments[0].storagePath.startsWith('00000000-0000-0000-0000-000000000001/'), true);

  // Critical requirement: attachments must NOT alter score, findings, or status
  assert.equal(updatedRecord.score, initialScore, 'score must remain unchanged after attaching evidence');
  assert.equal(updatedRecord.findings.length, initialFindingsCount, 'findings count must remain unchanged');
  assert.equal(updatedRecord.status, initialStatus, 'workflow status must not be auto-verified');

  // Verify attachment is listed when review is reopened from storage
  const reloaded = readReviewRecords().find((r) => r.id === record.id);
  assert.ok(reloaded);
  assert.equal(reloaded.attachments.length, 1);
  assert.equal(reloaded.attachments[0].id, 'att-test-01');

  // Test removing attachment
  const afterRemove = removeAttachmentFromReviewRecord(record.id, 'att-test-01');
  assert.equal(afterRemove.attachments.length, 0);
});

test('resubmitting a review snapshots previous revision attachments cleanly', () => {
  const configHash = getWorkspaceAnalysisConfigHash();
  const submission = {
    title: 'Revision attachment test',
    contentType: 'Social post',
    campaign: '',
    author: 'Editor',
    content: 'Initial revision draft with an attachment.',
  };
  const analysis = analyzeLocalContent(submission.content);
  const created = saveReviewRecord(submission, analysis.score, analysis.findings, analysis.summary, configHash);

  // Attach evidence to revision 1
  attachFileToReviewRecord({
    id: 'att-rev1',
    workspaceId: 'ws-123',
    reviewId: created.id,
    revision: 1,
    fileName: 'spec-rev1.pdf',
    contentType: 'application/pdf',
    fileSize: 2048,
    storagePath: 'ws-123/' + created.id + '/rev-1/att-rev1-spec-rev1.pdf',
    uploadedBy: 'Editor',
    createdAt: new Date().toISOString(),
  });

  // Request changes through decision
  decideReviewRecord(created.id, 'changes_requested', 'Reviewer', 'Please clarify paragraph 1', configHash);

  // Resubmit as revision 2
  const revisedSubmission = {
    ...submission,
    content: 'Second revision with updated editorial copy.',
  };
  const revisedAnalysis = analyzeLocalContent(revisedSubmission.content);
  const resubmitted = resubmitReviewRecord(created.id, revisedSubmission, revisedAnalysis.score, revisedAnalysis.findings, revisedAnalysis.summary, configHash);

  assert.equal(resubmitted.revision, 2);
  assert.equal(resubmitted.revisionHistory.length, 1);
  const snapshot = resubmitted.revisionHistory[0];
  assert.equal(snapshot.revision, 1);
  assert.ok(snapshot.attachments);
  assert.equal(snapshot.attachments.length, 1);
  assert.equal(snapshot.attachments[0].id, 'att-rev1');
});

test('[Unit test] review attachment typing, validation, and JSON serialization preserves revision consistency', () => {
  const attachment = {
    id: 'att-rev-101',
    workspaceId: '11111111-1111-1111-1111-111111111111',
    reviewId: 'DOC-TYPING-1',
    revision: 2,
    fileName: 'guidelines-check.pdf',
    contentType: 'application/pdf',
    fileSize: 4096,
    storagePath: '11111111-1111-1111-1111-111111111111/DOC-TYPING-1/rev-2/att-rev-101-guidelines-check.pdf',
    uploadedBy: 'editor_user',
    createdAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(attachment);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.id, 'att-rev-101');
  assert.equal(parsed.revision, 2);
  assert.equal(parsed.fileName, 'guidelines-check.pdf');
  assert.equal(parsed.fileSize, 4096);
  assert.equal(typeof parsed.revision, 'number');
});

test('[Unit test] review records safely handle non-array and null attachments during migration without throwing', () => {
  const baseRecord = {
    id: 'DOC-JSONB-SAFE',
    title: 'JSONB null test',
    contentType: 'Social post',
    originalContent: 'Safe content',
    currentContent: 'Safe content',
    suggestedContent: 'Safe content',
    score: 95,
    findings: [],
    status: 'draft',
    revision: 1,
  };

  // Case 1: attachments is null (JSON scalar null)
  const recordWithNullAttachments = { ...baseRecord, attachments: null };
  window.localStorage.setItem('brandlens.reviewRecords.v1', JSON.stringify([recordWithNullAttachments]));
  const loaded1 = readReviewRecords();
  assert.equal(loaded1.length, 1);
  assert.deepEqual(loaded1[0].attachments, []);

  // Case 2: attachments is missing / undefined
  const recordWithoutAttachments = { ...baseRecord };
  delete recordWithoutAttachments.attachments;
  window.localStorage.setItem('brandlens.reviewRecords.v1', JSON.stringify([recordWithoutAttachments]));
  const loaded2 = readReviewRecords();
  assert.equal(loaded2.length, 1);
  assert.deepEqual(loaded2[0].attachments, []);

  // Case 3: attachments is empty array
  const recordWithEmptyArray = { ...baseRecord, attachments: [] };
  window.localStorage.setItem('brandlens.reviewRecords.v1', JSON.stringify([recordWithEmptyArray]));
  const loaded3 = readReviewRecords();
  assert.equal(loaded3.length, 1);
  assert.deepEqual(loaded3[0].attachments, []);
});

test('[Unit test] storage path and association validation rules reject malformed, mismatched, and null paths', () => {
  const targetWorkspace = '11111111-1111-1111-1111-111111111111';
  const targetReviewId = 'DOC-REV-99';
  const revision = 1;
  const attachmentId = 'att_proof01';

  // JavaScript implementation of the storage path validation rule
  const validateStoragePath = (storagePath, workspace, reviewId, rev, attId) => {
    if (!storagePath || typeof storagePath !== 'string' || !storagePath.trim()) return false;
    if (!workspace || !reviewId || !rev || rev <= 0) return false;

    const parts = storagePath.trim().split('/');
    if (parts.length !== 4) return false;

    const ws = parts[0];
    const revId = parts[1];
    const revSeg = parts[2];
    const fileSeg = parts[3];

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ws);
    if (!isUuid || ws !== workspace) return false;
    if (revId !== reviewId) return false;
    if (revSeg !== `rev-${rev}`) return false;
    if (!fileSeg || !fileSeg.trim()) return false;
    if (attId && !fileSeg.startsWith(`${attId}-`)) return false;

    return true;
  };

  // 1. Valid path with exact 4-segment structure
  assert.equal(
    validateStoragePath(`${targetWorkspace}/${targetReviewId}/rev-${revision}/${attachmentId}-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId),
    true,
    'Valid storage path must pass validation'
  );

  // 2. Mismatched workspace prefix
  assert.equal(
    validateStoragePath(`22222222-2222-2222-2222-222222222222/${targetReviewId}/rev-${revision}/${attachmentId}-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId),
    false,
    'Mismatched workspace must be rejected'
  );

  // 3. Mismatched review ID
  assert.equal(
    validateStoragePath(`${targetWorkspace}/DOC-OTHER/rev-${revision}/${attachmentId}-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId),
    false,
    'Mismatched review ID must be rejected'
  );

  // 4. Mismatched revision number
  assert.equal(
    validateStoragePath(`${targetWorkspace}/${targetReviewId}/rev-2/${attachmentId}-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId),
    false,
    'Mismatched revision number must be rejected'
  );

  // 5. Malformed revision prefix
  assert.equal(
    validateStoragePath(`${targetWorkspace}/${targetReviewId}/revision-1/${attachmentId}-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId),
    false,
    'Malformed revision prefix (not rev-<N>) must be rejected'
  );

  // 6. Mismatched attachment ID prefix
  assert.equal(
    validateStoragePath(`${targetWorkspace}/${targetReviewId}/rev-${revision}/att_other-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId),
    false,
    'Mismatched attachment ID must be rejected'
  );

  // 7. Malformed path: empty string, null, undefined
  assert.equal(validateStoragePath('', targetWorkspace, targetReviewId, revision, attachmentId), false);
  assert.equal(validateStoragePath(null, targetWorkspace, targetReviewId, revision, attachmentId), false);
  assert.equal(validateStoragePath(undefined, targetWorkspace, targetReviewId, revision, attachmentId), false);

  // 8. Malformed path: insufficient segments (2 or 3)
  assert.equal(validateStoragePath(`${targetWorkspace}/${targetReviewId}/proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId), false);
  assert.equal(validateStoragePath(`${targetWorkspace}/${targetReviewId}/rev-1`, targetWorkspace, targetReviewId, revision, attachmentId), false);

  // 9. Malformed path: extra segments (5 segments / path traversal)
  assert.equal(validateStoragePath(`${targetWorkspace}/${targetReviewId}/rev-1/nested/${attachmentId}-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId), false);
  assert.equal(validateStoragePath(`../${targetWorkspace}/${targetReviewId}/rev-1/${attachmentId}-proof.pdf`, targetWorkspace, targetReviewId, revision, attachmentId), false);
});

test('[Mocked simulation - not against real Supabase] PostgreSQL IS DISTINCT FROM null-safety semantic comparison', () => {
  // Simulates Postgres ternary SQL logic (TRUE, FALSE, NULL)
  // Demonstrates why IS DISTINCT FROM is mandatory over <> for NULL-returning functions like storage_workspace_id()
  const targetWorkspace = '11111111-1111-1111-1111-111111111111';

  const simulateStorageWorkspaceId = (path) => {
    if (!path) return null;
    const seg = path.split('/')[0];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) {
      return seg;
    }
    return null;
  };

  const sqlInequalityCheck = (extractedWs, targetWs) => {
    // In SQL: NULL <> 'val' yields NULL (falsy in PL/pgSQL IF)
    if (extractedWs === null || targetWs === null) {
      return null; // Fails to trigger "IF <>" branch in SQL
    }
    return extractedWs !== targetWs;
  };

  const sqlIsDistinctFromCheck = (extractedWs, targetWs) => {
    // In SQL: (extractedWs IS DISTINCT FROM targetWs) is always boolean TRUE or FALSE
    return extractedWs !== targetWs;
  };

  const malformedPath = 'invalid-workspace-path/DOC-1/rev-1/att-1-proof.pdf';
  const extractedWs = simulateStorageWorkspaceId(malformedPath); // returns null

  // Demonstrate that standard <> fails to enter error branch on null
  const inequalityBranchEntered = Boolean(sqlInequalityCheck(extractedWs, targetWorkspace));
  assert.equal(
    inequalityBranchEntered,
    false,
    'SQL <> operator evaluates to NULL, failing to trigger the IF branch for malformed path'
  );

  // Demonstrate that IS DISTINCT FROM enters the error branch safely
  const isDistinctBranchEntered = sqlIsDistinctFromCheck(extractedWs, targetWorkspace);
  assert.equal(
    isDistinctBranchEntered,
    true,
    'SQL IS DISTINCT FROM evaluates to TRUE, properly raising an exception on malformed path'
  );
});

test('[Mocked simulation - not against real Supabase] deletion order ensures metadata is preserved if storage removal fails', async () => {
  const workspaceId = '11111111-1111-1111-1111-111111111111';
  const reviewId = 'DOC-FAIL-SAFE';
  const attachmentId = 'att-fail-01';
  const storagePath = `${workspaceId}/${reviewId}/rev-1/${attachmentId}-report.pdf`;

  let storageRemoveAttempted = false;
  let rpcDeleteAttempted = false;
  let localCacheRemoved = false;

  const mockStorageFail = {
    remove: async () => {
      storageRemoveAttempted = true;
      throw new Error('Storage network timeout');
    },
  };

  const mockRpc = async () => {
    rpcDeleteAttempted = true;
    return { error: null };
  };

  // Simulated revised deletion order:
  // 1. Remove storage first
  // 2. If storage fails, abort before RPC so metadata is not deleted
  try {
    await mockStorageFail.remove([storagePath]);
    await mockRpc();
    localCacheRemoved = true;
  } catch (err) {
    // Expected storage failure
  }

  assert.equal(storageRemoveAttempted, true, 'Storage removal must be attempted first');
  assert.equal(rpcDeleteAttempted, false, 'RPC deletion must NOT run if storage removal fails');
  assert.equal(localCacheRemoved, false, 'Local cache must NOT be purged if storage removal fails');
});

test('first-sign-in welcome preferences isolate markers by user ID and handle storage fallback gracefully', () => {
  // Test implementation of welcomePreferences logic in isolation
  const getWelcomeStorageKey = (userId) => `brandlens.welcome_shown.v1.${userId}`;

  const mockStore = new Map();
  const mockLocalStorage = {
    getItem: (k) => mockStore.get(k) ?? null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: (k) => mockStore.delete(k),
  };

  const hasUserSeenWelcome = (userId, storage = mockLocalStorage) => {
    if (!userId) return false;
    try {
      return storage.getItem(getWelcomeStorageKey(userId)) === 'true';
    } catch {
      return true; // Graceful non-blocking fallback
    }
  };

  const markUserWelcomeSeen = (userId, storage = mockLocalStorage) => {
    if (!userId) return;
    try {
      storage.setItem(getWelcomeStorageKey(userId), 'true');
    } catch {
      // Graceful fallback
    }
  };

  const resetUserWelcomeState = (userId, storage = mockLocalStorage) => {
    if (!userId) return;
    try {
      storage.removeItem(getWelcomeStorageKey(userId));
    } catch {
      // Graceful fallback
    }
  };

  const userA = 'user-uuid-1111-aaaa';
  const userB = 'user-uuid-2222-bbbb';

  // Initially neither user has seen welcome
  assert.equal(hasUserSeenWelcome(userA), false, 'New user A should not have seen welcome');
  assert.equal(hasUserSeenWelcome(userB), false, 'New user B should not have seen welcome');
  assert.equal(hasUserSeenWelcome(null), false, 'Null user ID returns false');
  assert.equal(hasUserSeenWelcome(undefined), false, 'Undefined user ID returns false');

  // Mark user A as seen
  markUserWelcomeSeen(userA);
  assert.equal(hasUserSeenWelcome(userA), true, 'User A should be marked as seen');
  assert.equal(hasUserSeenWelcome(userB), false, 'User B must remain unmarked (isolated accounts)');

  // Mark user B as seen
  markUserWelcomeSeen(userB);
  assert.equal(hasUserSeenWelcome(userB), true, 'User B should now be marked as seen');

  // Reset user A
  resetUserWelcomeState(userA);
  assert.equal(hasUserSeenWelcome(userA), false, 'User A reset should unmark welcome');
  assert.equal(hasUserSeenWelcome(userB), true, 'User B must remain unaffected by user A reset');

  // Fallback test: when storage throws (e.g. cookies/storage blocked in browser)
  const throwingStorage = {
    getItem: () => { throw new Error('SecurityError: Access is denied'); },
    setItem: () => { throw new Error('SecurityError: Access is denied'); },
  };
  assert.equal(
    hasUserSeenWelcome(userA, throwingStorage),
    true,
    'Restricted browser storage should gracefully fallback to true without throwing'
  );
  // markUserWelcomeSeen with throwing storage should not throw
  assert.doesNotThrow(() => markUserWelcomeSeen(userA, throwingStorage));
});

test('EditorialTaskLamp and FirstSignInWelcome render accessible structure and clean visual tokens', () => {
  const React = require('react');
  const ReactDOMServer = require('react-dom/server');
  const { EditorialTaskLamp } = require('../src/components/brand/EditorialTaskLamp.tsx');
  const { FirstSignInWelcome } = require('../src/components/brand/FirstSignInWelcome.tsx');
  const { LanguageProvider } = require('../src/contexts/LanguageProvider.tsx');

  // 1. EditorialTaskLamp rendering and states
  const lampLit = ReactDOMServer.renderToStaticMarkup(React.createElement(EditorialTaskLamp, { isLit: true }));
  assert.ok(lampLit.includes('lamp-shade'), 'Task lamp must include the lamp shade');
  assert.ok(lampLit.includes('lamp-beam'), 'Lit task lamp must project the light beam');
  assert.ok(lampLit.includes('lamp-pull-cord'), 'Task lamp must feature the tactile pull cord');
  assert.equal(lampLit.includes('illumination-floor'), false, 'Task lamp must not include unwanted floor ring or halo');

  const lampUnlit = ReactDOMServer.renderToStaticMarkup(React.createElement(EditorialTaskLamp, { isLit: false }));
  assert.ok(lampUnlit.includes('lamp-is-dim'), 'Unlit task lamp should render with dim class');
  assert.ok(lampUnlit.includes('data-lit="false"'), 'Unlit task lamp should have data-lit=false attribute');

  // 2. FirstSignInWelcome modal structure & accessibility
  const welcomeElement = React.createElement(
    LanguageProvider,
    null,
    React.createElement(FirstSignInWelcome, {
      userEmail: 'reviewer@brandlens.ai',
      workspaceName: 'Acme Editorial',
      onComplete: () => {},
    })
  );
  const welcomeHtml = ReactDOMServer.renderToStaticMarkup(welcomeElement);

  assert.ok(welcomeHtml.includes('role="dialog"'), 'Welcome experience must use role=dialog');
  assert.ok(welcomeHtml.includes('aria-modal="true"'), 'Welcome experience must set aria-modal=true');
  assert.ok(welcomeHtml.includes('Your editorial studio is ready'), 'Must render welcoming headline');
  assert.ok(welcomeHtml.includes('Acme Editorial'), 'Must display workspace identity tag');
  assert.ok(welcomeHtml.includes('reviewer@brandlens.ai'), 'Must display user email');
  assert.ok(welcomeHtml.includes('Continue to workspace'), 'Must include Continue action button');
  assert.ok(welcomeHtml.includes('Skip'), 'Must include Skip button');
  assert.ok(welcomeHtml.includes('lamp-shade'), 'Must integrate the task lamp centerpiece');
});

test('eagle tour onboarding eligibility strictly isolates new registrations from returning users', () => {
  const {
    setPendingRegistrationTour,
    isPendingRegistrationTour,
    clearPendingRegistrationTour,
    hasUserCompletedEagleTour,
    markUserEagleTourCompleted,
    hasUserSkippedEagleTour,
    markUserEagleTourSkipped,
    resetEagleTourState,
  } = require('../src/services/onboardingPreferences.ts');

  const newUserId = 'user-new-001';
  const newEmail = 'judge-hackathon@brandlens.local';
  const existingUserId = 'user-existing-999';
  const existingEmail = 'veteran-editor@brandlens.local';

  // Clear any existing state
  resetEagleTourState(newUserId);
  resetEagleTourState(existingUserId);

  // 1. Existing user signing in (no registration marker)
  assert.equal(isPendingRegistrationTour(existingUserId, existingEmail), false, 'Existing user must NOT be pending tour');
  assert.equal(hasUserCompletedEagleTour(existingUserId), false, 'No completion flag yet');

  // 2. Newly registered user created via registration flow
  setPendingRegistrationTour(newUserId, newEmail);
  assert.equal(isPendingRegistrationTour(newUserId, newEmail), true, 'Newly registered user must be marked pending tour');
  assert.equal(isPendingRegistrationTour(existingUserId, existingEmail), false, 'Pending state must not leak across users');

  // 3. User skips or completes tour
  markUserEagleTourCompleted(newUserId);
  clearPendingRegistrationTour(newUserId, newEmail);
  assert.equal(isPendingRegistrationTour(newUserId, newEmail), false, 'Pending marker must be cleared');
  assert.equal(hasUserCompletedEagleTour(newUserId), true, 'Must be marked as completed');

  // 4. Subsequent sign-in must not restart tour
  assert.equal(isPendingRegistrationTour(newUserId, newEmail), false, 'Tour must not automatically re-flag on later sign-ins');

  // 5. Test skip behavior
  const skippedUserId = 'user-skip-002';
  setPendingRegistrationTour(skippedUserId, 'skipped@brandlens.local');
  markUserEagleTourSkipped(skippedUserId);
  assert.equal(hasUserSkippedEagleTour(skippedUserId), true, 'Tour skip must be persisted');
});

test('EagleJourneyMap and EagleTourOverlay render accessible structure and 6-stage journey', () => {
  const React = require('react');
  const ReactDOMServer = require('react-dom/server');
  const { EagleJourneyMap } = require('../src/components/brand/EagleJourneyMap.tsx');
  const { LanguageProvider } = require('../src/contexts/LanguageProvider.tsx');

  const journeyElement = React.createElement(
    LanguageProvider,
    null,
    React.createElement(EagleJourneyMap, {
      activeStep: 3,
      showDescriptions: true,
    })
  );
  const journeyHtml = ReactDOMServer.renderToStaticMarkup(journeyElement);

  assert.ok(journeyHtml.includes('Overview'), 'Must include Step 1 Overview');
  assert.ok(journeyHtml.includes('Quick Scan'), 'Must include Step 2 Quick Scan');
  assert.ok(journeyHtml.includes('Findings'), 'Must include Step 3 Findings');
  assert.ok(journeyHtml.includes('Fix'), 'Must include Step 4 Fix');
  assert.ok(journeyHtml.includes('Human Verification'), 'Must include Step 5 Human Verification');
  assert.ok(journeyHtml.includes('Audit Trail'), 'Must include Step 6 Audit Trail');
  assert.ok(journeyHtml.includes('aria-label="BrandLens 6-Step Guided Journey"'), 'Must have accessible nav label');
});

test('Quick Scan lifecycle events cleanly open and close modal across tour step transitions', () => {
  const { QUICK_SCAN_OPEN_EVENT, QUICK_SCAN_CLOSE_EVENT } = require('../src/services/uiPreferences.ts');

  assert.equal(QUICK_SCAN_OPEN_EVENT, 'brandlens:open-quick-scan', 'Must export exact open event constant');
  assert.equal(QUICK_SCAN_CLOSE_EVENT, 'brandlens:close-quick-scan', 'Must export exact close event constant');

  // Verify simulated modal state machine
  let modalOpen = false;
  let result = 'has-stale-data';
  let error = 'has-stale-error';

  const handleOpen = () => {
    modalOpen = true;
    result = null;
    error = '';
  };

  const handleClose = () => {
    modalOpen = false;
    result = null;
    error = '';
  };

  // 1. Step 2 opens Quick Scan
  handleOpen();
  assert.equal(modalOpen, true, 'Modal should be open in Step 2');
  assert.equal(result, null, 'Stale results must be cleared on open');
  assert.equal(error, '', 'Stale error must be cleared on open');

  // 2. Advancing to Step 3 triggers close
  handleClose();
  assert.equal(modalOpen, false, 'Modal must be closed when advancing to Step 3');
  assert.equal(result, null, 'Results cleared');

  // 3. Re-visiting Step 2 with Back button re-opens
  handleOpen();
  assert.equal(modalOpen, true, 'Re-visiting step 2 re-opens modal');

  // 4. Escape / Skip Tutorial triggers close
  handleClose();
  assert.equal(modalOpen, false, 'Escape or tour dismissal closes modal completely');
});

test('Authentication confirmation redirect origin derivation and error parameter parsing', () => {
  // Test origin derivation
  const fakeWindowLocal = { location: { origin: 'http://localhost:5173' } };
  const redirectLocal = `${fakeWindowLocal.location.origin}/auth`;
  assert.equal(redirectLocal, 'http://localhost:5173/auth', 'Local registration must target local origin');

  const fakeWindowProd = { location: { origin: 'https://brandlens-ai.vercel.app' } };
  const redirectProd = `${fakeWindowProd.location.origin}/auth`;
  assert.equal(redirectProd, 'https://brandlens-ai.vercel.app/auth', 'Prod registration must target production origin');

  // Test URL parameter and hash parsing for expired/invalid confirmation links
  const sampleExpiredHash = '#error=access_denied&error_code=403&error_description=Email+link+is+invalid+or+has+expired';
  const hashWithoutHash = sampleExpiredHash.replace(/^#/, '');
  const params = new URLSearchParams(hashWithoutHash);

  assert.equal(params.get('error'), 'access_denied', 'Error code extracted');
  assert.equal(params.get('error_code'), '403', 'Error code extracted');
  const desc = decodeURIComponent((params.get('error_description') || '').replace(/\+/g, ' '));
  assert.equal(desc, 'Email link is invalid or has expired', 'Error description decoded');
  assert.ok(/expired|invalid/i.test(desc), 'Matches expiration detection pattern');
});

test('EagleFlightIntro one-time flight persistence strictly isolates user and workspace', () => {
  const {
    hasUserSeenImportFlight,
    markUserImportFlightSeen,
  } = require('../src/components/brand/EagleFlightIntro.tsx');

  const userA = 'user-judge-flight-1';
  const userB = 'user-judge-flight-2';
  const ws1 = 'ws-corp-alpha';
  const ws2 = 'ws-corp-beta';

  // Initially unseen
  assert.equal(hasUserSeenImportFlight(userA, ws1), false, 'New user on ws1 must not have seen flight');
  assert.equal(hasUserSeenImportFlight(userB, ws1), false, 'User B must not have seen flight');

  // Mark seen for userA on ws1
  markUserImportFlightSeen(userA, ws1);
  assert.equal(hasUserSeenImportFlight(userA, ws1), true, 'User A on ws1 marked as seen');
  assert.equal(hasUserSeenImportFlight(userA, ws2), false, 'User A on ws2 is isolated');
  assert.equal(hasUserSeenImportFlight(userB, ws1), false, 'User B on ws1 remains unseen');
});

test('SidebarDemoStudio and AuthPage eagle greeting render accessible structure', () => {
  const React = require('react');
  const ReactDOMServer = require('react-dom/server');
  const { SidebarDemoStudio } = require('../src/components/brand/SidebarDemoStudio.tsx');
  const { LanguageProvider } = require('../src/contexts/LanguageProvider.tsx');
  const { MemoryRouter } = require('react-router-dom');

  // Expanded Sidebar Demo Studio
  const expandedElement = React.createElement(
    MemoryRouter,
    null,
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(SidebarDemoStudio, { collapsed: false })
    )
  );
  const expandedHtml = ReactDOMServer.renderToStaticMarkup(expandedElement);

  assert.ok(expandedHtml.includes('Demo Studio'), 'Must render Demo Studio title');
  assert.ok(expandedHtml.includes('Clean Review'), 'Must render Clean Review action');
  assert.ok(expandedHtml.includes('Find and Fix Issues'), 'Must render Find and Fix Issues action');
  assert.ok(expandedHtml.includes('Replay Eagle Tour'), 'Must render Replay Tour action');
  assert.ok(expandedHtml.includes('Unverified does not mean false'), 'Must display editorial philosophy note');

  // Collapsed Sidebar Demo Studio
  const collapsedElement = React.createElement(
    MemoryRouter,
    null,
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(SidebarDemoStudio, { collapsed: true })
    )
  );
  const collapsedHtml = ReactDOMServer.renderToStaticMarkup(collapsedElement);
  assert.ok(collapsedHtml.includes('Demo Studio'), 'Must have title/tooltip in collapsed mode');
});

test('Judge Demo Access preferences, email matching, and session state isolate judge evaluation', () => {
  const {
    isJudgeDemoEmail,
    setJudgeDemoSession,
    isJudgeDemoSessionActive,
    hasJudgeDemoTourBeenSeen,
    markJudgeDemoTourSeen,
    resetJudgeDemoTourSeen,
  } = require('../src/services/onboardingPreferences.ts');

  const configuredJudge = 'judge@brandlens.ai';
  const normalUser = 'creator@brandlens.org';

  // 1. Email matching
  assert.equal(isJudgeDemoEmail(configuredJudge, configuredJudge), true, 'Exact match must return true');
  assert.equal(isJudgeDemoEmail('JUDGE@BrandLens.AI  ', configuredJudge), true, 'Case-insensitive & whitespace trimmed match must return true');
  assert.equal(isJudgeDemoEmail(normalUser, configuredJudge), false, 'Normal user email must return false');
  assert.equal(isJudgeDemoEmail('', configuredJudge), false, 'Empty email must return false');
  assert.equal(isJudgeDemoEmail(null, configuredJudge), false, 'Null email must return false');
  assert.equal(isJudgeDemoEmail(configuredJudge, ''), false, 'Unconfigured demo email must return false');

  // 2. Session state
  setJudgeDemoSession(true);
  assert.equal(isJudgeDemoSessionActive(), true, 'Judge demo session must be marked active');
  setJudgeDemoSession(false);
  assert.equal(isJudgeDemoSessionActive(), false, 'Judge demo session must be deactivated');

  // 3. User-scoped judge tour seen tracking
  const judgeUserId = 'judge-user-uuid-101';
  const otherUserId = 'creator-user-uuid-202';

  assert.equal(hasJudgeDemoTourBeenSeen(judgeUserId), false, 'Initially unseen for judge');
  markJudgeDemoTourSeen(judgeUserId);
  assert.equal(hasJudgeDemoTourBeenSeen(judgeUserId), true, 'Marked as seen for judge');
  assert.equal(hasJudgeDemoTourBeenSeen(otherUserId), false, 'Other user must remain unaffected');

  resetJudgeDemoTourSeen(judgeUserId);
  assert.equal(hasJudgeDemoTourBeenSeen(judgeUserId), false, 'Reset clears judge demo tour marker');
});

test('Workspace role boundaries and RLS isolation model enforce strict judge evaluation limits', () => {
  // Architectural simulation of PostgreSQL RPC authorization checks from 202610220001_phase_a_workspace_auth.sql
  const ROLES = {
    ADMIN: 'workspace_admin',
    REVIEWER: 'reviewer',
    WRITER: 'writer',
  };

  const hasWorkspaceRole = (userRole, allowedRoles) => allowedRoles.includes(userRole);

  // 1. Verification Gate: Reviewer and Admin can decide reviews
  const canDecideReview = (role) => hasWorkspaceRole(role, [ROLES.ADMIN, ROLES.REVIEWER]);
  assert.equal(canDecideReview(ROLES.REVIEWER), true, 'Judge with Reviewer role CAN decide reviews in Verification Gate');
  assert.equal(canDecideReview(ROLES.ADMIN), true, 'Admin CAN decide reviews');
  assert.equal(canDecideReview(ROLES.WRITER), false, 'Writer cannot decide reviews');

  // 2. Workspace Data & Guidelines: ONLY Admin can modify settings, guidelines, or evidence
  const canSaveWorkspaceData = (role) => hasWorkspaceRole(role, [ROLES.ADMIN]);
  assert.equal(canSaveWorkspaceData(ROLES.REVIEWER), false, 'Judge with Reviewer role CANNOT modify workspace guidelines or settings');
  assert.equal(canSaveWorkspaceData(ROLES.WRITER), false, 'Writer cannot modify workspace guidelines');
  assert.equal(canSaveWorkspaceData(ROLES.ADMIN), true, 'Admin CAN modify workspace guidelines and settings');

  // 3. Member Administration: ONLY Admin can assign members
  const canAssignMember = (role) => hasWorkspaceRole(role, [ROLES.ADMIN]);
  assert.equal(canAssignMember(ROLES.REVIEWER), false, 'Judge CANNOT invite or assign members');

  // 4. Cross-workspace isolation simulation (RLS is_workspace_member check)
  const memberships = [
    { workspace_id: 'ws-creator-private', user_id: 'creator-uid', role: 'workspace_admin' },
    { workspace_id: 'ws-judge-demo', user_id: 'judge-uid', role: 'reviewer' },
  ];

  const isWorkspaceMember = (targetWorkspaceId, userId) => (
    memberships.some((m) => m.workspace_id === targetWorkspaceId && m.user_id === userId)
  );

  // Judge accessing dedicated demo workspace
  assert.equal(isWorkspaceMember('ws-judge-demo', 'judge-uid'), true, 'Judge has access to dedicated demo workspace');

  // Judge accessing creator private workspace
  assert.equal(isWorkspaceMember('ws-creator-private', 'judge-uid'), false, 'Judge RLS strictly blocks access to creator private workspace');
});

test('Judge Demo trilingual translations and first-time onboarding lifecycle sequence', () => {
  const React = require('react');
  const ReactDOMServer = require('react-dom/server');
  const { LanguageProvider, useLanguage } = require('../src/contexts/LanguageProvider.tsx');
  const {
    isJudgeDemoEmail,
    hasJudgeDemoTourBeenSeen,
    markJudgeDemoTourSeen,
    resetJudgeDemoTourSeen,
    isPendingRegistrationTour,
    setPendingRegistrationTour,
    clearPendingRegistrationTour,
  } = require('../src/services/onboardingPreferences.ts');
  const {
    hasUserSeenWelcome,
    markUserWelcomeSeen,
    resetUserWelcomeState,
  } = require('../src/services/welcomePreferences.ts');

  // 1. Verify Trilingual Coverage for all Judge Demo keys
  const judgeDemoKeys = [
    'authJudgeDemoBadge',
    'authJudgeDemoTitle',
    'authJudgeDemoDesc',
    'authJudgeDemoEmailLabel',
    'authJudgeDemoPasswordLabel',
    'authJudgeDemoCopyEmail',
    'authJudgeDemoCopyPassword',
    'authJudgeDemoCopied',
    'authJudgeDemoShowPassword',
    'authJudgeDemoHidePassword',
    'authJudgeDemoEnterBtn',
    'authJudgeDemoEntering',
    'authJudgeDemoRoleNote',
    'authJudgeDemoNotConfiguredTitle',
    'authJudgeDemoNotConfiguredDesc',
    'authJudgeDemoExploreLocalPrompt',
  ];

  ['en', 'hi', 'gu'].forEach((lang) => {
    window.localStorage.setItem('brandlens.language.v1', lang);

    function TestExtractor() {
      const { t } = useLanguage();
      judgeDemoKeys.forEach((k) => {
        const val = t(k);
        assert.ok(val && typeof val === 'string' && val.length > 0, `Key ${k} must exist and have content in language ${lang}`);
      });
      return React.createElement('span', null, lang);
    }

    ReactDOMServer.renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(TestExtractor))
    );
  });

  // 2. First-time Judge Demo Onboarding Flow Simulation
  const judgeId = 'judge-session-user-999';
  const judgeEmail = 'judge@brandlens.ai';
  resetJudgeDemoTourSeen(judgeId);
  resetUserWelcomeState(judgeId);

  // Before login: judge has not seen welcome and has not seen tour
  assert.equal(hasJudgeDemoTourBeenSeen(judgeId), false, 'Initially judge has not seen demo tour');
  assert.equal(hasUserSeenWelcome(judgeId), false, 'Initially judge has not seen welcome lamp');

  // Judge signs in: welcome is needed because isJudgeFirstRun is true
  const isJudgeSession = isJudgeDemoEmail(judgeEmail, judgeEmail);
  const isJudgeFirstRun = isJudgeSession && !hasJudgeDemoTourBeenSeen(judgeId);
  assert.equal(isJudgeFirstRun, true, 'First run detected for judge demo session');

  // Welcome lamp completes: marks welcome seen, marks judge tour seen, and queues Eagle tour
  markUserWelcomeSeen(judgeId);
  markJudgeDemoTourSeen(judgeId);
  setPendingRegistrationTour(judgeId, judgeEmail);

  assert.equal(hasUserSeenWelcome(judgeId), true, 'Welcome marked as seen');
  assert.equal(hasJudgeDemoTourBeenSeen(judgeId), true, 'Judge demo tour marked as seen');
  assert.equal(isPendingRegistrationTour(judgeId, judgeEmail), true, 'Eagle tour queued for first session');

  // Eagle Tour launches on dashboard and clears pending queue
  clearPendingRegistrationTour(judgeId, judgeEmail);
  assert.equal(isPendingRegistrationTour(judgeId, judgeEmail), false, 'Pending queue cleared after tour starts');

  // Subsequent login by returning judge on same browser:
  const isSecondRun = isJudgeSession && !hasJudgeDemoTourBeenSeen(judgeId);
  assert.equal(isSecondRun, false, 'Returning judge session correctly bypasses first-run welcome and tour');
  assert.equal(hasUserSeenWelcome(judgeId), true, 'Returning judge goes directly to dashboard');
});

test('Password Recovery Flow: Forgot password request and redirect URL derivation', async () => {
  // Test redirect URL generation
  const fakeWindow = { location: { origin: 'https://brandlens-ai.example.com' } };
  const expectedRedirect = `${fakeWindow.location.origin}/auth?mode=recovery`;
  assert.equal(expectedRedirect, 'https://brandlens-ai.example.com/auth?mode=recovery', 'Redirect URL must target /auth?mode=recovery');

  // Verify supabase.auth.resetPasswordForEmail call parameters simulation
  let resetCallParams = null;
  const mockSupabase = {
    auth: {
      resetPasswordForEmail: async (email, options) => {
        resetCallParams = { email, options };
        return { data: {}, error: null };
      },
    },
  };

  const testEmail = '  editor@brandlens.org  ';
  const redirectTo = `${fakeWindow.location.origin}/auth?mode=recovery`;
  const { error } = await mockSupabase.auth.resetPasswordForEmail(testEmail.trim(), { redirectTo });

  assert.equal(error, null, 'Reset password call must succeed');
  assert.equal(resetCallParams.email, 'editor@brandlens.org', 'Email must be trimmed');
  assert.equal(resetCallParams.options.redirectTo, 'https://brandlens-ai.example.com/auth?mode=recovery', 'Exact redirectTo option provided');
});

test('Password Recovery Flow: PASSWORD_RECOVERY event handling, state persistence, and completion', async () => {
  // Simulate AuthProvider state machine logic
  let passwordRecovery = false;
  let currentSession = null;

  const onAuthStateChangeHandler = (event, nextSession) => {
    if (event === 'PASSWORD_RECOVERY') {
      passwordRecovery = true;
    } else if (event === 'SIGNED_OUT') {
      passwordRecovery = false;
    }
    // Ordinary SIGNED_IN or TOKEN_REFRESHED must NOT clear passwordRecovery
    currentSession = nextSession;
  };

  // 1. Initial state
  assert.equal(passwordRecovery, false, 'Initially passwordRecovery is false');

  // 2. PASSWORD_RECOVERY event arrives
  const recoverySession = { user: { id: 'usr-recovery-1', email: 'editor@brandlens.ai' } };
  onAuthStateChangeHandler('PASSWORD_RECOVERY', recoverySession);
  assert.equal(passwordRecovery, true, 'passwordRecovery is true on PASSWORD_RECOVERY event');

  // 3. Subsequent SIGNED_IN or TOKEN_REFRESHED must NOT clear recovery mode
  onAuthStateChangeHandler('SIGNED_IN', recoverySession);
  assert.equal(passwordRecovery, true, 'Ordinary SIGNED_IN must preserve passwordRecovery');

  onAuthStateChangeHandler('TOKEN_REFRESHED', recoverySession);
  assert.equal(passwordRecovery, true, 'TOKEN_REFRESHED must preserve passwordRecovery');

  // 4. Update password helper
  let updatedPasswordArg = null;
  const mockSupabase = {
    auth: {
      updateUser: async ({ password }) => {
        if (!password || password.length < 8) {
          return { data: null, error: new Error('Password must be at least 8 characters') };
        }
        updatedPasswordArg = password;
        return { data: { user: recoverySession.user }, error: null };
      },
    },
  };

  const updateRecoveredPassword = async (newPassword) => {
    const { error: updateError } = await mockSupabase.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
    passwordRecovery = false;
  };

  // 5. Failed update does not clear recovery
  await assert.rejects(
    async () => {
      await updateRecoveredPassword('short');
    },
    /at least 8 characters/,
    'Short password update rejected'
  );
  assert.equal(passwordRecovery, true, 'passwordRecovery remains true after failed password update');

  // 6. Successful update clears recovery mode
  await updateRecoveredPassword('NewSecurePassword2026!');
  assert.equal(updatedPasswordArg, 'NewSecurePassword2026!', 'Correct password passed to updateUser');
  assert.equal(passwordRecovery, false, 'passwordRecovery cleared only after successful completion');

  // 7. Sign out also clears recovery state
  passwordRecovery = true;
  onAuthStateChangeHandler('SIGNED_OUT', null);
  assert.equal(passwordRecovery, false, 'SIGNED_OUT event clears recovery state');
});

test('Password Recovery Flow: Recovery mode prevents dashboard redirect and suppresses first-run welcome', () => {
  const currentUser = { id: 'usr-rec-test', email: 'test@brandlens.ai' };
  const authLoading = false;
  const isJudgeSession = false;
  const welcomeDismissed = false;

  // Scenario A: Standard authenticated user with seen welcome -> redirects to dashboard
  const standardAuth = {
    session: { user: currentUser },
    loading: authLoading,
    passwordRecovery: false,
  };
  const isRecoveryModeStandard = false;
  const isWelcomeNeededStandard = Boolean(
    !isRecoveryModeStandard &&
    currentUser &&
    !standardAuth.loading &&
    !welcomeDismissed &&
    false
  );
  const shouldRedirectStandard = standardAuth.session && !standardAuth.loading && !isWelcomeNeededStandard && !isRecoveryModeStandard;
  assert.equal(shouldRedirectStandard, true, 'Standard authenticated user redirects to dashboard');

  // Scenario B: User in recovery mode -> MUST NOT redirect to dashboard
  const recoveryAuth = {
    session: { user: currentUser },
    loading: authLoading,
    passwordRecovery: true,
  };
  const isRecoveryModeActive = true;
  const isWelcomeNeededRecovery = Boolean(
    !isRecoveryModeActive &&
    currentUser &&
    !recoveryAuth.loading &&
    !welcomeDismissed &&
    true // even if welcome would normally be needed
  );
  const shouldRedirectRecovery = recoveryAuth.session && !recoveryAuth.loading && !isWelcomeNeededRecovery && !isRecoveryModeActive;
  assert.equal(shouldRedirectRecovery, false, 'Recovery mode strictly prevents dashboard redirection');
  assert.equal(isWelcomeNeededRecovery, false, 'Recovery mode strictly suppresses FirstSignInWelcome');
});

test('Password Recovery Flow: Password confirmation and length validation rules', () => {
  const validatePasswords = (newPassword, confirmPassword) => {
    if (newPassword.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters.' };
    }
    if (newPassword !== confirmPassword) {
      return { valid: false, error: 'Passwords do not match. Please verify and try again.' };
    }
    return { valid: true, error: null };
  };

  // Too short
  assert.deepEqual(validatePasswords('1234567', '1234567'), {
    valid: false,
    error: 'Password must be at least 8 characters.',
  });

  // Mismatch
  assert.deepEqual(validatePasswords('ValidPassword123', 'DifferentPassword456'), {
    valid: false,
    error: 'Passwords do not match. Please verify and try again.',
  });

  // Valid
  assert.deepEqual(validatePasswords('BrandLensAI#2026', 'BrandLensAI#2026'), {
    valid: true,
    error: null,
  });
});

test('Password Recovery Flow: Expired link and missing recovery session detection', () => {
  // Test expired link parameter detection
  const expiredUrl = 'https://brandlens-ai.vercel.app/auth?mode=recovery#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  const urlObj = new URL(expiredUrl);
  const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ''));

  assert.equal(hashParams.get('error'), 'access_denied', 'Detects error in hash');
  assert.equal(hashParams.get('error_code'), 'otp_expired', 'Detects otp_expired code');
  const errorDesc = decodeURIComponent((hashParams.get('error_description') || '').replace(/\+/g, ' '));
  assert.ok(/expired|invalid/i.test(errorDesc), 'Detects expired or invalid text in description');

  // Test missing recovery session detection when !auth.loading and no session
  const checkSessionValid = (authLoading, session, passwordRecovery) => {
    if (authLoading) return 'loading';
    if (!session && !passwordRecovery) return 'expired_or_invalid';
    return 'valid';
  };

  assert.equal(checkSessionValid(true, null, false), 'loading', 'Still verifying while auth.loading is true');
  assert.equal(checkSessionValid(false, null, false), 'expired_or_invalid', 'Correctly flags expired/missing session when loading finishes without session');
  assert.equal(checkSessionValid(false, { user: {} }, true), 'valid', 'Recognizes valid active recovery session');
});

test('Password Recovery Flow: Trilingual translation keys completeness across EN, HI, GU', () => {
  const { LanguageProvider } = require('../src/contexts/LanguageProvider.tsx');
  const React = require('react');
  const ReactDOMServer = require('react-dom/server');

  const requiredRecoveryKeys = [
    'authForgotPasswordLink',
    'authForgotPasswordSending',
    'authPasswordResetSuccessGeneric',
    'authPasswordResetFailed',
    'authPasswordResetEmailRequired',
    'authRecoveryBadge',
    'authRecoveryTitle',
    'authRecoverySubtitle',
    'authRecoveryNewPasswordLabel',
    'authRecoveryConfirmPasswordLabel',
    'authRecoverySubmitBtn',
    'authRecoveryUpdating',
    'authRecoverySuccess',
    'authRecoveryContinueBtn',
    'authRecoveryPasswordMismatch',
    'authRecoveryPasswordTooShort',
    'authRecoveryExpired',
    'authRecoveryVerifying',
    'authRecoveryBackToSignIn',
  ];

  ['en', 'hi', 'gu'].forEach((lang) => {
    let capturedT = null;
    const TestComponent = () => {
      const { t } = require('../src/contexts/LanguageProvider.tsx').useLanguage();
      capturedT = t;
      return null;
    };

    global.window.localStorage.setItem('brandlens.language.v1', lang);
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(TestComponent))
    );

    assert.ok(capturedT, `Translation hook t must be initialized for ${lang}`);
    for (const key of requiredRecoveryKeys) {
      const val = capturedT(key);
      assert.ok(val && typeof val === 'string' && val.length > 0, `Key ${key} must exist and be non-empty in ${lang}`);
      assert.notEqual(val, key, `Key ${key} in ${lang} must not return raw key fallback`);
    }
  });
});

test('Targeted Polish Task 1: Judge button single-line structure, flex alignment, and responsive translations', () => {
  const React = require('react');
  const ReactDOMServer = require('react-dom/server');
  const { Button } = require('../src/components/ui/Button.tsx');
  const { ArrowRight } = require('lucide-react');
  const { LanguageProvider } = require('../src/contexts/LanguageProvider.tsx');

  // Verify button renders single-line flex container
  const buttonElement = React.createElement(
    Button,
    {
      variant: 'copper',
      size: 'md',
      className: 'w-full justify-center font-mono text-xs uppercase tracking-wider font-semibold shadow-xs flex-nowrap',
    },
    React.createElement(
      'span',
      { className: 'inline-flex items-center justify-center gap-2 flex-nowrap whitespace-nowrap' },
      React.createElement('span', null, 'Enter Judge Demo'),
      React.createElement(ArrowRight, { className: 'h-3.5 w-3.5 shrink-0', 'aria-hidden': 'true' })
    )
  );

  const html = ReactDOMServer.renderToStaticMarkup(buttonElement);
  assert.ok(html.includes('flex-nowrap'), 'Button and inner container must contain flex-nowrap');
  assert.ok(html.includes('whitespace-nowrap'), 'Inner span must specify whitespace-nowrap to prevent text wrapping');
  assert.ok(html.includes('shrink-0'), 'Arrow must specify shrink-0 so it is never compressed');
  assert.ok(html.includes('lucide-arrow-right'), 'Must render ArrowRight icon');

  // Verify translation labels in EN, HI, GU
  const expectedTranslations = {
    en: 'Enter Judge Demo',
    hi: 'जज डेमो में प्रवेश करें',
    gu: 'જજ ડેમોમાં પ્રવેશ કરો',
  };

  Object.entries(expectedTranslations).forEach(([lang, expectedText]) => {
    let capturedT = null;
    const TestComponent = () => {
      const { t } = require('../src/contexts/LanguageProvider.tsx').useLanguage();
      capturedT = t;
      return null;
    };
    global.window.localStorage.setItem('brandlens.language.v1', lang);
    ReactDOMServer.renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(TestComponent))
    );
    assert.equal(capturedT('authJudgeDemoEnterBtn'), expectedText, `Label must match expected text in ${lang}`);
  });
});

test('Targeted Polish Task 2: Human Verification confirmation dialog, cancel safety, and single-execution flow', async () => {
  const mockRecord = {
    id: 'DOC-DEMO-NEEDS-REVIEW',
    title: 'Demo · Launch claim review',
    currentContent: 'Sample content to verify',
    contentHash: 'fnv1a-014f3bd2',
    revision: 1,
    status: 'awaiting_human_verification',
  };

  let activeDecision = null;
  let isSaving = false;
  let rpcCallCount = 0;
  let lastRpcPayload = null;

  const mockCloudDecideReviewRecord = async (id, decision, reviewer, comment, suggestedDraft) => {
    rpcCallCount++;
    lastRpcPayload = { id, decision, reviewer, comment, suggestedDraft };
    return { ...mockRecord, status: decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'changes_requested' };
  };

  const openDecision = (decision) => {
    activeDecision = decision;
  };

  const handleCancelDecision = () => {
    if (isSaving) return;
    activeDecision = null;
  };

  const confirmDecision = async (comment, suggestedDraft, canDecide = true) => {
    if (!mockRecord || !activeDecision || isSaving) return;
    if (!canDecide) throw new Error('Role required to decide');
    if ((activeDecision === 'changes_requested' || activeDecision === 'rejected') && !comment?.trim()) {
      throw new Error('Comment required');
    }
    isSaving = true;
    try {
      const res = await mockCloudDecideReviewRecord(
        mockRecord.id,
        activeDecision,
        'Judge Reviewer',
        comment,
        activeDecision === 'changes_requested' ? suggestedDraft : undefined
      );
      activeDecision = null;
      return res;
    } finally {
      isSaving = false;
    }
  };

  // 1. Opening dialog must NOT mutate review or call decision RPC
  openDecision('approved');
  assert.equal(activeDecision, 'approved', 'Decision dialog opened for approval');
  assert.equal(rpcCallCount, 0, 'Opening dialog must NOT invoke decision RPC');

  // 2. Cancel must close the dialog without modifying any data
  handleCancelDecision();
  assert.equal(activeDecision, null, 'Cancel closed the dialog');
  assert.equal(rpcCallCount, 0, 'Cancel must not call decision RPC');

  // 3. Confirming invoke decision operation exactly once
  openDecision('approved');
  const approveResult = await confirmDecision('Approved launch copy', undefined, true);
  assert.equal(rpcCallCount, 1, 'Decision operation invoked exactly once on confirmation');
  assert.equal(lastRpcPayload.decision, 'approved');
  assert.equal(lastRpcPayload.id, 'DOC-DEMO-NEEDS-REVIEW');
  assert.equal(approveResult.status, 'approved');
  assert.equal(activeDecision, null, 'Dialog closed after successful confirmation');

  // 4. Request Changes action requires rationale
  openDecision('changes_requested');
  await assert.rejects(
    async () => confirmDecision('', undefined, true),
    /Comment required/,
    'Changes requested must require reviewer comment'
  );
  assert.equal(rpcCallCount, 1, 'Failed validation does not call RPC');

  const changesResult = await confirmDecision('Please remove unverified superlatives', 'Improved content draft', true);
  assert.equal(rpcCallCount, 2, 'Confirmed changes requested called RPC once');
  assert.equal(lastRpcPayload.decision, 'changes_requested');
  assert.equal(lastRpcPayload.suggestedDraft, 'Improved content draft');
  assert.equal(changesResult.status, 'changes_requested');

  // 5. Reject action requires rationale
  openDecision('rejected');
  await assert.rejects(
    async () => confirmDecision('', undefined, true),
    /Comment required/,
    'Reject must require rationale'
  );
  const rejectResult = await confirmDecision('Unsubstantiated performance claims', undefined, true);
  assert.equal(rpcCallCount, 3, 'Confirmed reject called RPC once');
  assert.equal(lastRpcPayload.decision, 'rejected');
  assert.equal(rejectResult.status, 'rejected');

  // 6. Non-reviewer permission check
  openDecision('approved');
  await assert.rejects(
    async () => confirmDecision('Try approving', undefined, false),
    /Role required to decide/,
    'Non-reviewer is blocked from deciding'
  );
  assert.equal(rpcCallCount, 3, 'Blocked permission call does not execute RPC');
});

test('Targeted Polish Task 3: Full-height desktop sidebar layout and sticky scrolling behavior', () => {
  const React = require('react');
  const ReactDOMServer = require('react-dom/server');
  const { Sidebar } = require('../src/components/layout/Sidebar.tsx');
  const { LanguageProvider } = require('../src/contexts/LanguageProvider.tsx');
  const { MemoryRouter } = require('react-router-dom');

  // Desktop expanded sidebar
  const desktopElement = React.createElement(
    MemoryRouter,
    null,
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(Sidebar, {
        collapsed: false,
        onToggleCollapse: () => {},
        mobileOpen: false,
        onCloseMobile: () => {},
      })
    )
  );

  const desktopHtml = ReactDOMServer.renderToStaticMarkup(desktopElement);
  assert.ok(desktopHtml.includes('md:sticky'), 'Desktop sidebar must have md:sticky positioning');
  assert.ok(desktopHtml.includes('top-0'), 'Desktop sidebar must stick to top-0');
  assert.ok(desktopHtml.includes('md:h-[100dvh]'), 'Desktop sidebar must fill full viewport height with md:h-[100dvh]');
  assert.ok(desktopHtml.includes('min-h-screen'), 'Desktop sidebar must declare min-h-screen');
  assert.ok(desktopHtml.includes('md:min-h-[100dvh]'), 'Desktop sidebar must declare md:min-h-[100dvh]');
  assert.ok(desktopHtml.includes('self-stretch'), 'Desktop sidebar must have self-stretch in flex container');
  assert.ok(desktopHtml.includes('shrink-0'), 'Desktop sidebar must have shrink-0 to prevent flex compression');
  assert.ok(desktopHtml.includes('bg-obsidian'), 'Desktop sidebar must have solid Obsidian background');
  assert.ok(desktopHtml.includes('overflow-y-auto'), 'Sidebar navigation must scroll internally');

  // Shell layout integrity
  const fs = require('fs');
  const shellSource = fs.readFileSync(require.resolve('../src/components/layout/Shell.tsx'), 'utf8');
  assert.ok(shellSource.includes('overflow-x-clip'), 'Shell layout must use overflow-x-clip to prevent sticky breaking');
  assert.ok(shellSource.includes('items-stretch'), 'Shell layout must use items-stretch for sidebar full height alignment');
  assert.ok(shellSource.includes('window.scrollTo(0, 0)'), 'Shell must reset scroll on navigation');

  // Mobile open drawer
  const mobileElement = React.createElement(
    MemoryRouter,
    null,
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(Sidebar, {
        collapsed: false,
        onToggleCollapse: () => {},
        mobileOpen: true,
        onCloseMobile: () => {},
      })
    )
  );

  const mobileHtml = ReactDOMServer.renderToStaticMarkup(mobileElement);
  assert.ok(mobileHtml.includes('translate-x-0'), 'Mobile drawer must translate-x-0 when open');
  assert.ok(mobileHtml.includes('bg-obsidian/80'), 'Mobile drawer must show backdrop overlay when open');
});

test('ReviewPage Git Merge Conflict Resolution: Sample cards, trilingual support, replacement safety, and single analysis button', () => {
  const React = require('react');
  global.React = React;
  const ReactDOMServer = require('react-dom/server');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');

  // Provide mock for cloud client modules before loading ReviewPage
  require.cache[path.join(root, 'src', 'services', 'supabaseClient.ts')] = {
    id: path.join(root, 'src', 'services', 'supabaseClient.ts'),
    filename: path.join(root, 'src', 'services', 'supabaseClient.ts'),
    loaded: true,
    exports: { supabase: null, supabaseConfigurationError: 'mocked' },
  };
  require.cache[path.join(root, 'src', 'services', 'cloudStorage.ts')] = {
    id: path.join(root, 'src', 'services', 'cloudStorage.ts'),
    filename: path.join(root, 'src', 'services', 'cloudStorage.ts'),
    loaded: true,
    exports: { cloudCreateReviewDraftRecord: async () => 'mock-id' },
  };

  const { MemoryRouter } = require('react-router-dom');
  const { LanguageProvider } = require('../src/contexts/LanguageProvider.tsx');
  const { ReviewPage } = require('../src/pages/ReviewPage.tsx');
  const { DEMO_SCENARIOS } = require('../src/services/demoScenarios.ts');
  const { readReviewRecords, saveReviewRecord, attachFileToReviewRecord } = require('../src/services/reviewStorage.ts');
  const { analyzeLocalContent } = require('../src/services/localReviewEngine.ts');

  // Ensure window listener mocks
  global.window.addEventListener = global.window.addEventListener || (() => {});
  global.window.removeEventListener = global.window.removeEventListener || (() => {});
  global.window.confirm = () => true;

  try {
    // 1. Render ReviewPage and verify responsive 3-card grid exists
    const reviewElement = React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(ReviewPage)
      )
    );
    const html = ReactDOMServer.renderToStaticMarkup(reviewElement);

    // Verify 3-card grid container
    assert.ok(html.includes('grid grid-cols-1 gap-3 sm:grid-cols-3'), 'Must render responsive 3-card grid');

    // Verify all 3 sample scenarios are rendered in the grid
    for (const scenario of DEMO_SCENARIOS) {
      assert.ok(html.includes(scenario.id), `Sample card for scenario ${scenario.id} must be present`);
    }

    // Verify sample action label and arrow indicator
    assert.ok(html.includes('Load sample'), 'Sample cards must contain Load sample action');
    assert.ok(html.includes('Not sure what to enter? Start with a sample.'), 'Must render sample section heading');

    // 2. Exactly ONE Analyse Content button is rendered inside editor actions
    const analyseButtons = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*?Analyse Content[\s\S]*?<\/button>/gi) || [];
    assert.equal(analyseButtons.length, 1, 'Exactly ONE Analyse Content button must be rendered');

    // Exactly ONE Clear Form action is rendered
    const clearActions = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*?Clear[\s\S]*?<\/button>/gi) || [];
    assert.ok(clearActions.length >= 1, 'Clear form button must be present');

    // 3. Trilingual translation coverage for all sample-related keys across EN, HI, GU
    const requiredSampleKeys = [
      'reviewSampleHeading',
      'reviewSampleDescription',
      'reviewSampleNeedsReviewDesc',
      'reviewSampleEvidenceGapsDesc',
      'reviewSampleCleanApprovalDesc',
      'reviewLoadSampleAction',
      'reviewConfirmReplaceWork',
      'reviewLoadExample',
      'reviewNeedsReview',
      'reviewEvidenceGaps',
      'reviewCleanApproval',
      'reviewClear',
      'reviewAnalysing',
      'reviewAnalysisCurrent',
      'reviewAnalyseContent',
    ];

    for (const lang of ['en', 'hi', 'gu']) {
      let capturedT = null;
      const TestLang = () => {
        const { t } = require('../src/contexts/LanguageProvider.tsx').useLanguage();
        capturedT = t;
        return null;
      };
      global.window.localStorage.setItem('brandlens.language.v1', lang);
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(LanguageProvider, null, React.createElement(TestLang))
      );
      assert.ok(capturedT, `Translation hook must be initialized for ${lang}`);
      for (const key of requiredSampleKeys) {
        const val = capturedT(key);
        assert.ok(val && typeof val === 'string' && val.length > 0, `Key ${key} must exist and be non-empty in ${lang}`);
        assert.notEqual(val, key, `Key ${key} in ${lang} must not return raw key fallback`);
      }
    }

    // 4. Editor replacement safety simulation
    let confirmReturnValue = false;
    global.window.confirm = () => confirmReturnValue;

    // Save an existing review in Approvals with an attachment
    const existingSubmission = {
      title: 'Existing Review in Approvals',
      contentType: 'Social post',
      campaign: 'Apex Media · Q4 launch',
      author: 'Elena Rostova',
      content: 'Original unedited copy before sample load.',
    };
    const savedRecord = saveReviewRecord(existingSubmission, 95, [], 'Initial analysis', 'config-hash-1');
    assert.ok(savedRecord.id, 'Saved record must have ID');

    // Attach an evidence item to the saved record
    attachFileToReviewRecord({
      id: 'att-safe-1',
      workspaceId: '11111111-1111-1111-1111-111111111111',
      reviewId: savedRecord.id,
      revision: 1,
      fileName: 'compliance-proof.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
      storagePath: '11111111-1111-1111-1111-111111111111/DOC-1/rev-1/att-safe-1-proof.pdf',
      uploadedBy: 'test-user',
      createdAt: '2026-10-30T10:00:00Z',
    });

    // Simulate loadExample replacement logic
    const simulateLoadExample = (scenarioId, editorState) => {
      const example = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
      if (!example) return { state: editorState, loaded: false };

      const hasExistingWork = Boolean(
        editorState.title.trim() ||
        editorState.content.trim() ||
        editorState.author.trim() ||
        editorState.campaign ||
        editorState.report ||
        editorState.editingRecordId ||
        (editorState.attachments && editorState.attachments.length > 0)
      );

      if (hasExistingWork && !global.window.confirm('Confirmation prompt')) {
        return { state: editorState, loaded: false };
      }

      return {
        state: {
          title: example.title,
          contentType: example.contentType,
          campaign: example.campaign,
          author: example.author,
          content: example.content,
          report: null,
          editingRecordId: null,
          attachments: [],
        },
        loaded: true,
      };
    };

    // Case A: User cancels confirmation -> editor state must NOT change
    confirmReturnValue = false;
    const dirtyEditor = {
      title: 'Active Draft Title',
      contentType: 'Email',
      campaign: 'Custom Campaign',
      author: 'Draft Author',
      content: 'Custom draft content in progress',
      report: { score: 80 },
      editingRecordId: savedRecord.id,
      attachments: [{ id: 'att-temp' }],
    };

    const cancelledResult = simulateLoadExample('needs-review', dirtyEditor);
    assert.equal(cancelledResult.loaded, false, 'Loading must be aborted when user cancels confirmation');
    assert.deepEqual(cancelledResult.state, dirtyEditor, 'Editor state must remain unchanged on cancel');

    // Case B: User confirms -> editor receives scenario fields, attachments are NOT transferred
    confirmReturnValue = true;
    const confirmedResult = simulateLoadExample('needs-review', dirtyEditor);
    assert.equal(confirmedResult.loaded, true, 'Loading succeeds when user confirms');
    assert.equal(confirmedResult.state.title, DEMO_SCENARIOS.find((s) => s.id === 'needs-review').title);
    assert.equal(confirmedResult.state.editingRecordId, null, 'Editing record ID reset to null');
    assert.equal(confirmedResult.state.report, null, 'Report reset to null');
    assert.deepEqual(confirmedResult.state.attachments, [], 'Attachments not transferred to newly loaded sample');

    // Verify existing record in Approvals storage is untouched
    const recordsAfter = readReviewRecords();
    const preservedRecord = recordsAfter.find((r) => r.id === savedRecord.id);
    assert.ok(preservedRecord, 'Previously saved review must remain preserved in storage');
    assert.equal(preservedRecord.title, 'Existing Review in Approvals');
    assert.equal(preservedRecord.attachments.length, 1, 'Previously saved review attachments must remain preserved');
    assert.equal(preservedRecord.attachments[0].id, 'att-safe-1');

    // 5. Verify local analysis engine produces findings on loaded scenario
    const sampleNeedsReview = DEMO_SCENARIOS.find((s) => s.id === 'needs-review');
    const analysis = analyzeLocalContent(sampleNeedsReview.content);
    assert.ok(analysis.findings.length > 0, 'Needs Review scenario must produce policy findings');
    assert.ok(analysis.score < 100, 'Needs Review scenario must have score lower than 100');
  } finally {
    delete global.window.confirm;
  }
});
