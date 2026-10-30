import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock3,
  FileEdit,
  FileSearch,
  History,
  LockKeyhole,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';
import { EvidenceAttachmentSection } from '@/components/brand/EvidenceAttachmentSection';
import { GuidelineGeometry } from '@/components/brand/GuidelineGeometry';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthProvider';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageProvider';
import {
  hashReviewContent,
  readReviewRecords,
  REVIEW_RECORDS_STORAGE_KEY,
  REVIEW_RECORDS_UPDATED_EVENT,
} from '@/services/reviewStorage';
import { cloudDecideReviewRecord } from '@/services/cloudStorage';
import { getLocalBrandRules, getLocalEvidenceCatalogue, LocalBrandRule, LocalEvidence } from '@/services/localReviewEngine';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  getWorkspaceAnalysisConfigHash,
  readWorkspaceSettings,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import { WorkspaceSettings } from '@/types/workspace';
import {
  ReviewDecision,
  ReviewFinding,
  ReviewRecord,
  ReviewWorkflowStatus,
} from '@/types/review';
import { getScopedStorageKey } from '@/services/storageScope';

type QueueFilter = 'awaiting_human_verification' | 'approved' | 'changes_requested' | 'rejected' | 'all';

const APPROVALS_UI = {
  en: {
    filterAwaitingReview: 'Awaiting review',
    filterApproved: 'Approved',
    filterChangesRequested: 'Changes requested',
    filterRejected: 'Rejected',
    filterAllReviews: 'All reviews',

    statusDraft: 'Needs analysis',
    statusSubmitted: 'Submitted',
    statusAnalysisComplete: 'Analysis complete',
    statusValidationComplete: 'Validation complete',
    statusIssuesFound: 'Issues found',
    statusAwaitingHumanVerification: 'Awaiting human verification',
    statusApproved: 'Approved',
    statusChangesRequested: 'Changes requested',
    statusRejected: 'Rejected',

    severityCritical: 'Critical',
    severityModerate: 'Moderate',
    severityMinor: 'Minor',

    evidenceMatched: 'Catalogue match',
    evidenceUnverified: 'Unverified',
    evidenceRuleOnly: 'Rule reference only',

    browserStorageError: 'The browser could not access local review storage.',
    timeUnavailable: 'Time unavailable',
    reviewsLoadError: 'Reviews could not be loaded:',
    workspaceConfigError: 'Workspace configuration could not be loaded:',

    decisionApprove: 'Approve',
    decisionRequestChanges: 'Request Changes',
    decisionReject: 'Reject',
    decisionApproved: 'Approved',
    decisionChangesRequested: 'Changes requested',
    decisionRejected: 'Rejected',

    stageAnalysis: 'AI Content Analysis',
    stageValidation: 'Brand & Evidence Validation',
    stageHuman: 'Human Verification',
    stagePublication: 'Publication Approval',

    roleRequiredToDecide: 'Reviewer or workspace-admin membership is required to record a human decision.',
    reviewerNameRequired: 'A reviewer display name is required by the current workspace policy.',
    rejectionReasonRequired: 'A rejection reason is required.',
    explainChangesRequired: 'Explain the changes needed before submitting this decision.',
    anonymousReviewerFallback: 'Anonymous demo reviewer',

    loadingReviewRecord: 'Loading review record…',
    backToQueue: 'Back to queue',
    kickerHumanVerification: 'HUMAN VERIFICATION',
    reviewNotFoundTitle: 'Review not found',
    reviewNotFoundDescription: 'This review is not present in the shared local review store.',

    modalKicker: 'DEMO REVIEWER · HUMAN VERIFICATION',
    confirmDecision: 'Confirm decision',
    confirmTitlePrefix: 'Confirm',
    explanationApproved: 'You are approving the exact analysed revision displayed here. Any later content revision will require fresh analysis and human approval.',
    explanationChangesRequested: 'The content creator will see your comment and can revise this record. The revised content must be analysed before it returns to the human gate.',
    explanationRejected: 'This content will be marked rejected and preserved with your required rationale. Rejection cannot be confused with a request for revision.',

    quickDirectivesKicker: 'Quick reviewer directives · based on active findings',
    directiveR103A: '+ Remove unsubstantiated 100% / guarantee claim (R-103)',
    directiveR103B: '+ Attach approved SLA / benchmark evidence (EVI-01)',
    directiveR101: '+ Soften unverified global superlative (R-101)',
    directiveR106: '+ Fix CTA accessibility & tone (R-106)',

    commentLabelOptional: 'Reviewer comment (optional)',
    commentLabelRejectionRequired: 'Rejection reason (required)',
    commentLabelRationaleRequired: 'Reviewer rationale (required)',
    commentPlaceholderApprove: 'Add an optional note for the decision record.',
    commentPlaceholderReject: 'Explain why this submission cannot proceed.',
    commentPlaceholderChanges: 'Explain why revisions are needed. This note appears in Activity and Audit Records.',
    suggestedDraftLabel: 'Optional inline redline / suggested draft',
    suggestedDraftHelperText: 'This editable draft is saved separately from your rationale and does not replace the submitted revision.',
    decisionLinkedAccountNotice: 'Decision is linked to your authenticated account.',
    btnCancel: 'Cancel',
    dialogReviewTitle: 'Review Title',
    dialogSelectedDecision: 'Selected Decision',
    dialogHistoryNotice: 'This confirmed decision is recorded permanently in the review history and workspace audit log. As a human reviewer, your decision takes immediate effect on the shared workspace.',
    decisionSuccessBanner: 'Decision confirmed and recorded in history',

    pageKicker: 'Editorial governance / Human-owned decision',
    pageTitle: 'Human Verification Gate',
    pageDescription: 'Review the submitted revision, findings, and available evidence before deciding. An AI consistency score is advisory; it is never a publication approval.',
    outstandingReviewsLabel: 'Outstanding human reviews',
    queueFiltersAria: 'Approval queue filters',
    queueKicker: 'Review queue',
    awaitingYourReviewHeading: 'Awaiting your review',
    recordSingular: 'record',
    recordPlural: 'records',
    persistedLocally: 'persisted locally',
    loadingQueue: 'Loading review queue…',
    emptyQueueKicker: 'HUMAN VERIFICATION QUEUE',
    emptyQueueTitleAwaiting: 'No reviews awaiting a decision',
    emptyQueueTitleOther: 'No records in this view',
    emptyQueueDescAwaiting: 'Completed analyses appear here for human review. The analysis score alone cannot approve content.',
    emptyQueueDescOther: 'Records will appear in this filter as they move through the review lifecycle.',

    priorityAttention: 'Priority attention',
    byAuthorPrefix: 'By',
    consistencyScorePrefix: 'Consistency',
    findingsSingular: 'finding',
    findingsPlural: 'findings',
    openReviewAction: 'Open review',
    viewDecisionAction: 'View decision',

    humanVerificationKickerDetail: 'Human verification',
    submittedByPrefix: 'Submitted by',
    decisionOwnedTitle: 'Decision is owned by a reviewer',
    decisionOwnedSubtitle: 'AI findings and score inform your review; neither can authorize publication.',
    stageStatusComplete: 'Complete',
    stageStatusYourDecision: 'Your decision',
    stageStatusIssuesFlagged: 'Issues flagged',
    stageStatusPending: 'Pending',
    approvalBoundNotePrefix: 'Approval is bound to revision',
    approvalBoundNoteSuffix: 'Any re-analysis creates a new revision and requires a new human decision; earlier decisions remain in the audit trail.',

    submittedContentKicker: '01 / SUBMITTED CONTENT',
    titleCurrentAnalysedRevision: 'Current analysed revision',
    titleAnalysisOutOfDate: 'Analysis out of date',
    titleUnanalysedDraftRevision: 'Unanalysed draft revision',
    descExactContentReviewed: 'Exact content and active rules reviewed',
    descRulesChangedSinceAnalysis: 'Active rules or evidence changed since analysis',
    descEditedAwaitingAnalysis: 'Edited content awaiting analysis',
    wordsCountSuffix: 'words',
    charsCountSuffix: 'characters',
    analysisMatchesRevisionStatus: 'Analysis matches revision',
    reanalysisRequiredStatus: 'Re-analysis required',
    btnCreateRevisedContent: 'Create revised content',
    btnContinueEditingAndAnalyse: 'Continue editing and analyse',
    btnReviseAndReanalyse: 'Revise and re-analyse',
    btnReanalyseWithCurrentRules: 'Re-analyse with current rules',

    aiFindingsKicker: '02 / AI FINDINGS',
    aiScoreAdvisoryDisclaimer: 'AI scoring is advisory and does not equal approval.',
    analysisRequiredAlert: 'This revision must be analysed before it can enter human verification.',
    noRulesMatchedNotice: 'No configured local rule matched this revision. Human verification is still required.',
    matchedGuidelineHighlightTitle: 'Matched by an active local guideline',
    guidelineLabelPrefix: 'Guideline:',

    evidenceKicker: '03 / EVIDENCE & GUIDELINES',
    referencesTitle: 'Available references',
    referencesSubtitle: 'A rule reference is guidance, not independent proof.',
    evidenceCannotBeAssessedNotice: 'Evidence cannot be assessed until local analysis is run for this revision.',
    noFindingsRequireReferencePrefix: 'No findings require a reference. The current workspace catalogue contains',
    catalogueEntriesSuffix: 'entries.',
    catalogueEntryRemovedSuffix: '(catalogue entry later removed)',
    atAnalysisSuffix: 'at analysis.',
    noMatchingApprovedEvidenceNotice: 'No matching approved factual evidence exists in the local catalogue.',
    unverifiedNotFalseNotice: 'Unverified — not determined to be false.',
    snapshotAtAnalysisPrefix: 'Snapshot at analysis:',
    reviewedWord: 'reviewed',
    dueWord: 'due',
    notRecordedWord: 'not recorded',
    supportingAttachmentsTitle: 'Supporting Evidence Attachments',
    supportingAttachmentsSubtitle: 'Files attached for human reviewer verification',
    attachmentsNoticeVerificationGate: 'Human verification notice: Supporting attachments are submitted by authors for editorial verification. Attachments are not automatically verified and do not alter AI consistency scores.',
    noAttachmentsForRevision: 'No evidence files were attached to this revision.',
    attachmentBtnInspect: 'Inspect',
    attachmentBtnDownload: 'Download',
    attachmentGeneratingUrl: 'Generating signed access…',
    attachmentSignedUrlError: 'Could not generate secure signed URL for attachment.',
    attachmentAttachedBy: 'Uploaded by',
    configuredLocalRulesHeading: 'Configured local rules',

    approvedGreenKicker: 'HUMAN DECISION · FOREST GREEN',
    approvedRevisionTitle: 'Approved for this revision',
    approvedRevisionSubtitle: 'This approval applies only to the exact content and hash shown below.',
    decisionDatumLabel: 'Decision',
    reviewerDatumLabel: 'Reviewer',
    recordedDatumLabel: 'Recorded',
    reviewerCommentStrong: 'Reviewer comment:',
    approvedRevisionHeaderPrefix: 'Approved revision',

    humanDecisionKicker: 'HUMAN DECISION',
    recordedByPrefix: 'Recorded by',
    noAdditionalCommentRecorded: 'No additional reviewer comment was recorded.',

    reviewerDecisionKicker: 'REVIEWER DECISION',
    yourDecisionRequiredTitle: 'Your decision is required',
    decisionRecordTitle: 'Decision record',
    decisionRequiredSubtitle: 'Inspect all submitted content, findings, and evidence before recording a human decision.',
    workflowAuthoritativeSubtitle: 'The current workflow state is authoritative; earlier approvals remain tied to their original revision.',
    legacyUntrustedNotice: 'This browser-imported record contains historical decision text that was not authenticated. It was reset to draft; re-analyse and record a new authenticated human decision before approval.',
    contentOrRulesChangedAlert: 'The content or active rule/evidence configuration changed after analysis. No decision can be recorded until this revision is analysed again.',

    actionApproveTitle: 'Approve',
    actionApproveDesc: 'Approve this exact analysed revision.',
    actionChangesTitle: 'Request Changes',
    actionChangesDesc: 'Return the draft with mandatory feedback.',
    actionRejectTitle: 'Reject',
    actionRejectDesc: 'Record a final rejection and rationale.',
    affordanceApprove: 'Click to sign off',
    affordanceChanges: 'Open revision drawer',
    affordanceReject: 'Record rejection',
    chooseThisDecision: 'Choose this decision',
    analysisRequiredFirst: 'Analysis required first',
    reviewerRoleRequiredNote: 'Reviewer or workspace-admin membership is required to record a human decision.',
    authReviewerAccountLabel: 'Authenticated reviewer account:',
    dbDecisionTiedNotice: 'The recorded database decision is tied to your Supabase user ID.',

    workflowDescDraft: 'This edited revision must be analysed before it can return to the human verification gate.',
    workflowDescRejected: 'Rejected content remains preserved as a record. Rejection is distinct from requesting changes.',
    workflowDescChanges: 'The creator can revise the content, analyse the new revision, and return it for a new human decision.',
    workflowDescApprovedCurrent: 'Human approval is confirmed for the current revision only.',
    workflowDescApprovedEarlier: 'The approval shown in the history belongs to an earlier content revision and does not approve this one.',
    btnCreateRevisedRevision: 'Create revised revision',

    auditTrailKicker: 'AUDIT TRAIL',
    auditTrailTitle: 'Revision and decision history',
    auditTrailSubtitle: 'Prior decisions are retained and never transferred to a newer revision.',
    noEarlierRevisionsOrDecisions: 'No earlier revisions or decisions have been recorded.',
    archivedRevisionPrefix: 'Archived revision',
    byWord: 'by',
    scorePrefix: 'Score',
    revisionWord: 'Revision',
    humanVerificationGateKicker: 'HUMAN VERIFICATION GATE',
    analysisRequiredTitle: 'Analysis required',
    noCurrentScoreAvailable: 'No current score available',
  },
  hi: {
    filterAwaitingReview: 'समीक्षा प्रतीक्षित',
    filterApproved: 'स्वीकृत',
    filterChangesRequested: 'बदलाव का अनुरोध',
    filterRejected: 'अस्वीकृत',
    filterAllReviews: 'सभी समीक्षाएँ',

    statusDraft: 'विश्लेषण आवश्यक',
    statusSubmitted: 'सबमिट किया गया',
    statusAnalysisComplete: 'विश्लेषण पूर्ण',
    statusValidationComplete: 'सत्यापन पूर्ण',
    statusIssuesFound: 'समस्याएं मिलीं',
    statusAwaitingHumanVerification: 'मानव सत्यापन प्रतीक्षित',
    statusApproved: 'स्वीकृत',
    statusChangesRequested: 'बदलाव का अनुरोध',
    statusRejected: 'अस्वीकृत',

    severityCritical: 'अत्यंत गंभीर',
    severityModerate: 'मध्यम',
    severityMinor: 'कम',

    evidenceMatched: 'सूची से मेल',
    evidenceUnverified: 'असत्यापित',
    evidenceRuleOnly: 'केवल नियम संदर्भ',

    browserStorageError: 'ब्राउज़र स्थानीय समीक्षा स्टोरेज तक नहीं पहुँच सका।',
    timeUnavailable: 'समय उपलब्ध नहीं',
    reviewsLoadError: 'समीक्षाएं लोड नहीं की जा सकीं:',
    workspaceConfigError: 'कार्यस्थान कॉन्फ़िगरेशन लोड नहीं किया जा सका:',

    decisionApprove: 'स्वीकृत करें',
    decisionRequestChanges: 'बदलाव का अनुरोध करें',
    decisionReject: 'अस्वीकृत करें',
    decisionApproved: 'स्वीकृत',
    decisionChangesRequested: 'बदलाव का अनुरोध',
    decisionRejected: 'अस्वीकृत',

    stageAnalysis: 'AI सामग्री विश्लेषण',
    stageValidation: 'ब्रांड और साक्ष्य सत्यापन',
    stageHuman: 'मानव सत्यापन',
    stagePublication: 'प्रकाशन स्वीकृति',

    roleRequiredToDecide: 'मानव निर्णय दर्ज करने के लिए समीक्षक या कार्यस्थान-व्यवस्थापक सदस्यता आवश्यक है।',
    reviewerNameRequired: 'वर्तमान कार्यस्थान नीति के अनुसार समीक्षक का प्रदर्शन नाम आवश्यक है।',
    rejectionReasonRequired: 'अस्वीकृति का कारण आवश्यक है।',
    explainChangesRequired: 'इस निर्णय को सबमिट करने से पहले आवश्यक परिवर्तनों की व्याख्या करें।',
    anonymousReviewerFallback: 'अनाम डेमो समीक्षक',

    loadingReviewRecord: 'समीक्षा रिकॉर्ड लोड हो रहा है…',
    backToQueue: 'कतार पर वापस जाएं',
    kickerHumanVerification: 'मानव सत्यापन',
    reviewNotFoundTitle: 'समीक्षा नहीं मिली',
    reviewNotFoundDescription: 'यह समीक्षा साझा स्थानीय समीक्षा स्टोर में मौजूद नहीं है।',

    modalKicker: 'डेमो समीक्षक · मानव सत्यापन',
    confirmDecision: 'निर्णय की पुष्टि करें',
    confirmTitlePrefix: 'पुष्टि करें',
    explanationApproved: 'आप यहाँ प्रदर्शित सटीक विश्लेषित संशोधन को स्वीकृत कर रहे हैं। बाद के किसी भी सामग्री संशोधन के लिए नए विश्लेषण और मानवीय स्वीकृति की आवश्यकता होगी।',
    explanationChangesRequested: 'सामग्री निर्माता आपकी टिप्पणी देख सकेंगे और इस रिकॉर्ड को संशोधित कर सकेंगे। संशोधित सामग्री को मानव द्वार पर लौटने से पहले विश्लेषित किया जाना चाहिए।',
    explanationRejected: 'इस सामग्री को अस्वीकृत चिह्नित किया जाएगा और आपके आवश्यक कारण के साथ सुरक्षित रखा जाएगा। अस्वीकृति को संशोधन के अनुरोध के साथ भ्रमित नहीं किया जा सकता।',

    quickDirectivesKicker: 'समीक्षक के त्वरित निर्देश · सक्रिय निष्कर्षों पर आधारित',
    directiveR103A: '+ अप्रमाणित 100% / गारंटी का दावा हटाएं (R-103)',
    directiveR103B: '+ स्वीकृत SLA / बेंचमार्क साक्ष्य संलग्न करें (EVI-01)',
    directiveR101: '+ असत्यापित वैश्विक श्रेष्ठता दावे को सौम्य करें (R-101)',
    directiveR106: '+ CTA सुलभता और लहजा ठीक करें (R-106)',

    commentLabelOptional: 'समीक्षक की टिप्पणी (वैकल्पिक)',
    commentLabelRejectionRequired: 'अस्वीकृति का कारण (आवश्यक)',
    commentLabelRationaleRequired: 'समीक्षक का कारण (आवश्यक)',
    commentPlaceholderApprove: 'निर्णय रिकॉर्ड के लिए एक वैकल्पिक नोट जोड़ें।',
    commentPlaceholderReject: 'बताएं कि यह सबमिशन आगे क्यों नहीं बढ़ सकता।',
    commentPlaceholderChanges: 'बताएं कि संशोधनों की आवश्यकता क्यों है। यह नोट गतिविधि और ऑडिट रिकॉर्ड में दिखाई देता है।',
    suggestedDraftLabel: 'वैकल्पिक इनलाइन रेडलाइन / सुझाया गया ड्राफ्ट',
    suggestedDraftHelperText: 'यह संपादन योग्य ड्राफ्ट आपके कारण से अलग सहेजा जाता है और सबमिट किए गए संशोधन को प्रतिस्थापित नहीं करता है।',
    decisionLinkedAccountNotice: 'निर्णय आपके प्रमाणित खाते से जुड़ा है।',
    btnCancel: 'रद्द करें',
    dialogReviewTitle: 'समीक्षा शीर्षक',
    dialogSelectedDecision: 'चयनित निर्णय',
    dialogHistoryNotice: 'यह पुष्ट निर्णय समीक्षा इतिहास और कार्यक्षेत्र ऑडिट लॉग में स्थायी रूप से दर्ज किया जाता है। एक मानवीय समीक्षक के रूप में, आपका निर्णय साझा कार्यक्षेत्र पर तुरंत प्रभावी होता है।',
    decisionSuccessBanner: 'समीक्षा इतिहास में निर्णय सफलतापूर्वक दर्ज किया गया',

    pageKicker: 'संपादकीय नियंत्रण / मानव-स्वामित्व वाला निर्णय',
    pageTitle: 'मानव सत्यापन द्वार',
    pageDescription: 'निर्णय लेने से पहले सबमिट किए गए संशोधन, निष्कर्षों और उपलब्ध साक्ष्यों की समीक्षा करें। AI संगति स्कोर केवल सलाहकारी है; यह कभी भी प्रकाशन स्वीकृति नहीं है।',
    outstandingReviewsLabel: 'लंबित मानव समीक्षाएं',
    queueFiltersAria: 'स्वीकृति कतार फ़िल्टर',
    queueKicker: 'समीक्षा कतार',
    awaitingYourReviewHeading: 'आपकी समीक्षा की प्रतीक्षा में',
    recordSingular: 'रिकॉर्ड',
    recordPlural: 'रिकॉर्ड',
    persistedLocally: 'स्थानीय रूप से सहेजा गया',
    loadingQueue: 'समीक्षा कतार लोड हो रही है…',
    emptyQueueKicker: 'मानव सत्यापन कतार',
    emptyQueueTitleAwaiting: 'निर्णय की प्रतीक्षा में कोई समीक्षा नहीं है',
    emptyQueueTitleOther: 'इस दृश्य में कोई रिकॉर्ड नहीं है',
    emptyQueueDescAwaiting: 'पूर्ण किए गए विश्लेषण मानवीय समीक्षा के लिए यहाँ दिखाई देते हैं। केवल विश्लेषण स्कोर सामग्री को स्वीकृत नहीं कर सकता।',
    emptyQueueDescOther: 'जैसे-जैसे रिकॉर्ड समीक्षा जीवनचक्र से गुजरेंगे, वे इस फ़िल्टर में दिखाई देंगे।',

    priorityAttention: 'प्राथमिकता ध्यान',
    byAuthorPrefix: 'द्वारा',
    consistencyScorePrefix: 'संगति',
    findingsSingular: 'निष्कर्ष',
    findingsPlural: 'निष्कर्ष',
    openReviewAction: 'समीक्षा खोलें',
    viewDecisionAction: 'निर्णय देखें',

    humanVerificationKickerDetail: 'मानव सत्यापन',
    submittedByPrefix: 'द्वारा सबमिट किया गया',
    decisionOwnedTitle: 'निर्णय का स्वामित्व समीक्षक के पास है',
    decisionOwnedSubtitle: 'AI निष्कर्ष और स्कोर आपकी समीक्षा को सूचित करते हैं; इनमें से कोई भी प्रकाशन को अधिकृत नहीं कर सकता।',
    stageStatusComplete: 'पूर्ण',
    stageStatusYourDecision: 'आपका निर्णय',
    stageStatusIssuesFlagged: 'समस्याएं चिह्नित',
    stageStatusPending: 'लंबित',
    approvalBoundNotePrefix: 'स्वीकृति संशोधन से बंधी है',
    approvalBoundNoteSuffix: 'किसी भी पुन: विश्लेषण से एक नया संशोधन बनता है और नए मानवीय निर्णय की आवश्यकता होती है; पहले के निर्णय ऑडिट ट्रेल में बने रहते हैं।',

    submittedContentKicker: '01 / सबमिट की गई सामग्री',
    titleCurrentAnalysedRevision: 'वर्तमान विश्लेषित संशोधन',
    titleAnalysisOutOfDate: 'विश्लेषण पुराना हो चुका है',
    titleUnanalysedDraftRevision: 'अविश्लेषित ड्राफ्ट संशोधन',
    descExactContentReviewed: 'सटीक सामग्री और सक्रिय नियमों की समीक्षा की गई',
    descRulesChangedSinceAnalysis: 'विश्लेषण के बाद सक्रिय नियम या साक्ष्य बदल गए',
    descEditedAwaitingAnalysis: 'संपादित सामग्री विश्लेषण की प्रतीक्षा में है',
    wordsCountSuffix: 'शब्द',
    charsCountSuffix: 'वर्ण',
    analysisMatchesRevisionStatus: 'विश्लेषण संशोधन से मेल खाता है',
    reanalysisRequiredStatus: 'पुन: विश्लेषण आवश्यक',
    btnCreateRevisedContent: 'संशोधित सामग्री बनाएं',
    btnContinueEditingAndAnalyse: 'संपादन जारी रखें और विश्लेषण करें',
    btnReviseAndReanalyse: 'संशोधित करें और पुन: विश्लेषण करें',
    btnReanalyseWithCurrentRules: 'वर्तमान नियमों के साथ पुन: विश्लेषण करें',

    aiFindingsKicker: '02 / AI निष्कर्ष',
    aiScoreAdvisoryDisclaimer: 'AI स्कोरिंग केवल सलाहकारी है और यह स्वीकृति के बराबर नहीं है।',
    analysisRequiredAlert: 'मानव सत्यापन में प्रवेश करने से पहले इस संशोधन का विश्लेषण किया जाना चाहिए।',
    noRulesMatchedNotice: 'कोई भी कॉन्फ़िगर किया गया स्थानीय नियम इस संशोधन से मेल नहीं खाता। मानव सत्यापन अभी भी आवश्यक है।',
    matchedGuidelineHighlightTitle: 'सक्रिय स्थानीय दिशानिर्देश द्वारा मिलान',
    guidelineLabelPrefix: 'दिशानिर्देश:',

    evidenceKicker: '03 / साक्ष्य और दिशानिर्देश',
    referencesTitle: 'उपलब्ध संदर्भ',
    referencesSubtitle: 'नियम संदर्भ मार्गदर्शन है, स्वतंत्र प्रमाण नहीं।',
    evidenceCannotBeAssessedNotice: 'इस संशोधन के लिए स्थानीय विश्लेषण चलाए जाने तक साक्ष्य का आकलन नहीं किया जा सकता।',
    noFindingsRequireReferencePrefix: 'किसी भी निष्कर्ष के लिए संदर्भ की आवश्यकता नहीं है। वर्तमान कार्यस्थान सूची में शामिल हैं:',
    catalogueEntriesSuffix: 'प्रविष्टियाँ।',
    catalogueEntryRemovedSuffix: '(सूची प्रविष्टि बाद में हटा दी गई)',
    atAnalysisSuffix: 'विश्लेषण के समय।',
    noMatchingApprovedEvidenceNotice: 'स्थानीय सूची में कोई मेल खाता स्वीकृत तथ्यात्मक साक्ष्य मौजूद नहीं है।',
    unverifiedNotFalseNotice: 'असत्यापित — गलत निर्धारित नहीं किया गया।',
    snapshotAtAnalysisPrefix: 'विश्लेषण के समय स्नैपशॉट:',
    reviewedWord: 'समीक्षित',
    dueWord: 'नियत',
    notRecordedWord: 'दर्ज नहीं',
    supportingAttachmentsTitle: 'सहायक साक्ष्य संलग्नक',
    supportingAttachmentsSubtitle: 'मानव समीक्षक सत्यापन के लिए संलग्न फ़ाइलें',
    attachmentsNoticeVerificationGate: 'मानव सत्यापन सूचना: संपादकीय सत्यापन के लिए लेखकों द्वारा सहायक संलग्नक प्रस्तुत किए जाते हैं। संलग्नक स्वचालित रूप से सत्यापित नहीं होते हैं और AI सुसंगतता स्कोर में बदलाव नहीं करते हैं।',
    noAttachmentsForRevision: 'इस संशोधन के साथ कोई साक्ष्य फ़ाइल संलग्न नहीं की गई थी।',
    attachmentBtnInspect: 'निरीक्षण करें',
    attachmentBtnDownload: 'डाउनलोड करें',
    attachmentGeneratingUrl: 'सुरक्षित एक्सेस लिंक तैयार किया जा रहा है…',
    attachmentSignedUrlError: 'संलग्नक के लिए सुरक्षित हस्ताक्षरित URL जनरेट नहीं किया जा सका।',
    attachmentAttachedBy: 'द्वारा अपलोड किया गया',
    configuredLocalRulesHeading: 'कॉन्फ़िगर किए गए स्थानीय नियम',

    approvedGreenKicker: 'मानवीय निर्णय · फ़ॉरेस्ट ग्रीन',
    approvedRevisionTitle: 'इस संशोधन के लिए स्वीकृत',
    approvedRevisionSubtitle: 'यह स्वीकृति केवल नीचे दिखाई गई सटीक सामग्री और हैश पर लागू होती है।',
    decisionDatumLabel: 'निर्णय',
    reviewerDatumLabel: 'समीक्षक',
    recordedDatumLabel: 'दर्ज किया गया',
    reviewerCommentStrong: 'समीक्षक की टिप्पणी:',
    approvedRevisionHeaderPrefix: 'स्वीकृत संशोधन',

    humanDecisionKicker: 'मानव निर्णय',
    recordedByPrefix: 'द्वारा दर्ज किया गया',
    noAdditionalCommentRecorded: 'कोई अतिरिक्त समीक्षक टिप्पणी दर्ज नहीं की गई थी।',

    reviewerDecisionKicker: 'समीक्षक का निर्णय',
    yourDecisionRequiredTitle: 'आपका निर्णय आवश्यक है',
    decisionRecordTitle: 'निर्णय रिकॉर्ड',
    decisionRequiredSubtitle: 'मानव निर्णय दर्ज करने से पहले सभी सबमिट की गई सामग्री, निष्कर्षों और साक्ष्यों का निरीक्षण करें।',
    workflowAuthoritativeSubtitle: 'वर्तमान कार्यप्रवाह स्थिति आधिकारिक है; पहले के अनुमोदन अपने मूल संशोधन से बंधे रहते हैं।',
    legacyUntrustedNotice: 'इस ब्राउज़र-आयातित रिकॉर्ड में ऐतिहासिक निर्णय पाठ शामिल है जो प्रमाणित नहीं था। इसे ड्राफ्ट पर रीसेट कर दिया गया था; अनुमोदन से पहले पुन: विश्लेषण करें और एक नया प्रमाणित मानवीय निर्णय दर्ज करें।',
    contentOrRulesChangedAlert: 'विश्लेषण के बाद सामग्री या सक्रिय नियम/साक्ष्य विन्यास बदल गया। जब तक इस संशोधन का पुन: विश्लेषण नहीं किया जाता, तब तक कोई निर्णय दर्ज नहीं किया जा सकता।',

    actionApproveTitle: 'स्वीकृत करें',
    actionApproveDesc: 'इस सटीक विश्लेषित संशोधन को स्वीकृत करें।',
    actionChangesTitle: 'बदलाव का अनुरोध करें',
    actionChangesDesc: 'अनिवार्य प्रतिक्रिया के साथ ड्राफ्ट वापस करें।',
    actionRejectTitle: 'अस्वीकृत करें',
    actionRejectDesc: 'अंतिम अस्वीकृति और कारण दर्ज करें।',
    affordanceApprove: 'हस्ताक्षर के लिए क्लिक करें',
    affordanceChanges: 'संशोधन ड्रॉअर खोलें',
    affordanceReject: 'अस्वीकृति दर्ज करें',
    chooseThisDecision: 'यह निर्णय चुनें',
    analysisRequiredFirst: 'पहले विश्लेषण आवश्यक है',
    reviewerRoleRequiredNote: 'मानव निर्णय दर्ज करने के लिए समीक्षक या कार्यस्थान-व्यवस्थापक सदस्यता आवश्यक है।',
    authReviewerAccountLabel: 'प्रमाणित समीक्षक खाता:',
    dbDecisionTiedNotice: 'दर्ज किया गया डेटाबेस निर्णय आपके Supabase उपयोगकर्ता आईडी से जुड़ा है।',

    workflowDescDraft: 'मानव सत्यापन द्वार पर लौटने से पहले इस संपादित संशोधन का विश्लेषण किया जाना चाहिए।',
    workflowDescRejected: 'अस्वीकृत सामग्री एक रिकॉर्ड के रूप में सुरक्षित रहती है। अस्वीकृति परिवर्तन का अनुरोध करने से भिन्न है।',
    workflowDescChanges: 'निर्माता सामग्री को संशोधित कर सकता है, नए संशोधन का विश्लेषण कर सकता है, और इसे एक नए मानवीय निर्णय के लिए वापस ला सकता है।',
    workflowDescApprovedCurrent: 'मानव स्वीकृति केवल वर्तमान संशोधन के लिए पुष्टीकृत है।',
    workflowDescApprovedEarlier: 'इतिहास में दिखाई गई स्वीकृति पहले के सामग्री संशोधन से संबंधित है और इसे स्वीकृत नहीं करती है।',
    btnCreateRevisedRevision: 'संशोधित संशोधन बनाएं',

    auditTrailKicker: 'ऑडिट ट्रेल',
    auditTrailTitle: 'संशोधन और निर्णय इतिहास',
    auditTrailSubtitle: 'पूर्व निर्णय बरकरार रखे जाते हैं और कभी भी नए संशोधन में स्थानांतरित नहीं किए जाते हैं।',
    noEarlierRevisionsOrDecisions: 'कोई पुराना संशोधन या निर्णय दर्ज नहीं किया गया है।',
    archivedRevisionPrefix: 'संग्रहीत संशोधन',
    byWord: 'द्वारा',
    scorePrefix: 'स्कोर',
    revisionWord: 'संशोधन',
    humanVerificationGateKicker: 'मानव सत्यापन द्वार',
    analysisRequiredTitle: 'विश्लेषण आवश्यक',
    noCurrentScoreAvailable: 'कोई वर्तमान स्कोर उपलब्ध नहीं',
  },
  gu: {
    filterAwaitingReview: 'સમીક્ષા બાકી',
    filterApproved: 'મંજૂર',
    filterChangesRequested: 'ફેરફારો મંગાયા',
    filterRejected: 'નકારાયેલ',
    filterAllReviews: 'બધી સમીક્ષાઓ',

    statusDraft: 'વિશ્લેષણ જરૂરી',
    statusSubmitted: 'સબમિટ કરેલ',
    statusAnalysisComplete: 'વિશ્લેષણ પૂર્ણ',
    statusValidationComplete: 'ચકાસણી પૂર્ણ',
    statusIssuesFound: 'સમસ્યાઓ મળી',
    statusAwaitingHumanVerification: 'માનવ ચકાસણી બાકી',
    statusApproved: 'મંજૂર',
    statusChangesRequested: 'ફેરફારો મંગાયા',
    statusRejected: 'નકારાયેલ',

    severityCritical: 'ગંભીર',
    severityModerate: 'મધ્યમ',
    severityMinor: 'નાનું',

    evidenceMatched: 'સૂચિમાં મેળ',
    evidenceUnverified: 'અચકાસાયેલ',
    evidenceRuleOnly: 'ફક્ત નિયમ સંદર્ભ',

    browserStorageError: 'બ્રાઉઝર સ્થાનિક સમીક્ષા સંગ્રહને ઍક્સેસ કરી શક્યું નથી.',
    timeUnavailable: 'સમય ઉપલબ્ધ નથી',
    reviewsLoadError: 'સમીક્ષાઓ લોડ થઈ શકી નથી:',
    workspaceConfigError: 'કાર્યસ્થળ રૂપરેખાંકન લોડ થઈ શક્યું નથી:',

    decisionApprove: 'મંજૂર કરો',
    decisionRequestChanges: 'ફેરફારની વિનંતી કરો',
    decisionReject: 'નકારો',
    decisionApproved: 'મંજૂર',
    decisionChangesRequested: 'ફેરફારો મંગાયા',
    decisionRejected: 'નકારાયેલ',

    stageAnalysis: 'AI સામગ્રી વિશ્લેષણ',
    stageValidation: 'બ્રાન્ડ અને પુરાવા ચકાસણી',
    stageHuman: 'માનવ ચકાસણી',
    stagePublication: 'પ્રકાશન મંજૂરી',

    roleRequiredToDecide: 'માનવ નિર્ણય નોંધવા માટે સમીક્ષક અથવા કાર્યસ્થળ-સંચાલક સભ્યપદ જરૂરી છે.',
    reviewerNameRequired: 'વર્તમાન કાર્યસ્થળ નીતિ મુજબ સમીક્ષકનું પ્રદર્શન નામ જરૂરી છે.',
    rejectionReasonRequired: 'અસ્વીકારનું કારણ જરૂરી છે.',
    explainChangesRequired: 'આ નિર્ણય સબમિટ કરતાં પહેલાં જરૂરી ફેરફારો સમજાવો.',
    anonymousReviewerFallback: 'અનામી ડેમો સમીક્ષક',

    loadingReviewRecord: 'સમીક્ષા રેકોર્ડ લોડ થઈ રહ્યો છે…',
    backToQueue: 'કતાર પર પાછા જાઓ',
    kickerHumanVerification: 'માનવ ચકાસણી',
    reviewNotFoundTitle: 'સમીક્ષા મળી નથી',
    reviewNotFoundDescription: 'આ સમીક્ષા શેર કરેલા સ્થાનિક સમીક્ષા સંગ્રહમાં હાજર નથી.',

    modalKicker: 'ડેમો સમીક્ષક · માનવ ચકાસણી',
    confirmDecision: 'નિર્ણયની પુષ્ટિ કરો',
    confirmTitlePrefix: 'પુષ્ટિ કરો',
    explanationApproved: 'તમે અહીં દર્શાવેલ ચોક્કસ વિશ્લેષિત સુધારાને મંજૂર કરી રહ્યા છો. પછીના કોઈપણ સામગ્રી સુધારા માટે ફરીથી નવા વિશ્લેષણ અને માનવ મંજૂરીની જરૂર પડશે.',
    explanationChangesRequested: 'સામગ્રી નિર્માતા તમારી ટિપ્પણી જોઈ શકશે અને આ રેકોર્ડમાં ફેરફાર કરી શકશે. સુધારેલી સામગ્રીને માનવ દ્વાર પર મોકલતા પહેલા તેનું વિશ્લેષણ થવું આવશ્યક છે.',
    explanationRejected: 'આ સામગ્રીને નકારાયેલી તરીકે ચિહ્નિત કરવામાં આવશે અને તમારા જરૂરી કારણ સાથે સાચવવામાં આવશે. અસ્વીકારને સુધારાની વિનંતી ગણી શકાય નહીં.',

    quickDirectivesKicker: 'ઝડપી સમીક્ષક નિર્દેશો · સક્રિય તારણો પર આધારિત',
    directiveR103A: '+ અપ્રમાણિત 100% / ગેરંટીનો દાવો દૂર કરો (R-103)',
    directiveR103B: '+ મંજૂર SLA / બેન્ચમાર્ક પુરાવો જોડો (EVI-01)',
    directiveR101: '+ અચકાસાયેલ વૈશ્વિક શ્રેષ્ઠતા દાવાને હળવો કરો (R-101)',
    directiveR106: '+ CTA સુલભતા અને લહેજો સુધારો (R-106)',

    commentLabelOptional: 'સમીક્ષકની ટિપ્પણી (વૈકલ્પિક)',
    commentLabelRejectionRequired: 'અસ્વીકારનું કારણ (જરૂરી)',
    commentLabelRationaleRequired: 'સમીક્ષકનું કારણ (જરૂરી)',
    commentPlaceholderApprove: 'નિર્ણય રેકોર્ડ માટે વૈકલ્પિક નોંધ ઉમેરો.',
    commentPlaceholderReject: 'સમજાવો કે આ સબમિશન શા માટે આગળ વધી શકતું નથી.',
    commentPlaceholderChanges: 'સમજાવો કે શા માટે સુધારાઓ જરૂરી છે. આ નોંધ પ્રવૃત્તિ અને ઓડિટ રેકોર્ડ્સમાં દેખાશે.',
    suggestedDraftLabel: 'વૈકલ્પિક ઇનલાઇન રેડલાઇન / સૂચવેલ ડ્રાફ્ટ',
    suggestedDraftHelperText: 'આ સંપાદનયોગ્ય ડ્રાફ્ટ તમારા કારણથી અલગ સાચવવામાં આવે છે અને તે સબમિટ કરેલા સુધારાને બદલતો નથી.',
    decisionLinkedAccountNotice: 'નિર્ણય તમારા પ્રમાણિત ખાતા સાથે જોડાયેલો છે.',
    btnCancel: 'રદ કરો',
    dialogReviewTitle: 'સમીક્ષા શીર્ષક',
    dialogSelectedDecision: 'પસંદ કરેલ નિર્ણય',
    dialogHistoryNotice: 'આ પુષ્ટિ થયેલ નિર્ણય કાયમી ધોરણે સમીક્ષા ઇતિહાસ અને વર્કસ્પેસ ઑડિટ લૉગમાં રેકોર્ડ કરવામાં આવે છે. માનવીય સમીક્ષક તરીકે, તમારો નિર્ણય શેર કરેલ વર્કસ્પેસ પર તરત જ અમલમાં આવે છે.',
    decisionSuccessBanner: 'સમીક્ષા ઇતિહાસમાં નિર્ણય સફળતાપૂર્વક નોંધાયો',

    pageKicker: 'સંપાદકીય ગવર્નન્સ / માનવ-માલિકીનો નિર્ણય',
    pageTitle: 'માનવ ચકાસણી દ્વાર',
    pageDescription: 'નિર્ણય લેતાં પહેલાં સબમિટ કરેલા સુધારા, તારણો અને ઉપલબ્ધ પુરાવાઓની સમીક્ષા કરો. AI સુસંગતતા સ્કોર સલાહકારી છે; તે ક્યારેય પ્રકાશન મંજૂરી નથી.',
    outstandingReviewsLabel: 'બાકી માનવ સમીક્ષાઓ',
    queueFiltersAria: 'મંજૂરી કતાર ફિલ્ટર્સ',
    queueKicker: 'સમીક્ષા કતાર',
    awaitingYourReviewHeading: 'તમારી સમીક્ષાની પ્રતીક્ષામાં',
    recordSingular: 'રેકોર્ડ',
    recordPlural: 'રેકોર્ડ્સ',
    persistedLocally: 'સ્થાનિક રીતે સાચવેલ',
    loadingQueue: 'સમીક્ષા કતાર લોડ થઈ રહી છે…',
    emptyQueueKicker: 'માનવ ચકાસણી કતાર',
    emptyQueueTitleAwaiting: 'નિર્ણયની રાહમાં કોઈ સમીક્ષા નથી',
    emptyQueueTitleOther: 'આ વ્યુમાં કોઈ રેકોર્ડ નથી',
    emptyQueueDescAwaiting: 'પૂર્ણ થયેલ વિશ્લેષણ માનવ સમીક્ષા માટે અહીં દેખાય છે. માત્ર વિશ્લેષણ સ્કોર સામગ્રીને મંજૂર કરી શકતો નથી.',
    emptyQueueDescOther: 'રેકોર્ડ્સ સમીક્ષા જીવનચક્રમાંથી પસાર થશે તેમ આ ફિલ્ટરમાં દેખાશે.',

    priorityAttention: 'પ્રાથમિકતા ધ્યાન',
    byAuthorPrefix: 'દ્વારા',
    consistencyScorePrefix: 'સુસંગતતા',
    findingsSingular: 'તારણ',
    findingsPlural: 'તારણો',
    openReviewAction: 'સમીક્ષા ખોલો',
    viewDecisionAction: 'નિર્ણય જુઓ',

    humanVerificationKickerDetail: 'માનવ ચકાસણી',
    submittedByPrefix: 'દ્વારા સબમિટ કરેલ',
    decisionOwnedTitle: 'નિર્ણયની માલિકી સમીક્ષકની છે',
    decisionOwnedSubtitle: 'AI તારણો અને સ્કોર તમારી સમીક્ષાને માહિતી આપે છે; બંનેમાંથી કોઈ પણ પ્રકાશનને અધિકૃત કરી શકતું નથી.',
    stageStatusComplete: 'પૂર્ણ',
    stageStatusYourDecision: 'તમારો નિર્ણય',
    stageStatusIssuesFlagged: 'સમસ્યાઓ ચિહ્નિત',
    stageStatusPending: 'બાકી',
    approvalBoundNotePrefix: 'મંજૂરી સુધારા સાથે જોડાયેલી છે',
    approvalBoundNoteSuffix: 'કોઈપણ પુનઃવિશ્લેષણ નવો સુધારો બનાવે છે અને નવા માનવ નિર્ણયની જરૂર પડે છે; અગાઉના નિર્ણયો ઓડિટ ટ્રેલમાં રહે છે.',

    submittedContentKicker: '01 / સબમિટ કરેલ સામગ્રી',
    titleCurrentAnalysedRevision: 'વર્તમાન વિશ્લેષિત સુધારો',
    titleAnalysisOutOfDate: 'વિશ્લેષણ જૂનું થઈ ગયું છે',
    titleUnanalysedDraftRevision: 'અવિશ્લેષિત ડ્રાફ્ટ સુધારો',
    descExactContentReviewed: 'ચોક્કસ સામગ્રી અને સક્રિય નિયમોની સમીક્ષા થઈ',
    descRulesChangedSinceAnalysis: 'વિશ્લેષણ પછી સક્રિય નિયમો અથવા પુરાવા બદલાયા છે',
    descEditedAwaitingAnalysis: 'સંપાદિત સામગ્રી વિશ્લેષણની રાહમાં છે',
    wordsCountSuffix: 'શબ્દો',
    charsCountSuffix: 'અક્ષરો',
    analysisMatchesRevisionStatus: 'વિશ્લેષણ સુધારા સાથે મેળ ખાય છે',
    reanalysisRequiredStatus: 'પુનઃવિશ્લેષણ જરૂરી',
    btnCreateRevisedContent: 'સુધારેલી સામગ્રી બનાવો',
    btnContinueEditingAndAnalyse: 'સંપાદન ચાલુ રાખો અને વિશ્લેષણ કરો',
    btnReviseAndReanalyse: 'સુધારો અને પુનઃવિશ્લેષણ કરો',
    btnReanalyseWithCurrentRules: 'વર્તમાન નિયમો સાથે પુનઃવિશ્લેષણ કરો',

    aiFindingsKicker: '02 / AI તારણો',
    aiScoreAdvisoryDisclaimer: 'AI સ્કોરિંગ સલાહકારી છે અને તે મંજૂરી સમાન નથી.',
    analysisRequiredAlert: 'માનવ ચકાસણીમાં પ્રવેશતાં પહેલાં આ સુધારાનું વિશ્લેષણ થવું આવશ્યક છે.',
    noRulesMatchedNotice: 'કોઈ રૂપરેખાંકિત સ્થાનિક નિયમ આ સુધારા સાથે મેળ ખાતો નથી. માનવ ચકાસણી હજુ પણ જરૂરી છે.',
    matchedGuidelineHighlightTitle: 'સક્રિય સ્થાનિક માર્ગદર્શિકા સાથે મેળ ખાધું',
    guidelineLabelPrefix: 'માર્ગદર્શિકા:',

    evidenceKicker: '03 / પુરાવા અને માર્ગદર્શિકાઓ',
    referencesTitle: 'ઉપલબ્ધ સંદર્ભો',
    referencesSubtitle: 'નિયમ સંદર્ભ માર્ગદર્શન છે, સ્વતંત્ર પુરાવો નથી.',
    evidenceCannotBeAssessedNotice: 'આ સુધારા માટે સ્થાનિક વિશ્લેષણ ચલાવવામાં ન આવે ત્યાં સુધી પુરાવાનું મૂલ્યાંકન કરી શકાતું નથી.',
    noFindingsRequireReferencePrefix: 'કોઈ તારણો માટે સંદર્ભની જરૂર નથી. વર્તમાન કાર્યસ્થળ સૂચિમાં સમાવિષ્ટ છે:',
    catalogueEntriesSuffix: 'નોંધો.',
    catalogueEntryRemovedSuffix: '(સૂચિ નોંધ પાછળથી દૂર કરાઈ)',
    atAnalysisSuffix: 'વિશ્લેષણ વખતે.',
    noMatchingApprovedEvidenceNotice: 'સ્થાનિક સૂચિમાં કોઈ મેળ ખાતો મંજૂર તથ્યાત્મક પુરાવો નથી.',
    unverifiedNotFalseNotice: 'અચકાસાયેલ — ખોટું હોવાનું નક્કી થયું નથી.',
    snapshotAtAnalysisPrefix: 'વિશ્લેષણ વખતે સ્નેપશોટ:',
    reviewedWord: 'સમીક્ષિત',
    dueWord: 'બાકી',
    notRecordedWord: 'નોંધાયેલ નથી',
    supportingAttachmentsTitle: 'સહાયક પુરાવા જોડાણો',
    supportingAttachmentsSubtitle: 'માનવ સમીક્ષક ચકાસણી માટે જોડાયેલ ફાઇલો',
    attachmentsNoticeVerificationGate: 'માનવ ચકાસણી સૂચના: સંપાદકીય ચકાસણી માટે લેખકો દ્વારા સહાયક જોડાણો સબમિટ કરવામાં આવે છે. જોડાણો આપમેળે ચકાસાયેલ નથી અને AI સુસંગતતા સ્કોરમાં ફેરફાર કરતા નથી.',
    noAttachmentsForRevision: 'આ સુધારા સાથે કોઈ પુરાવા ફાઇલ જોડવામાં આવી ન હતી.',
    attachmentBtnInspect: 'તપાસ કરો',
    attachmentBtnDownload: 'ડાઉનલોડ કરો',
    attachmentGeneratingUrl: 'સુરક્ષિત એક્સેસ લિંક બનાવવામાં આવી રહી છે…',
    attachmentSignedUrlError: 'જોડાણ માટે સુરક્ષિત હસ્તાક્ષરિત URL બનાવી શકાયું નથી.',
    attachmentAttachedBy: 'દ્વારા અપલોડ કરવામાં આવ્યું',
    configuredLocalRulesHeading: 'રૂપરેખાંકિત સ્થાનિક નિયમો',

    approvedGreenKicker: 'માનવીય નિર્ણય · ફોરેસ્ટ ગ્રીન',
    approvedRevisionTitle: 'આ સુધારા માટે મંજૂર',
    approvedRevisionSubtitle: 'આ મંજૂરી માત્ર નીચે દર્શાવેલ ચોક્કસ સામગ્રી અને હેશ પર લાગુ થાય છે.',
    decisionDatumLabel: 'નિર્ણય',
    reviewerDatumLabel: 'સમીક્ષક',
    recordedDatumLabel: 'નોંધાયેલ',
    reviewerCommentStrong: 'સમીક્ષકની ટિપ્પણી:',
    approvedRevisionHeaderPrefix: 'મંજૂર સુધારો',

    humanDecisionKicker: 'માનવ નિર્ણય',
    recordedByPrefix: 'દ્વારા નોંધાયેલ',
    noAdditionalCommentRecorded: 'કોઈ વધારાની સમીક્ષક ટિપ્પણી નોંધાઈ નહોતી.',

    reviewerDecisionKicker: 'સમીક્ષકનો નિર્ણય',
    yourDecisionRequiredTitle: 'તમારો નિર્ણય જરૂરી છે',
    decisionRecordTitle: 'નિર્ણય રેકોર્ડ',
    decisionRequiredSubtitle: 'માનવ નિર્ણય નોંધતાં પહેલાં તમામ સબમિટ કરેલી સામગ્રી, તારણો અને પુરાવાઓની તપાસ કરો.',
    workflowAuthoritativeSubtitle: 'વર્તમાન વર્કફ્લો સ્થિતિ સત્તાવાર છે; અગાઉની મંજૂરીઓ તેમના મૂળ સુધારા સાથે જોડાયેલી રહે છે.',
    legacyUntrustedNotice: 'આ બ્રાઉઝર-આયાત કરેલા રેકોર્ડમાં ઐતિહાસિક નિર્ણય લખાણ છે જે પ્રમાણિત નહોતું. તેને ડ્રાફ્ટ પર રીસેટ કરવામાં આવ્યું હતું; મંજૂરી પહેલાં પુનઃવિશ્લેષણ કરો અને નવો પ્રમાણિત માનવ નિર્ણય નોંધો.',
    contentOrRulesChangedAlert: 'વિશ્લેષણ પછી સામગ્રી અથવા સક્રિય નિયમ/પુરાવા રૂપરેખાંકન બદલાઈ ગયું છે. આ સુધારાનું ફરીથી વિશ્લેષણ ન થાય ત્યાં સુધી કોઈ નિર્ણય નોંધી શકાતો નથી.',

    actionApproveTitle: 'મંજૂર કરો',
    actionApproveDesc: 'આ ચોક્કસ વિશ્લેષિત સુધારાને મંજૂર કરો.',
    actionChangesTitle: 'ફેરફારની વિનંતી કરો',
    actionChangesDesc: 'ફરજિયાત પ્રતિસાદ સાથે ડ્રાફ્ટ પરત કરો.',
    actionRejectTitle: 'નકારો',
    actionRejectDesc: 'અંતિમ અસ્વીકાર અને કારણ નોંધો.',
    affordanceApprove: 'સહી કરવા ક્લિક કરો',
    affordanceChanges: 'સુધારા ડ્રોઅર ખોલો',
    affordanceReject: 'અસ્વીકાર નોંધો',
    chooseThisDecision: 'આ નિર્ણય પસંદ કરો',
    analysisRequiredFirst: 'પહેલાં વિશ્લેષણ જરૂરી છે',
    reviewerRoleRequiredNote: 'માનવ નિર્ણય નોંધવા માટે સમીક્ષક અથવા કાર્યસ્થળ-સંચાલક સભ્યપદ જરૂરી છે.',
    authReviewerAccountLabel: 'પ્રમાણિત સમીક્ષક ખાતું:',
    dbDecisionTiedNotice: 'નોંધાયેલ ડેટાબેઝ નિર્ણય તમારા Supabase વપરાશકર્તા ID સાથે જોડાયેલ છે.',

    workflowDescDraft: 'માનવ ચકાસણી દ્વાર પર પાછા ફરતાં પહેલાં આ સંપાદિત સુધારાનું વિશ્લેષણ થવું આવશ્યક છે.',
    workflowDescRejected: 'નકારાયેલી સામગ્રી એક રેકોર્ડ તરીકે સાચવી રાખવામાં આવે છે. અસ્વીકાર એ ફેરફારોની વિનંતી કરતાં અલગ છે.',
    workflowDescChanges: 'નિર્માતા સામગ્રીમાં સુધારો કરી શકે છે, નવા સુધારાનું વિશ્લેષણ કરી શકે છે અને તેને નવા માનવ નિર્ણય માટે પરત કરી શકે છે.',
    workflowDescApprovedCurrent: 'માનવ મંજૂરી માત્ર વર્તમાન સુધારા માટે જ પુષ્ટિ થયેલ છે.',
    workflowDescApprovedEarlier: 'ઇતિહાસમાં દર્શાવેલ મંજૂરી અગાઉના સામગ્રી સુધારાની છે અને તે આ સુધારાને મંજૂર કરતી નથી.',
    btnCreateRevisedRevision: 'નવો સુધારો બનાવો',

    auditTrailKicker: 'ઓડિટ ટ્રેલ',
    auditTrailTitle: 'સુધારો અને નિર્ણય ઇતિહાસ',
    auditTrailSubtitle: 'અગાઉના નિર્ણયો જળવાઈ રહે છે અને ક્યારેય નવા સુધારામાં ટ્રાન્સફર થતા નથી.',
    noEarlierRevisionsOrDecisions: 'કોઈ અગાઉના સુધારા કે નિર્ણયો નોંધાયા નથી.',
    archivedRevisionPrefix: 'સંગ્રહિત સુધારો',
    byWord: 'દ્વારા',
    scorePrefix: 'સ્કોર',
    revisionWord: 'સુધારો',
    humanVerificationGateKicker: 'માનવ ચકાસણી દ્વાર',
    analysisRequiredTitle: 'વિશ્લેષણ જરૂરી',
    noCurrentScoreAvailable: 'કોઈ વર્તમાન સ્કોર ઉપલબ્ધ નથી',
  },
} as const;

