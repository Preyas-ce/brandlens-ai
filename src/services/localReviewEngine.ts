import {
  ReviewCategory,
  ReviewFinding,
  ReviewSeverity,
} from '@/types/review';
import { EvidenceRecord, GuidelineRecord, GuidelineRuleType } from '@/types/workspace';
import {
  findEvidenceForClaim,
  findEvidenceCandidatesForClaim,
  getWorkspaceAnalysisConfigHash,
  getEvidenceFreshness,
  readEvidenceRecords,
  readGuidelines,
} from '@/services/workspaceStorage';

export interface LocalBrandRule {
  id: string;
  title: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  rationale: string;
}

export interface LocalEvidence {
  id: string;
  label: string;
  source: string;
  approvedPhrase: string;
  note: string;
  verificationStatus: EvidenceRecord['verificationStatus'];
  freshness: 'verified' | 'unverified' | 'expired' | 'due';
  sourceUrl: string;
}

export interface LocalReviewAnalysis {
  score: number;
  findings: ReviewFinding[];
  summary: string;
  configHash: string;
}

const SEVERITY_PENALTY: Record<ReviewSeverity, number> = {
  critical: 20,
  moderate: 10,
  minor: 4,
};

const CATEGORY_MAP: Record<string, ReviewCategory> = {
  'Brand voice and tone': 'Voice & Claims',
  'Approved and prohibited terminology': 'Terminology',
  'Messaging principles': 'Voice & Claims',
  'Approved factual claims and promotional statements': 'Evidence',
  'Accessibility guidelines': 'Accessibility',
  'Visual identity guidance': 'Accessibility',
  'General brand rules': 'Voice & Claims',
};

const SPECIAL_RULE_TYPES: Record<string, GuidelineRuleType> = {
  'R-101': 'guidance',
  'R-102': 'approved_terminology',
  'R-103': 'claim_evidence',
  'R-104': 'prohibited_term',
  'R-105': 'guidance',
  'R-106': 'guidance',
  'R-107': 'guidance',
  'R-108': 'guidance',
};

const hasBuiltInAnalysis = (rule: GuidelineRecord): boolean => (
  SPECIAL_RULE_TYPES[rule.id] === rule.ruleType
);

const toRule = (record: GuidelineRecord): LocalBrandRule => ({
  id: record.id,
  title: record.title,
  category: CATEGORY_MAP[record.category] ?? 'Voice & Claims',
  severity: record.severity,
  rationale: record.description,
});

export const getLocalBrandRules = (): LocalBrandRule[] => readGuidelines()
  .filter((guideline) => guideline.isActive)
  .map(toRule);

export const getLocalEvidenceCatalogue = (): LocalEvidence[] => readEvidenceRecords().map((evidence) => ({
  id: evidence.id,
  label: evidence.title,
  source: evidence.sourceName,
  approvedPhrase: evidence.associatedClaim,
  note: evidence.description,
  verificationStatus: evidence.verificationStatus,
  freshness: getEvidenceFreshness(evidence),
  sourceUrl: evidence.sourceUrl,
}));

