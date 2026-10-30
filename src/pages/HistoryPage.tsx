import React, { useEffect, useState } from 'react';
import {
  Download, 
  Search, 
  UserCheck,
  History,
  RotateCcw,
} from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import {
  readReviewRecords,
  REVIEW_RECORDS_STORAGE_KEY,
  REVIEW_RECORDS_UPDATED_EVENT,
} from '@/services/reviewStorage';
import { cloudClearAllReviews, cloudClearUserReviews } from '@/services/cloudStorage';
import { readWorkspaceAuditEvents, WORKSPACE_DATA_STORAGE_KEY, WORKSPACE_DATA_UPDATED_EVENT } from '@/services/workspaceStorage';
import { createAuditTrailExport } from '@/services/auditTrailExport';
import { ReviewRecord } from '@/types/review';
import { WorkspaceAuditEvent } from '@/types/workspace';
import { useNavigate } from 'react-router-dom';
import { getScopedStorageKey } from '@/services/storageScope';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageProvider';

interface AuditRecord {
  id: string;
  docTitle: string;
  source: string;
  score: number;
  status: string;
  verifiedBy: string;
  timestamp: string;
  flagsResolved: number;
  comment?: string;
  revision?: number;
  contentHash?: string;
  isDemo?: boolean;
  recordOrigin?: 'live' | 'seeded_example';
  relatedReviewId?: string;
  eventType?: string;
  legacyUnverified?: boolean;
  details?: Record<string, string>;
  sortTimestamp?: string;
  revisionContent?: string;
  events?: AuditRecord[];
}

type AuditFilter = 'all' | 'review' | 'decision' | 'guideline' | 'evidence' | 'settings';
type AuditRecordView = 'live' | 'seeded';