type ApprovalsUiKey = keyof typeof APPROVALS_UI.en;

const getApprovalsT = (language: SupportedLanguage) => (key: ApprovalsUiKey): string =>
  APPROVALS_UI[language]?.[key] ?? APPROVALS_UI.en[key];

const getFilters = (t: (key: ApprovalsUiKey) => string): { value: QueueFilter; label: string }[] => [
  { value: 'awaiting_human_verification', label: t('filterAwaitingReview') },
  { value: 'approved', label: t('filterApproved') },
  { value: 'changes_requested', label: t('filterChangesRequested') },
  { value: 'rejected', label: t('filterRejected') },
  { value: 'all', label: t('filterAllReviews') },
];

const getStatusLabel = (status: ReviewWorkflowStatus, t: (key: ApprovalsUiKey) => string): string => {
  const map: Record<ReviewWorkflowStatus, ApprovalsUiKey> = {
    draft: 'statusDraft',
    submitted: 'statusSubmitted',
    analysis_complete: 'statusAnalysisComplete',
    validation_complete: 'statusValidationComplete',
    issues_found: 'statusIssuesFound',
    awaiting_human_verification: 'statusAwaitingHumanVerification',
    approved: 'statusApproved',
    changes_requested: 'statusChangesRequested',
    rejected: 'statusRejected',
  };
  return t(map[status]);
};

