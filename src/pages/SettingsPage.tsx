import React, { useEffect, useState } from 'react';
import { 
  Database, 
  FilePlus2,
  RotateCcw, 
  Save
} from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  readWorkspaceSettings,
  WORKSPACE_DATA_STORAGE_KEY,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import { DEMO_SCENARIOS, prepareDemoScenarios } from '@/services/demoScenarios';
import { readReviewRecords } from '@/services/reviewStorage';
import {
  cloudPersistReviewRecords,
  cloudResetDemoReviews,
  cloudRestoreWorkspaceSettings,
  cloudSaveWorkspaceSettings,
  cloudAssignWorkspaceMember,
} from '@/services/cloudStorage';
import { useAuth } from '@/contexts/AuthProvider';
import { WorkspaceSettings } from '@/types/workspace';
import { getScopedStorageKey } from '@/services/storageScope';
import { useLanguage } from '@/contexts/LanguageProvider';

const SETTINGS_UI = {
  en: {
    kicker: 'Configuration',
    title: 'Governance & Workspace Settings',
    description: 'Configure the Human Verification Gate parameters, analysis thresholds, and authenticated workspace access.',
    settingsSaved: 'Settings Saved',
    readOnlyNotice: 'Workspace settings are read-only for your role. Only a workspace admin can change or restore these settings.',
    metaKicker: 'WORKSPACE METADATA',
    metaTitle: 'Brand Organization Identity',
    metaSubtitle: 'Workspace details visible on verification records and audit exports',
    orgNameLabel: 'Organization Workspace Name',
    orgNameHelper: 'Identifies your editorial division in the audit ledger',
    demoBrandLabel: 'Demo Brand Name',
    demoBrandHelper: 'Workspace identity used by the local prototype; it does not change prior analysis records.',
    reviewerNameLabel: 'Demo Reviewer Display Name',
    reviewerNameHelper: 'Used for future human decisions and governance audit events. This is not production authentication.',
    policyKicker: 'PUBLICATION POLICY',
    policyTitle: 'Human Verification Gate Enforcement',
    policySubtitle: 'Prioritize human attention. The final publication approval always remains a human decision.',
    strictnessLabel: 'Gate Strictness Level',
    strictTitle: 'Strict Gate (Mandatory)',
    strictBadge: 'Recommended',
    strictDesc: 'Prioritize critical and moderate findings for human review. Every publication decision still requires a human reviewer.',
    advisoryTitle: 'Advisory Gate',
    advisoryBadge: 'Permissive',
    advisoryDesc: 'Prioritize critical findings; other findings remain visible to the reviewer. This never bypasses human verification.',
    requireNamedLabel: 'Require a named reviewer identity',
    requireNamedDesc: "When enabled, decisions require a configured display name. This prototype does not verify a person's real-world identity.",
    queueThresholdLabel: (score: number) => `Queue Attention Threshold: ${score}/100`,
    queueThresholdDesc: 'Lower-scoring reviews are surfaced as priority attention in the human queue. Scores never approve or block a human decision.',
    storageTitle: 'Local State & Storage Architecture',
    storageSubtitle: 'Manage workspace-backed persistence',
    supabaseTitle: 'Authenticated Supabase Workspace',
    supabaseDesc: 'Reviews, revisions, decisions, guidelines, evidence metadata, and audit events are stored in the authenticated Supabase workspace. Browser-scoped data is retained as an import source and local cache; it is not authoritative.',
    restoreButton: 'Restore Workspace Settings',
    restoreConfirm: 'Restore workspace settings only? Reviews, guidelines, evidence, and audit history will be preserved.',
    saveButton: 'Save Publication Settings',
    adminRequiredSave: 'Workspace-admin access is required to change workspace settings.',
    emptyNamesError: 'Workspace and brand names cannot be empty.',
    reviewerNameRequired: 'Enter a reviewer display name or disable the named-signature preference.',
    saveError: 'Workspace settings could not be saved.',
    loadError: 'Workspace settings could not be loaded.',
    adminRequiredRestore: 'Workspace-admin access is required to restore workspace settings.',
    restoreError: 'Default settings could not be restored.',
    accessKicker: 'ACCESS CONTROL',
    accessTitle: 'Workspace members',
    accessSubtitle: 'Assign roles to existing BrandLens accounts by their confirmed email address.',
    accountEmailLabel: 'Account email',
    workspaceRoleLabel: 'Workspace role',
    roleWriter: 'Writer — submit and revise content',
    roleReviewer: 'Reviewer — record human decisions',
    roleAdmin: 'Workspace admin — manage workspace data and access',
    assignButton: 'Assign workspace role',
    adminRequiredMembers: 'Workspace-admin access is required to manage workspace members.',
    memberSuccess: (userId: string, roleName: string) => `Account ${userId} now has the ${roleName} role.`,
    memberError: 'Member role could not be updated.',
    demoKicker: 'DEMO WORKSPACE',
    demoTitle: 'Repeatable review scenarios',
    demoSubtitle: 'Prepare real local review records to demonstrate analysis, evidence, revisions, and the human gate.',
    demoDesc: 'Demo submissions run through the same local analysis and approval workflow as regular content. They are not pre-approved. Repeating setup skips existing demo scenarios.',
    prepareButton: 'Prepare demo reviews',
    resetButton: 'Reset demo reviews',
    demoPermissionNotice: 'Preparing or resetting demo reviews is available to workspace admins and writers.',
    demoDisclaimer: 'Reset removes only marked demo review records and their review history. It does not change guidelines, evidence, settings, workspace audit events, or non-demo reviews.',
    prepareConfirm: (scenarioList: string) => `Create any missing demo submissions?\n\n${scenarioList}\n\nThey will be analysed with the active workspace rules and added as awaiting human review. Existing reviews, guidelines, evidence, settings, and history will not be replaced.`,
    resetConfirm: 'Remove only the review records marked as BrandLens demo scenarios, including their revision and decision history? Your other review records, guidelines, evidence, workspace settings, and workspace audit events will be preserved.',
    prepareSuccess: (created: number, existing: number) => `${created} demo submission${created === 1 ? '' : 's'} prepared and analysed. ${existing} already existed. All are awaiting a human decision.`,
    prepareAllExist: 'All demo scenarios already exist. No duplicate review records were created.',
    prepareError: 'Demo submissions could not be prepared.',
    resetSuccess: (removed: number) => `${removed} demo review record${removed === 1 ? '' : 's'} removed with ${removed === 1 ? 'its' : 'their'} associated review history. Workspace data and other reviews were preserved.`,
    resetNoneFound: 'No marked demo review records were found.',
    resetError: 'Demo review records could not be removed.',
    demoAdminOrWriterRequired: 'Workspace-admin or writer access is required to prepare demo reviews.',
    demoResetAdminOrWriterRequired: 'Workspace-admin or writer access is required to reset demo reviews.',
  },
  hi: {
    kicker: 'कॉन्फ़िगरेशन',
    title: 'शासन और कार्यस्थान सेटिंग्स',
    description: 'मानव सत्यापन गेट पैरामीटर, विश्लेषण थ्रेशोल्ड और प्रमाणित कार्यस्थान एक्सेस कॉन्फ़िगर करें।',
    settingsSaved: 'सेटिंग्स सहेजी गईं',
    readOnlyNotice: 'कार्यस्थान सेटिंग्स आपकी भूमिका के लिए केवल पढ़ने योग्य हैं। केवल एक कार्यस्थान व्यवस्थापक ही इन सेटिंग्स को बदल या पुनर्स्थापित कर सकता है।',
    metaKicker: 'कार्यस्थान मेटाडेटा',
    metaTitle: 'ब्रांड संगठन पहचान',
    metaSubtitle: 'सत्यापन रिकॉर्ड और ऑडिट निर्यात पर दृश्यमान कार्यस्थान विवरण',
    orgNameLabel: 'संगठन कार्यस्थान का नाम',
    orgNameHelper: 'ऑडिट बहीखाते में आपके संपादकीय प्रभाग की पहचान करता है',
    demoBrandLabel: 'डेमो ब्रांड नाम',
    demoBrandHelper: 'स्थानीय प्रोटोटाइप द्वारा उपयोग की जाने वाली कार्यस्थान पहचान; यह पूर्व विश्लेषण रिकॉर्ड को नहीं बदलता है।',
    reviewerNameLabel: 'डेमो समीक्षक प्रदर्शन नाम',
    reviewerNameHelper: 'भविष्य के मानव निर्णयों और शासन ऑडिट कार्यक्रमों के लिए उपयोग किया जाता है। यह उत्पादन प्रमाणीकरण नहीं है।',
    policyKicker: 'प्रकाशन नीति',
    policyTitle: 'मानव सत्यापन गेट प्रवर्तन',
    policySubtitle: 'मानवीय ध्यान को प्राथमिकता दें। अंतिम प्रकाशन अनुमोदन हमेशा एक मानवीय निर्णय रहता है।',
    strictnessLabel: 'गेट सख्ती स्तर',
    strictTitle: 'सख्त गेट (अनिवार्य)',
    strictBadge: 'अनुशंसित',
    strictDesc: 'मानव समीक्षा के लिए महत्वपूर्ण और मध्यम निष्कर्षों को प्राथमिकता दें। प्रत्येक प्रकाशन निर्णय के लिए अभी भी एक मानव समीक्षक की आवश्यकता होती है।',
    advisoryTitle: 'सलाहकार गेट',
    advisoryBadge: 'अनुमेय',
    advisoryDesc: 'महत्वपूर्ण निष्कर्षों को प्राथमिकता दें; अन्य निष्कर्ष समीक्षक को दिखाई देते रहते हैं। यह कभी भी मानव सत्यापन को बायपास नहीं करता है।',
    requireNamedLabel: 'नामित समीक्षक पहचान आवश्यक करें',
    requireNamedDesc: 'सक्रिय होने पर, निर्णयों के लिए एक कॉन्फ़िगर किए गए प्रदर्शन नाम की आवश्यकता होती है। यह प्रोटोटाइप किसी व्यक्ति की वास्तविक दुनिया की पहचान सत्यापित नहीं करता है।',
    queueThresholdLabel: (score: number) => `कतार ध्यान थ्रेशोल्ड: ${score}/100`,
    queueThresholdDesc: 'कम स्कोर वाली समीक्षाएं मानव कतार में प्राथमिकता के रूप में सामने आती हैं। स्कोर कभी भी किसी मानवीय निर्णय को स्वीकृत या अवरोधित नहीं करते हैं।',
    storageTitle: 'स्थानीय स्थिति और संग्रहण वास्तुकला',
    storageSubtitle: 'कार्यस्थान-समर्थित दृढ़ता प्रबंधित करें',
    supabaseTitle: 'प्रमाणित Supabase कार्यस्थान',
    supabaseDesc: 'समीक्षाएं, संशोधन, निर्णय, दिशानिर्देश, प्रमाण मेटाडेटा और ऑडिट इवेंट प्रमाणित Supabase कार्यस्थान में संग्रहीत होते हैं। ब्राउज़र-आधारित डेटा को आयात स्रोत और स्थानीय कैश के रूप में बनाए रखा जाता है; यह आधिकारिक नहीं है।',
    restoreButton: 'कार्यस्थान सेटिंग्स पुनर्स्थापित करें',
    restoreConfirm: 'केवल कार्यस्थान सेटिंग्स पुनर्स्थापित करें? समीक्षाएं, दिशानिर्देश, प्रमाण और ऑडिट इतिहास सुरक्षित रहेंगे।',
    saveButton: 'प्रकाशन सेटिंग्स सहेजें',
    adminRequiredSave: 'कार्यस्थान सेटिंग्स बदलने के लिए कार्यस्थान-व्यवस्थापक एक्सेस आवश्यक है।',
    emptyNamesError: 'कार्यस्थान और ब्रांड के नाम खाली नहीं हो सकते।',
    reviewerNameRequired: 'एक समीक्षक प्रदर्शन नाम दर्ज करें या नामित-हस्ताक्षर प्राथमिकता को अक्षम करें।',
    saveError: 'कार्यस्थान सेटिंग्स सहेजी नहीं जा सकीं।',
    loadError: 'कार्यस्थान सेटिंग्स लोड नहीं की जा सकीं।',
    adminRequiredRestore: 'कार्यस्थान सेटिंग्स पुनर्स्थापित करने के लिए कार्यस्थान-व्यवस्थापक एक्सेस आवश्यक है।',
    restoreError: 'डिफ़ॉल्ट सेटिंग्स पुनर्स्थापित नहीं की जा सकीं।',
    accessKicker: 'पहुंच नियंत्रण',
    accessTitle: 'कार्यस्थान सदस्य',
    accessSubtitle: 'मौजूदा BrandLens खातों को उनके पुष्ट ईमेल पते द्वारा भूमिकाएं सौंपें।',
    accountEmailLabel: 'खाता ईमेल',
    workspaceRoleLabel: 'कार्यस्थान भूमिका',
    roleWriter: 'लेखक — सामग्री सबमिट करें और संशोधित करें',
    roleReviewer: 'समीक्षक — मानवीय निर्णय दर्ज करें',
    roleAdmin: 'कार्यस्थान व्यवस्थापक — कार्यस्थान डेटा और पहुंच प्रबंधित करें',
    assignButton: 'कार्यस्थान भूमिका सौंपें',
    adminRequiredMembers: 'कार्यस्थान सदस्यों को प्रबंधित करने के लिए कार्यस्थान-व्यवस्थापक पहुंच आवश्यक है।',
    memberSuccess: (userId: string, roleName: string) => `खाता ${userId} के पास अब ${roleName} भूमिका है।`,
    memberError: 'सदस्य भूमिका अपडेट नहीं की जा सकी।',
    demoKicker: 'डेमो कार्यस्थान',
    demoTitle: 'दोहराने योग्य समीक्षा परिदृश्य',
    demoSubtitle: 'विश्लेषण, प्रमाण, संशोधन और मानव गेट प्रदर्शित करने के लिए वास्तविक स्थानीय समीक्षा रिकॉर्ड तैयार करें।',
    demoDesc: 'डेमो सबमिशन नियमित सामग्री की तरह ही स्थानीय विश्लेषण और अनुमोदन वर्कफ़्लो से गुजरते हैं। वे पूर्व-अनुमोदित नहीं हैं। सेटअप दोहराने पर मौजूदा डेमो परिदृश्यों को छोड़ दिया जाता है।',
    prepareButton: 'डेमो समीक्षाएं तैयार करें',
    resetButton: 'डेमो समीक्षाएं रीसेट करें',
    demoPermissionNotice: 'डेमो समीक्षाएं तैयार करना या रीसेट करना कार्यस्थान व्यवस्थापकों और लेखकों के लिए उपलब्ध है।',
    demoDisclaimer: 'रीसेट केवल चिह्नित डेमो समीक्षा रिकॉर्ड और उनके समीक्षा इतिहास को हटाता है। यह दिशानिर्देश, प्रमाण, सेटिंग्स, कार्यस्थान ऑडिट ईवेंट या गैर-डेमो समीक्षाओं को नहीं बदलता है।',
    prepareConfirm: (scenarioList: string) => `क्या कोई अनुपलब्ध डेमो सबमिशन बनाना चाहते हैं?\n\n${scenarioList}\n\nसक्रिय कार्यस्थान नियमों के साथ उनका विश्लेषण किया जाएगा और मानव समीक्षा की प्रतीक्षा के रूप में जोड़ा जाएगा। मौजूदा समीक्षाएं, दिशानिर्देश, प्रमाण, सेटिंग्स और इतिहास प्रतिस्थापित नहीं किए जाएंगे।`,
    resetConfirm: 'केवल BrandLens डेमो परिदृश्यों के रूप में चिह्नित समीक्षा रिकॉर्ड और उनके संशोधन और निर्णय इतिहास को हटाएं? आपके अन्य समीक्षा रिकॉर्ड, दिशानिर्देश, प्रमाण, कार्यस्थान सेटिंग्स और कार्यस्थान ऑडिट ईवेंट सुरक्षित रहेंगे।',
    prepareSuccess: (created: number, existing: number) => `${created} डेमो सबमिशन तैयार और विश्लेषित किए गए। ${existing} पहले से मौजूद थे। सभी मानवीय निर्णय की प्रतीक्षा कर रहे हैं।`,
    prepareAllExist: 'सभी डेमो परिदृश्य पहले से मौजूद हैं। कोई डुप्लिकेट समीक्षा रिकॉर्ड नहीं बनाया गया।',
    prepareError: 'डेमो सबमिशन तैयार नहीं किए जा सके।',
    resetSuccess: (removed: number) => `${removed} डेमो समीक्षा रिकॉर्ड उनके संबंधित समीक्षा इतिहास के साथ हटा दिए गए। कार्यस्थान डेटा और अन्य समीक्षाएं सुरक्षित रखी गईं।`,
    resetNoneFound: 'कोई चिह्नित डेमो समीक्षा रिकॉर्ड नहीं मिला।',
    resetError: 'डेमो समीक्षा रिकॉर्ड हटाए नहीं जा सके।',
    demoAdminOrWriterRequired: 'डेमो समीक्षाएं तैयार करने के लिए कार्यस्थान-व्यवस्थापक या लेखक पहुंच आवश्यक है।',
    demoResetAdminOrWriterRequired: 'डेमो समीक्षाएं रीसेट करने के लिए कार्यस्थान-व्यवस्थापक या लेखक पहुंच आवश्यक है।',
  },
  gu: {
    kicker: 'રૂપરેખાંકન',
    title: 'શાસન અને વર્કસ્પેસ સેટિંગ્સ',
    description: 'માનવ ચકાસણી ગેટ પરિમાણો, વિશ્લેષણ થ્રેશોલ્ડ અને પ્રમાણિત વર્કસ્પેસ ઍક્સેસ ગોઠવો.',
    settingsSaved: 'સેટિંગ્સ સાચવી',
    readOnlyNotice: 'તમારી ભૂમિકા માટે વર્કસ્પેસ સેટિંગ્સ ફક્ત વાંચવા માટે છે. ફક્ત વર્કસ્પેસ એડમિન જ આ સેટિંગ્સ બદલી અથવા પુનઃસ્થાપિત કરી શકે છે.',
    metaKicker: 'વર્કસ્પેસ મેટાડેટા',
    metaTitle: 'બ્રાન્ડ સંસ્થા ઓળખ',
    metaSubtitle: 'ચકાસણી રેકોર્ડ્સ અને ઑડિટ નિકાસ પર દૃશ્યમાન વર્કસ્પેસ વિગતો',
    orgNameLabel: 'સંસ્થા વર્કસ્પેસ નામ',
    orgNameHelper: 'ઑડિટ ખાતાવહીમાં તમારા સંપાદકીય વિભાગને ઓળખે છે',
    demoBrandLabel: 'ડેમો બ્રાન્ડ નામ',
    demoBrandHelper: 'સ્થાનિક પ્રોટોટાઇપ દ્વારા ઉપયોગમાં લેવાતી વર્કસ્પેસ ઓળખ; તે અગાઉના વિશ્લેષણ રેકોર્ડ્સને બદલતું નથી.',
    reviewerNameLabel: 'ડેમો સમીક્ષક પ્રદર્શન નામ',
    reviewerNameHelper: 'ભવિષ્યના માનવ નિર્ણયો અને શાસન ઑડિટ ઇવેન્ટ્સ માટે વપરાય છે. આ ઉત્પાદન પ્રમાણીકરણ નથી.',
    policyKicker: 'પ્રકાશન નીતિ',
    policyTitle: 'માનવ ચકાસણી ગેટ અમલીકરણ',
    policySubtitle: 'માનવ ધ્યાનને પ્રાધાન્ય આપો. અંતિમ પ્રકાશન મંજૂરી હંમેશા માનવ નિર્ણય રહે છે.',
    strictnessLabel: 'ગેટ કડકતા સ્તર',
    strictTitle: 'કડક ગેટ (ફરજિયાત)',
    strictBadge: 'ભલામણ કરેલ',
    strictDesc: 'માનવ સમીક્ષા માટે ગંભીર અને મધ્યમ તારણોને પ્રાધાન્ય આપો. દરેક પ્રકાશન નિર્ણય માટે હજુ પણ માનવ સમીક્ષકની જરૂર છે.',
    advisoryTitle: 'સલાહકાર ગેટ',
    advisoryBadge: 'પરવાનગીવાળું',
    advisoryDesc: 'ગંભીર તારણોને પ્રાધાન્ય આપો; અન્ય તારણો સમીક્ષક માટે દૃશ્યમાન રહે છે. આ ક્યારેય માનવ ચકાસણીને બાયપાસ કરતું નથી.',
    requireNamedLabel: 'નામાંકિત સમીક્ષક ઓળખ જરૂરી છે',
    requireNamedDesc: 'સક્ષમ હોય ત્યારે, નિર્ણયો માટે રૂપરેખાંકિત પ્રદર્શન નામની જરૂર પડે છે. આ પ્રોટોટાઇપ વ્યક્તિની વાસ્તવિક દુનિયાની ઓળખ ચકાસતું નથી.',
    queueThresholdLabel: (score: number) => `કતાર ધ્યાન થ્રેશોલ્ડ: ${score}/100`,
    queueThresholdDesc: 'ઓછા સ્કોરિંગ સમીક્ષાઓ માનવ કતારમાં અગ્રતા ધ્યાન તરીકે સામે આવે છે. સ્કોર્સ ક્યારેય માનવ નિર્ણયને મંજૂર કે બ્લોક કરતા નથી.',
    storageTitle: 'સ્થાનિક સ્થિતિ અને સંગ્રહ આર્કિટેક્ચર',
    storageSubtitle: 'વર્કસ્પેસ-સમર્થિત સ્થિરતાનું સંચાલન કરો',
    supabaseTitle: 'પ્રમાણિત Supabase વર્કસ્પેસ',
    supabaseDesc: 'સમીક્ષાઓ, સુધારાઓ, નિર્ણયો, માર્ગદર્શિકાઓ, પુરાવા મેટાડેટા અને ઑડિટ ઇવેન્ટ્સ પ્રમાણિત Supabase વર્કસ્પેસમાં સંગ્રહિત થાય છે. બ્રાઉઝર-સ્કોપ કરેલ ડેટા આયાત સ્ત્રોત અને સ્થાનિક કેશ તરીકે જાળવવામાં આવે છે; તે સત્તાવાર નથી.',
    restoreButton: 'વર્કસ્પેસ સેટિંગ્સ પુનઃસ્થાપિત કરો',
    restoreConfirm: 'ફક્ત વર્કસ્પેસ સેટિંગ્સ પુનઃસ્થાપિત કરવી છે? સમીક્ષાઓ, માર્ગદર્શિકા, પુરાવા અને ઑડિટ ઇતિહાસ સાચવવામાં આવશે.',
    saveButton: 'પ્રકાશન સેટિંગ્સ સાચવો',
    adminRequiredSave: 'વર્કસ્પેસ સેટિંગ્સ બદલવા માટે વર્કસ્પેસ-એડમિન ઍક્સેસ જરૂરી છે.',
    emptyNamesError: 'વર્કસ્પેસ અને બ્રાન્ડના નામ ખાલી હોઈ શકતા નથી.',
    reviewerNameRequired: 'સમીક્ષક પ્રદર્શન નામ દાખલ કરો અથવા નામાંકિત સહી પસંદગીને અક્ષમ કરો.',
    saveError: 'વર્કસ્પેસ સેટિંગ્સ સાચવી શકાઈ નથી.',
    loadError: 'વર્કસ્પેસ સેટિંગ્સ લોડ કરી શકાઈ નથી.',
    adminRequiredRestore: 'વર્કસ્પેસ સેટિંગ્સ પુનઃસ્થાપિત કરવા માટે વર્કસ્પેસ-એડમિન ઍક્સેસ જરૂરી છે.',
    restoreError: 'ડિફૉલ્ટ સેટિંગ્સ પુનઃસ્થાપિત કરી શકાઈ નથી.',
    accessKicker: 'ઍક્સેસ નિયંત્રણ',
    accessTitle: 'વર્કસ્પેસ સભ્યો',
    accessSubtitle: 'તેમના પુષ્ટિ થયેલ ઇમેઇલ સરનામાં દ્વારા હાલના BrandLens એકાઉન્ટ્સને ભૂમિકાઓ સોંપો.',
    accountEmailLabel: 'એકાઉન્ટ ઇમેઇલ',
    workspaceRoleLabel: 'વર્કસ્પેસ ભૂમિકા',
    roleWriter: 'લેખક — સામગ્રી સબમિટ કરો અને સુધારો',
    roleReviewer: 'સમીક્ષક — માનવ નિર્ણયો રેકોર્ડ કરો',
    roleAdmin: 'વર્કસ્પેસ એડમિન — વર્કસ્પેસ ડેટા અને ઍક્સેસ મેનેજ કરો',
    assignButton: 'વર્કસ્પેસ ભૂમિકા સોંપો',
    adminRequiredMembers: 'વર્કસ્પેસ સભ્યોનું સંચાલન કરવા માટે વર્કસ્પેસ-એડમિન ઍક્સેસ જરૂરી છે.',
    memberSuccess: (userId: string, roleName: string) => `એકાઉન્ટ ${userId} પાસે હવે ${roleName} ભૂમિકા છે.`,
    memberError: 'સભ્ય ભૂમિકા અપડેટ કરી શકાઈ નથી.',
    demoKicker: 'ડેમો વર્કસ્પેસ',
    demoTitle: 'પુનરાવર્તિત સમીક્ષા પરિસ્થિતિઓ',
    demoSubtitle: 'વિશ્લેષણ, પુરાવા, સુધારાઓ અને માનવ ગેટ દર્શાવવા માટે વાસ્તવિક સ્થાનિક સમીક્ષા રેકોર્ડ્સ તૈયાર કરો.',
    demoDesc: 'ડેમો સબમિશન નિયમિત સામગ્રીની જેમ જ સ્થાનિક વિશ્લેષણ અને મંજૂરી વર્કફ્લોમાંથી પસાર થાય છે. તેઓ પૂર્વ-મંજૂર નથી. સેટઅપનું પુનરાવર્તન હાલના ડેમો દૃશ્યોને છોડી દે છે.',
    prepareButton: 'ડેમો સમીક્ષાઓ તૈયાર કરો',
    resetButton: 'ડેમો સમીક્ષાઓ રીસેટ કરો',
    demoPermissionNotice: 'ડેમો સમીક્ષાઓ તૈયાર કરવી અથવા રીસેટ કરવી વર્કસ્પેસ એડમિન અને લેખકો માટે ઉપલબ્ધ છે.',
    demoDisclaimer: 'રીસેટ ફક્ત ચિહ્નિત ડેમો સમીક્ષા રેકોર્ડ્સ અને તેમના સમીક્ષા ઇતિહાસને દૂર કરે છે. તે માર્ગદર્શિકા, પુરાવા, સેટિંગ્સ, વર્કસ્પેસ ઑડિટ ઇવેન્ટ્સ અથવા બિન-ડેમો સમીક્ષાઓને બદલતું નથી.',
    prepareConfirm: (scenarioList: string) => `શું કોઈ ગુમ થયેલ ડેમો સબમિશન બનાવવા માંગો છો?\n\n${scenarioList}\n\nતેઓ સક્રિય વર્કસ્પેસ નિયમો સાથે વિશ્લેષિત થશે અને માનવ સમીક્ષાની રાહ જોતા તરીકે ઉમેરવામાં આવશે. હાલની સમીક્ષાઓ, માર્ગદર્શિકાઓ, પુરાવા, સેટિંગ્સ અને ઇતિહાસ બદલાશે નહીં.`,
    resetConfirm: 'ફક્ત BrandLens ડેમો દૃશ્યો તરીકે ચિહ્નિત સમીક્ષા રેકોર્ડ્સ અને તેમના સુધારા અને નિર્ણય ઇતિહાસને દૂર કરવા છે? તમારા અન્ય સમીક્ષા રેકોર્ડ્સ, માર્ગદર્શિકા, પુરાવા, વર્કસ્પેસ સેટિંગ્સ અને વર્કસ્પેસ ઑડિટ ઇવેન્ટ્સ સાચવવામાં આવશે.',
    prepareSuccess: (created: number, existing: number) => `${created} ડેમો સબમિશન તૈયાર અને વિશ્લેષિત કર્યા. ${existing} પહેલેથી જ અસ્તિત્વમાં હતા. બધા માનવ નિર્ણયની રાહ જોઈ રહ્યા છે.`,
    prepareAllExist: 'બધી ડેમો પરિસ્થિતિઓ પહેલેથી અસ્તિત્વમાં છે. કોઈ ડુપ્લિકેટ સમીક્ષા રેકોર્ડ બનાવવામાં આવ્યા નથી.',
    prepareError: 'ડેમો સબમિશન તૈયાર કરી શકાયા નથી.',
    resetSuccess: (removed: number) => `${removed} ડેમો સમીક્ષા રેકોર્ડ તેમના સંબંધિત સમીક્ષા ઇતિહાસ સાથે દૂર કરવામાં આવ્યા. વર્કસ્પેસ ડેટા અને અન્ય સમીક્ષાઓ સાચવવામાં આવી.`,
    resetNoneFound: 'કોઈ ચિહ્નિત ડેમો સમીક્ષા રેકોર્ડ મળ્યા નથી.',
    resetError: 'ડેમો સમીક્ષા રેકોર્ડ્સ દૂર કરી શકાયા નથી.',
    demoAdminOrWriterRequired: 'ડેમો સમીક્ષાઓ તૈયાર કરવા માટે વર્કસ્પેસ-એડમિન અથવા લેખક ઍક્સેસ જરૂરી છે.',
    demoResetAdminOrWriterRequired: 'ડેમો સમીક્ષાઓ રીસેટ કરવા માટે વર્કસ્પેસ-એડમિન અથવા લેખક ઍક્સેસ જરૂરી છે.',
  },
};