const HISTORY_UI = {
  en: {
    kicker: 'Compliance Ledger',
    title: 'Editorial Audit History',
    description: 'Live reviewer decisions are linked to exact analysed revisions. Built-in reference examples are kept separate and are not live approval records.',
    loadError: 'Local audit records could not be loaded.',
    loadDecisionsPrefix: 'Local audit decisions could not be loaded:',
    resetButton: 'Reset Local Audit History',
    exportButton: 'Export Audit Trail (JSON)',
    liveTab: (count: number) => `Live Workspace Audit Ledger (${count})`,
    seededTab: (count: number) => `Seeded Reference Examples (${count})`,
    tablistAria: 'Audit record origin',
    searchPlaceholder: 'Search by title, reviewer, or department...',
    filterAria: 'Filter audit history by event type',
    filterAll: 'All events',
    filterReview: 'Review lifecycle',
    filterDecision: 'Human decisions',
    filterGuideline: 'Guideline changes',
    filterEvidence: 'Evidence changes',
    filterSettings: 'Workspace settings',
    showingLive: (count: number) => `Showing ${count} live audit records`,
    showingSeeded: (count: number) => `Showing ${count} seeded audit records`,
    panelKickerLive: 'APPEND-ONLY WORKSPACE TIMELINE',
    panelKickerSeeded: 'BUILT-IN DEMONSTRATION RECORDS',
    seededBadge: 'SEEDED EXAMPLE · NOT A LIVE APPROVAL',
    seededNotice: 'These built-in examples illustrate the audit interface and are not user-submitted or saved approval records.',
    emptyKicker: 'AUDIT LOG SEARCH',
    emptyTitle: 'No Matching Audit Records',
    emptyDesc: 'No historical audit entries match your search query. Try searching for a different reviewer, document title, or source.',
    clearSearch: 'Clear Search Query',
    thLogId: 'Log ID / Date',
    thTitleSource: 'Document Title & Source',
    thAlignment: 'Alignment',
    thGateStatus: 'Gate Status',
    thSignature: 'Human Sign-off Signature',
    detailsButton: 'Details',
    findingsCount: (count: number) => `${count} findings`,
    reviewLifecycleAria: 'Review lifecycle',
    lifecycleSubmitted: 'Submitted',
    lifecycleAnalyzed: 'Analyzed',
    lifecycleFlagged: 'Flagged',
    lifecycleGate: 'Gate',
    seededDemoRecord: 'Seeded demo record',
    workspaceEvent: 'Workspace event',
    revisionText: 'Revision',
    revisionLifecycleSummary: (count: number) => `Revision lifecycle · ${count} events · Compare with prior revision`,
    revisionDiffTitle: 'Revision diff · changed passage',
    noPriorWording: 'No prior wording',
    noReplacementWording: 'No replacement wording',
    noPriorRevision: 'No prior revision is available for comparison.',
    modalEventKicker: 'WORKSPACE AUDIT EVENT',
    recordedBy: 'Recorded by:',
    notProvided: 'Not provided',
    closeDetails: 'Close details',
    modalResetKicker: 'LOCAL AUDIT HISTORY',
    modalResetTitle: 'Reset local review records',
    modalResetSubtitle: 'Choose precisely which browser-saved review records to remove. Guideline, evidence, and workspace settings remain unchanged.',
    clearTestsTitle: 'Clear local test records',
    clearTestsDesc: 'Remove user-created review records, revisions, and decisions. Prepared demo scenario records are preserved.',
    clearTestsButton: 'Clear test records',
    resetSeededTitle: 'Reset to clean seeded examples',
    resetSeededDesc: 'Remove all browser-saved review records, including prepared scenarios. The five built-in, read-only seeded audit examples remain visible.',
    resetSeededButton: 'Reset to seeded examples',
    cancel: 'Cancel',
    noResetMatch: 'No local review records matched that reset option.',
    resetError: 'Workspace audit history could not be reset.',
    unverifiedHistory: 'Unverified local history',
    statusLabels: {
      draft: 'Draft / revision saved',
      submitted: 'Submitted',
      analysis_complete: 'AI analysis complete',
      validation_complete: 'Brand & evidence validation complete',
      issues_found: 'Issues found',
      awaiting_human_verification: 'Awaiting human verification',
      approved: 'Approved',
      changes_requested: 'Changes requested',
      rejected: 'Rejected',
      revision_requested: 'Revision Requested',
      legacyApproved: 'Legacy approval (unverified)',
      legacyChangesRequested: 'Legacy change request (unverified)',
      legacyRejected: 'Legacy rejection (unverified)',
    } as Record<string, string>,
    workspaceEvents: {
      guideline_created: 'Guideline created',
      guideline_updated: 'Guideline updated',
      guideline_activated: 'Guideline activated',
      guideline_deactivated: 'Guideline paused',
      guideline_deleted: 'Guideline deleted',
      evidence_created: 'Evidence record created',
      evidence_updated: 'Evidence record updated',
      evidence_deleted: 'Evidence record deleted',
      settings_updated: 'Workspace settings updated',
    } as Record<string, string>,
  },
  hi: {
    kicker: 'अनुपालन बहीखाता',
    title: 'संपादकीय ऑडिट इतिहास',
    description: 'समीक्षक के लाइव निर्णय ठीक विश्लेषित संशोधनों से जुड़े हैं। अंतर्निहित संदर्भ उदाहरण अलग रखे गए हैं और वे लाइव अनुमोदन रिकॉर्ड नहीं हैं।',
    loadError: 'स्थानीय ऑडिट रिकॉर्ड लोड नहीं किए जा सके।',
    loadDecisionsPrefix: 'स्थानीय ऑडिट निर्णय लोड नहीं किए जा सके:',
    resetButton: 'स्थानीय ऑडिट इतिहास रीसेट करें',
    exportButton: 'ऑडिट ट्रेल निर्यात करें (JSON)',
    liveTab: (count: number) => `लाइव कार्यस्थान ऑडिट बहीखाता (${count})`,
    seededTab: (count: number) => `सीडेड संदर्भ उदाहरण (${count})`,
    tablistAria: 'ऑडिट रिकॉर्ड स्रोत',
    searchPlaceholder: 'शीर्षक, समीक्षक या विभाग द्वारा खोजें...',
    filterAria: 'इवेंट प्रकार द्वारा ऑडिट इतिहास फ़िल्टर करें',
    filterAll: 'सभी इवेंट',
    filterReview: 'समीक्षा जीवनचक्र',
    filterDecision: 'मानव निर्णय',
    filterGuideline: 'दिशानिर्देश परिवर्तन',
    filterEvidence: 'प्रमाण परिवर्तन',
    filterSettings: 'कार्यस्थान सेटिंग्स',
    showingLive: (count: number) => `${count} लाइव ऑडिट रिकॉर्ड प्रदर्शित`,
    showingSeeded: (count: number) => `${count} सीडेड ऑडिट रिकॉर्ड प्रदर्शित`,
    panelKickerLive: 'केवल-संलग्न कार्यस्थान समयरेखा',
    panelKickerSeeded: 'अंतर्निहित प्रदर्शन रिकॉर्ड',
    seededBadge: 'सीडेड उदाहरण · लाइव अनुमोदन नहीं',
    seededNotice: 'ये अंतर्निहित उदाहरण ऑडिट इंटरफ़ेस को प्रदर्शित करते हैं और ये उपयोगकर्ता द्वारा प्रस्तुत या सहेजे गए अनुमोदन रिकॉर्ड नहीं हैं।',
    emptyKicker: 'ऑडिट लॉग खोज',
    emptyTitle: 'कोई मेल खाता ऑडिट रिकॉर्ड नहीं',
    emptyDesc: 'आपकी खोज क्वेरी से कोई ऐतिहासिक ऑडिट प्रविष्टि मेल नहीं खाती। किसी अन्य समीक्षक, दस्तावेज़ शीर्षक या स्रोत के लिए खोजें।',
    clearSearch: 'खोज क्वेरी साफ़ करें',
    thLogId: 'लॉग आईडी / दिनांक',
    thTitleSource: 'दस्तावेज़ शीर्षक और स्रोत',
    thAlignment: 'संरेखण',
    thGateStatus: 'गेट स्थिति',
    thSignature: 'मानव हस्ताक्षर',
    detailsButton: 'विवरण',
    findingsCount: (count: number) => `${count} निष्कर्ष`,
    reviewLifecycleAria: 'समीक्षा जीवनचक्र',
    lifecycleSubmitted: 'प्रस्तुत',
    lifecycleAnalyzed: 'विश्लेषित',
    lifecycleFlagged: 'चिह्नित',
    lifecycleGate: 'गेट',
    seededDemoRecord: 'सीडेड डेमो रिकॉर्ड',
    workspaceEvent: 'कार्यस्थान इवेंट',
    revisionText: 'संशोधन',
    revisionLifecycleSummary: (count: number) => `संशोधन जीवनचक्र · ${count} इवेंट · पूर्व संशोधन से तुलना करें`,
    revisionDiffTitle: 'संशोधन अंतर · बदला हुआ अंश',
    noPriorWording: 'कोई पूर्व शब्द नहीं',
    noReplacementWording: 'कोई प्रतिस्थापन शब्द नहीं',
    noPriorRevision: 'तुलना के लिए कोई पूर्व संशोधन उपलब्ध नहीं है।',
    modalEventKicker: 'कार्यस्थान ऑडिट इवेंट',
    recordedBy: 'द्वारा रिकॉर्ड किया गया:',
    notProvided: 'प्रदान नहीं किया गया',
    closeDetails: 'विवरण बंद करें',
    modalResetKicker: 'स्थानीय ऑडिट इतिहास',
    modalResetTitle: 'स्थानीय समीक्षा रिकॉर्ड रीसेट करें',
    modalResetSubtitle: 'सटीक रूप से चुनें कि कौन से ब्राउज़र-सहेजे गए समीक्षा रिकॉर्ड हटाने हैं। दिशानिर्देश, प्रमाण और कार्यस्थान सेटिंग्स अपरिवर्तित रहेंगी।',
    clearTestsTitle: 'स्थानीय परीक्षण रिकॉर्ड साफ़ करें',
    clearTestsDesc: 'उपयोगकर्ता द्वारा बनाए गए समीक्षा रिकॉर्ड, संशोधन और निर्णय हटाएं। तैयार डेमो परिदृश्य रिकॉर्ड सुरक्षित रहेंगे।',
    clearTestsButton: 'परीक्षण रिकॉर्ड साफ़ करें',
    resetSeededTitle: 'स्वच्छ सीडेड उदाहरणों पर रीसेट करें',
    resetSeededDesc: 'तैयार परिदृश्यों सहित सभी ब्राउज़र-सहेजे गए समीक्षा रिकॉर्ड हटाएं। पाँच अंतर्निहित, केवल-पढ़ने योग्य सीडेड ऑडिट उदाहरण दृश्यमान रहेंगे।',
    resetSeededButton: 'सीडेड उदाहरणों पर रीसेट करें',
    cancel: 'रद्द करें',
    noResetMatch: 'उस रीसेट विकल्प से कोई स्थानीय समीक्षा रिकॉर्ड मेल नहीं खाता।',
    resetError: 'कार्यस्थान ऑडिट इतिहास रीसेट नहीं किया जा सका।',
    unverifiedHistory: 'असत्यापित स्थानीय इतिहास',
    statusLabels: {
      draft: 'प्रारूप / संशोधन सहेजा गया',
      submitted: 'प्रस्तुत',
      analysis_complete: 'एआई विश्लेषण पूर्ण',
      validation_complete: 'ब्रांड और प्रमाण सत्यापन पूर्ण',
      issues_found: 'मुद्दे पाए गए',
      awaiting_human_verification: 'मानव सत्यापन की प्रतीक्षा',
      approved: 'अनुमोदित',
      changes_requested: 'परिवर्तन का अनुरोध किया',
      rejected: 'अस्वीकृत',
      revision_requested: 'संशोधन का अनुरोध किया गया',
      legacyApproved: 'विरासत अनुमोदन (असत्यापित)',
      legacyChangesRequested: 'विरासत परिवर्तन अनुरोध (असत्यापित)',
      legacyRejected: 'विरासत अस्वीकृति (असत्यापित)',
    } as Record<string, string>,
    workspaceEvents: {
      guideline_created: 'दिशानिर्देश बनाया गया',
      guideline_updated: 'दिशानिर्देश अपडेट किया गया',
      guideline_activated: 'दिशानिर्देश सक्रिय किया गया',
      guideline_deactivated: 'दिशानिर्देश रोका गया',
      guideline_deleted: 'दिशानिर्देश हटाया गया',
      evidence_created: 'प्रमाण रिकॉर्ड बनाया गया',
      evidence_updated: 'प्रमाण रिकॉर्ड अपडेट किया गया',
      evidence_deleted: 'प्रमाण रिकॉर्ड हटाया गया',
      settings_updated: 'कार्यस्थान सेटिंग्स अपडेट की गईं',
    } as Record<string, string>,
  },
  gu: {
    kicker: 'અનુપાલન ખાતાવહી',
    title: 'સંપાદકીય ઑડિટ ઇતિહાસ',
    description: 'લાઇવ સમીક્ષક નિર્ણયો ચોક્કસ વિશ્લેષિત સુધારાઓ સાથે જોડાયેલા છે. ઇન-બિલ્ટ સંદર્ભ ઉદાહરણો અલગ રાખવામાં આવ્યા છે અને તે લાઇવ મંજૂરી રેકોર્ડ નથી.',
    loadError: 'સ્થાનિક ઑડિટ રેકોર્ડ્સ લોડ કરી શકાયા નથી.',
    loadDecisionsPrefix: 'સ્થાનિક ઑડિટ નિર્ણયો લોડ કરી શકાયા નથી:',
    resetButton: 'સ્થાનિક ઑડિટ ઇતિહાસ રીસેટ કરો',
    exportButton: 'ઑડિટ ટ્રેઇલ નિકાસ કરો (JSON)',
    liveTab: (count: number) => `લાઇવ વર્કસ્પેસ ઑડિટ ખાતાવહી (${count})`,
    seededTab: (count: number) => `સીડેડ સંદર્ભ ઉદાહરણો (${count})`,
    tablistAria: 'ઑડિટ રેકોર્ડ સ્ત્રોત',
    searchPlaceholder: 'શીર્ષક, સમીક્ષક અથવા વિભાગ દ્વારા શોધો...',
    filterAria: 'ઇવેન્ટ પ્રકાર દ્વારા ઑડિટ ઇતિહાસ ફિલ્ટર કરો',
    filterAll: 'બધી ઇવેન્ટ્સ',
    filterReview: 'સમીક્ષા જીવનચક્ર',
    filterDecision: 'માનવ નિર્ણયો',
    filterGuideline: 'માર્ગદર્શિકા ફેરફારો',
    filterEvidence: 'પુરાવા ફેરફારો',
    filterSettings: 'વર્કસ્પેસ સેટિંગ્સ',
    showingLive: (count: number) => `${count} લાઇવ ઑડિટ રેકોર્ડ દર્શાવે છે`,
    showingSeeded: (count: number) => `${count} સીડેડ ઑડિટ રેકોર્ડ દર્શાવે છે`,
    panelKickerLive: 'માત્ર-ઉમેરો વર્કસ્પેસ સમયરેખા',
    panelKickerSeeded: 'ઇન-બિલ્ટ પ્રદર્શન રેકોર્ડ્સ',
    seededBadge: 'સીડેડ ઉદાહરણ · લાઇવ મંજૂરી નથી',
    seededNotice: 'આ ઇન-બિલ્ટ ઉદાહરણો ઑડિટ ઇન્ટરફેસ દર્શાવે છે અને વપરાશકર્તા દ્વારા સબમિટ કરેલા અથવા સાચવેલા મંજૂરી રેકોર્ડ નથી.',
    emptyKicker: 'ઑડિટ લૉગ શોધ',
    emptyTitle: 'કોઈ મેળ ખાતા ઑડિટ રેકોર્ડ મળ્યા નથી',
    emptyDesc: 'તમારી શોધ ક્વેરી સાથે કોઈ ઐતિહાસિક ઑડિટ એન્ટ્રી મેળ ખાતી નથી. અલગ સમીક્ષક, દસ્તાવેજ શીર્ષક અથવા સ્ત્રોત શોધવાનો પ્રયાસ કરો.',
    clearSearch: 'શોધ ક્વેરી સાફ કરો',
    thLogId: 'લૉગ આઈડી / તારીખ',
    thTitleSource: 'દસ્તાવેજ શીર્ષક અને સ્ત્રોત',
    thAlignment: 'સુસંગતતા',
    thGateStatus: 'ગેટ સ્થિતિ',
    thSignature: 'માનવ સહી',
    detailsButton: 'વિગતો',
    findingsCount: (count: number) => `${count} તારણો`,
    reviewLifecycleAria: 'સમીક્ષા જીવનચક્ર',
    lifecycleSubmitted: 'સબમિટ કરેલ',
    lifecycleAnalyzed: 'વિશ્લેષિત',
    lifecycleFlagged: 'ચિહ્નિત',
    lifecycleGate: 'ગેટ',
    seededDemoRecord: 'સીડેડ ડેમો રેકોર્ડ',
    workspaceEvent: 'વર્કસ્પેસ ઇવેન્ટ',
    revisionText: 'સુધારો',
    revisionLifecycleSummary: (count: number) => `સુધારો જીવનચક્ર · ${count} ઇવેન્ટ્સ · અગાઉના સુધારા સાથે સરખામણી કરો`,
    revisionDiffTitle: 'સુધારો તફાવત · બદલાયેલ ફકરો',
    noPriorWording: 'કોઈ અગાઉના શબ્દો નથી',
    noReplacementWording: 'કોઈ રિપ્લેસમેન્ટ શબ્દો નથી',
    noPriorRevision: 'સરખામણી માટે કોઈ અગાઉનો સુધારો ઉપલબ્ધ નથી.',
    modalEventKicker: 'વર્કસ્પેસ ઑડિટ ઇવેન્ટ',
    recordedBy: 'દ્વારા રેકોર્ડ થયેલ:',
    notProvided: 'પ્રદાન કરેલ નથી',
    closeDetails: 'વિગતો બંધ કરો',
    modalResetKicker: 'સ્થાનિક ઑડિટ ઇતિહાસ',
    modalResetTitle: 'સ્થાનિક સમીક્ષા રેકોર્ડ્સ રીસેટ કરો',
    modalResetSubtitle: 'બ્રાઉઝરમાં સાચવેલા કયા સમીક્ષા રેકોર્ડ્સ દૂર કરવા તે ચોક્કસપણે પસંદ કરો. માર્ગદર્શિકા, પુરાવા અને વર્કસ્પેસ સેટિંગ્સ યથાવત રહેશે.',
    clearTestsTitle: 'સ્થાનિક પરીક્ષણ રેકોર્ડ્સ સાફ કરો',
    clearTestsDesc: 'વપરાશકર્તા દ્વારા બનાવેલા સમીક્ષા રેકોર્ડ્સ, સુધારાઓ અને નિર્ણયો દૂર કરો. તૈયાર ડેમો પરિસ્થિતિ રેકોર્ડ્સ સાચવવામાં આવશે.',
    clearTestsButton: 'પરીક્ષણ રેકોર્ડ્સ સાફ કરો',
    resetSeededTitle: 'સ્વચ્છ સીડેડ ઉદાહરણો પર રીસેટ કરો',
    resetSeededDesc: 'તૈયાર પરિસ્થિતિઓ સહિત તમામ બ્રાઉઝર-સાચવેલા સમીક્ષા રેકોર્ડ્સ દૂર કરો. પાંચ ઇન-બિલ્ટ, ફક્ત-વાંચવા માટેના સીડેડ ઑડિટ ઉદાહરણો દૃશ્યમાન રહેશે.',
    resetSeededButton: 'સીડેડ ઉદાહરણો પર રીસેટ કરો',
    cancel: 'રદ કરો',
    noResetMatch: 'તે રીસેટ વિકલ્પ સાથે કોઈ સ્થાનિક સમીક્ષા રેકોર્ડ્સ મેળ ખાતા નથી.',
    resetError: 'વર્કસ્પેસ ઑડિટ ઇતિહાસ રીસેટ કરી શકાયો નથી.',
    unverifiedHistory: 'અચકાસાયેલ સ્થાનિક ઇતિહાસ',
    statusLabels: {
      draft: 'ડ્રાફ્ટ / સુધારો સાચવ્યો',
      submitted: 'સબમિટ કરેલ',
      analysis_complete: 'એઆઈ વિશ્લેષણ પૂર્ણ',
      validation_complete: 'બ્રાન્ડ અને પુરાવા માન્યતા પૂર્ણ',
      issues_found: 'સમસ્યાઓ મળી',
      awaiting_human_verification: 'માનવ ચકાસણીની રાહ જોઈ રહ્યું છે',
      approved: 'મંજૂર',
      changes_requested: 'ફેરફારોની વિનંતી કરી',
      rejected: 'અસ્વીકાર કર્યો',
      revision_requested: 'સુધારાની વિનંતી કરી',
      legacyApproved: 'વારસાગત મંજૂરી (અચકાસાયેલ)',
      legacyChangesRequested: 'વારસાગત ફેરફાર વિનંતી (અચકાસાયેલ)',
      legacyRejected: 'વારસાગત અસ્વીકાર (અચકાસાયેલ)',
    } as Record<string, string>,
    workspaceEvents: {
      guideline_created: 'માર્ગદર્શિકા બનાવી',
      guideline_updated: 'માર્ગદર્શિકા અપડેટ કરી',
      guideline_activated: 'માર્ગદર્શિકા સક્રિય કરી',
      guideline_deactivated: 'માર્ગદર્શિકા થોભાવી',
      guideline_deleted: 'માર્ગદર્શિકા કાઢી નાખી',
      evidence_created: 'પુરાવા રેકોર્ડ બનાવ્યો',
      evidence_updated: 'પુરાવા રેકોર્ડ અપડેટ કર્યો',
      evidence_deleted: 'પુરાવા રેકોર્ડ કાઢી નાખ્યો',
      settings_updated: 'વર્કસ્પેસ સેટિંગ્સ અપડેટ કરી',
    } as Record<string, string>,
  },
};