const STATUS_STYLES: Record<ReviewWorkflowStatus, string> = {
  draft: 'border-stone-300 bg-stone-100 text-stone-700',
  submitted: 'border-copper-300 bg-copper-50 text-copper-800',
  analysis_complete: 'border-copper-300 bg-copper-50 text-copper-800',
  validation_complete: 'border-forest-300 bg-forest-50 text-forest-700',
  issues_found: 'border-copper-300 bg-copper-50 text-copper-800',
  awaiting_human_verification: 'border-copper-300 bg-copper-50 text-copper-800',
  approved: 'border-forest-300 bg-forest-50 text-forest-700',
  changes_requested: 'border-copper-300 bg-copper-50 text-copper-800',
  rejected: 'border-stone-400 bg-stone-200 text-obsidian',
};

const SEVERITY_STYLES: Record<ReviewFinding['severity'], string> = {
  critical: 'border-copper-400 bg-copper-50 text-copper-900',
  moderate: 'border-copper-300 bg-ivory-100 text-copper-800',
  minor: 'border-stone-300 bg-stone-100 text-stone-700',
};

const getSeverityLabel = (severity: ReviewFinding['severity'], t: (key: ApprovalsUiKey) => string): string => {
  const map: Record<ReviewFinding['severity'], ApprovalsUiKey> = {
    critical: 'severityCritical',
    moderate: 'severityModerate',
    minor: 'severityMinor',
  };
  return t(map[severity]);
};