export const SettingsPage: React.FC = () => {
  const auth = useAuth();
  const { language } = useLanguage();
  const t = SETTINGS_UI[language] ?? SETTINGS_UI.en;

  const canManageWorkspace = auth.role === 'workspace_admin';
  const canManageDemoReviews = auth.role === 'workspace_admin' || auth.role === 'writer';
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [demoFeedback, setDemoFeedback] = useState('');
  const [demoError, setDemoError] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'writer' | 'reviewer' | 'workspace_admin'>('writer');
  const [memberFeedback, setMemberFeedback] = useState('');
  const [memberError, setMemberError] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);

  useEffect(() => {
    const refreshSettings = () => {
      try {
        setSettings(readWorkspaceSettings());
      } catch (error) {
        setSettingsError(error instanceof Error ? error.message : t.loadError);
      }
    };
    refreshSettings();
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshSettings);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getScopedStorageKey(WORKSPACE_DATA_STORAGE_KEY)) refreshSettings();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshSettings);
      window.removeEventListener('storage', handleStorage);
    };
  }, [t.loadError]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageWorkspace) {
      setSettingsError(t.adminRequiredSave);
      return;
    }
    if (!settings.workspaceName.trim() || !settings.demoBrandName.trim()) {
      setSettingsError(t.emptyNamesError);
      return;
    }
    if (settings.requireNamedSignature && !settings.reviewerDisplayName.trim()) {
      setSettingsError(t.reviewerNameRequired);
      return;
    }
    try {
      const savedSettings = await cloudSaveWorkspaceSettings({
        ...settings,
        workspaceName: settings.workspaceName.trim(),
        demoBrandName: settings.demoBrandName.trim(),
        reviewerDisplayName: settings.reviewerDisplayName.trim(),
      });
      setSettings(savedSettings);
      setSettingsError('');
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : t.saveError);
    }
  };

  const restoreDefaults = async () => {
    if (!canManageWorkspace) {
      setSettingsError(t.adminRequiredRestore);
      return;
    }
    if (confirm(t.restoreConfirm)) {
      try {
        setSettings(await cloudRestoreWorkspaceSettings());
        setSettingsError('');
      } catch (error) {
        setSettingsError(error instanceof Error ? error.message : t.restoreError);
      }
    }
  };

  const prepareDemoRecords = async () => {
    if (!canManageDemoReviews) {
      setDemoError(t.demoAdminOrWriterRequired);
      return;
    }
    const scenarioList = DEMO_SCENARIOS.map((scenario) => `• ${scenario.title}`).join('\n');
    if (!window.confirm(t.prepareConfirm(scenarioList))) return;
    try {
      const existingIds = new Set(readReviewRecords().map((record) => record.id));
      const result = prepareDemoScenarios();
      const createdRecords = readReviewRecords().filter((record) => !existingIds.has(record.id));
      await cloudPersistReviewRecords(createdRecords);
      setDemoFeedback(result.created
        ? t.prepareSuccess(result.created, result.existing)
        : t.prepareAllExist);
      setDemoError('');
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : t.prepareError);
      setDemoFeedback('');
    }
  };

  const clearDemoRecords = async () => {
    if (!canManageDemoReviews) {
      setDemoError(t.demoResetAdminOrWriterRequired);
      return;
    }
    if (!window.confirm(t.resetConfirm)) return;
    try {
      const removed = await cloudResetDemoReviews();
      setDemoFeedback(removed
        ? t.resetSuccess(removed)
        : t.resetNoneFound);
      setDemoError('');
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : t.resetError);
      setDemoFeedback('');
    }
  };

  const assignWorkspaceMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageWorkspace) {
      setMemberError(t.adminRequiredMembers);
      return;
    }
    setMemberSaving(true);
    setMemberError('');
    setMemberFeedback('');
    try {
      const userId = await cloudAssignWorkspaceMember(memberEmail, memberRole);
      const roleDisplayName = memberRole === 'writer' ? t.roleWriter.split(' — ')[0] : memberRole === 'reviewer' ? t.roleReviewer.split(' — ')[0] : t.roleAdmin.split(' — ')[0];
      setMemberFeedback(t.memberSuccess(userId, roleDisplayName));
      setMemberEmail('');
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : t.memberError);
    } finally {
      setMemberSaving(false);
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

        {savedFeedback && (
          <Badge variant="forest" size="md" dot>
            {t.settingsSaved}
          </Badge>
        )}
      </div>

      {!canManageWorkspace && (
        <p role="note" className="border-l-2 border-stone-400 bg-stone-100 px-3 py-2 text-xs text-stone-700">
          {t.readOnlyNotice}
        </p>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <fieldset disabled={!canManageWorkspace} className="space-y-6 min-w-0">
        {/* Workspace Identity */}
        <Panel
          kicker={t.metaKicker}
          title={t.metaTitle}
          subtitle={t.metaSubtitle}
          padding="md"
        >
          <div className="max-w-xl space-y-4">
            <Input
              label={t.orgNameLabel}
              value={settings.workspaceName}
              onChange={(e) => setSettings({ ...settings, workspaceName: e.target.value })}
              helperText={t.orgNameHelper}
            />
            <Input
              label={t.demoBrandLabel}
              value={settings.demoBrandName}
              onChange={(e) => setSettings({ ...settings, demoBrandName: e.target.value })}
              helperText={t.demoBrandHelper}
            />
            <Input
              label={t.reviewerNameLabel}
              value={settings.reviewerDisplayName}
              onChange={(e) => setSettings({ ...settings, reviewerDisplayName: e.target.value })}
              helperText={t.reviewerNameHelper}
              required={settings.requireNamedSignature}
            />
          </div>
        </Panel>

        {/* Human Verification Gate Configuration */}
        <Panel
          kicker={t.policyKicker}
          title={t.policyTitle}
          subtitle={t.policySubtitle}
          padding="md"
        >
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-3">
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] font-semibold text-stone-700">
                {t.strictnessLabel}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t.strictnessLabel}>
                <div
                  role="radio"
                  aria-checked={settings.gateStrictness === 'strict'}
                  aria-disabled={!canManageWorkspace}
                  tabIndex={canManageWorkspace ? 0 : -1}
                  onKeyDown={(e) => {
                    if (canManageWorkspace && (e.key === ' ' || e.key === 'Enter')) setSettings({ ...settings, gateStrictness: 'strict' });
                  }}
                  onClick={() => { if (canManageWorkspace) setSettings({ ...settings, gateStrictness: 'strict' }); }}
                  className={`p-4 rounded-[3px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${canManageWorkspace ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'} ${
                    settings.gateStrictness === 'strict'
                      ? 'border-copper bg-copper-50/50 ring-1 ring-copper'
                      : `border-stone-300 bg-ivory-50/80 ${canManageWorkspace ? 'hover:bg-stone-100/50' : ''}`
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs md:text-sm text-obsidian">{t.strictTitle}</span>
                    <Badge variant="copper" size="sm">{t.strictBadge}</Badge>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {t.strictDesc}
                  </p>
                </div>

                <div
                  role="radio"
                  aria-checked={settings.gateStrictness === 'flexible'}
                  aria-disabled={!canManageWorkspace}
                  tabIndex={canManageWorkspace ? 0 : -1}
                  onKeyDown={(e) => {
                    if (canManageWorkspace && (e.key === ' ' || e.key === 'Enter')) setSettings({ ...settings, gateStrictness: 'flexible' });
                  }}
                  onClick={() => { if (canManageWorkspace) setSettings({ ...settings, gateStrictness: 'flexible' }); }}
                  className={`p-4 rounded-[3px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${canManageWorkspace ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'} ${
                    settings.gateStrictness === 'flexible'
                      ? 'border-copper bg-copper-50/50 ring-1 ring-copper'
                      : `border-stone-300 bg-ivory-50/80 ${canManageWorkspace ? 'hover:bg-stone-100/50' : ''}`
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs md:text-sm text-obsidian">{t.advisoryTitle}</span>
                    <Badge variant="stone" size="sm">{t.advisoryBadge}</Badge>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {t.advisoryDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireNamedSignature}
                  onChange={(e) => setSettings({ ...settings, requireNamedSignature: e.target.checked })}
                  className="mt-1 rounded-[2px] border-stone-300 text-copper focus:ring-copper"
                />
                <div>
                  <span className="text-sm font-medium text-obsidian">
                    {t.requireNamedLabel}
                  </span>
                  <p className="text-xs text-stone-600">
                    {t.requireNamedDesc}
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-700 mb-1">
                  {t.queueThresholdLabel(settings.minPassScore)}
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.minPassScore}
                  onChange={(e) => setSettings({ ...settings, minPassScore: Number(e.target.value) })}
                  className="w-full accent-copper cursor-pointer"
                />
                <p className="text-xs text-stone-500 mt-1">
                  {t.queueThresholdDesc}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        {/* Local Storage & Engine Controls */}
        <Panel
          title={t.storageTitle}
          subtitle={t.storageSubtitle}
          padding="md"
        >
          <div className="space-y-4 max-w-xl">
            <div className="p-3 bg-stone-100 rounded-[3px] border border-stone-200 text-xs text-stone-700 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-obsidian">
                <Database className="w-4 h-4 text-copper" />
                <span>{t.supabaseTitle}</span>
              </div>
              <p>
                {t.supabaseDesc}
              </p>
            </div>

            {canManageWorkspace && (
              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={restoreDefaults}
                >
                  {t.restoreButton}
                </Button>
              </div>
            )}
          </div>
        </Panel>
        </fieldset>

        {canManageWorkspace && (
          <div className="pt-2 flex items-center justify-end gap-3">
            {settingsError && <p role="alert" className="mr-auto text-xs text-copper-900">{settingsError}</p>}
            <Button
              type="submit"
              variant="copper"
              size="md"
              leftIcon={<Save className="w-4 h-4" />}
            >
              {t.saveButton}
            </Button>
          </div>
        )}
      </form>

        {auth.role === 'workspace_admin' && (
          <Panel kicker={t.accessKicker} title={t.accessTitle} subtitle={t.accessSubtitle} padding="md">
            <form className="max-w-xl space-y-3" onSubmit={assignWorkspaceMember}>
              <Input label={t.accountEmailLabel} type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required />
              <label className="block text-xs text-stone-600">
                {t.workspaceRoleLabel}
                <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as typeof memberRole)} className="mt-1 block w-full rounded border border-stone-300 bg-ivory-50 px-3 py-2 text-sm text-obsidian">
                  <option value="writer">{t.roleWriter}</option>
                  <option value="reviewer">{t.roleReviewer}</option>
                  <option value="workspace_admin">{t.roleAdmin}</option>
                </select>
              </label>
              {memberError && <p role="alert" className="text-xs text-copper-900">{memberError}</p>}
              {memberFeedback && <p role="status" className="text-xs text-forest-700">{memberFeedback}</p>}
              <Button type="submit" variant="outline" disabled={memberSaving} isLoading={memberSaving}>{t.assignButton}</Button>
            </form>
          </Panel>
        )}

        <Panel
          kicker={t.demoKicker}
          title={t.demoTitle}
          subtitle={t.demoSubtitle}
          padding="md"
        >
          <div className="max-w-2xl space-y-3">
            <p className="text-xs leading-relaxed text-stone-600">
              {t.demoDesc}
            </p>
            {demoFeedback && <p role="status" className="border-l-2 border-forest bg-forest-50 px-3 py-2 text-xs text-forest-900">{demoFeedback}</p>}
            {demoError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{demoError}</p>}
            {canManageDemoReviews ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="copper" size="sm" leftIcon={<FilePlus2 className="h-3.5 w-3.5" />} onClick={prepareDemoRecords}>
                  {t.prepareButton}
                </Button>
                <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={clearDemoRecords}>
                  {t.resetButton}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-stone-500">{t.demoPermissionNotice}</p>
            )}
            <p className="text-[10px] leading-relaxed text-stone-500">
              {t.demoDisclaimer}
            </p>
          </div>
        </Panel>

    </div>
  );
};