interface FindingDraft extends Omit<ReviewFinding, 'id'> {
  id: string;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matches = (content: string, expression: RegExp): RegExpExecArray[] => {
  const globalExpression = new RegExp(expression.source, `${expression.flags.replace(/g/g, '')}g`);
  const found: RegExpExecArray[] = [];
  let match = globalExpression.exec(content);
  while (match) {
    found.push(match);
    if (match[0].length === 0) globalExpression.lastIndex += 1;
    match = globalExpression.exec(content);
  }
  return found;
};

const literalMatches = (content: string, phrases: string[]): RegExpExecArray[] => {
  const expressions = phrases
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .map((phrase) => new RegExp(`(?<![\\w])${escapeRegExp(phrase).replace(/\s+/g, '\\s+')}(?![\\w])`, 'gi'));
  return expressions.flatMap((expression) => matches(content, expression))
    .sort((left, right) => left.index - right.index || right[0].length - left[0].length)
    .filter((match, index, list) => !list.some((other, otherIndex) => (
      otherIndex < index && match.index < other.index + other[0].length && other.index < match.index + match[0].length
    )));
};

const ruleFinder = (rules: GuidelineRecord[]) => (id: string): GuidelineRecord | undefined => (
  rules.find((rule) => rule.id === id && rule.isActive)
);

const makeFinding = (
  matchIndex: number,
  matchedText: string,
  rule: GuidelineRecord,
  options: {
    reason: string;
    evidence?: EvidenceRecord;
    evidenceStatus?: ReviewFinding['evidenceStatus'];
    suggestion: string;
    suggestionLabel: string;
  },
): FindingDraft => ({
  id: `${rule.id}-${matchIndex}-${matchedText.length}-${options.suggestionLabel}`,
  ruleId: rule.id,
  ruleTitle: rule.title,
  category: CATEGORY_MAP[rule.category] ?? 'Voice & Claims',
  severity: rule.severity,
  quote: matchedText,
  startIndex: matchIndex,
  endIndex: matchIndex + matchedText.length,
  reason: options.reason,
  evidenceReference: options.evidence
    ? `${options.evidence.id} — ${options.evidence.title}`
    : rule.ruleType === 'guidance' || rule.ruleType === 'prohibited_term' || rule.ruleType === 'approved_terminology'
      ? `${rule.id} — local guideline`
      : null,
  evidenceStatus: options.evidence
    ? options.evidenceStatus === 'unverified'
      ? 'unverified'
      : options.evidenceStatus === 'rule-only'
        ? 'rule-only'
        : getEvidenceFreshness(options.evidence) === 'verified' ? 'matched' : 'unverified'
    : rule.ruleType === 'guidance' || rule.ruleType === 'prohibited_term' || rule.ruleType === 'approved_terminology'
      ? 'rule-only'
      : options.evidenceStatus ?? 'unverified',
  suggestion: options.suggestion,
  suggestionLabel: options.suggestionLabel,
  guidelineSnapshot: {
    id: rule.id,
    title: rule.title,
    description: rule.description,
    category: rule.category,
  },
  evidenceSnapshot: options.evidence ? {
    id: options.evidence.id,
    title: options.evidence.title,
    sourceName: options.evidence.sourceName,
    sourceUrl: options.evidence.sourceUrl,
    associatedClaim: options.evidence.associatedClaim,
    verificationStatus: options.evidence.verificationStatus,
    lastReviewedAt: options.evidence.lastReviewedAt,
    reviewDueAt: options.evidence.reviewDueAt,
  } : undefined,
});

const buildRuleFindings = (
  content: string,
  rule: GuidelineRecord,
  reason: (phrase: string) => string,
  suggestion: (phrase: string) => string,
  suggestionLabel: string,
): FindingDraft[] => literalMatches(content, rule.phrases).map((match) => (
  makeFinding(match.index, match[0], rule, {
    reason: reason(match[0]),
    suggestion: suggestion(match[0]),
    suggestionLabel,
  })
));

const analyzeSuperlatives = (content: string, rule: GuidelineRecord): FindingDraft[] => {
  const fixed = /\b(?:best[\s-]+in[\s-]+class|world[\s-]+leading|industry[\s-]+leading|revolutionary|unmatched|unprecedented|number\s+one|#1)\b|\bbest\s+(?:[a-z]+\s+){0,2}(?:in the world|on earth|ever|globally|in india)\b|\b(?:most|fastest|largest|only)\s+[a-z]+\s+in the world\b/gi;
  const custom = literalMatches(content, rule.phrases);
  const all = [...matches(content, fixed), ...custom]
    .sort((left, right) => left.index - right.index)
    .filter((match, index, list) => !list.some((other, otherIndex) => otherIndex < index
      && match.index < other.index + other[0].length && other.index < match.index + match[0].length));
  return all.flatMap((match) => {
    const context = content.slice(Math.max(0, match.index - 55), match.index + match[0].length + 85);
    const verifiedEvidence = findEvidenceForClaim(context, rule.id);
    if (verifiedEvidence) return [];
    const candidateEvidence = findEvidenceCandidatesForClaim(context, rule.id)[0];
    return [makeFinding(match.index, match[0], rule, {
      reason: candidateEvidence
        ? `A related catalogue entry exists (${candidateEvidence.id}) but is ${getEvidenceFreshness(candidateEvidence)}; this claim remains Unverified.`
        : 'This comparative or absolute claim is not supported by applicable verified evidence in the local catalogue. The wording is Unverified, not established as false.',
      evidence: candidateEvidence,
      evidenceStatus: 'unverified',
      suggestion: '',
      suggestionLabel: 'Qualify or remove unsupported wording',
    })];
  });
};

const analyzeClaimTerms = (content: string, rule: GuidelineRecord): FindingDraft[] => {
  const expression = /\b(?:guarantee(?:d|s|ing)?|promise(?:s|d|ing)?|always|never fail|zero[- ]risk|risk[- ]free|no possibility of failure|no downtime|100%\s*[a-z]*|(?:\d+(?:\.\d+)?x)\s+faster)\b/gi;
  const phrases = literalMatches(content, rule.phrases);
  const all = [...matches(content, expression), ...phrases]
    .sort((left, right) => left.index - right.index)
    .filter((match, index, list) => !list.some((other, otherIndex) => otherIndex < index
      && match.index < other.index + other[0].length && other.index < match.index + match[0].length));
  return all.flatMap((match) => {
    const context = content.slice(Math.max(0, match.index - 55), match.index + match[0].length + 85);
    const evidence = findEvidenceCandidatesForClaim(context, rule.id)
      .find((candidate) => candidate.associatedClaim.toLowerCase().includes(match[0].toLowerCase()));
    if (evidence && getEvidenceFreshness(evidence) === 'verified') return [];
    return [makeFinding(match.index, match[0], rule, {
      reason: evidence
        ? `A related catalogue entry exists (${evidence.id}) but is ${getEvidenceFreshness(evidence)}; this claim remains Unverified.`
        : 'This guarantee or absolute claim has no applicable verified evidence in the local catalogue, so it is Unverified.',
      evidence,
      evidenceStatus: 'unverified',
      suggestion: '',
      suggestionLabel: evidence ? 'Check against cited source' : 'Qualify or remove unsupported wording',
    })];
  });
};

const analyzePercentages = (content: string, rule: GuidelineRecord): FindingDraft[] => (
  matches(content, /\b\d+(?:\.\d+)?\s?%/g).flatMap((match) => {
    const context = content.slice(Math.max(0, match.index - 55), match.index + match[0].length + 85);
    const evidence = findEvidenceForClaim(context, rule.id);
    if (evidence) return [];
    const candidateEvidence = findEvidenceCandidatesForClaim(context, rule.id)[0];
    return [makeFinding(match.index, match[0], rule, {
      reason: candidateEvidence
        ? `A relevant catalogue entry exists (${candidateEvidence.id}) but is ${getEvidenceFreshness(candidateEvidence)}; the figure remains Unverified.`
        : 'A percentage needs approved, current evidence matching this specific figure and context. No applicable verified source is available, so this figure is Unverified.',
      evidence: candidateEvidence,
      evidenceStatus: 'unverified',
      suggestion: '',
      suggestionLabel: 'Add a source or remove the figure',
    })];
  })
);

const analyzeQuantifiedOutcomes = (content: string, rule: GuidelineRecord): FindingDraft[] => (
  matches(content, /\b\d+(?:\.\d+)?\s?(?:x|×|times?)\b|\b(?:in|within|over|for)\s+(?:just\s+)?\d+\s+(?:days?|weeks?|months?|hours?|minutes?)\b/gi)
    .flatMap((match) => {
      const context = content.slice(Math.max(0, match.index - 55), match.index + match[0].length + 85);
      const evidence = findEvidenceForClaim(context, rule.id);
      if (evidence) return [];
      const candidateEvidence = findEvidenceCandidatesForClaim(context, rule.id)[0];
      return [makeFinding(match.index, match[0], rule, {
        reason: candidateEvidence
          ? `A related catalogue entry exists (${candidateEvidence.id}) but is ${getEvidenceFreshness(candidateEvidence)}; this quantified outcome remains Unverified.`
          : 'A quantified outcome needs applicable, verified evidence matching this figure and context. No applicable verified source is available, so this claim is Unverified.',
        evidence: candidateEvidence,
        evidenceStatus: 'unverified',
        suggestion: '',
        suggestionLabel: 'Add a source or remove the figure',
      })];
    })
);

const analyzeApprovedTerms = (content: string, rule: GuidelineRecord): FindingDraft[] => {
  const alternativeMatches = literalMatches(content, rule.phrases)
    .filter((match) => {
      if (!rule.approvedPhrase) return true;
      const matched = content.slice(match.index, match.index + match[0].length);
      const fullApproved = content.slice(match.index, match.index + rule.approvedPhrase.length);
      return matched.toLowerCase() !== rule.approvedPhrase.toLowerCase()
        && fullApproved.toLowerCase() !== rule.approvedPhrase.toLowerCase();
    });
  return alternativeMatches.map((match) => makeFinding(match.index, match[0], rule, {
    reason: `This wording differs from the approved term “${rule.approvedPhrase}” configured in this guideline.`,
    suggestion: rule.approvedPhrase,
    suggestionLabel: 'Apply approved terminology',
  }));
};

const analyzeBrandName = (content: string, rule: GuidelineRecord): FindingDraft[] => (
  matches(content, /\bbrand\s?lens(?:\s+ai)?\b/gi)
    .filter((match) => content.slice(match.index, match.index + 'BrandLens AI'.length) !== 'BrandLens AI')
    .map((match) => makeFinding(match.index, match[0], rule, {
      reason: `This spelling differs from the approved “${rule.approvedPhrase || 'BrandLens AI'}” wordmark in the local terminology directive.`,
      suggestion: rule.approvedPhrase || 'BrandLens AI',
      suggestionLabel: 'Apply approved wordmark',
    }))
);

const analyzeTimeSensitive = (content: string, rule: GuidelineRecord): FindingDraft[] => {
  const standard = /\b(?:current(?:ly)?|latest|as of|today'?s|this year'?s)(?:\s+(?:20\d{2}|Q[1-4]|pricing|version|figures|results|policy|information|data|rates|release|guidance|offer|plan|availability|requirements|terms)){0,3}/gi;
  const standardMatches = matches(content, standard);
  const customMatches = literalMatches(content, rule.phrases);
  const all = [...standardMatches, ...customMatches]
    .sort((left, right) => left.index - right.index)
    .filter((match, index, list) => !list.some((other, otherIndex) => otherIndex < index
      && match.index < other.index + other[0].length && other.index < match.index + match[0].length));
  return all.flatMap((match) => {
    const phrase = match[0].trimEnd();
    const context = content.slice(Math.max(0, match.index - 55), match.index + phrase.length + 85);
    const evidence = findEvidenceForClaim(context, rule.id);
    if (evidence) return [];
    const candidateEvidence = findEvidenceCandidatesForClaim(context, rule.id)[0];
    return [makeFinding(match.index, phrase, rule, {
      reason: candidateEvidence
        ? `A related catalogue entry exists (${candidateEvidence.id}) but is ${getEvidenceFreshness(candidateEvidence)}; current accuracy remains Unverified.`
        : 'This time-sensitive statement has no applicable current verified source in the catalogue. Its accuracy is Unverified.',
      evidence: candidateEvidence,
      evidenceStatus: 'unverified',
      suggestion: '',
      suggestionLabel: 'Add a current source or remove the claim',
    })];
  });
};

const analyzeAccessibility = (content: string, rule: GuidelineRecord): FindingDraft[] => {
  const vague = matches(content, /\b(?:click here|read more|learn more)\b/gi).map((match) => (
    makeFinding(match.index, match[0], rule, {
      reason: 'This call to action does not describe its destination for people using assistive technology.',
      suggestion: match[0].toLowerCase() === 'click here' ? 'View the linked details' : 'Read the full details',
      suggestionLabel: 'Use a descriptive link label',
    })
  ));
  const allCaps = matches(content, /\b[A-Z]{4,}(?:\s+[A-Z]{2,}){1,}\b/g).map((match) => (
    makeFinding(match.index, match[0], rule, {
      reason: 'Extended all-caps text can reduce readability, especially for some readers with low vision or dyslexia.',
      suggestion: match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
      suggestionLabel: 'Use sentence case',
    })
  ));
  const missingAlt = matches(content, /!\[\s*\]\([^)]+\)|\[(?:image|photo|graphic)\s*\]/gi).map((match) => (
    makeFinding(match.index, match[0], rule, {
      reason: 'An image is referenced without a text alternative describing its purpose or content.',
      suggestion: '[Image: add a concise description of the image]',
      suggestionLabel: 'Add an image description',
    })
  ));
  const custom = buildRuleFindings(content, rule, (phrase) => `“${phrase}” matches an accessibility guideline configured in the local rulebook.`, () => '', 'Review accessibility wording');
  return [...vague, ...allCaps, ...missingAlt, ...custom]
    .sort((left, right) => left.startIndex - right.startIndex)
    .filter((finding, index, list) => !list.some((other, otherIndex) => (
      otherIndex < index && finding.startIndex < other.endIndex && other.startIndex < finding.endIndex
    )));
};

const analyzeDismissiveTone = (content: string, rule: GuidelineRecord): FindingDraft[] => {
  const patterns = [
    /\b(?:don['’]?t|do not)\s+require\s+anybody\s+else['’]?s\s+advice\b/gi,
    /\bignore\s+(?:the\s+)?competitors\b/gi,
    /\b[A-Z]{3,}\b/g,
  ];
  const phraseFindings = patterns.flatMap((pattern) => matches(content, pattern));
  const exclamationFindings = matches(content, /!{2,}/g);
  const configured = literalMatches(content, rule.phrases);
  const all = [...phraseFindings, ...exclamationFindings, ...configured]
    .sort((left, right) => left.index - right.index || right[0].length - left[0].length)
    .filter((match, index, list) => !list.some((other, otherIndex) => otherIndex < index
      && match.index < other.index + other[0].length && other.index < match.index + match[0].length));

  return all.map((match) => makeFinding(match.index, match[0], rule, {
    reason: /!{2,}/.test(match[0])
      ? 'Repeated exclamation marks can make the message feel overly forceful.'
      : /^[A-Z]{3,}$/.test(match[0])
        ? 'All-caps wording can read as shouting; use sentence case unless this is an approved acronym.'
        : 'Dismissive language undermines a measured, human-centered brand voice.',
    suggestion: /^[A-Z]{3,}$/.test(match[0]) ? match[0].toLowerCase() : '',
    suggestionLabel: 'Use a measured, respectful tone',
  }));
};

export interface VisualReviewInput {
  foreground: string;
  background: string;
  accent: string;
}

const parseHexColor = (value: string): [number, number, number] | null => {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return null;
  const expanded = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
};

const relativeLuminance = ([red, green, blue]: [number, number, number]): number => {
  const linear = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const analyzeVisualPalette = (input: VisualReviewInput, rule: GuidelineRecord): FindingDraft[] => {
  const foreground = parseHexColor(input.foreground);
  const background = parseHexColor(input.background);
  const palette = new Set(['#F7F4EB', '#181816', '#1E3A2F', '#B4532A']);
  const normalizedAccent = input.accent.trim().toUpperCase();
  const onBrand = [input.foreground, input.background, input.accent]
    .every((color) => palette.has(color.trim().toUpperCase()));
  const findings: FindingDraft[] = [];
  if (foreground && background) {
    const l1 = relativeLuminance(foreground);
    const l2 = relativeLuminance(background);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) {
      findings.push(makeFinding(0, `${input.foreground} on ${input.background}`, rule, {
        reason: `The selected foreground/background contrast is ${ratio.toFixed(2)}:1, below the WCAG 2.1 AA 4.5:1 threshold for normal text.`,
        suggestion: 'Choose a higher-contrast foreground or background pair.',
        suggestionLabel: 'Improve text contrast',
      }));
    }
  }
  if (!onBrand || !palette.has(normalizedAccent)) {
    findings.push(makeFinding(0, `${input.foreground} · ${input.background} · ${input.accent}`, rule, {
      reason: 'One or more selected colors fall outside the approved Warm Ivory, Obsidian, Forest Green, and Copper palette.',
      suggestion: '',
      suggestionLabel: 'Return to the brand palette',
    }));
  }
  return findings;
};

const analyzeConfiguredRules = (content: string, rules: GuidelineRecord[]): FindingDraft[] => {
  return rules.filter((rule) => rule.isActive && !hasBuiltInAnalysis(rule) && rule.phrases.length > 0)
    .flatMap((rule) => {
      if (rule.ruleType === 'approved_terminology') return analyzeApprovedTerms(content, rule);
      if (rule.ruleType === 'claim_evidence') {
        const terms = analyzeClaimTerms(content, rule);
        const percentagesRule = rule.id === 'R-103' ? [] : analyzePercentages(content, rule);
        return [...terms, ...percentagesRule];
      }
      return buildRuleFindings(
        content,
        rule,
        (phrase) => `“${phrase}” matches a configured ${rule.category.toLowerCase()} guideline.`,
        () => '',
        'Review against guideline',
      );
    });
};

export const analyzeLocalContent = (content: string, visualInput?: VisualReviewInput): LocalReviewAnalysis => {
  const configured = readGuidelines();
  const find = ruleFinder(configured);
  const findings: FindingDraft[] = [];
  const superlatives = find('R-101');
  if (superlatives && hasBuiltInAnalysis(superlatives)) findings.push(...analyzeSuperlatives(content, superlatives));
  const claims = find('R-103');
  if (claims && hasBuiltInAnalysis(claims)) {
    findings.push(
      ...analyzeClaimTerms(content, claims),
      ...analyzePercentages(content, claims),
      ...analyzeQuantifiedOutcomes(content, claims),
    );
  }
  const brand = find('R-102');
  if (brand && hasBuiltInAnalysis(brand)) findings.push(...analyzeBrandName(content, brand));
  const disallowed = find('R-104');
  if (disallowed && hasBuiltInAnalysis(disallowed)) findings.push(...buildRuleFindings(content, disallowed,
    (phrase) => `“${phrase}” appears in the configured disallowed terminology list.`,
    () => '',
    'Replace disallowed jargon'));
  const timeSensitive = find('R-105');
  if (timeSensitive && hasBuiltInAnalysis(timeSensitive)) findings.push(...analyzeTimeSensitive(content, timeSensitive));
  const accessibility = find('R-106');
  if (accessibility && hasBuiltInAnalysis(accessibility)) findings.push(...analyzeAccessibility(content, accessibility));
  const tone = find('R-108');
  if (tone && hasBuiltInAnalysis(tone)) findings.push(...analyzeDismissiveTone(content, tone));
  const visual = find('R-107');
  if (visualInput && visual && hasBuiltInAnalysis(visual)) findings.push(...analyzeVisualPalette(visualInput, visual));
  findings.push(...analyzeConfiguredRules(content, configured));
  const orderedFindings = findings
    .sort((left, right) => left.startIndex - right.startIndex || left.ruleId.localeCompare(right.ruleId));

  const score = Math.max(0, 100 - orderedFindings.reduce(
    (total, finding) => total + SEVERITY_PENALTY[finding.severity],
    0,
  ));
  const criticalCount = orderedFindings.filter((finding) => finding.severity === 'critical').length;
  const moderateCount = orderedFindings.filter((finding) => finding.severity === 'moderate').length;
  const minorCount = orderedFindings.filter((finding) => finding.severity === 'minor').length;
  const summary = orderedFindings.length === 0
    ? 'No configured active local rules matched this draft. This heuristic result is not a guarantee of compliance or factual accuracy.'
    : `${orderedFindings.length} finding${orderedFindings.length === 1 ? '' : 's'}: ${criticalCount} critical, ${moderateCount} moderate, and ${minorCount} minor. Unsupported claims without applicable verified evidence are Unverified, not false.`;

  return {
    score,
    findings: orderedFindings,
    summary,
    configHash: getWorkspaceAnalysisConfigHash(),
  };
};