const getDisplayStatus = (status: string, language: SupportedLanguage): string => {
  const t = HISTORY_UI[language] ?? HISTORY_UI.en;
  const enUI = HISTORY_UI.en;

  // Direct match in status labels
  if (status === 'Approved') return t.statusLabels.approved;
  if (status === 'Revision Requested') return t.statusLabels.revision_requested;
  if (status === 'Rejected') return t.statusLabels.rejected;
  if (status === 'Legacy approval (unverified)') return t.statusLabels.legacyApproved;
  if (status === 'Legacy change request (unverified)') return t.statusLabels.legacyChangesRequested;
  if (status === 'Legacy rejection (unverified)') return t.statusLabels.legacyRejected;
  if (status === 'Submitted') return t.statusLabels.submitted;
  if (status === 'AI analysis complete') return t.statusLabels.analysis_complete;
  if (status === 'Brand & evidence validation complete') return t.statusLabels.validation_complete;
  if (status === 'Draft / revision saved') return t.statusLabels.draft;
  if (status === 'Issues found') return t.statusLabels.issues_found;
  if (status === 'Awaiting human verification') return t.statusLabels.awaiting_human_verification;

  // Check in statusLabels keys directly
  if (t.statusLabels[status]) return t.statusLabels[status];

  // Check in workspaceEvents by English label
  const foundWsKey = Object.entries(enUI.workspaceEvents).find(([, enLabel]) => enLabel === status)?.[0];
  if (foundWsKey && t.workspaceEvents[foundWsKey]) {
    return t.workspaceEvents[foundWsKey];
  }

  return status;
};