const getEvidenceLabel = (status: ReviewFinding['evidenceStatus'], t: (key: ApprovalsUiKey) => string): string => {
  const map: Record<ReviewFinding['evidenceStatus'], ApprovalsUiKey> = {
    matched: 'evidenceMatched',
    unverified: 'evidenceUnverified',
    'rule-only': 'evidenceRuleOnly',
  };
  return t(map[status]);
};

const ERROR_MESSAGE = (error: unknown, fallback: string): string => (
  error instanceof Error ? error.message : fallback
);

const formatDate = (value: string, language: SupportedLanguage): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === 'hi' ? 'समय उपलब्ध नहीं' : language === 'gu' ? 'સમય ઉપલબ્ધ નથી' : 'Time unavailable';
  }
  const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
  return date.toLocaleString(locale);
};

const getFindingCounts = (findings: ReviewFinding[]) => ({
  critical: findings.filter((finding) => finding.severity === 'critical').length,
  moderate: findings.filter((finding) => finding.severity === 'moderate').length,
  minor: findings.filter((finding) => finding.severity === 'minor').length,
});

const getLatestDecision = (record: ReviewRecord) => (
  [...record.decisionHistory].reverse().find(
    (decision) => !decision.legacyLocalUnverified
      && decision.revision === record.revision
      && decision.contentHash === record.contentHash,
  )
);

