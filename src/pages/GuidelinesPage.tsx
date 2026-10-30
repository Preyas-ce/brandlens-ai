import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import { useLanguage } from '@/contexts/LanguageProvider';
import { BookOpen, Check, FileCheck2, Pause, Pencil, Play, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Panel } from '@/components/ui/Panel';
import {
  getEvidenceFreshness,
  GUIDELINE_CATEGORIES,
  readEvidenceRecords,
  readGuidelines,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import {
  cloudCreateEvidenceRecord,
  cloudCreateGuideline,
  cloudDeleteEvidenceRecord,
  cloudDeleteGuideline,
  cloudUpdateEvidenceRecord,
  cloudUpdateGuideline,
} from '@/services/cloudStorage';
import {
  EvidenceRecord,
  GuidelineCategory,
  GuidelineRecord,
  GuidelineRuleType,
} from '@/types/workspace';

type DirectoryTab = 'guidelines' | 'evidence';
type RuleStatusFilter = 'all' | 'active' | 'paused';
type EvidenceStatusFilter = 'all' | 'verified' | 'unverified' | 'expired';

const GUIDELINES_UI = {
  en: {
    pageKicker: 'Governance Directives', pageTitle: 'Guidelines & Evidence', pageDescription: 'Maintain the rules and source records used by future local analyses. Edits never rewrite prior findings.', add: 'Add', guideline: 'Guideline', evidence: 'Evidence',
    directoryAria: 'Workspace governance directories', guidelinesTab: 'Guidelines', evidenceTab: 'Evidence', filterGuidelineCategory: 'Filter guidelines by category', filterEvidenceStatus: 'Filter evidence by verification status', allCategories: 'All categories', allVerificationStates: 'All verification states', verifiedCurrent: 'Verified and current', unverified: 'Unverified', expiredOrDueReview: 'Expired or due for review',
    searchGuidelinesPlaceholder: 'Search rules, phrases, or guidance…', searchEvidencePlaceholder: 'Search evidence, claims, sources…', searchDirectory: 'Search this directory', filterActiveState: 'Filter guidelines by active state', allRuleStates: 'All rule states', activeInAnalysis: 'Active in analysis', paused: 'Paused', active: 'Active',
    guidelineDirectory: 'GUIDELINE DIRECTORY', noMatchingGuidelines: 'No matching guidelines', guidelineNoMatchDescription: 'Try a different search or category, or add a local guideline for future content analyses.', addGuidelineAction: 'Add a guideline', clearFilters: 'Clear filters', edit: 'Edit', pause: 'Pause', activate: 'Activate', deleteGuideline: 'Delete guideline', checkedPhrases: 'Checked phrases:', approvedWording: 'Approved wording:',
    evidenceRulesNotice: 'Evidence is usable only when marked verified, reviewed, current, and associated with the matching claim. User-added URLs are never trusted automatically.', evidenceCatalogue: 'EVIDENCE CATALOGUE', noMatchingEvidence: 'No matching evidence records', evidenceNoMatchDescription: 'Add a source record to document the claim it supports. New entries begin unverified.', addEvidenceAction: 'Add evidence', claim: 'Claim:', noAdditionalSourceNotes: 'No additional source notes.', source: 'Source:', lastReviewed: 'Last reviewed:', reviewDue: 'Review due:', verifyRecord: 'Verify record…', markUnverified: 'Mark unverified', deleteEvidence: 'Delete evidence',
    guidelineEditTitle: 'Edit guideline', guidelineAddTitle: 'Add guideline', activeRulesSubtitle: 'Active rules are evaluated by future deterministic local analyses.', guidelineTitleLabel: 'Guideline title', categoryLabel: 'Category', ruleTypeLabel: 'Rule type', phrasesToMatchLabel: 'Phrases to match (comma-separated)', phrasesPlaceholder: 'e.g. guaranteed, best in class', phraseMatchHelper: 'Literal phrase checks run against future submissions.', approvedSpellingLabel: 'Approved spelling or phrase', severityLabel: 'Severity', critical: 'Critical', moderate: 'Moderate', minor: 'Minor', guidelineRationaleLabel: 'Guideline and rationale', cancel: 'Cancel', saveGuideline: 'Save guideline',
    evidenceEditTitle: 'Edit evidence record', evidenceAddTitle: 'Add evidence record', evidenceSubtitle: 'New or changed evidence is unverified until a reviewer attests to its source and scope.', evidenceTitleLabel: 'Evidence title', sourceNameLabel: 'Source or publisher name', sourceUrlLabel: 'Source URL (optional)', specificClaimLabel: 'Specific claim supported', evidenceMatchHelper: 'Analysis will only match evidence when its claim appears in the nearby content.', relatedGuidelineLabel: 'Related guideline', generalEvidence: 'General evidence', sourceNotesLabel: 'Source notes and scope', verificationStatusLabel: 'Verification status', verified: 'Verified', lastReviewedLabel: 'Last reviewed', reviewDueLabel: 'Review due', sourceVerificationNotice: 'Mark verified only after checking the source itself. A URL or imported description alone does not establish a claim.', saveEvidence: 'Save evidence', notRecorded: 'Not recorded',
    typeGuidance: 'Guidance', typeProhibited: 'Prohibited terminology', typeApproved: 'Approved terminology', typeEvidence: 'Claim requires evidence', catVoice: 'Brand voice and tone', catTerminology: 'Approved and prohibited terminology', catMessaging: 'Messaging principles', catClaims: 'Approved factual claims and promotional statements', catAccessibility: 'Accessibility guidelines', catVisual: 'Visual identity guidance', catGeneral: 'General brand rules', freshnessExpired: 'Expired', freshnessDue: 'Review due',
    adminRequired: 'Workspace-admin access is required to manage guidelines and evidence.', workspaceLoadFailed: 'Workspace data could not be loaded.', guidelineTitleDescriptionRequired: 'Add a title and explanatory guideline text.', phraseRequired: 'This rule type needs at least one phrase or term to check.', approvedPhraseRequired: 'Enter the approved spelling or phrase for this terminology rule.', guidelineSaveFailed: 'The guideline could not be saved.', guidelineStatusFailed: 'The guideline status could not be changed.', guidelineDeleteFailed: 'The guideline could not be deleted.', evidenceRequiredFields: 'Add a title, source name, and the specific claim this evidence supports.', urlInvalid: 'Enter a valid HTTP or HTTPS source URL, or leave it blank.', verifiedDatesRequired: 'Verified evidence requires both a review date and a next review due date.', reviewDateFuture: 'The evidence review date cannot be in the future.', nextReviewDateFuture: 'Verified evidence must be reviewed again on a future date before it can support analysis.', dateOrderInvalid: 'The next review date cannot precede the last review date.', evidenceSaveFailed: 'The evidence record could not be saved.', evidenceDeleteFailed: 'The evidence record could not be deleted.',
    saved: 'saved.', added: 'added.', pausedAndSaved: 'paused and saved.', activatedAndSaved: 'activated and saved.', guidelineDeletePrompt: 'Delete', guidelineDeleteRemainder: 'Existing review findings retain their historical rule snapshot.', evidenceDeletePrompt: 'Delete evidence record', evidenceDeleteRemainder: 'Historical review snapshots will remain intact.', evidenceRemovedPrefix: 'removed from the active catalogue. Existing findings retain its evidence snapshot.'
  },
  hi: {
    pageKicker: 'गवर्नेंस निर्देश', pageTitle: 'दिशानिर्देश और साक्ष्य', pageDescription: 'आगामी स्थानीय विश्लेषणों में उपयोग होने वाले नियमों और स्रोत रिकॉर्ड को बनाए रखें। बदलाव पुराने निष्कर्षों को नहीं बदलते।', add: 'जोड़ें', guideline: 'दिशानिर्देश', evidence: 'साक्ष्य',
    directoryAria: 'कार्यस्थान गवर्नेंस निर्देशिकाएँ', guidelinesTab: 'दिशानिर्देश', evidenceTab: 'साक्ष्य', filterGuidelineCategory: 'श्रेणी के अनुसार दिशानिर्देश फ़िल्टर करें', filterEvidenceStatus: 'सत्यापन स्थिति के अनुसार साक्ष्य फ़िल्टर करें', allCategories: 'सभी श्रेणियाँ', allVerificationStates: 'सभी सत्यापन स्थितियाँ', verifiedCurrent: 'सत्यापित और वर्तमान', unverified: 'असत्यापित', expiredOrDueReview: 'समाप्त या समीक्षा लंबित',
    searchGuidelinesPlaceholder: 'नियम, वाक्यांश या मार्गदर्शन खोजें…', searchEvidencePlaceholder: 'साक्ष्य, दावे, स्रोत खोजें…', searchDirectory: 'इस निर्देशिका में खोजें', filterActiveState: 'सक्रिय स्थिति के अनुसार दिशानिर्देश फ़िल्टर करें', allRuleStates: 'नियम की सभी स्थितियाँ', activeInAnalysis: 'विश्लेषण में सक्रिय', paused: 'रोका गया', active: 'सक्रिय',
    guidelineDirectory: 'दिशानिर्देश निर्देशिका', noMatchingGuidelines: 'कोई मेल खाते दिशानिर्देश नहीं', guidelineNoMatchDescription: 'दूसरी खोज या श्रेणी आज़माएँ, या भविष्य के विश्लेषणों के लिए स्थानीय दिशानिर्देश जोड़ें।', addGuidelineAction: 'दिशानिर्देश जोड़ें', clearFilters: 'फ़िल्टर साफ़ करें', edit: 'संपादित करें', pause: 'रोकें', activate: 'सक्रिय करें', deleteGuideline: 'दिशानिर्देश हटाएँ', checkedPhrases: 'जाँचे गए वाक्यांश:', approvedWording: 'स्वीकृत शब्दावली:',
    evidenceRulesNotice: 'साक्ष्य तभी उपयोग योग्य है जब वह सत्यापित, समीक्षित, वर्तमान और संबंधित दावे से जुड़ा हो। उपयोगकर्ता द्वारा जोड़े गए URL पर अपने-आप भरोसा नहीं किया जाता।', evidenceCatalogue: 'साक्ष्य सूची', noMatchingEvidence: 'कोई मेल खाते साक्ष्य रिकॉर्ड नहीं', evidenceNoMatchDescription: 'समर्थित दावे को दर्ज करने के लिए स्रोत रिकॉर्ड जोड़ें। नई प्रविष्टियाँ असत्यापित रहती हैं।', addEvidenceAction: 'साक्ष्य जोड़ें', claim: 'दावा:', noAdditionalSourceNotes: 'स्रोत की अतिरिक्त टिप्पणियाँ नहीं।', source: 'स्रोत:', lastReviewed: 'अंतिम समीक्षा:', reviewDue: 'समीक्षा की अंतिम तिथि:', verifyRecord: 'रिकॉर्ड सत्यापित करें…', markUnverified: 'असत्यापित चिह्नित करें', deleteEvidence: 'साक्ष्य हटाएँ',
    guidelineEditTitle: 'दिशानिर्देश संपादित करें', guidelineAddTitle: 'दिशानिर्देश जोड़ें', activeRulesSubtitle: 'सक्रिय नियमों का मूल्यांकन भविष्य के नियतात्मक स्थानीय विश्लेषणों में होगा।', guidelineTitleLabel: 'दिशानिर्देश का शीर्षक', categoryLabel: 'श्रेणी', ruleTypeLabel: 'नियम का प्रकार', phrasesToMatchLabel: 'मिलान के वाक्यांश (अल्पविराम से अलग करें)', phrasesPlaceholder: 'जैसे: गारंटीशुदा, अपनी श्रेणी में सर्वश्रेष्ठ', phraseMatchHelper: 'शाब्दिक वाक्यांशों की जाँच भविष्य में भेजी गई सामग्री पर होगी।', approvedSpellingLabel: 'स्वीकृत वर्तनी या वाक्यांश', severityLabel: 'गंभीरता', critical: 'अत्यंत गंभीर', moderate: 'मध्यम', minor: 'कम', guidelineRationaleLabel: 'दिशानिर्देश और कारण', cancel: 'रद्द करें', saveGuideline: 'दिशानिर्देश सहेजें',
    evidenceEditTitle: 'साक्ष्य रिकॉर्ड संपादित करें', evidenceAddTitle: 'साक्ष्य रिकॉर्ड जोड़ें', evidenceSubtitle: 'नया या बदला हुआ साक्ष्य तब तक असत्यापित रहता है जब तक समीक्षक उसके स्रोत और दायरे की पुष्टि न करे।', evidenceTitleLabel: 'साक्ष्य का शीर्षक', sourceNameLabel: 'स्रोत या प्रकाशक का नाम', sourceUrlLabel: 'स्रोत URL (वैकल्पिक)', specificClaimLabel: 'समर्थित विशिष्ट दावा', evidenceMatchHelper: 'विश्लेषण साक्ष्य का मिलान तभी करेगा जब संबंधित सामग्री के पास उसका दावा मौजूद हो।', relatedGuidelineLabel: 'संबंधित दिशानिर्देश', generalEvidence: 'सामान्य साक्ष्य', sourceNotesLabel: 'स्रोत टिप्पणियाँ और दायरा', verificationStatusLabel: 'सत्यापन स्थिति', verified: 'सत्यापित', lastReviewedLabel: 'अंतिम समीक्षा', reviewDueLabel: 'समीक्षा की अंतिम तिथि', sourceVerificationNotice: 'स्रोत को स्वयं जाँचने के बाद ही सत्यापित चिह्नित करें। केवल URL या आयातित विवरण किसी दावे को सिद्ध नहीं करता।', saveEvidence: 'साक्ष्य सहेजें', notRecorded: 'दर्ज नहीं',
    typeGuidance: 'मार्गदर्शन', typeProhibited: 'निषिद्ध शब्दावली', typeApproved: 'स्वीकृत शब्दावली', typeEvidence: 'दावे के लिए साक्ष्य आवश्यक', catVoice: 'ब्रांड की आवाज़ और लहजा', catTerminology: 'स्वीकृत और निषिद्ध शब्दावली', catMessaging: 'संदेश सिद्धांत', catClaims: 'स्वीकृत तथ्यात्मक दावे और प्रचार कथन', catAccessibility: 'सुलभता दिशानिर्देश', catVisual: 'दृश्य पहचान मार्गदर्शन', catGeneral: 'सामान्य ब्रांड नियम', freshnessExpired: 'समाप्त', freshnessDue: 'समीक्षा लंबित',
    adminRequired: 'दिशानिर्देश और साक्ष्य प्रबंधित करने के लिए कार्यस्थान प्रशासक की अनुमति आवश्यक है।', workspaceLoadFailed: 'कार्यस्थान डेटा लोड नहीं हो सका।', guidelineTitleDescriptionRequired: 'शीर्षक और दिशानिर्देश का विवरण जोड़ें।', phraseRequired: 'इस नियम प्रकार के लिए कम से कम एक जाँचने योग्य वाक्यांश या शब्द आवश्यक है।', approvedPhraseRequired: 'इस शब्दावली नियम के लिए स्वीकृत वर्तनी या वाक्यांश दर्ज करें।', guidelineSaveFailed: 'दिशानिर्देश सहेजा नहीं जा सका।', guidelineStatusFailed: 'दिशानिर्देश की स्थिति बदली नहीं जा सकी।', guidelineDeleteFailed: 'दिशानिर्देश हटाया नहीं जा सका।', evidenceRequiredFields: 'शीर्षक, स्रोत का नाम और वह विशिष्ट दावा जोड़ें जिसे यह साक्ष्य समर्थन देता है।', urlInvalid: 'मान्य HTTP या HTTPS स्रोत URL दर्ज करें या इसे खाली छोड़ दें।', verifiedDatesRequired: 'सत्यापित साक्ष्य के लिए समीक्षा की तारीख और अगली समीक्षा की तारीख दोनों आवश्यक हैं।', reviewDateFuture: 'साक्ष्य की समीक्षा की तारीख भविष्य में नहीं हो सकती।', nextReviewDateFuture: 'विश्लेषण में उपयोग से पहले सत्यापित साक्ष्य की अगली समीक्षा भविष्य की तारीख पर होनी चाहिए।', dateOrderInvalid: 'अगली समीक्षा की तारीख पिछली समीक्षा से पहले नहीं हो सकती।', evidenceSaveFailed: 'साक्ष्य रिकॉर्ड सहेजा नहीं जा सका।', evidenceDeleteFailed: 'साक्ष्य रिकॉर्ड हटाया नहीं जा सका।',
    saved: 'सहेजा गया।', added: 'जोड़ा गया।', pausedAndSaved: 'रोक दिया गया और सहेजा गया।', activatedAndSaved: 'सक्रिय किया गया और सहेजा गया।', guidelineDeletePrompt: 'हटाएँ', guidelineDeleteRemainder: 'मौजूदा समीक्षा निष्कर्षों में ऐतिहासिक नियम स्नैपशॉट सुरक्षित रहेगा।', evidenceDeletePrompt: 'साक्ष्य रिकॉर्ड हटाएँ', evidenceDeleteRemainder: 'ऐतिहासिक समीक्षा स्नैपशॉट सुरक्षित रहेंगे।', evidenceRemovedPrefix: 'सक्रिय सूची से हटाया गया। मौजूदा निष्कर्षों में उसका साक्ष्य स्नैपशॉट सुरक्षित है।'
  },
  gu: {
    pageKicker: 'ગવર્નન્સ સૂચનાઓ', pageTitle: 'માર્ગદર્શિકા અને પુરાવા', pageDescription: 'આગામી સ્થાનિક વિશ્લેષણો માટેના નિયમો અને સ્રોત રેકોર્ડ જાળવો. ફેરફારો અગાઉના તારણોને ફરીથી લખતા નથી.', add: 'ઉમેરો', guideline: 'માર્ગદર્શિકા', evidence: 'પુરાવા',
    directoryAria: 'કાર્યસ્થળની ગવર્નન્સ ડિરેક્ટરીઓ', guidelinesTab: 'માર્ગદર્શિકા', evidenceTab: 'પુરાવા', filterGuidelineCategory: 'શ્રેણી પ્રમાણે માર્ગદર્શિકા ફિલ્ટર કરો', filterEvidenceStatus: 'ચકાસણી સ્થિતિ પ્રમાણે પુરાવા ફિલ્ટર કરો', allCategories: 'બધી શ્રેણીઓ', allVerificationStates: 'બધી ચકાસણી સ્થિતિઓ', verifiedCurrent: 'ચકાસેલ અને વર્તમાન', unverified: 'અચકાસેલ', expiredOrDueReview: 'સમાપ્ત અથવા સમીક્ષા બાકી',
    searchGuidelinesPlaceholder: 'નિયમો, શબ્દસમૂહો અથવા માર્ગદર્શન શોધો…', searchEvidencePlaceholder: 'પુરાવા, દાવા, સ્રોતો શોધો…', searchDirectory: 'આ ડિરેક્ટરીમાં શોધો', filterActiveState: 'સક્રિય સ્થિતિ પ્રમાણે માર્ગદર્શિકા ફિલ્ટર કરો', allRuleStates: 'નિયમની બધી સ્થિતિઓ', activeInAnalysis: 'વિશ્લેષણમાં સક્રિય', paused: 'થોભાવેલ', active: 'સક્રિય',
    guidelineDirectory: 'માર્ગદર્શિકા ડિરેક્ટરી', noMatchingGuidelines: 'મેળ ખાતી માર્ગદર્શિકા નથી', guidelineNoMatchDescription: 'બીજી શોધ અથવા શ્રેણી અજમાવો, અથવા ભાવિ વિશ્લેષણ માટે સ્થાનિક માર્ગદર્શિકા ઉમેરો.', addGuidelineAction: 'માર્ગદર્શિકા ઉમેરો', clearFilters: 'ફિલ્ટર સાફ કરો', edit: 'સંપાદિત કરો', pause: 'થોભાવો', activate: 'સક્રિય કરો', deleteGuideline: 'માર્ગદર્શિકા કાઢી નાખો', checkedPhrases: 'ચકાસેલા શબ્દસમૂહો:', approvedWording: 'મંજૂર શબ્દરચના:',
    evidenceRulesNotice: 'પુરાવા ત્યારે જ ઉપયોગી છે જ્યારે તે ચકાસેલ, સમીક્ષિત, વર્તમાન અને સંબંધિત દાવા સાથે જોડાયેલ હોય. વપરાશકર્તા દ્વારા ઉમેરાયેલા URL પર આપમેળે વિશ્વાસ થતો નથી.', evidenceCatalogue: 'પુરાવા સૂચિ', noMatchingEvidence: 'મેળ ખાતા પુરાવા રેકોર્ડ નથી', evidenceNoMatchDescription: 'જે દાવાને સમર્થન મળે છે તે નોંધવા માટે સ્રોત રેકોર્ડ ઉમેરો. નવી નોંધો શરૂઆતમાં અચકાસેલ હોય છે.', addEvidenceAction: 'પુરાવા ઉમેરો', claim: 'દાવો:', noAdditionalSourceNotes: 'સ્રોતની વધારાની નોંધ નથી.', source: 'સ્રોત:', lastReviewed: 'છેલ્લી સમીક્ષા:', reviewDue: 'સમીક્ષા બાકી તારીખ:', verifyRecord: 'રેકોર્ડ ચકાસો…', markUnverified: 'અચકાસેલ તરીકે ચિહ્નિત કરો', deleteEvidence: 'પુરાવા કાઢી નાખો',
    guidelineEditTitle: 'માર્ગદર્શિકા સંપાદિત કરો', guidelineAddTitle: 'માર્ગદર્શિકા ઉમેરો', activeRulesSubtitle: 'સક્રિય નિયમોનું મૂલ્યાંકન ભાવિ નિશ્ચિત સ્થાનિક વિશ્લેષણોમાં થશે.', guidelineTitleLabel: 'માર્ગદર્શિકાનું શીર્ષક', categoryLabel: 'શ્રેણી', ruleTypeLabel: 'નિયમનો પ્રકાર', phrasesToMatchLabel: 'મેળ ખાતા શબ્દસમૂહો (અલ્પવિરામથી અલગ કરો)', phrasesPlaceholder: 'દા.ત. ખાતરીપૂર્વક, વર્ગમાં શ્રેષ્ઠ', phraseMatchHelper: 'શાબ્દિક શબ્દસમૂહોની તપાસ ભાવિ સબમિશન પર થશે.', approvedSpellingLabel: 'મંજૂર જોડણી અથવા શબ્દસમૂહ', severityLabel: 'ગંભીરતા', critical: 'ગંભીર', moderate: 'મધ્યમ', minor: 'ઓછી', guidelineRationaleLabel: 'માર્ગદર્શિકા અને કારણ', cancel: 'રદ કરો', saveGuideline: 'માર્ગદર્શિકા સાચવો',
    evidenceEditTitle: 'પુરાવા રેકોર્ડ સંપાદિત કરો', evidenceAddTitle: 'પુરાવા રેકોર્ડ ઉમેરો', evidenceSubtitle: 'નવા અથવા બદલાયેલા પુરાવા સમીક્ષક તેના સ્રોત અને વ્યાપની ખાતરી ન કરે ત્યાં સુધી અચકાસેલ રહે છે.', evidenceTitleLabel: 'પુરાવાનું શીર્ષક', sourceNameLabel: 'સ્રોત અથવા પ્રકાશકનું નામ', sourceUrlLabel: 'સ્રોત URL (વૈકલ્પિક)', specificClaimLabel: 'સમર્થિત ચોક્કસ દાવો', evidenceMatchHelper: 'વિશ્લેષણ પુરાવાને ત્યારે જ મેળ કરશે જ્યારે તેની સાથેનો દાવો નજીકની સામગ્રીમાં દેખાય.', relatedGuidelineLabel: 'સંબંધિત માર્ગદર્શિકા', generalEvidence: 'સામાન્ય પુરાવા', sourceNotesLabel: 'સ્રોત નોંધો અને વ્યાપ', verificationStatusLabel: 'ચકાસણી સ્થિતિ', verified: 'ચકાસેલ', lastReviewedLabel: 'છેલ્લી સમીક્ષા', reviewDueLabel: 'સમીક્ષા બાકી તારીખ', sourceVerificationNotice: 'સ્રોત જાતે તપાસ્યા પછી જ ચકાસેલ તરીકે ચિહ્નિત કરો. માત્ર URL અથવા આયાત કરેલું વર્ણન દાવાને સાબિત કરતું નથી.', saveEvidence: 'પુરાવા સાચવો', notRecorded: 'નોંધાયેલ નથી',
    typeGuidance: 'માર્ગદર્શન', typeProhibited: 'પ્રતિબંધિત શબ્દાવલી', typeApproved: 'મંજૂર શબ્દાવલી', typeEvidence: 'દાવા માટે પુરાવો જરૂરી', catVoice: 'બ્રાન્ડનો અવાજ અને સ્વર', catTerminology: 'મંજૂર અને પ્રતિબંધિત શબ્દાવલી', catMessaging: 'સંદેશના સિદ્ધાંતો', catClaims: 'મંજૂર તથ્યાત્મક દાવા અને પ્રચાર નિવેદનો', catAccessibility: 'સુલભતા માર્ગદર્શિકા', catVisual: 'દૃશ્ય ઓળખ માર્ગદર્શન', catGeneral: 'સામાન્ય બ્રાન્ડ નિયમો', freshnessExpired: 'સમાપ્ત', freshnessDue: 'સમીક્ષા બાકી',
    adminRequired: 'માર્ગદર્શિકા અને પુરાવા સંચાલિત કરવા માટે કાર્યસ્થળ એડમિનની મંજૂરી જરૂરી છે.', workspaceLoadFailed: 'કાર્યસ્થળનો ડેટા લોડ થઈ શક્યો નથી.', guidelineTitleDescriptionRequired: 'શીર્ષક અને સમજાવટવાળી માર્ગદર્શિકા ઉમેરો.', phraseRequired: 'આ નિયમના પ્રકાર માટે ઓછામાં ઓછો એક શબ્દસમૂહ અથવા શબ્દ તપાસવા જરૂરી છે.', approvedPhraseRequired: 'આ શબ્દાવલી નિયમ માટે મંજૂર જોડણી અથવા શબ્દસમૂહ દાખલ કરો.', guidelineSaveFailed: 'માર્ગદર્શિકા સાચવી શકાઈ નથી.', guidelineStatusFailed: 'માર્ગદર્શિકાની સ્થિતિ બદલી શકાઈ નથી.', guidelineDeleteFailed: 'માર્ગદર્શિકા કાઢી શકાઈ નથી.', evidenceRequiredFields: 'શીર્ષક, સ્રોતનું નામ અને આ પુરાવો જે ચોક્કસ દાવાને સમર્થન આપે છે તે ઉમેરો.', urlInvalid: 'માન્ય HTTP અથવા HTTPS સ્રોત URL દાખલ કરો, અથવા ખાલી રાખો.', verifiedDatesRequired: 'ચકાસેલા પુરાવા માટે સમીક્ષાની તારીખ અને આગામી સમીક્ષા તારીખ બંને જરૂરી છે.', reviewDateFuture: 'પુરાવાની સમીક્ષા તારીખ ભવિષ્યમાં હોઈ શકતી નથી.', nextReviewDateFuture: 'વિશ્લેષણમાં ઉપયોગ કરતા પહેલાં ચકાસેલા પુરાવાની આગામી સમીક્ષા ભવિષ્યની તારીખે હોવી જોઈએ.', dateOrderInvalid: 'આગામી સમીક્ષા તારીખ છેલ્લી સમીક્ષા તારીખ પહેલાં ન હોવી જોઈએ.', evidenceSaveFailed: 'પુરાવા રેકોર્ડ સાચવી શકાયો નથી.', evidenceDeleteFailed: 'પુરાવા રેકોર્ડ કાઢી શકાયો નથી.',
    saved: 'સાચવાયું.', added: 'ઉમેરાયું.', pausedAndSaved: 'થોભાવાયું અને સાચવાયું.', activatedAndSaved: 'સક્રિય કરીને સાચવાયું.', guidelineDeletePrompt: 'કાઢી નાખો', guidelineDeleteRemainder: 'હાલના સમીક્ષા તારણોમાં ઐતિહાસિક નિયમ સ્નેપશોટ જળવાશે.', evidenceDeletePrompt: 'પુરાવા રેકોર્ડ કાઢી નાખો', evidenceDeleteRemainder: 'ઐતિહાસિક સમીક્ષા સ્નેપશોટ અખંડ રહેશે.', evidenceRemovedPrefix: 'સક્રિય સૂચિમાંથી દૂર થયું. હાલના તારણોમાં તેનો પુરાવા સ્નેપશોટ જળવાયો છે.'
  }
} as const;

// Built-in guideline display translations (display-only; IDs, phrases, analysis logic are never changed).
// Keys are the English default titles/descriptions from workspaceStorage DEFAULT_GUIDELINES.
// A translated value is applied only when the stored field still matches the English default.
const BUILTIN_GUIDELINE_DISPLAY: Record<
  string,
  { hi: { title: string; description: string }; gu: { title: string; description: string } }
> = {
  'R-101': {
    hi: {
      title: 'अतिश्योक्तिपूर्ण दावों को साक्ष्य से पुष्ट करें',
      description: 'तुलनात्मक या पूर्ण प्रशंसा के लिए किसी नामित, अनुमोदित स्रोत या ठोस क्षमता का उल्लेख आवश्यक है।',
    },
    gu: {
      title: 'ઉત્કૃષ્ટ દાવાઓ પુરાવા સાથે ટેકવો',
      description: 'સરખામણીત્મક અથવા ઉચ્ચ પ્રશંસા માટે નામ-ઉલ્લેખ સ્ત્રોત અથવા ચોક્કસ ક્ષમતા જરૂરી છે.',
    },
  },
  'R-102': {
    hi: {
      title: 'स्वीकृत BrandLens AI वर्डमार्क का उपयोग करें',
      description: 'उत्पाद का सटीक अनुमोदित नाम "BrandLens AI" उपयोग करें।',
    },
    gu: {
      title: 'મંજૂર BrandLens AI વર્ડમાર્ક વાપરો',
      description: 'ઉત્પાદનનું ચોક્કસ મંજૂર નામ "BrandLens AI" વાપરો.',
    },
  },
  'R-103': {
    hi: {
      title: 'गारंटी और मात्रात्मक दावों को योग्यता दें',
      description: 'गारंटी और प्रतिशत परिणामों के लिए लागू अनुमोदित साक्ष्य आवश्यक है। अनुपलब्ध साक्ष्य असत्यापित माना जाएगा।',
    },
    gu: {
      title: 'ગેરંટી અને સંખ્યાત્મક દાવાઓ સ્પષ્ટ કરો',
      description: 'ગેરંટી અને ટકાવારી પરિણામો માટે લાગુ મંજૂર પુરાવો જરૂરી છે. ગુમ પુરાવો અચકાસેલ ગણાય છે.',
    },
  },
  'R-104': {
    hi: {
      title: 'अस्वीकृत कॉर्पोरेट जार्गन से बचें',
      description: 'यहाँ सूचीबद्ध अस्वीकृत शब्दों की जगह सीधी संपादकीय भाषा को प्राथमिकता दें।',
    },
    gu: {
      title: 'અસ્વીકૃત કોર્પોરેટ શબ્દજાળ ટાળો',
      description: 'અહીં સૂચિબદ્ધ અસ્વીકૃત શબ્દોની જગ્યાએ સ્પષ્ટ સંપાદકીય ભાષા પ્રાધાન્ય આપો.',
    },
  },
  'R-105': {
    hi: {
      title: 'समय-संवेदनशील वक्तव्यों को सत्यापित करें',
      description: 'वर्तमान, नवीनतम या दिनांकित वक्तव्यों के लिए समीक्षा तिथि सहित लागू स्रोत आवश्यक है।',
    },
    gu: {
      title: 'સમય-સંવેદનશીલ નિવેદનો ચકાસો',
      description: 'વર્તમાન, સૌથી નવીન અથવા તારીખ-સ્ટેમ્પ ધરાવતા નિવેદનો માટે સમીક્ષા તારીખ સહ લાગુ સ્ત્રોત જરૂરી છે.',
    },
  },
  'R-106': {
    hi: {
      title: 'स्पष्ट और सुलभ कार्रवाई-आह्वान का उपयोग करें',
      description: 'लिंक लेबल उनके गंतव्य का वर्णन करना चाहिए; विस्तारित ऑल-कैप्स टेक्स्ट पठनीयता कम कर सकता है।',
    },
    gu: {
      title: 'સ્પષ્ટ, સુલભ ક્રિયા-સૂચનો (CTAs) વાપરો',
      description: 'લિંક લેબલ્સ તેમના ગંતવ્યનું વર્ણન કરવા જોઈએ; લાંબો ઓલ-કૅપ્સ ટેક્સ્ટ વાંચવાની ક્ષમતા ઘટાડી શકે છે.',
    },
  },
  'R-107': {
    hi: {
      title: 'संपादकीय रंग पैलेट सुरक्षित रखें',
      description: 'दृश्य सामग्री को वार्म आइवरी और ऑब्सीडियन पैलेट का सम्मान करना चाहिए, कॉपर और फ़ॉरेस्ट एक्सेंट का संयमित उपयोग करें।',
    },
    gu: {
      title: 'સંપાદકીય રંગ પૅલેટ જાળવો',
      description: 'દૃશ્ય સામગ્રી Warm Ivory અને Obsidian પૅલેટ સ્વીકારે, copper અને forest accents સંયત રીતે ઉપયોગ કરે.',
    },
  },
  'R-108': {
    hi: {
      title: 'स्पष्ट, मानव-केंद्रित संदेश से शुरुआत करें',
      description: 'लाभ को सरल भाषा में समझाएं और अंतिम प्रकाशन निर्णयों के लिए मानवीय जवाबदेही बनाए रखें।',
    },
    gu: {
      title: 'સ્પષ્ટ, માનવ-કેન્દ્રિત સંદેશ આગળ રાખો',
      description: 'ફાયદો સાદી ભાષામાં સમજાવો અને અંતિમ પ્રકાશન નિર્ણયો માટે માનવ જવાબદારી જાળવો.',
    },
  },
  'R-109': {
    hi: {
      title: 'सामान्य ब्रांड गवर्नेंस का पालन करें',
      description: 'सामग्री सटीक, श्रेय-योग्य और मानव सत्यापन गेट के अधीन होनी चाहिए।',
    },
    gu: {
      title: 'સામાન્ય બ્રાન્ડ ગવર્નન્સ અનુસરો',
      description: 'સામગ્રી સચોટ, ઓળખ-ક્ષમ અને માનવ ચકાસણી ગેટ હેઠળ હોવી જોઈએ.',
    },
  },
};

// English default titles/descriptions for built-in guidelines (must match workspaceStorage exactly).
const BUILTIN_EN_TITLES: Record<string, string> = {
  'R-101': 'Support superlatives with evidence',
  'R-102': 'Use the approved BrandLens AI wordmark',
  'R-103': 'Qualify guarantees and quantified claims',
  'R-104': 'Avoid disallowed corporate jargon',
  'R-105': 'Verify time-sensitive statements',
  'R-106': 'Use clear, accessible calls to action',
  'R-107': 'Protect the editorial color palette',
  'R-108': 'Lead with clear, human-centered messaging',
  'R-109': 'Follow general brand governance',
};
const BUILTIN_EN_DESCRIPTIONS: Record<string, string> = {
  'R-101': 'Comparative or absolute praise needs a named, approved source or a concrete capability.',
  'R-102': 'Use the exact approved product name "BrandLens AI".',
  'R-103': 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.',
  'R-104': 'Prefer direct editorial language to the disallowed terms listed here.',
  'R-105': 'Current, latest, or dated statements need an applicable source with a review date.',
  'R-106': 'Link labels should describe their destination; extended all-caps text can reduce readability.',
  'R-107': 'Visual materials should respect the Warm Ivory and Obsidian palette with restrained copper and forest accents.',
  'R-108': 'Explain the benefit plainly and retain human accountability for final publication decisions.',
  'R-109': 'Content must remain accurate, attributable, and subject to the human verification gate.',
};

/**
 * Returns display title/description for a guideline in the active language.
 * Falls back to stored values when: language is English, the guideline is not built-in,
 * or the stored value has been user-edited (no longer matches the English default).
 */
const localizeGuideline = (
  rule: GuidelineRecord,
  lang: 'en' | 'hi' | 'gu',
): { title: string; description: string } => {
  if (lang === 'en') return { title: rule.title, description: rule.description };
  const override = BUILTIN_GUIDELINE_DISPLAY[rule.id]?.[lang];
  if (!override) return { title: rule.title, description: rule.description };
  const title =
    rule.title === BUILTIN_EN_TITLES[rule.id] ? override.title : rule.title;
  const description =
    rule.description === BUILTIN_EN_DESCRIPTIONS[rule.id]
      ? override.description
      : rule.description;
  return { title, description };
};

type GuidelinesUiKey = keyof typeof GUIDELINES_UI.en;
const RULE_TYPE_KEYS: Record<GuidelineRuleType, GuidelinesUiKey> = {
  guidance: 'typeGuidance',
  prohibited_term: 'typeProhibited',
  approved_terminology: 'typeApproved',
  claim_evidence: 'typeEvidence',
};
const CATEGORY_KEYS: Record<GuidelineCategory, GuidelinesUiKey> = {
  'Brand voice and tone': 'catVoice',
  'Approved and prohibited terminology': 'catTerminology',
  'Messaging principles': 'catMessaging',
  'Approved factual claims and promotional statements': 'catClaims',
  'Accessibility guidelines': 'catAccessibility',
  'Visual identity guidance': 'catVisual',
  'General brand rules': 'catGeneral',
};

interface GuidelineFormState {
  title: string;
  category: GuidelineCategory;
  ruleType: GuidelineRuleType;
  phrases: string;
  approvedPhrase: string;
  severity: GuidelineRecord['severity'];
  description: string;
}

interface EvidenceFormState {
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  associatedClaim: string;
  guidelineId: string;
  verificationStatus: EvidenceRecord['verificationStatus'];
  lastReviewedAt: string;
  reviewDueAt: string;
}

const EMPTY_GUIDELINE: GuidelineFormState = {
  title: '',
  category: 'General brand rules',
  ruleType: 'guidance',
  phrases: '',
  approvedPhrase: '',
  severity: 'moderate',
  description: '',
};

const EMPTY_EVIDENCE: EvidenceFormState = {
  title: '',
  description: '',
  sourceName: '',
  sourceUrl: '',
  associatedClaim: '',
  guidelineId: '',
  verificationStatus: 'unverified',
  lastReviewedAt: '',
  reviewDueAt: '',
};

const formatDate = (value: string, language: 'en' | 'hi' | 'gu', notRecorded: string): string => {
  if (!value) return notRecorded;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
  return date.toLocaleDateString(locale);
};

export const GuidelinesPage: React.FC = () => {
  const auth = useAuth();
  const { language } = useLanguage();
  const t = (key: GuidelinesUiKey): string => GUIDELINES_UI[language][key];
  const canManageWorkspace = auth.role === 'workspace_admin';
  const [searchParams] = useSearchParams();
  const [guidelines, setGuidelines] = useState<GuidelineRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<DirectoryTab>(
    searchParams.get('tab') === 'evidence' ? 'evidence' : 'guidelines',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<GuidelineCategory | 'all'>('all');
  const [ruleStatus, setRuleStatus] = useState<RuleStatusFilter>('all');
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatusFilter>('all');
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<GuidelineRecord | null>(null);
  const [guidelineForm, setGuidelineForm] = useState<GuidelineFormState>(EMPTY_GUIDELINE);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<EvidenceRecord | null>(null);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>(EMPTY_EVIDENCE);
  const [storageError, setStorageError] = useState('');
  const [formError, setFormError] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');

  const refreshData = () => {
    try {
      setGuidelines(readGuidelines());
      setEvidence(readEvidenceRecords());
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : t('workspaceLoadFailed'));
    }
  };

  useEffect(() => {
    refreshData();
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshData);
    return () => window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshData);
  }, []);

  const filteredGuidelines = useMemo(() => guidelines.filter((rule) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesCategory = categoryFilter === 'all' || rule.category === categoryFilter;
    const matchesStatus = ruleStatus === 'all' || (ruleStatus === 'active' ? rule.isActive : !rule.isActive);
    const matchesQuery = !query || [
      rule.id, rule.title, rule.description, rule.category, rule.approvedPhrase, ...rule.phrases,
    ].some((value) => value.toLowerCase().includes(query));
    return matchesCategory && matchesStatus && matchesQuery;
  }), [categoryFilter, guidelines, ruleStatus, searchQuery]);

  const filteredEvidence = useMemo(() => evidence.filter((item) => {
    const freshness = getEvidenceFreshness(item);
    const matchesStatus = evidenceStatus === 'all'
      || (evidenceStatus === 'verified' && freshness === 'verified')
      || (evidenceStatus === 'unverified' && freshness === 'unverified')
      || (evidenceStatus === 'expired' && (freshness === 'expired' || freshness === 'due'));
    const query = searchQuery.trim().toLowerCase();
    const guideline = guidelines.find((rule) => rule.id === item.guidelineId);
    const matchesQuery = !query || [
      item.id, item.title, item.description, item.sourceName, item.associatedClaim, item.guidelineId,
      guideline?.title ?? '',
    ].some((value) => value.toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  }), [evidence, evidenceStatus, guidelines, searchQuery]);

  const openGuideline = (rule?: GuidelineRecord) => {
    if (!canManageWorkspace) return;
    setEditingGuideline(rule ?? null);
    setGuidelineForm(rule ? {
      title: rule.title,
      category: rule.category,
      ruleType: rule.ruleType,
      phrases: rule.phrases.join(', '),
      approvedPhrase: rule.approvedPhrase,
      severity: rule.severity,
      description: rule.description,
    } : EMPTY_GUIDELINE);
    setFormError('');
    setActionFeedback('');
    setIsGuidelineModalOpen(true);
  };

  const saveGuideline = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageWorkspace) {
      setFormError(t('adminRequired'));
      return;
    }
    if (!guidelineForm.title.trim() || !guidelineForm.description.trim()) {
      setFormError(t('guidelineTitleDescriptionRequired'));
      return;
    }
    const phrases = guidelineForm.phrases.split(',').map((phrase) => phrase.trim()).filter(Boolean);
    if (guidelineForm.ruleType !== 'guidance' && phrases.length === 0) {
      setFormError(t('phraseRequired'));
      return;
    }
    if (guidelineForm.ruleType === 'approved_terminology' && !guidelineForm.approvedPhrase.trim()) {
      setFormError(t('approvedPhraseRequired'));
      return;
    }
    try {
      const input = {
        ...guidelineForm,
        title: guidelineForm.title.trim(),
        description: guidelineForm.description.trim(),
        phrases,
        approvedPhrase: guidelineForm.approvedPhrase.trim(),
      };
      if (editingGuideline) {
        await cloudUpdateGuideline(editingGuideline.id, input);
        setActionFeedback(`${t('guideline')} “${input.title}” ${t('saved')}`);
      } else {
        await cloudCreateGuideline({ ...input, isActive: true });
        setActionFeedback(`${t('guideline')} “${input.title}” ${t('added')}`);
      }
      setStorageError('');
      setIsGuidelineModalOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('guidelineSaveFailed'));
    }
  };

  const toggleGuideline = async (rule: GuidelineRecord) => {
    if (!canManageWorkspace) {
      setStorageError(t('adminRequired'));
      return;
    }
    try {
      await cloudUpdateGuideline(rule.id, { isActive: !rule.isActive });
      setStorageError('');
      setActionFeedback(`${t('guideline')} “${rule.title}” ${rule.isActive ? t('pausedAndSaved') : t('activatedAndSaved')}`);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : t('guidelineStatusFailed'));
      setActionFeedback('');
    }
  };

  const removeGuideline = async (rule: GuidelineRecord) => {
    if (!canManageWorkspace) {
      setStorageError(t('adminRequired'));
      return;
    }
    if (!window.confirm(`${t('guidelineDeletePrompt')} “${rule.title}”? ${t('guidelineDeleteRemainder')}`)) return;
    try {
      await cloudDeleteGuideline(rule.id);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : t('guidelineDeleteFailed'));
    }
  };

  const openEvidence = (item?: EvidenceRecord) => {
    if (!canManageWorkspace) return;
    setEditingEvidence(item ?? null);
    setEvidenceForm(item ? {
      title: item.title,
      description: item.description,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      associatedClaim: item.associatedClaim,
      guidelineId: item.guidelineId,
      verificationStatus: item.verificationStatus,
      lastReviewedAt: item.lastReviewedAt,
      reviewDueAt: item.reviewDueAt,
    } : EMPTY_EVIDENCE);
    setFormError('');
    setIsEvidenceModalOpen(true);
  };

  const saveEvidence = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageWorkspace) {
      setFormError(t('adminRequired'));
      return;
    }
    if (!evidenceForm.title.trim() || !evidenceForm.sourceName.trim() || !evidenceForm.associatedClaim.trim()) {
      setFormError(t('evidenceRequiredFields'));
      return;
    }
    if (evidenceForm.sourceUrl.trim()) {
      try {
        const url = new URL(evidenceForm.sourceUrl);
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      } catch {
        setFormError(t('urlInvalid'));
        return;
      }
    }
    if (evidenceForm.verificationStatus === 'verified' && (!evidenceForm.lastReviewedAt || !evidenceForm.reviewDueAt)) {
      setFormError(t('verifiedDatesRequired'));
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (evidenceForm.lastReviewedAt && evidenceForm.lastReviewedAt.slice(0, 10) > today) {
      setFormError(t('reviewDateFuture'));
      return;
    }
    if (evidenceForm.verificationStatus === 'verified' && evidenceForm.reviewDueAt <= today) {
      setFormError(t('nextReviewDateFuture'));
      return;
    }
    if (evidenceForm.lastReviewedAt && evidenceForm.reviewDueAt && evidenceForm.reviewDueAt < evidenceForm.lastReviewedAt) {
      setFormError(t('dateOrderInvalid'));
      return;
    }
    try {
      const input = {
        ...evidenceForm,
        title: evidenceForm.title.trim(),
        description: evidenceForm.description.trim(),
        sourceName: evidenceForm.sourceName.trim(),
        sourceUrl: evidenceForm.sourceUrl.trim(),
        associatedClaim: evidenceForm.associatedClaim.trim(),
      };
      if (editingEvidence) await cloudUpdateEvidenceRecord(editingEvidence.id, input);
      else await cloudCreateEvidenceRecord(input);
      setIsEvidenceModalOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('evidenceSaveFailed'));
    }
  };

  const removeEvidence = async (item: EvidenceRecord) => {
    if (!canManageWorkspace) {
      setStorageError(t('adminRequired'));
      return;
    }
    if (!window.confirm(`${t('evidenceDeletePrompt')} ${item.id} (“${item.title}”)? ${t('evidenceDeleteRemainder')}`)) return;
    try {
      const result = await cloudDeleteEvidenceRecord(item.id);
      setStorageError(result.isReferenced
        ? `${item.id} ${t('evidenceRemovedPrefix')}`
        : '');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : t('evidenceDeleteFailed'));
    }
  };

  const updateEvidenceStatus = (item: EvidenceRecord, status: EvidenceRecord['verificationStatus']) => {
    if (!canManageWorkspace) return;
    setEditingEvidence(item);
    setEvidenceForm({
      title: item.title,
      description: item.description,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      associatedClaim: item.associatedClaim,
      guidelineId: item.guidelineId,
      verificationStatus: status,
      lastReviewedAt: status === 'verified' ? new Date().toISOString().slice(0, 10) : item.lastReviewedAt,
      reviewDueAt: status === 'verified' ? item.reviewDueAt || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) : item.reviewDueAt,
    });
    setFormError('');
    setIsEvidenceModalOpen(true);
  };

  const filterControl = (
    <select
      value={activeTab === 'guidelines' ? categoryFilter : evidenceStatus}
      onChange={(event) => activeTab === 'guidelines'
        ? setCategoryFilter(event.target.value as GuidelineCategory | 'all')
        : setEvidenceStatus(event.target.value as EvidenceStatusFilter)}
      className="w-full sm:w-auto bg-ivory-50 text-xs border border-stone-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
      aria-label={activeTab === 'guidelines' ? t('filterGuidelineCategory') : t('filterEvidenceStatus')}
    >
      {activeTab === 'guidelines' ? (
        <>
          <option value="all">{t('allCategories')}</option>
          {GUIDELINE_CATEGORIES.map((category) => <option key={category} value={category}>{t(CATEGORY_KEYS[category])}</option>)}
        </>
      ) : (
        <>
          <option value="all">{t('allVerificationStates')}</option>
          <option value="verified">{t('verifiedCurrent')}</option>
          <option value="unverified">{t('unverified')}</option>
          <option value="expired">{t('expiredOrDueReview')}</option>
        </>
      )}
    </select>
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-stone-300 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-widest font-mono text-copper font-bold">{t('pageKicker')}</span>
          <h2 className="font-serif text-3xl font-normal text-obsidian tracking-tight">{t('pageTitle')}</h2>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">{t('pageDescription')}</p>
        </div>
        {canManageWorkspace && (
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4 text-copper" />}
            onClick={() => activeTab === 'guidelines' ? openGuideline() : openEvidence()}
          >
            {t('add')} {activeTab === 'guidelines' ? t('guideline') : t('evidence')}
          </Button>
        )}
      </div>

      {storageError && <p role="status" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{storageError}</p>}
      {actionFeedback && <p role="status" className="border-l-2 border-forest bg-forest-50 px-3 py-2 text-xs text-forest-800">{actionFeedback}</p>}

      <div className="flex flex-wrap gap-1 border-b border-stone-300" role="tablist" aria-label={t('directoryAria')}>
        {([
          { id: 'guidelines' as const, label: `${t('guidelinesTab')} · ${guidelines.length}`, icon: BookOpen },
          { id: 'evidence' as const, label: `${t('evidenceTab')} · ${evidence.length}`, icon: FileCheck2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${
              activeTab === id ? 'border-copper text-obsidian' : 'border-transparent text-stone-500 hover:text-obsidian'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 bg-ivory-50 p-4 border border-stone-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={activeTab === 'guidelines' ? t('searchGuidelinesPlaceholder') : t('searchEvidencePlaceholder')}
            aria-label={t('searchDirectory')}
            className="w-full bg-white text-xs border border-stone-300 pl-9 pr-3 py-2 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          />
        </div>
        {filterControl}
        {activeTab === 'guidelines' && (
          <select
            value={ruleStatus}
            onChange={(event) => setRuleStatus(event.target.value as RuleStatusFilter)}
            aria-label={t('filterActiveState')}
            className="w-full sm:w-auto bg-ivory-50 text-xs border border-stone-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          >
            <option value="all">{t('allRuleStates')}</option>
            <option value="active">{t('activeInAnalysis')}</option>
            <option value="paused">{t('paused')}</option>
          </select>
        )}
      </div>

      {activeTab === 'guidelines' ? (
        <div className="space-y-3">
          {filteredGuidelines.length === 0 ? (
            <EmptyState
              kicker={t('guidelineDirectory')}
              title={t('noMatchingGuidelines')}
              description={t('guidelineNoMatchDescription')}
              icon={<BookOpen className="w-5 h-5 text-copper" />}
              action={canManageWorkspace ? {
                label: t('addGuidelineAction'),
                onClick: () => openGuideline(),
                icon: <Plus className="w-3.5 h-3.5" />,
              } : undefined}
              secondaryAction={{ label: t('clearFilters'), onClick: () => { setSearchQuery(''); setCategoryFilter('all'); setRuleStatus('all'); } }}
            />
          ) : filteredGuidelines.map((rule) => {
            const localizedRule = localizeGuideline(rule, language);
            return (
            <Panel key={rule.id} padding="none" variant="elevated" className={!rule.isActive ? 'opacity-75' : ''}>
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-stone-500">{rule.id}</span>
                    <Badge variant="stone" size="sm">{t(CATEGORY_KEYS[rule.category])}</Badge>
                    <Badge variant={rule.isActive ? 'forest' : 'stone'} size="sm" dot>{rule.isActive ? t('active') : t('paused')}</Badge>
                    <span className="text-[10px] font-mono uppercase tracking-wide text-stone-500">{t(RULE_TYPE_KEYS[rule.ruleType])}</span>
                  </div>
                  <h3 className="font-serif text-lg font-normal text-obsidian">{localizedRule.title}</h3>
                  {rule.phrases.length > 0 && <p className="text-xs text-stone-700"><span className="font-semibold">{t('checkedPhrases')}</span> {rule.phrases.join(', ')}</p>}
                  {rule.approvedPhrase && <p className="text-xs text-stone-700"><span className="font-semibold">{t('approvedWording')}</span> {rule.approvedPhrase}</p>}
                  <p className="text-xs text-stone-600 leading-relaxed">{localizedRule.description}</p>
                </div>
                {canManageWorkspace && (
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openGuideline(rule)}
                      title={`${t('edit')} ${t('guideline')} ${rule.id}`}
                    >{t('edit')}</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={rule.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      onClick={() => toggleGuideline(rule)}
                      aria-pressed={!rule.isActive}
                      title={`${rule.isActive ? t('pause') : t('activate')} ${t('guideline')} ${rule.id}`}
                    >{rule.isActive ? t('pause') : t('activate')}</Button>
                    <button
                      type="button"
                      onClick={() => removeGuideline(rule)}
                      aria-label={`${t('deleteGuideline')} ${rule.id}`}
                      title={`${t('deleteGuideline')} ${rule.id}`}
                      className="rounded-sm p-2 text-stone-500 transition duration-150 hover:scale-105 hover:bg-copper-50 hover:text-copper active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                    ><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </Panel>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="border-l-2 border-copper bg-copper-50/60 px-3 py-2 text-xs text-stone-700">
            {t('evidenceRulesNotice')}
          </p>
          {filteredEvidence.length === 0 ? (
            <EmptyState
              kicker={t('evidenceCatalogue')}
              title={t('noMatchingEvidence')}
              description={t('evidenceNoMatchDescription')}
              icon={<FileCheck2 className="w-5 h-5 text-copper" />}
              action={canManageWorkspace ? {
                label: t('addEvidenceAction'),
                onClick: () => openEvidence(),
                icon: <Plus className="w-3.5 h-3.5" />,
              } : undefined}
              secondaryAction={{ label: t('clearFilters'), onClick: () => { setSearchQuery(''); setEvidenceStatus('all'); } }}
            />
          ) : filteredEvidence.map((item) => {
            const freshness = getEvidenceFreshness(item);
            const linkedRule = guidelines.find((rule) => rule.id === item.guidelineId);
            const badgeVariant = freshness === 'verified' ? 'forest' : freshness === 'unverified' ? 'copper' : 'stone';
            const freshnessLabel = freshness === 'verified' ? t('verifiedCurrent') : freshness === 'unverified' ? t('unverified') : freshness === 'expired' ? t('freshnessExpired') : t('freshnessDue');
            return (
              <Panel key={item.id} padding="none" variant="elevated">
                <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-stone-500">{item.id}</span>
                      <Badge variant={badgeVariant} size="sm" dot>{freshnessLabel}</Badge>
                      {linkedRule && <Badge variant="stone" size="sm">{linkedRule.id} · {linkedRule.title}</Badge>}
                    </div>
                    <h3 className="font-serif text-lg text-obsidian">{item.title}</h3>
                    <p className="text-xs text-stone-700"><strong>{t('claim')}</strong> {item.associatedClaim}</p>
                    <p className="text-xs text-stone-600">{item.description || t('noAdditionalSourceNotes')}</p>
                    <div className="text-xs text-stone-600">
                      <strong>{t('source')}</strong> {item.sourceName}
                      {item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-copper underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{item.sourceUrl}</a></>}
                    </div>
                    <p className="text-[10px] font-mono text-stone-500">{t('lastReviewed')} {formatDate(item.lastReviewedAt, language, t('notRecorded'))} · {t('reviewDue')} {formatDate(item.reviewDueAt, language, t('notRecorded'))}</p>
                  </div>
                  {canManageWorkspace && (
                    <div className="flex flex-wrap items-center gap-2 self-end md:self-start shrink-0">
                      {item.verificationStatus !== 'verified' && <Button variant="outline" size="sm" onClick={() => updateEvidenceStatus(item, 'verified')}>{t('verifyRecord')}</Button>}
                      {item.verificationStatus === 'verified' && <Button variant="secondary" size="sm" onClick={() => updateEvidenceStatus(item, 'unverified')}>{t('markUnverified')}</Button>}
                      <Button variant="secondary" size="sm" onClick={() => openEvidence(item)}>{t('edit')}</Button>
                      <button
                        type="button"
                        onClick={() => removeEvidence(item)}
                        aria-label={`${t('deleteEvidence')} ${item.id}`}
                        title={`${t('deleteEvidence')} ${item.id}`}
                        className="rounded-sm p-2 text-stone-500 transition duration-150 hover:scale-105 hover:bg-copper-50 hover:text-copper active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {canManageWorkspace && (
      <Modal
        isOpen={isGuidelineModalOpen}
        onClose={() => setIsGuidelineModalOpen(false)}
        title={editingGuideline ? t('guidelineEditTitle') : t('guidelineAddTitle')}
        subtitle={t('activeRulesSubtitle')}
        maxWidth="2xl"
      >
        <form onSubmit={saveGuideline} className="space-y-4">
          <Input label={t('guidelineTitleLabel')} value={guidelineForm.title} onChange={(event) => setGuidelineForm({ ...guidelineForm, title: event.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-stone-700">{t('categoryLabel')}
              <select value={guidelineForm.category} onChange={(event) => setGuidelineForm({ ...guidelineForm, category: event.target.value as GuidelineCategory })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
                {GUIDELINE_CATEGORIES.map((category) => <option key={category} value={category}>{t(CATEGORY_KEYS[category])}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-stone-700">{t('ruleTypeLabel')}
              <select value={guidelineForm.ruleType} onChange={(event) => setGuidelineForm({ ...guidelineForm, ruleType: event.target.value as GuidelineRuleType })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
                {Object.keys(RULE_TYPE_KEYS).map((value) => <option key={value} value={value}>{t(RULE_TYPE_KEYS[value as GuidelineRuleType])}</option>)}
              </select>
            </label>
          </div>
          {guidelineForm.ruleType !== 'guidance' && (
            <Input label={t('phrasesToMatchLabel')} value={guidelineForm.phrases} onChange={(event) => setGuidelineForm({ ...guidelineForm, phrases: event.target.value })} placeholder={t('phrasesPlaceholder')} required helperText={t('phraseMatchHelper')} />
          )}
          {guidelineForm.ruleType === 'approved_terminology' && (
            <Input label={t('approvedSpellingLabel')} value={guidelineForm.approvedPhrase} onChange={(event) => setGuidelineForm({ ...guidelineForm, approvedPhrase: event.target.value })} required />
          )}
          <label className="block text-xs font-semibold text-stone-700">{t('severityLabel')}
            <select value={guidelineForm.severity} onChange={(event) => setGuidelineForm({ ...guidelineForm, severity: event.target.value as GuidelineRecord['severity'] })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
              <option value="critical">{t('critical')}</option><option value="moderate">{t('moderate')}</option><option value="minor">{t('minor')}</option>
            </select>
          </label>
          <Textarea label={t('guidelineRationaleLabel')} value={guidelineForm.description} onChange={(event) => setGuidelineForm({ ...guidelineForm, description: event.target.value })} rows={3} required />
          {formError && <p role="alert" className="text-xs text-copper-900">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsGuidelineModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" variant="primary" size="sm" leftIcon={<Check className="h-3.5 w-3.5" />}>{t('saveGuideline')}</Button>
          </div>
        </form>
      </Modal>
      )}

      {canManageWorkspace && (
      <Modal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        title={editingEvidence ? t('evidenceEditTitle') : t('evidenceAddTitle')}
        subtitle={t('evidenceSubtitle')}
        maxWidth="2xl"
      >
        <form onSubmit={saveEvidence} className="space-y-4">
          <Input label={t('evidenceTitleLabel')} value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} required />
          <Input label={t('sourceNameLabel')} value={evidenceForm.sourceName} onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceName: event.target.value })} required />
          <Input label={t('sourceUrlLabel')} type="url" value={evidenceForm.sourceUrl} onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceUrl: event.target.value })} placeholder="https://" />
          <Input label={t('specificClaimLabel')} value={evidenceForm.associatedClaim} onChange={(event) => setEvidenceForm({ ...evidenceForm, associatedClaim: event.target.value })} required helperText={t('evidenceMatchHelper')} />
          <label className="block text-xs font-semibold text-stone-700">{t('relatedGuidelineLabel')}
            <select value={evidenceForm.guidelineId} onChange={(event) => setEvidenceForm({ ...evidenceForm, guidelineId: event.target.value })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
              <option value="">{t('generalEvidence')}</option>
              {guidelines.map((rule) => <option key={rule.id} value={rule.id}>{rule.id} · {rule.title}</option>)}
            </select>
          </label>
          <Textarea label={t('sourceNotesLabel')} value={evidenceForm.description} onChange={(event) => setEvidenceForm({ ...evidenceForm, description: event.target.value })} rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-stone-700">{t('verificationStatusLabel')}
              <select value={evidenceForm.verificationStatus} onChange={(event) => setEvidenceForm({ ...evidenceForm, verificationStatus: event.target.value as EvidenceRecord['verificationStatus'] })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
                <option value="unverified">{t('unverified')}</option><option value="verified">{t('verified')}</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-stone-700">{t('lastReviewedLabel')}
              <input type="date" value={evidenceForm.lastReviewedAt} onChange={(event) => setEvidenceForm({ ...evidenceForm, lastReviewedAt: event.target.value })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-xs font-semibold text-stone-700">{t('reviewDueLabel')}
              <input type="date" value={evidenceForm.reviewDueAt} onChange={(event) => setEvidenceForm({ ...evidenceForm, reviewDueAt: event.target.value })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2" />
            </label>
          </div>
          <p className="flex items-start gap-2 border-l-2 border-copper bg-copper-50/60 px-3 py-2 text-[11px] leading-relaxed text-stone-700"><ShieldAlert className="h-4 w-4 shrink-0 text-copper" />{t('sourceVerificationNotice')}</p>
          {formError && <p role="alert" className="text-xs text-copper-900">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsEvidenceModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" variant="primary" size="sm" leftIcon={<Check className="h-3.5 w-3.5" />}>{t('saveEvidence')}</Button>
          </div>
        </form>
      </Modal>
      )}
    </div>
  );
};