const formatTimestamp = (dateStr: string, language: SupportedLanguage): string => {
  try {
    const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString(locale);
    }
  } catch {
    // ignore
  }
  return dateStr;
};

const workspaceEventLabel = (event: WorkspaceAuditEvent): string => {
  const labels: Record<string, string> = {
    guideline_created: 'Guideline created',
    guideline_updated: 'Guideline updated',
    guideline_activated: 'Guideline activated',
    guideline_deactivated: 'Guideline paused',
    guideline_deleted: 'Guideline deleted',
    evidence_created: 'Evidence record created',
    evidence_updated: 'Evidence record updated',
    evidence_deleted: 'Evidence record deleted',
    settings_updated: 'Workspace settings updated',
  };
  return labels[event.type] ?? event.type;
};

const STATUS_EVENT_LABELS: Record<string, string> = {
  draft: 'Draft / revision saved',
  submitted: 'Submitted',
  analysis_complete: 'AI analysis complete',
  validation_complete: 'Brand & evidence validation complete',
  issues_found: 'Issues found',
  awaiting_human_verification: 'Awaiting human verification',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
};

const AUDIT_LOGS: AuditRecord[] = [
  {
    id: 'AUD-5881',
    docTitle: 'Brand Modernization & Visual Identity Manifesto',
    source: 'Internal Brand Team',
    score: 94,
    status: 'Approved',
    verifiedBy: 'Elena Rostova (VP Brand Strategy)',
    timestamp: '2026-10-20 14:12',
    flagsResolved: 1,
    isDemo: true,
  },
  {
    id: 'AUD-5880',
    docTitle: 'Investor Narrative & Sustainable Growth Brief',
    source: 'Executive Communications',
    score: 98,
    status: 'Approved',
    verifiedBy: 'Nitin Editor (Chief Brand Officer)',
    timestamp: '2026-10-19 18:30',
    flagsResolved: 0,
    isDemo: true,
  },
  {
    id: 'AUD-5879',
    docTitle: 'Global Partner Summit Invitation Letter',
    source: 'Events Marketing Team',
    score: 88,
    status: 'Approved',
    verifiedBy: 'Marcus Brody (Lead Tech Writer)',
    timestamp: '2026-10-19 11:05',
    flagsResolved: 2,
    isDemo: true,
  },
  {
    id: 'AUD-5878',
    docTitle: 'Product Security Whitepaper v2.0',
    source: 'Technical Architecture',
    score: 62,
    status: 'Revision Requested',
    verifiedBy: 'Elena Rostova (VP Brand Strategy)',
    timestamp: '2026-10-18 16:44',
    flagsResolved: 4,
    isDemo: true,
  },
  {
    id: 'AUD-5877',
    docTitle: 'AI Ethics & Customer Privacy Charter',
    source: 'Legal & Compliance',
    score: 99,
    status: 'Approved',
    verifiedBy: 'Nitin Editor (Chief Brand Officer)',
    timestamp: '2026-10-17 09:20',
    flagsResolved: 0,
    isDemo: true,
  },
];

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = HISTORY_UI[language] ?? HISTORY_UI.en;

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [recordView, setRecordView] = useState<AuditRecordView>('live');
  const [selectedEvent, setSelectedEvent] = useState<AuditRecord | null>(null);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [workspaceEvents, setWorkspaceEvents] = useState<WorkspaceAuditEvent[]>([]);
  const [storageError, setStorageError] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    const refreshRecords = () => {
      try {
        setReviewRecords(readReviewRecords());
        setWorkspaceEvents(readWorkspaceAuditEvents());
        setStorageError('');
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : t.loadError);
      }
    };
    refreshRecords();
    window.addEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshRecords);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getScopedStorageKey(REVIEW_RECORDS_STORAGE_KEY) || event.key === getScopedStorageKey(WORKSPACE_DATA_STORAGE_KEY)) refreshRecords();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
      window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshRecords);
      window.removeEventListener('storage', handleStorage);
    };
  }, [t.loadError]);

  const localAuditLogs: AuditRecord[] = reviewRecords.flatMap((record) => {
    const lifecycleEvents: AuditRecord[] = record.statusHistory
      .filter((event) => event.status !== 'approved' && event.status !== 'changes_requested' && event.status !== 'rejected')
      .map((event, index) => {
        const revision = event.revision ?? record.revision;
        const snapshot = record.revisionHistory.find((item) => item.revision === revision);
        return {
          id: `${record.id}-event-${index}-${event.at}`,
          docTitle: `${snapshot?.title ?? record.title} · ${t.revisionText} ${revision}`,
          source: record.campaign || record.contentType,
          score: snapshot?.score ?? (revision === record.revision ? record.score : 0),
          status: STATUS_EVENT_LABELS[event.status] ?? event.status,
          verifiedBy: event.actor,
          timestamp: new Date(event.at).toLocaleString(),
          sortTimestamp: event.at,
          flagsResolved: snapshot?.findings.length ?? (revision === record.revision ? record.findings.length : 0),
          comment: event.note,
          revision,
          contentHash: snapshot?.contentHash ?? (revision === record.revision ? record.contentHash : undefined),
          revisionContent: snapshot?.content ?? (revision === record.revision ? record.currentContent : undefined),
          relatedReviewId: record.id,
          eventType: 'review',
        };
      });
    const decisions: AuditRecord[] = record.decisionHistory.map((decision) => {
      const revision = record.revisionHistory.find((item) => (
        item.revision === decision.revision && item.contentHash === decision.contentHash
      ));
      const isCurrentRevision = record.revision === decision.revision && record.contentHash === decision.contentHash;
      const findings = isCurrentRevision ? record.findings : revision?.findings ?? [];
      return {
        id: `${record.id}-R${decision.revision}-${decision.decidedAt}`,
        docTitle: `${revision?.title ?? record.title} · ${t.revisionText} ${decision.revision}`,
        source: record.campaign || record.contentType,
        score: isCurrentRevision ? record.score : revision?.score ?? 0,
        status: decision.decision === 'approved'
          ? decision.legacyLocalUnverified ? 'Legacy approval (unverified)' : 'Approved'
          : decision.decision === 'changes_requested'
            ? decision.legacyLocalUnverified ? 'Legacy change request (unverified)' : 'Revision Requested'
            : decision.legacyLocalUnverified ? 'Legacy rejection (unverified)' : 'Rejected',
        verifiedBy: decision.legacyLocalUnverified ? `Unverified local history · ${decision.reviewer}` : decision.reviewer,
        timestamp: new Date(decision.decidedAt).toLocaleString(),
        sortTimestamp: decision.decidedAt,
        flagsResolved: findings.length,
        comment: decision.comment,
        revision: decision.revision,
        contentHash: decision.contentHash,
        revisionContent: decision.content,
        relatedReviewId: record.id,
        eventType: 'decision',
        legacyUnverified: Boolean(decision.legacyLocalUnverified),
      };
    });
    return [...lifecycleEvents, ...decisions];
  });

  const workspaceAuditLogs: AuditRecord[] = workspaceEvents.map((event) => ({
    id: event.id,
    docTitle: event.entityTitle,
    source: event.snapshot.category ?? event.snapshot.sourceName ?? event.entityId,
    score: 0,
    status: workspaceEventLabel(event),
    verifiedBy: event.actor,
    timestamp: new Date(event.timestamp).toLocaleString(),
    sortTimestamp: event.timestamp,
    flagsResolved: 0,
    comment: event.description,
    eventType: event.type.startsWith('guideline')
      ? 'guideline'
      : event.type.startsWith('evidence') ? 'evidence' : 'settings',
    details: event.snapshot,
  }));
  const liveLogs = [...localAuditLogs, ...workspaceAuditLogs]
    .sort((left, right) => new Date(right.sortTimestamp ?? right.timestamp).getTime() - new Date(left.sortTimestamp ?? left.timestamp).getTime());
  const seededLogs = [...AUDIT_LOGS]
    .sort((left, right) => new Date(right.sortTimestamp ?? right.timestamp).getTime() - new Date(left.sortTimestamp ?? left.timestamp).getTime());

  const groupLogs = (sourceLogs: AuditRecord[]): AuditRecord[] => {
    const grouped = new Map<string, AuditRecord[]>();
    const displayLogs: AuditRecord[] = [];
    sourceLogs.forEach((log) => {
      if (!log.relatedReviewId || !['review', 'decision'].includes(log.eventType ?? '')) {
        displayLogs.push(log);
        return;
      }
      const groupId = `${log.relatedReviewId}-${log.revision ?? 0}-${log.contentHash ?? ''}`;
      grouped.set(groupId, [...(grouped.get(groupId) ?? []), log]);
    });
    grouped.forEach((events) => {
      const ordered = events.slice().sort((left, right) => (
        new Date(left.sortTimestamp ?? left.timestamp).getTime() - new Date(right.sortTimestamp ?? right.timestamp).getTime()
      ));
      const latest = ordered[ordered.length - 1];
      displayLogs.push({
        ...latest,
        id: `${latest.relatedReviewId}-R${latest.revision}-${latest.contentHash ?? 'revision'}`,
        status: latest.status,
        events: ordered,
      });
    });
    return displayLogs.sort((left, right) => new Date(right.sortTimestamp ?? right.timestamp).getTime() - new Date(left.sortTimestamp ?? left.timestamp).getTime());
  };
  const liveCount = groupLogs(liveLogs).length;
  const seededCount = seededLogs.length;
  const selectedLogs = recordView === 'live' ? liveLogs : seededLogs;
  const filteredLogs = selectedLogs.filter(
    (log) => (filter === 'all' || log.eventType === filter) && (
      log.docTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.verifiedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.comment?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
  const displayLogs = groupLogs(filteredLogs);

  const getDiff = (currentLog: AuditRecord) => {
    if (!currentLog.relatedReviewId || !currentLog.revision) return null;
    const record = reviewRecords.find((item) => item.id === currentLog.relatedReviewId);
    const current = record?.revisionHistory.find((item) => item.revision === currentLog.revision)?.content
      ?? (record?.revision === currentLog.revision ? record.currentContent : currentLog.revisionContent);
    const previous = record?.revisionHistory.find((item) => item.revision === (currentLog.revision ?? 1) - 1)?.content;
    if (current === undefined || previous === undefined) return null;
    const beforeWords = previous.split(/(\s+)/);
    const afterWords = current.split(/(\s+)/);
    let prefix = 0;
    while (prefix < beforeWords.length && prefix < afterWords.length && beforeWords[prefix] === afterWords[prefix]) prefix += 1;
    let suffix = 0;
    while (
      suffix < beforeWords.length - prefix
      && suffix < afterWords.length - prefix
      && beforeWords[beforeWords.length - 1 - suffix] === afterWords[afterWords.length - 1 - suffix]
    ) suffix += 1;
    return {
      before: beforeWords.slice(prefix, beforeWords.length - suffix).join(''),
      after: afterWords.slice(prefix, afterWords.length - suffix).join(''),
    };
  };

  const handleExport = () => {
    const exportData = createAuditTrailExport(liveLogs, seededLogs);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'brandlens_audit_trail.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const resetLocalHistory = async (mode: 'tests' | 'all') => {
    try {
      const removed = mode === 'tests' ? await cloudClearUserReviews() : await cloudClearAllReviews();
      setReviewRecords(readReviewRecords());
      setStorageError('');
      setIsResetModalOpen(false);
      if (removed === 0) setStorageError(t.noResetMatch);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : t.resetError);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-stone-300 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-widest font-mono text-copper font-bold">
              {t.kicker}
            </span>
          </div>
          <h2 className="font-serif text-3xl font-normal text-obsidian tracking-tight">
            {t.title}
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            {t.description}
          </p>
        </div>

        {storageError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{t.loadDecisionsPrefix} {storageError}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RotateCcw className="w-4 h-4 text-copper" />}
            onClick={() => setIsResetModalOpen(true)}
          >
            {t.resetButton}
          </Button>
          <Button
            variant="outline"
            size="md"
            leftIcon={<Download className="w-4 h-4 text-stone-600" />}
            onClick={handleExport}
          >
            {t.exportButton}
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label={t.tablistAria} className="flex flex-wrap gap-2 border-b border-stone-300 pb-3">
        <button
          type="button"
          role="tab"
          aria-selected={recordView === 'live'}
          onClick={() => setRecordView('live')}
          className={`border px-3 py-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${recordView === 'live' ? 'border-obsidian bg-obsidian text-ivory' : 'border-stone-300 bg-ivory-50 text-stone-700 hover:border-copper'}`}
        >
          {t.liveTab(liveCount)}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={recordView === 'seeded'}
          onClick={() => setRecordView('seeded')}
          className={`border px-3 py-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${recordView === 'seeded' ? 'border-obsidian bg-obsidian text-ivory' : 'border-stone-300 bg-ivory-50 text-stone-700 hover:border-copper'}`}
        >
          {t.seededTab(seededCount)}
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center justify-between gap-4 bg-ivory-50/80 p-3.5 rounded-[3px] border border-stone-300">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-white text-xs rounded-[3px] border border-stone-300 pl-9 pr-3 py-2 placeholder:text-stone-400 focus:outline-none focus:border-copper"
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as AuditFilter)}
          aria-label={t.filterAria}
          className="bg-white text-xs rounded-[3px] border border-stone-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
        >
          <option value="all">{t.filterAll}</option>
          <option value="review">{t.filterReview}</option>
          <option value="decision">{t.filterDecision}</option>
          <option value="guideline">{t.filterGuideline}</option>
          <option value="evidence">{t.filterEvidence}</option>
          <option value="settings">{t.filterSettings}</option>
        </select>
        </div>

        <span className="text-xs text-stone-500 font-mono hidden sm:inline">
          {recordView === 'live' ? t.showingLive(displayLogs.length) : t.showingSeeded(displayLogs.length)}
        </span>
      </div>

      {/* Audit Table */}
      <div data-tour="audit-ledger">
        <Panel
          padding="none"
          variant="elevated"
          kicker={recordView === 'live' ? t.panelKickerLive : t.panelKickerSeeded}
          title={recordView === 'live' ? t.liveTab(liveCount) : t.seededTab(seededCount)}
        >
        {recordView === 'seeded' && (
          <div className="border-b border-copper-300 bg-copper-50 px-6 py-3">
            <span className="inline-flex border border-copper-400 bg-ivory px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-copper-900">{t.seededBadge}</span>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-700">{t.seededNotice}</p>
          </div>
        )}
        {filteredLogs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              kicker={t.emptyKicker}
              title={t.emptyTitle}
              description={t.emptyDesc}
              icon={<History className="w-5 h-5 text-copper" />}
              action={{
                label: t.clearSearch,
                onClick: () => setSearchTerm(''),
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/80 border-b border-stone-200 uppercase font-mono font-semibold text-stone-600 tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">{t.thLogId}</th>
                  <th className="px-6 py-3.5">{t.thTitleSource}</th>
                  <th className="px-6 py-3.5">{t.thAlignment}</th>
                  <th className="px-6 py-3.5">{t.thGateStatus}</th>
                  <th className="px-6 py-3.5">{t.thSignature}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {displayLogs.map((log) => (
                  <React.Fragment key={log.id}>
                  <tr className="align-top hover:bg-ivory-100/60 transition-colors">
                    <td className="px-6 py-4 font-mono">
                      {log.isDemo && <span className="mb-1 inline-block border border-copper-400 bg-copper-50 px-1.5 py-1 text-[8px] font-mono font-bold uppercase tracking-wider text-copper-900">{t.seededBadge}</span>}
                      {log.details ? (
                        <button type="button" onClick={() => setSelectedEvent(log)} className="font-bold text-obsidian hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{log.id} · {t.detailsButton}</button>
                      ) : <div className="font-bold text-obsidian">{log.events ? `R${log.revision} · ${log.relatedReviewId}` : log.id}</div>}
                      <div className="text-stone-500 text-[11px]">{formatTimestamp(log.sortTimestamp ?? log.timestamp, language)}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-serif text-sm font-medium text-obsidian">
                        {log.relatedReviewId ? (
                          <button type="button" onClick={() => navigate(`/approvals/${encodeURIComponent(log.relatedReviewId ?? '')}`)} className="text-left hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{log.docTitle}</button>
                        ) : log.docTitle}
                      </div>
                      <div className="text-stone-500 text-[11px] mt-0.5">
                        {log.source}{log.contentHash ? ` · ${log.contentHash}` : ''}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`font-mono font-semibold ${
                        log.score >= 90 ? 'text-forest' : 'text-copper'
                      }`}>
                        {log.eventType === 'guideline' || log.eventType === 'evidence' ? '—' : `${log.score}/100`}
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {log.eventType === 'guideline' || log.eventType === 'evidence' ? getDisplayStatus(log.eventType, language) : t.findingsCount(log.flagsResolved)}
                      </span>
                      {log.events && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[8px] font-mono uppercase tracking-wide text-stone-500" aria-label={t.reviewLifecycleAria}>
                          {[
                            [t.lifecycleSubmitted, log.events.some((event) => event.status === 'Submitted')],
                            [t.lifecycleAnalyzed, log.events.some((event) => event.status.toLowerCase().includes('analysis complete'))],
                            [t.lifecycleFlagged, log.flagsResolved > 0],
                            [t.lifecycleGate, log.events.some((event) => event.eventType === 'decision')],
                          ].map(([label, done]) => (
                            <span key={String(label)} className={`border px-1 py-0.5 ${done ? 'border-forest-300 bg-forest-50 text-forest-800' : 'border-stone-200 text-stone-400'}`}>{label}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <Badge
                        variant={log.status === 'Approved' || log.status.includes('complete') ? 'forest' : log.status === 'Rejected' ? 'stone' : 'copper'}
                        size="sm"
                        dot
                      >
                        {getDisplayStatus(log.status, language)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 font-sans">
                      <div className="flex items-center gap-1.5 text-obsidian font-medium">
                        <UserCheck className={`w-3.5 h-3.5 ${log.status === 'Approved' ? 'text-forest' : 'text-copper'}`} />
                        <span>{log.legacyUnverified ? `${t.unverifiedHistory} · ${log.verifiedBy.replace(/^Unverified local history · /, '')}` : log.verifiedBy}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">
                        {log.isDemo ? t.seededDemoRecord : `${log.eventType === 'guideline' || log.eventType === 'evidence' ? t.workspaceEvent : `${t.revisionText} ${log.revision ?? '—'} · ${log.contentHash ?? ''}`}`}
                      </div>
                      {log.comment && <div className="mt-1 max-w-sm text-[10px] leading-relaxed text-stone-600">“{log.comment}”</div>}
                    </td>
                  </tr>
                  {log.events && (
                    <tr className="bg-ivory-100/40">
                      <td colSpan={5} className="px-6 pb-3">
                        <details className="border-t border-stone-200 pt-2">
                          <summary className="cursor-pointer text-[9px] font-mono uppercase tracking-wider text-copper-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{t.revisionLifecycleSummary(log.events.length)}</summary>
                          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <ol className="space-y-2">
                              {log.events.map((event) => (
                                <li key={event.id} className="flex items-start justify-between gap-3 border-l border-stone-300 pl-2 text-[9px]">
                                  <span className="font-semibold text-obsidian">{getDisplayStatus(event.status, language)}<span className="ml-2 font-normal text-stone-500">· {event.verifiedBy}</span></span>
                                  <time className="shrink-0 text-stone-500">{formatTimestamp(event.sortTimestamp ?? event.timestamp, language)}</time>
                                </li>
                              ))}
                            </ol>
                            {(() => {
                              const diff = getDiff(log);
                              return diff ? (
                                <div className="border-l-2 border-copper/50 pl-3">
                                  <p className="mb-2 text-[9px] font-mono font-bold uppercase tracking-wider text-stone-600">{t.revisionDiffTitle}</p>
                                  <p className="text-[10px] leading-relaxed text-stone-700"><span className="font-mono text-copper-800">−</span> {diff.before || t.noPriorWording}</p>
                                  <p className="mt-1 text-[10px] leading-relaxed text-stone-700"><span className="font-mono text-forest-800">+</span> {diff.after || t.noReplacementWording}</p>
                                </div>
                              ) : <p className="text-[9px] text-stone-500">{t.noPriorRevision}</p>;
                            })()}
                          </div>
                        </details>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      </div>

      <Modal
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        kicker={t.modalEventKicker}
        title={selectedEvent?.docTitle}
        subtitle={selectedEvent ? `${getDisplayStatus(selectedEvent.status, language)} · ${selectedEvent.id} · ${formatTimestamp(selectedEvent.sortTimestamp ?? selectedEvent.timestamp, language)}` : ''}
        maxWidth="lg"
      >
        {selectedEvent && (
          <div className="space-y-3">
            <p className="border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-xs text-stone-700">{selectedEvent.comment}</p>
            <p className="text-xs text-stone-600"><strong className="text-obsidian">{t.recordedBy}</strong> {selectedEvent.verifiedBy}</p>
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(selectedEvent.details ?? {}).map(([key, value]) => (
                <div key={key} className="border-b border-stone-200 pb-2">
                  <dt className="text-[9px] font-mono uppercase tracking-wider text-stone-500">{key}</dt>
                  <dd className="mt-1 break-words text-xs text-obsidian">{value || t.notProvided}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end border-t border-stone-200 pt-3">
              <Button variant="secondary" size="sm" onClick={() => setSelectedEvent(null)}>{t.closeDetails}</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        kicker={t.modalResetKicker}
        title={t.modalResetTitle}
        subtitle={t.modalResetSubtitle}
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="border border-stone-200 bg-ivory-50 p-3">
            <h4 className="text-sm font-semibold text-obsidian">{t.clearTestsTitle}</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-600">{t.clearTestsDesc}</p>
            <Button className="mt-3" type="button" variant="outline" size="sm" onClick={() => resetLocalHistory('tests')}>{t.clearTestsButton}</Button>
          </div>
          <div className="border border-copper/40 bg-copper-50/50 p-3">
            <h4 className="text-sm font-semibold text-obsidian">{t.resetSeededTitle}</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-600">{t.resetSeededDesc}</p>
            <Button className="mt-3" type="button" variant="copper" size="sm" onClick={() => resetLocalHistory('all')}>{t.resetSeededButton}</Button>
          </div>
          <div className="flex justify-end border-t border-stone-200 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsResetModalOpen(false)}>{t.cancel}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