const getReviewStages = (t: (key: ApprovalsUiKey) => string) => [
  { key: 'analysis', title: t('stageAnalysis'), icon: FileSearch },
  { key: 'validation', title: t('stageValidation'), icon: BookOpenCheck },
  { key: 'human', title: t('stageHuman'), icon: UserRoundCheck },
  { key: 'publication', title: t('stagePublication'), icon: BadgeCheck },
] as const;

export const ApprovalsPage: React.FC = () => {
  const auth = useAuth();
  const { language } = useLanguage();
  const t = useMemo(() => getApprovalsT(language), [language]);
  const filters = useMemo(() => getFilters(t), [t]);
  const canDecide = auth.role === 'reviewer' || auth.role === 'workspace_admin';
  const navigate = useNavigate();
  const { reviewId } = useParams<{ reviewId: string }>();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<QueueFilter>(
    filters.find((item) => item.value === searchParams.get('filter'))?.value ?? 'awaiting_human_verification',
  );
  const [storageError, setStorageError] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [activeDecision, setActiveDecision] = useState<ReviewDecision | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [suggestedDraft, setSuggestedDraft] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [decisionSuccess, setDecisionSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reviewerName, setReviewerName] = useState(DEFAULT_WORKSPACE_SETTINGS.reviewerDisplayName);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [analysisConfigHash, setAnalysisConfigHash] = useState('');
  const [localRules, setLocalRules] = useState<LocalBrandRule[]>([]);
  const [evidenceCatalogue, setEvidenceCatalogue] = useState<LocalEvidence[]>([]);

  useEffect(() => {
    const refreshRecords = () => {
      try {
        setRecords(readReviewRecords());
        setStorageError('');
      } catch (error) {
        setStorageError(`${t('reviewsLoadError')} ${ERROR_MESSAGE(error, t('browserStorageError'))}`);
      } finally {
        setIsLoading(false);
      }
    };
    refreshRecords();
    window.addEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getScopedStorageKey(REVIEW_RECORDS_STORAGE_KEY)) refreshRecords();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
      window.removeEventListener('storage', handleStorage);
    };
  }, [t]);

  useEffect(() => {
    const refreshReviewer = () => {
      try {
        const settings = readWorkspaceSettings();
        setReviewerName(auth.session?.user.email ?? settings.reviewerDisplayName);
        setWorkspaceSettings(settings);
        setAnalysisConfigHash(getWorkspaceAnalysisConfigHash());
        setLocalRules(getLocalBrandRules());
        setEvidenceCatalogue(getLocalEvidenceCatalogue());
        setWorkspaceError('');
      } catch (error) {
        setWorkspaceError(`${t('workspaceConfigError')} ${ERROR_MESSAGE(error, t('browserStorageError'))}`);
      }
    };
    refreshReviewer();
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshReviewer);
    return () => window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshReviewer);
  }, [auth.session?.user.email, t]);

  const selectedRecord = reviewId ? records.find((record) => record.id === reviewId) : undefined;
  const filteredRecords = useMemo(
    () => {
      const matchingRecords = records.filter((record) => filter === 'all' || record.status === filter);
      if (filter !== 'awaiting_human_verification') return matchingRecords;
      const requiresPriority = (record: ReviewRecord) => {
        const hasCritical = record.findings.some((finding) => finding.severity === 'critical');
        const hasElevated = record.findings.some((finding) => finding.severity === 'moderate');
        const belowScoreThreshold = record.score < workspaceSettings.minPassScore;
        return belowScoreThreshold || hasCritical || (workspaceSettings.gateStrictness === 'strict' && hasElevated);
      };
      return matchingRecords.sort((left, right) => {
        const priorityDelta = Number(requiresPriority(right)) - Number(requiresPriority(left));
        if (priorityDelta) return priorityDelta;
        return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
      });
    },
    [filter, records, workspaceSettings.gateStrictness, workspaceSettings.minPassScore],
  );
  const pendingCount = records.filter((record) => record.status === 'awaiting_human_verification').length;

  const openDecision = (decision: ReviewDecision) => {
    setActiveDecision(decision);
    setReviewComment('');
    setSuggestedDraft(selectedRecord?.currentContent ?? '');
    setDecisionError('');
    setDecisionSuccess('');
  };

  const handleCancelDecision = () => {
    if (isSaving) return;
    setActiveDecision(null);
    setDecisionError('');
    setReviewComment('');
  };

  const confirmDecision = async () => {
    if (!selectedRecord || !activeDecision || isSaving) return;
    if (!canDecide) {
      setDecisionError(t('roleRequiredToDecide'));
      return;
    }
    if (workspaceSettings.requireNamedSignature && !reviewerName.trim()) {
      setDecisionError(t('reviewerNameRequired'));
      return;
    }
    if ((activeDecision === 'changes_requested' || activeDecision === 'rejected') && !reviewComment.trim()) {
      setDecisionError(activeDecision === 'rejected'
        ? t('rejectionReasonRequired')
        : t('explainChangesRequired'));
      return;
    }
    setIsSaving(true);
    setDecisionError('');
    try {
      await cloudDecideReviewRecord(
        selectedRecord.id,
        activeDecision,
        reviewerName.trim() || t('anonymousReviewerFallback'),
        reviewComment,
        activeDecision === 'changes_requested' ? suggestedDraft : undefined,
      );
      const decisionLabel = decisionTitle(activeDecision, t);
      setDecisionSuccess(`${decisionLabel} · ${selectedRecord.title}`);
      setActiveDecision(null);
      setReviewComment('');
    } catch (error) {
      setDecisionError(ERROR_MESSAGE(error, t('browserStorageError')));
    } finally {
      setIsSaving(false);
    }
  };

  if (reviewId) {
    if (storageError) {
      return <ErrorState message={storageError} onBack={() => navigate('/approvals')} />;
    }
    if (isLoading) {
      return <p role="status" className="flex items-center gap-2 py-8 text-sm text-stone-600"><LoaderCircle className="h-4 w-4 animate-spin text-copper" />{t('loadingReviewRecord')}</p>;
    }
    if (!selectedRecord) {
      return (
        <div className="space-y-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={() => navigate('/approvals')}>{t('backToQueue')}</Button>
          <EmptyState kicker={t('kickerHumanVerification')} title={t('reviewNotFoundTitle')} description={t('reviewNotFoundDescription')} icon={<FileSearch className="h-5 w-5 text-stone-500" />} />
        </div>
      );
    }
    return (
      <>
        {decisionSuccess && (
          <div
            role="status"
            className="mb-4 flex items-start justify-between gap-3 border-l-2 border-forest bg-forest-50 p-3.5 text-xs text-forest-900 shadow-xs"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-forest mt-0.5" />
              <div>
                <p className="font-semibold text-forest-950">{t('decisionSuccessBanner')}</p>
                <p className="mt-0.5 text-forest-800">{decisionSuccess}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDecisionSuccess('')}
              className="p-1 text-forest-700 hover:text-forest-950 focus-visible:outline-none"
              aria-label="Dismiss message"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <ReviewDetail
          record={selectedRecord}
          localRules={localRules}
          evidenceCatalogue={evidenceCatalogue}
          reviewerName={reviewerName}
          canDecide={canDecide}
          analysisConfigHash={analysisConfigHash}
          gateStrictness={workspaceSettings.gateStrictness}
          storageError={workspaceError}
          onBack={() => navigate('/approvals')}
          onEdit={() => navigate(`/review?record=${encodeURIComponent(selectedRecord.id)}`)}
          onReanalyze={() => navigate(`/review?record=${encodeURIComponent(selectedRecord.id)}&reanalyze=1`)}
          onDecision={openDecision}
        />
        <Modal
          isOpen={activeDecision !== null}
          onClose={handleCancelDecision}
          kicker={t('modalKicker')}
          title={activeDecision ? `${t('confirmTitlePrefix')} ${decisionTitle(activeDecision, t)}` : t('confirmDecision')}
          subtitle={`${t('recordSingular')} ${selectedRecord.id} · ${t('revisionWord')} ${selectedRecord.revision} · ${selectedRecord.contentHash}`}
          maxWidth="lg"
        >
          {activeDecision && (
            <div className="space-y-4">
              {/* Review Title & Selected Decision Callout */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200 pb-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-500 block">
                    {t('dialogReviewTitle')}
                  </span>
                  <h3 className="font-serif text-sm sm:text-base font-semibold text-obsidian truncate">
                    {selectedRecord.title}
                  </h3>
                </div>
                <div className="shrink-0">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-stone-500 block">
                    {t('dialogSelectedDecision')}
                  </span>
                  <Badge
                    variant={activeDecision === 'approved' ? 'forest' : activeDecision === 'rejected' ? 'stone' : 'copper'}
                    size="sm"
                    dot
                  >
                    {decisionTitle(activeDecision, t)}
                  </Badge>
                </div>
              </div>

              {/* Permanent History Notice */}
              <div className="border-l-2 border-copper bg-copper-50/70 p-3 text-xs text-copper-950 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-copper-900">
                  <LockKeyhole className="h-3.5 w-3.5 text-copper" />
                  <span>{t('dialogHistoryNotice')}</span>
                </p>
                <p className="text-[11px] text-stone-600 leading-relaxed font-sans">
                  {t('decisionLinkedAccountNotice')} ({reviewerName || t('anonymousReviewerFallback')})
                </p>
              </div>

              <div className={`border-l-2 px-3 py-2 text-xs leading-relaxed ${activeDecision === 'approved' ? 'border-forest bg-forest-50 text-forest-900' : 'border-copper bg-copper-50 text-copper-900'}`}>
                {decisionExplanation(activeDecision, t)}
              </div>
              <div className="max-h-36 overflow-y-auto whitespace-pre-wrap border border-stone-200 bg-ivory-50 p-3 text-xs leading-relaxed text-stone-700">
                {selectedRecord.currentContent}
              </div>
              {activeDecision === 'changes_requested' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-600">{t('quickDirectivesKicker')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { rule: 'R-103', label: t('directiveR103A') },
                      { rule: 'R-103', label: t('directiveR103B') },
                      { rule: 'R-101', label: t('directiveR101') },
                      { rule: 'R-106', label: t('directiveR106') },
                    ]
                      .filter((directive) => selectedRecord.findings.some((finding) => finding.ruleId === directive.rule))
                      .map((directive) => (
                        <button
                          key={directive.label}
                          type="button"
                          onClick={() => setReviewComment((current) => `${current.trim()}${current.trim() ? '\n' : ''}${directive.label.replace(/^\+\s*/, '')}`)}
                          className="border border-stone-300 bg-ivory-50 px-2 py-1.5 text-left text-[9px] leading-snug text-stone-700 hover:border-copper hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                        >
                          {directive.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <Textarea
                label={activeDecision === 'approved' ? t('commentLabelOptional') : activeDecision === 'rejected' ? t('commentLabelRejectionRequired') : t('commentLabelRationaleRequired')}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={3}
                required={activeDecision !== 'approved'}
                placeholder={activeDecision === 'approved' ? t('commentPlaceholderApprove') : activeDecision === 'rejected' ? t('commentPlaceholderReject') : t('commentPlaceholderChanges')}
              />
              {activeDecision === 'changes_requested' && (
                <Textarea
                  label={t('suggestedDraftLabel')}
                  value={suggestedDraft}
                  onChange={(event) => setSuggestedDraft(event.target.value)}
                  rows={5}
                  helperText={t('suggestedDraftHelperText')}
                />
              )}
              {decisionError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{decisionError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
                <span className="text-[10px] text-stone-500">{t('decisionLinkedAccountNotice')}</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={handleCancelDecision}
                  >
                    {t('btnCancel')}
                  </Button>
                  <Button
                    type="button"
                    variant={activeDecision === 'approved' ? 'forest' : activeDecision === 'rejected' ? 'secondary' : 'copper'}
                    size="sm"
                    isLoading={isSaving}
                    disabled={isSaving}
                    onClick={confirmDecision}
                  >
                    {t('confirmTitlePrefix')} {decisionTitle(activeDecision, t)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-6 font-sans" data-tour="verification-gate">
      <header className="border-b border-stone-300 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="mb-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">{t('pageKicker')}</p>
            <h2 className="font-serif text-3xl font-normal tracking-tight text-obsidian sm:text-4xl">{t('pageTitle')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              {t('pageDescription')}
            </p>
          </div>
          <div className="border-l-2 border-copper pl-3">
            <span className="block text-[9px] font-mono uppercase tracking-wider text-stone-500">{t('outstandingReviewsLabel')}</span>
            <span className="font-serif text-3xl leading-none text-copper-800">{pendingCount}</span>
          </div>
        </div>
      </header>

      {(storageError || workspaceError) && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{storageError || workspaceError}</p>}

      <section aria-label={t('queueFiltersAria')}>
        <div className="flex flex-wrap gap-2 border-b border-stone-300 pb-3">
          {filters.map((item) => {
            const count = item.value === 'all'
              ? records.length
              : records.filter((record) => record.status === item.value).length;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`border px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${filter === item.value ? 'border-obsidian bg-obsidian text-ivory' : 'border-stone-300 bg-ivory-50 text-stone-700 hover:border-copper hover:text-obsidian'}`}
              >
                {item.label} <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="approval-queue-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-copper">{t('queueKicker')}</p>
            <h3 id="approval-queue-heading" className="mt-1 font-serif text-2xl text-obsidian">
              {filter === 'awaiting_human_verification' ? t('awaitingYourReviewHeading') : filters.find((item) => item.value === filter)?.label}
            </h3>
          </div>
          <span className="text-[10px] text-stone-500">{filteredRecords.length} {filteredRecords.length === 1 ? t('recordSingular') : t('recordPlural')} · {t('persistedLocally')}</span>
        </div>
        {isLoading ? (
          <p role="status" className="flex items-center gap-2 border-y border-stone-300 py-8 text-sm text-stone-600"><LoaderCircle className="h-4 w-4 animate-spin text-copper" />{t('loadingQueue')}</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            kicker={t('emptyQueueKicker')}
            title={filter === 'awaiting_human_verification' ? t('emptyQueueTitleAwaiting') : t('emptyQueueTitleOther')}
            description={filter === 'awaiting_human_verification'
              ? t('emptyQueueDescAwaiting')
              : t('emptyQueueDescOther')}
            icon={<ShieldCheck className="h-5 w-5 text-forest" />}
          />
        ) : (
          <div className="divide-y divide-stone-200 border-y border-stone-300">
            {filteredRecords.map((record) => (
              <QueueRow
                key={record.id}
                record={record}
                isPriority={record.status === 'awaiting_human_verification' && (
                  record.score < workspaceSettings.minPassScore
                  || record.findings.some((finding) => finding.severity === 'critical')
                  || (workspaceSettings.gateStrictness === 'strict' && record.findings.some((finding) => finding.severity === 'moderate'))
                )}
                onOpen={() => navigate(`/approvals/${encodeURIComponent(record.id)}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const QueueRow: React.FC<{ record: ReviewRecord; isPriority: boolean; onOpen: () => void }> = ({ record, isPriority, onOpen }) => {
  const { language } = useLanguage();
  const t = getApprovalsT(language);
  const counts = getFindingCounts(record.findings);
  const awaiting = record.status === 'awaiting_human_verification';
  return (
    <article className={`grid grid-cols-1 gap-3 border-l-2 py-4 pl-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${awaiting ? 'border-l-copper' : record.status === 'approved' ? 'border-l-forest' : 'border-l-stone-400'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-mono font-bold tracking-wider text-stone-500">{record.id} · R{record.revision}</span>
          <span className={`inline-flex items-center border px-1.5 py-1 text-[8px] font-mono uppercase tracking-wider ${STATUS_STYLES[record.status]}`}>{getStatusLabel(record.status, t)}</span>
          <span className="text-[9px] text-stone-500">{record.contentType}</span>
          {isPriority && <Badge variant="copper" size="sm">{t('priorityAttention')}</Badge>}
        </div>
        <button type="button" onClick={onOpen} className="mt-1 block max-w-full text-left font-serif text-lg leading-snug text-obsidian hover:text-copper-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">
          {record.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-stone-600">
          <span>{t('byAuthorPrefix')} {record.author}</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />{formatDate(record.submittedAt, language)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
          <span className="font-mono font-semibold text-obsidian">{t('consistencyScorePrefix')} {record.score}/100</span>
          <span className="text-copper-800">{counts.critical} {t('severityCritical').toLowerCase()}</span>
          <span className="text-copper-700">{counts.moderate} {t('severityModerate').toLowerCase()}</span>
          <span className="text-stone-600">{counts.minor} {t('severityMinor').toLowerCase()}</span>
          <span className="text-stone-500">{record.findings.length} {record.findings.length === 1 ? t('findingsSingular') : t('findingsPlural')}</span>
        </div>
      </div>
      <Button variant={awaiting ? 'copper' : 'outline'} size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={onOpen}>
        {awaiting ? t('openReviewAction') : t('viewDecisionAction')}
      </Button>
    </article>
  );
};

const ReviewDetail: React.FC<{
  record: ReviewRecord;
  storageError: string;
  localRules: LocalBrandRule[];
  evidenceCatalogue: LocalEvidence[];
  reviewerName: string;
  canDecide: boolean;
  analysisConfigHash: string;
  gateStrictness: WorkspaceSettings['gateStrictness'];
  onBack: () => void;
  onEdit: () => void;
  onReanalyze: () => void;
  onDecision: (decision: ReviewDecision) => void;
}> = ({ record, storageError, localRules, evidenceCatalogue, reviewerName, canDecide, analysisConfigHash, gateStrictness, onBack, onEdit, onReanalyze, onDecision }) => {
  const { language } = useLanguage();
  const t = getApprovalsT(language);
  const reviewStages = getReviewStages(t);
  const [geometryFocus, setGeometryFocus] = useState<'rules' | 'evidence' | 'human' | null>(null);
  const decision = getLatestDecision(record);
  const contentAnalysisIsCurrent = record.analysisContentHash === record.contentHash
    && hashReviewContent(record.currentContent) === record.contentHash;
  const analysisIsCurrent = contentAnalysisIsCurrent
    && Boolean(record.analysisConfigHash)
    && record.analysisConfigHash === analysisConfigHash;
  const isAwaiting = record.status === 'awaiting_human_verification';
  const counts = getFindingCounts(record.findings);
  const hasValidation = analysisIsCurrent && record.statusHistory.some((event) => event.revision === record.revision && (event.status === 'validation_complete' || event.status === 'issues_found'));
  const hasAnalysis = analysisIsCurrent && record.statusHistory.some((event) => event.revision === record.revision && event.status === 'analysis_complete');
  const approvedThisRevision = decision?.decision === 'approved'
    && record.approvedRevision === record.revision
    && record.approvedContentHash === record.contentHash;
  const currentHumanDecision = decision
    && decision.revision === record.revision
    && decision.contentHash === record.contentHash
    ? decision
    : null;

  useEffect(() => {
    if (geometryFocus === 'rules') {
      document.getElementById('matched-copy-highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('matched-rule-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (geometryFocus === 'human') {
      document.getElementById('reviewer-decision-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [geometryFocus]);

  return (
    <div className="space-y-5 font-sans" data-tour="verification-gate">
      <div>
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBack}>{t('backToQueue')}</Button>
      </div>
      {storageError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{storageError}</p>}

      <header className="flex flex-col gap-4 border-b border-stone-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper">{t('humanVerificationKickerDetail')} / {record.id} / {t('revisionWord')} {record.revision}</p>
          <h2 className="mt-1 break-words font-serif text-3xl font-normal tracking-tight text-obsidian">{record.title}</h2>
          <p className="mt-2 text-xs text-stone-600">{record.contentType}{record.campaign ? ` · ${record.campaign}` : ''} · {t('submittedByPrefix')} {record.author} · {formatDate(record.submittedAt, language)}</p>
        </div>
        <StatusBadge status={record.status} />
      </header>

      <Panel kicker={t('humanVerificationGateKicker')} title={t('decisionOwnedTitle')} subtitle={t('decisionOwnedSubtitle')} padding="md">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          {reviewStages.map((stage, index) => {
            const isIssue = stage.key === 'validation' && counts.critical + counts.moderate + counts.minor > 0;
            const isDone = stage.key === 'analysis' ? hasAnalysis
              : stage.key === 'validation' ? hasValidation && !isIssue
                : stage.key === 'human' ? Boolean(currentHumanDecision)
                  : Boolean(approvedThisRevision);
            const isActive = stage.key === 'human' && isAwaiting;
            const style = isDone
              ? stage.key === 'publication' ? 'border-forest bg-forest text-ivory' : 'border-forest-300 bg-forest-50 text-forest-900'
              : isActive || isIssue
                ? 'border-copper bg-copper-50 text-copper-900'
                : 'border-stone-300 bg-ivory-50 text-stone-500';
            const Icon = stage.icon;
            const stageStatusText = isDone ? t('stageStatusComplete') : isActive ? t('stageStatusYourDecision') : isIssue ? t('stageStatusIssuesFlagged') : t('stageStatusPending');
            return (
              <div key={stage.key} className={`relative flex min-h-20 items-center gap-3 border p-3 ${style}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center border ${isDone ? 'border-forest/30 bg-forest/10' : isActive || isIssue ? 'border-copper/30 bg-copper/10' : 'border-stone-300 bg-ivory'}`}>
                  {isDone ? <Check className="h-4 w-4" /> : isIssue ? <AlertTriangle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span>
                  <span className="block text-[8px] font-mono uppercase tracking-widest">{String(index + 1).padStart(2, '0')} / {stageStatusText}</span>
                  <span className="mt-1 block text-[10px] font-semibold leading-snug">{stage.title}</span>
                </span>
                {index < reviewStages.length - 1 && <ArrowRight className="absolute -right-2.5 z-10 hidden h-4 w-4 bg-ivory text-stone-400 md:block" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 border-t border-stone-200 pt-3 text-[10px] leading-relaxed text-stone-600">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-copper" aria-hidden="true" />
          <span>{t('approvalBoundNotePrefix')} {record.revision} ({record.contentHash}). {t('approvalBoundNoteSuffix')}</span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel kicker={t('submittedContentKicker')} title={analysisIsCurrent ? t('titleCurrentAnalysedRevision') : contentAnalysisIsCurrent ? t('titleAnalysisOutOfDate') : t('titleUnanalysedDraftRevision')} subtitle={`${t('revisionWord')} ${record.revision} · ${record.contentHash}`} padding="md" className="xl:col-span-5">
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-stone-500"><FileEdit className="h-3 w-3" /> {analysisIsCurrent ? t('descExactContentReviewed') : contentAnalysisIsCurrent ? t('descRulesChangedSinceAnalysis') : t('descEditedAwaitingAnalysis')}</p>
          <div className="max-h-[34rem] overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-obsidian bg-ivory-50 px-4 py-3 font-serif text-sm leading-relaxed text-obsidian">
            <ReviewContentHighlights content={record.currentContent} findings={record.findings} highlight={geometryFocus === 'rules'} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3 text-[9px] text-stone-500">
            <span>{record.currentContent.trim().split(/\s+/).filter(Boolean).length} {t('wordsCountSuffix')} · {record.currentContent.length} {t('charsCountSuffix')}</span>
            <span className={`font-mono uppercase tracking-wider ${analysisIsCurrent ? 'text-forest-700' : 'text-copper-800'}`}>{analysisIsCurrent ? t('analysisMatchesRevisionStatus') : t('reanalysisRequiredStatus')}</span>
          </div>
          {!isAwaiting && (record.status === 'changes_requested' || record.status === 'approved' || record.status === 'draft') && (
            <Button className="mt-3 w-full" variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onEdit}>
              {record.status === 'approved' ? t('btnCreateRevisedContent') : record.status === 'draft' ? t('btnContinueEditingAndAnalyse') : t('btnReviseAndReanalyse')}
            </Button>
          )}
          {isAwaiting && !analysisIsCurrent && (
            <Button className="mt-3 w-full" variant="copper" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onReanalyze}>
              {t('btnReanalyseWithCurrentRules')}
            </Button>
          )}
        </Panel>

        <Panel kicker={t('aiFindingsKicker')} title={analysisIsCurrent ? `${record.findings.length} ${record.findings.length === 1 ? t('findingsSingular') : t('findingsPlural')}` : t('analysisRequiredTitle')} subtitle={analysisIsCurrent ? `${counts.critical} ${t('severityCritical').toLowerCase()} · ${counts.moderate} ${t('severityModerate').toLowerCase()} · ${counts.minor} ${t('severityMinor').toLowerCase()} · ${t('scorePrefix')} ${record.score}/100` : t('noCurrentScoreAvailable')} padding="md" className="self-start xl:col-span-4">
          <div className="mb-3 border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-[10px] leading-relaxed text-stone-700">{record.aiSummary} {t('aiScoreAdvisoryDisclaimer')}</div>
          {!analysisIsCurrent ? (
            <div className="flex items-start gap-2 border-l-2 border-copper bg-copper-50 p-3 text-xs leading-relaxed text-stone-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-copper" /> {t('analysisRequiredAlert')}
            </div>
          ) : record.findings.length === 0 ? (
            <div className="flex items-start gap-2 border-l-2 border-forest bg-forest-50/60 p-3 text-xs leading-relaxed text-stone-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" /> {t('noRulesMatchedNotice')}
            </div>
          ) : (
            <div className={`space-y-3 overflow-y-auto pr-1 ${record.findings.length > 5 ? 'max-h-[35rem]' : ''}`}>
              {record.findings.map((finding, index) => (
                <div key={finding.id} id={geometryFocus === 'rules' && index === 0 ? 'matched-rule-card' : undefined} className={geometryFocus === 'rules' && index === 0 ? 'rounded-sm ring-2 ring-copper/60 ring-offset-2' : ''}>
                  <FindingReview finding={finding} />
                </div>
              ))}
            </div>
          )}
          {analysisIsCurrent && record.findings.length <= 2 && <GuidelineGeometry findings={record.findings} gateStrictness={gateStrictness} onSelect={setGeometryFocus} />}
        </Panel>

        <Panel kicker={t('evidenceKicker')} title={t('referencesTitle')} subtitle={t('referencesSubtitle')} padding="md" className="xl:col-span-3">
          <div className="space-y-3">
            {!analysisIsCurrent ? (
              <p className="border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-[10px] leading-relaxed text-stone-700">{t('evidenceCannotBeAssessedNotice')}</p>
            ) : record.findings.length === 0 ? (
              <p className="border-l-2 border-stone-300 pl-3 text-xs leading-relaxed text-stone-600">{t('noFindingsRequireReferencePrefix')} {evidenceCatalogue.length} {t('catalogueEntriesSuffix')}</p>
            ) : record.findings.map((finding) => {
              const evidenceId = finding.evidenceReference?.match(/\bEVD-[A-Z0-9-]+\b/)?.[0];
              const evidence = evidenceCatalogue.find((entry) => entry.id === evidenceId);
              return (
                <article key={`ref-${finding.id}`} className="border-b border-stone-200 pb-3 last:border-b-0">
                  <p className="text-[10px] font-semibold leading-snug text-obsidian">{finding.ruleId} · {finding.ruleTitle}</p>
                  <p className={`mt-1 text-[8px] font-mono uppercase tracking-wider ${finding.evidenceStatus === 'matched' ? 'text-forest-700' : 'text-copper-800'}`}>{getEvidenceLabel(finding.evidenceStatus, t)}</p>
                  {evidence ? (
                    <>
                      <p className="mt-1 text-[10px] font-semibold text-stone-700">{evidence.id} · {evidence.label}</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-stone-600">{evidence.source}. {evidence.note} <span className="font-semibold uppercase">{evidence.verificationStatus}</span></p>
                      {evidence.sourceUrl && <a href={evidence.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[9px] text-copper underline">{evidence.sourceUrl}</a>}
                      {finding.evidenceSnapshot && <p className="mt-1 text-[9px] text-stone-500">{t('snapshotAtAnalysisPrefix')} {finding.evidenceSnapshot.verificationStatus}, {t('reviewedWord')} {finding.evidenceSnapshot.lastReviewedAt || t('notRecordedWord')}, {t('dueWord')} {finding.evidenceSnapshot.reviewDueAt || t('notRecordedWord')}.</p>}
                    </>
                  ) : finding.evidenceSnapshot ? (
                    <>
                      <p className="mt-1 text-[10px] font-semibold text-stone-700">{finding.evidenceSnapshot.id} · {finding.evidenceSnapshot.title} {t('catalogueEntryRemovedSuffix')}</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-stone-600">{finding.evidenceSnapshot.sourceName} · {finding.evidenceSnapshot.verificationStatus} {t('atAnalysisSuffix')} {finding.evidenceSnapshot.sourceUrl}</p>
                    </>
                  ) : finding.evidenceReference ? (
                    <p className="mt-1 text-[9px] leading-relaxed text-stone-600">{finding.evidenceReference}</p>
                  ) : (
                    <p className="mt-1 text-[9px] leading-relaxed text-stone-600">{t('noMatchingApprovedEvidenceNotice')}</p>
                  )}
                  {finding.evidenceStatus === 'unverified' && <p className="mt-1 text-[9px] font-semibold text-copper-800">{t('unverifiedNotFalseNotice')}</p>}
                </article>
              );
            })}
            <div className="border-t border-copper/30 pt-3">
              <p className="mb-2 text-[8px] font-mono font-bold uppercase tracking-wider text-copper">{t('configuredLocalRulesHeading')}</p>
              {localRules.map((rule) => (
                <p key={rule.id} className="mb-1 text-[9px] leading-relaxed text-stone-600"><span className="font-semibold text-obsidian">{rule.id}</span> · {rule.title}</p>
              ))}
            </div>
          </div>
        </Panel>
      </div>


      <Panel
        kicker="04 / EVIDENCE ATTACHMENTS"
        title={t('supportingAttachmentsTitle')}
        subtitle={t('supportingAttachmentsSubtitle')}
        padding="md"
      >
        <EvidenceAttachmentSection
          reviewId={record.id}
          revision={record.revision}
          attachments={record.attachments ?? []}
          mode="verification_gate"
        />
      </Panel>

      {approvedThisRevision && decision && (
        <Panel kicker={t('approvedGreenKicker')} title={t('approvedRevisionTitle')} subtitle={t('approvedRevisionSubtitle')} padding="md" className="border-l-[3px] border-l-forest">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DecisionDatum label={t('decisionDatumLabel')} value={t('decisionApproved')} icon={<BadgeCheck className="h-4 w-4 text-forest" />} />
            <DecisionDatum label={t('reviewerDatumLabel')} value={decision.reviewer} icon={<UserRoundCheck className="h-4 w-4 text-forest" />} />
            <DecisionDatum label={t('recordedDatumLabel')} value={formatDate(decision.decidedAt, language)} icon={<Clock3 className="h-4 w-4 text-forest" />} />
          </div>
          {decision.comment && <p className="mt-4 border-t border-forest-200 pt-3 text-xs leading-relaxed text-stone-700"><strong>{t('reviewerCommentStrong')}</strong> {decision.comment}</p>}
          <div className="mt-3 border-t border-forest-200 pt-3">
            <p className="mb-1 text-[8px] font-mono uppercase tracking-wider text-forest-700">{t('approvedRevisionHeaderPrefix')} {decision.revision} · {decision.contentHash}</p>
            <p className="max-h-36 overflow-y-auto whitespace-pre-wrap border-l-2 border-forest px-3 py-2 font-serif text-xs leading-relaxed text-stone-700">{decision.content}</p>
          </div>
        </Panel>
      )}

      {currentHumanDecision && !approvedThisRevision && (
        <Panel kicker={t('humanDecisionKicker')} title={decisionTitle(currentHumanDecision.decision, t)} subtitle={`${t('recordedByPrefix')} ${currentHumanDecision.reviewer} · ${formatDate(currentHumanDecision.decidedAt, language)}`} padding="md" className="border-l-[3px] border-l-copper">
          <p className="text-xs leading-relaxed text-stone-700">{currentHumanDecision.comment || t('noAdditionalCommentRecorded')}</p>
          {record.status === 'changes_requested' && <Button className="mt-3" variant="copper" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onEdit}>{t('btnReviseAndReanalyse')}</Button>}
        </Panel>
      )}

      <Panel id="reviewer-decision-panel" className={geometryFocus === 'human' ? 'ring-2 ring-copper/60 ring-offset-2' : ''} kicker={t('reviewerDecisionKicker')} title={isAwaiting ? t('yourDecisionRequiredTitle') : t('decisionRecordTitle')} subtitle={isAwaiting ? t('decisionRequiredSubtitle') : t('workflowAuthoritativeSubtitle')} padding="md">
        {record.legacyApprovalUntrusted && (
          <p role="note" className="mb-3 border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">
            {t('legacyUntrustedNotice')}
          </p>
        )}
        {isAwaiting ? (
          <>
            {!analysisIsCurrent && <p role="alert" className="mb-3 border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{t('contentOrRulesChangedAlert')}</p>}
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <DecisionAction
                title={t('actionApproveTitle')}
                description={t('actionApproveDesc')}
                affordance={t('affordanceApprove')}
                actionHint={t('chooseThisDecision')}
                disabledHint={t('analysisRequiredFirst')}
                tone="forest"
                icon={<ShieldCheck className="h-4 w-4" />}
                disabled={!analysisIsCurrent || !canDecide}
                onClick={() => onDecision('approved')}
              />
              <DecisionAction
                title={t('actionChangesTitle')}
                description={t('actionChangesDesc')}
                affordance={t('affordanceChanges')}
                actionHint={t('chooseThisDecision')}
                disabledHint={t('analysisRequiredFirst')}
                tone="copper"
                icon={<FileEdit className="h-4 w-4" />}
                disabled={!analysisIsCurrent || !canDecide}
                onClick={() => onDecision('changes_requested')}
              />
              <DecisionAction
                title={t('actionRejectTitle')}
                description={t('actionRejectDesc')}
                affordance={t('affordanceReject')}
                actionHint={t('chooseThisDecision')}
                disabledHint={t('analysisRequiredFirst')}
                tone="stone"
                icon={<XCircle className="h-4 w-4" />}
                disabled={!analysisIsCurrent || !canDecide}
                onClick={() => onDecision('rejected')}
              />
            </div>
            {!canDecide && <p role="note" className="mb-3 text-[10px] text-stone-600">{t('reviewerRoleRequiredNote')}</p>}
            <p className="flex items-start gap-2 border-t border-stone-200 pt-3 text-[9px] leading-relaxed text-stone-500">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('authReviewerAccountLabel')} <strong className="font-semibold text-obsidian">{reviewerName}</strong>. {t('dbDecisionTiedNotice')}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-2xl text-xs leading-relaxed text-stone-600">
              {record.status === 'draft'
                ? t('workflowDescDraft')
                : record.status === 'rejected'
                ? t('workflowDescRejected')
                : record.status === 'changes_requested'
                  ? t('workflowDescChanges')
                  : approvedThisRevision
                    ? t('workflowDescApprovedCurrent')
                    : t('workflowDescApprovedEarlier')}
            </p>
            {record.status === 'approved' && (
              <Button variant="outline" size="sm" leftIcon={<FileEdit className="h-3.5 w-3.5" />} onClick={onEdit}>{t('btnCreateRevisedRevision')}</Button>
            )}
          </div>
        )}
      </Panel>

      <Panel kicker={t('auditTrailKicker')} title={t('auditTrailTitle')} subtitle={t('auditTrailSubtitle')} padding="md">
        {record.decisionHistory.length === 0 && record.revisionHistory.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-stone-600"><History className="h-4 w-4" />{t('noEarlierRevisionsOrDecisions')}</p>
        ) : (
          <ol className="space-y-3">
            {record.statusHistory.map((event, index) => {
              const decisionEvent = record.decisionHistory.find((item) => item.decidedAt === event.at && item.revision === record.revision);
              return (
                <li key={`${event.status}-${event.at}-${index}`} className="flex gap-3 border-l border-stone-300 pl-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-copper" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-obsidian">{getStatusLabel(event.status, t)} · R{decisionEvent?.revision ?? event.revision ?? record.revision}</p>
                    <p className="mt-0.5 text-[9px] text-stone-500">{event.actor} · {formatDate(event.at, language)}</p>
                    {event.note && <p className="mt-1 text-[10px] leading-relaxed text-stone-600">{event.note}</p>}
                  </div>
                </li>
              );
            })}
            {record.revisionHistory.map((revision) => (
              <li key={`revision-${revision.revision}-${revision.contentHash}`} className="flex gap-3 border-l border-stone-300 pl-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-stone-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-obsidian">{t('archivedRevisionPrefix')} {revision.revision} · {getStatusLabel(revision.status, t)}</p>
                  <p className="mt-0.5 text-[9px] text-stone-500">{formatDate(revision.submittedAt, language)} · {revision.contentHash} · {t('scorePrefix')} {revision.score}/100</p>
                  <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap border-l border-stone-300 pl-2 text-[9px] leading-relaxed text-stone-600">{revision.content}</p>
                  {record.decisionHistory.filter((item) => item.revision === revision.revision && item.contentHash === revision.contentHash).map((item) => (
                    <p key={`${item.decidedAt}-${item.revision}`} className="mt-1 text-[9px] leading-relaxed text-forest-800">
                      {decisionTitle(item.decision, t)} {t('byWord')} {item.reviewer} · {formatDate(item.decidedAt, language)}{item.comment ? ` · “${item.comment}”` : ''}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
};

const ReviewContentHighlights: React.FC<{ content: string; findings: ReviewFinding[]; highlight: boolean }> = ({ content, findings, highlight }) => {
  const { language } = useLanguage();
  const t = getApprovalsT(language);
  const ranges = findings
    .filter((finding) => finding.endIndex > finding.startIndex && finding.startIndex < content.length)
    .map((finding) => ({
      start: Math.max(0, finding.startIndex),
      end: Math.min(content.length, finding.endIndex),
    }));
  const boundaries = [...new Set([0, content.length, ...ranges.flatMap(({ start, end }) => [start, end])])]
    .sort((left, right) => left - right);
  let marked = false;
  return (
    <>
      {boundaries.slice(0, -1).map((start, index) => {
        const end = boundaries[index + 1];
        if (end <= start) return null;
        const text = content.slice(start, end);
        const isMatch = ranges.some((range) => range.start <= start && range.end >= end);
        if (!isMatch) return <React.Fragment key={`${start}-${end}`}>{text}</React.Fragment>;
        const addId = highlight && !marked;
        if (addId) marked = true;
        return (
          <mark
            key={`${start}-${end}`}
            id={addId ? 'matched-copy-highlight' : undefined}
            className={highlight ? 'bg-copper-200/80 text-obsidian ring-2 ring-copper/70 animate-pulse' : 'bg-copper-100/70 text-obsidian'}
            title={t('matchedGuidelineHighlightTitle')}
          >
            {text}
          </mark>
        );
      })}
    </>
  );
};

const FindingReview: React.FC<{ finding: ReviewFinding }> = ({ finding }) => {
  const { language } = useLanguage();
  const t = getApprovalsT(language);
  return (
    <article className="border-l-2 border-copper bg-ivory-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[8px] font-mono uppercase tracking-wider text-copper-800">{finding.ruleId} · {finding.category}</p>
          <h4 className="mt-1 text-xs font-semibold text-obsidian">{finding.ruleTitle}</h4>
        </div>
        <span className={`border px-1.5 py-1 text-[8px] font-mono uppercase tracking-wider ${SEVERITY_STYLES[finding.severity]}`}>{getSeverityLabel(finding.severity, t)}</span>
      </div>
      <blockquote className="mt-2 border-l border-copper px-2 font-serif text-sm italic text-obsidian">“{finding.quote}”</blockquote>
      <p className="mt-2 text-[10px] leading-relaxed text-stone-700">{finding.reason}</p>
      <p className="mt-2 text-[9px] leading-relaxed text-stone-600"><strong className="text-obsidian">{t('guidelineLabelPrefix')}</strong> {finding.guidelineSnapshot?.description ?? finding.ruleTitle}</p>
      {finding.suggestion && (
        <div className="mt-2 min-w-0 w-full text-left text-[10px] leading-relaxed text-forest-800">
          <p className="flex items-center gap-1.5">
            <MessageSquareText className="h-3 w-3 shrink-0" aria-hidden="true" />
            <strong>{finding.suggestionLabel}</strong>
          </p>
          <p className="mt-1 w-full min-w-0 break-words text-left [overflow-wrap:anywhere]">{finding.suggestion}</p>
        </div>
      )}
    </article>
  );
};

const DecisionDatum: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="min-w-0 border-b border-forest-200 pb-2">
    <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-wider text-forest-700">{icon}{label}</div>
    <p className="mt-1 break-words text-xs font-semibold text-obsidian">{value}</p>
  </div>
);

const DecisionAction: React.FC<{
  title: string;
  description: string;
  affordance: string;
  actionHint: string;
  disabledHint: string;
  tone: 'forest' | 'copper' | 'stone';
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}> = ({ title, description, affordance, actionHint, disabledHint, tone, icon, disabled, onClick }) => {
  const toneStyle = {
    forest: 'border-forest-300 bg-forest-50 text-forest-900 hover:border-forest hover:shadow-[0_14px_32px_rgba(36,76,58,0.17)]',
    copper: 'border-copper-300 bg-copper-50 text-copper-900 hover:border-copper hover:shadow-[0_14px_32px_rgba(188,116,78,0.2)]',
    stone: 'border-[#c78b7c] bg-[#fbf1ed] text-[#7d342b] hover:border-[#9c3e33] hover:shadow-[0_14px_32px_rgba(156,62,51,0.18)]',
  }[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${title}: ${description}`}
      className={`group relative flex min-h-32 flex-col items-start justify-between gap-2 border p-3 pt-7 text-left transition duration-200 ease-out hover:-translate-y-1 hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none ${toneStyle}`}
    >
      <span className="absolute right-2 top-2 translate-y-1 border border-current/20 bg-white/80 px-1.5 py-1 text-[7px] font-mono uppercase tracking-wider opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        {affordance} ↗
      </span>
      <span className="flex items-center gap-2 text-xs font-semibold">
        <span className="transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6">{icon}</span>
        {title}
      </span>
      <span className="text-[9px] leading-relaxed opacity-80">{description}</span>
      <span className="flex w-full items-center justify-between border-t border-current/20 pt-2 text-[8px] font-mono uppercase tracking-wider">
        <span>{disabled ? disabledHint : actionHint}</span>
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
};

const StatusBadge: React.FC<{ status: ReviewWorkflowStatus }> = ({ status }) => {
  const { language } = useLanguage();
  const t = getApprovalsT(language);
  return (
    <Badge variant={status === 'approved' ? 'forest' : status === 'rejected' ? 'stone' : 'copper'} size="sm" dot>
      {getStatusLabel(status, t)}
    </Badge>
  );
};

const ErrorState: React.FC<{ message: string; onBack: () => void }> = ({ message, onBack }) => {
  const { language } = useLanguage();
  const t = getApprovalsT(language);
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBack}>{t('backToQueue')}</Button>
      <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{message}</p>
    </div>
  );
};

const decisionTitle = (decision: ReviewDecision, t: (key: ApprovalsUiKey) => string): string => ({
  approved: t('decisionApprove'),
  changes_requested: t('decisionRequestChanges'),
  rejected: t('decisionReject'),
}[decision]);

const decisionExplanation = (decision: ReviewDecision, t: (key: ApprovalsUiKey) => string): string => ({
  approved: t('explanationApproved'),
  changes_requested: t('explanationChangesRequested'),
  rejected: t('explanationRejected'),
}[decision]);
