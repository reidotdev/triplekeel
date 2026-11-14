// Keyword scorer: the MVP scorer (REI-256, ADR-0012). Rules per question from
// text features. Runs on the device, needs no download, and is deterministic.
// Tune rules against eval/dev.ts only, never against eval/holdout.ts.
import type { Answer, QuestionId, TrackQuestion } from "@triplekeel/schema";
import type {
  ProgressCallback,
  ScoreContext,
  ScoredAnswer,
  Scorer,
} from "./types.js";

/** Specific people or groups a prompt can name as its user or audience. */
const ROLES =
  "clients?|buyers?|sellers?|shoppers?|subscribers?|(?<!screen )readers?|viewers?|listeners?|teams?|businesses|nonprofits?|clinics?|schools?|dentists?|shops?|restaurants?|startups?|agencies|managers?|admins?|operators?|staff|employees?|workers?|nurses?|doctors?|patients?|clinicians?|students?|teachers?|parents?|kids|families|designers?|developers?|engineers?|marketers?|sales ?(?:team|reps?)|founders?|freelancers?|creators?|owners?|landlords?|tenants?|renters?|drivers?|riders?|travell?ers?|volunteers?|researchers?|analysts?|beginners?|seniors?|newcomers?|recruiters?|candidates?|agents?";

/** Bare words for users. They only name an audience with a qualifier. */
const GENERIC = "users?|customers?|people|members?|visitors?";
const QUALIFIER =
  "new|first-time|existing|returning|paying|free|trial|power|enterprise|remote|busy|small|local|young|older|[a-z]+-[a-z]+";

const AUDIENCE = new RegExp(
  [
    `\\b(?:${ROLES})\\b`,
    `\\b(?:${QUALIFIER})\\s+(?:${GENERIC})\\b`,
    `\\b(?:${GENERIC})\\s+who\\b`,
    "\\b(?:persona|personas|target (?:users?|audience)|audience|segment)\\b",
  ].join("|"),
  "i",
);
/** "Users say..." names users, but not which ones. */
const AUDIENCE_VAGUE = new RegExp(
  `^\\s*(?:our\\s+)?(?:${GENERIC})\\s+(?:say|says|report|reported|complain|told)\\b`,
  "i",
);

const PROBLEM =
  /\b(?:because|problem|pain(?: point)?s?|struggl\w*|frustrat\w*|confus\w*|miss(?:es|ed|ing)?|forget\w*|churn\w*|drop(?:s|ped)? off|abandon\w*|complain\w*|keep asking|too (?:slow|long|hard|many|much)|takes? too|wast\w*|lose|loses|losing|lost|so that|in order to|we need to|why|currently|by hand|manually|use (?:it|this) to|overlap\w*|broken|bugs?|crash\w*|hidden|can't|cannot|doesn't|fails?)\b/i;

const METRIC =
  /\d+(?:\.\d+)?\s*(?:%|percent\b)|\b\d+ (?:of|out of) \d+\b|\b(?:metrics?|kpis?|conversion|retention|activation|nps|success (?:is|means|looks like|=)|measured by|target(?:s|ed)? (?:of|is)|goal is|increase \w+ by|reduce \w+ by|cut \w+(?: \w+)? by)\b/i;

const ACCEPTANCE_GIVEN =
  /\b(?:acceptance(?: criteria)?:|done (?:when|means)|(?:a|the|each|every|all)\s+(?:[a-z]+\s+)?(?:user|patient|customer|parent|member|admin|visitor)s?\s+can\b|users can\b|definition of done|must\b|should be able to|it works when|given\b.+\bwhen\b.+\bthen)/i;
const ACCEPTANCE_ASKED =
  /\b(?:include|write|add|list|with|draft|suggest)\s+(?:the\s+|some\s+)?acceptance criteria\b/i;

const SCOPE =
  /\b(?:out of scope|not in scope|mvp|first version|v1|for now|only\b|no [a-z]+ features|don't (?:add|build|include|change)|do not (?:add|build|include|change)|leave out|exclude\w*|skip)\b|(?:^|[.!?]\s+)no\s+[a-z]/i;

const STEP_WORDS =
  /\b(?:steps?:|step 1|in this order|phase 1|first[:,]?\s.+\b(?:then|second)\b)|,\s*then\b/i;
const NUMBERED = /(?:^|\s)\d+[.)]\s+\S/g;

const CONTEXT =
  /\b(?:here(?:'s| is| are)|attached|below|these|this list|the following|existing|current|screenshots?|figma|mock-?ups?|examples?|e\.g\.|for instance|similar to|notes:|changes:|data:|our [a-z]+ (?:table|data|database|docs?|codebase|repo|api|design|notes|schema|logs?))\b|https?:\/\/|:\s*\n/i;

const TESTS =
  /\b(?:tests?|testing|unit tests?|e2e|playwright|cypress|jest|vitest|verify|validate|qa|check|benchmark|regression|reproduce)\b/i;
const NEGATED_TESTS =
  /\b(?:don't|do not|no need to|without|skip|never|bother with|no)\b[^.!?]{0,30}\b(?:tests?|testing|check\w*|verify\w*|review\w*)/i;

const COST =
  /\b(?:costs?|budget|price|pricing|cheap\w*|expensive|latency|speed|fast\w*|slow\w*|performance|limits?|limited|quota|tokens?|in under|under \d+\s*(?:ms|s|sec\w*|min\w*|mb|kb)|within \d+\s*(?:ms|s|sec\w*|min\w*)|keep it (?:to|under)|\d+\s*(?:ms|seconds?|minutes?))\b/i;

const EDGE =
  /\b(?:edge cases?|errors?|error states?|empty states?|offline|fails?|failures?|failing|timeouts?|invalid|duplicates?|duplicate rows|missing|null|no results|when there (?:are|is) (?:none|no)|small screens?|mobile(?!-first)|iphone(?: se)?|slow (?:network|connection)|retry|retries|overdue|denied|permissions?|time ?zones?)\b/i;
const NEGATED_EDGE =
  /\b(?:don't|do not|no need to|without|skip|never|bother with)\b[^.!?]{0,30}\bedge cases?\b/i;

const CONSTRAINTS =
  /\b(?:react|next\.?js|vue|svelte|angular|typescript|javascript|python|sql|postgres(?:ql)?|mysql|sqlite|supabase|firebase|tailwind|node(?:\.js)?|graphql|rest api|api|ios|android|swift|kotlin|flutter|react native|aws|gcp|azure|docker|wcag|accessib\w*|keyboard|screen readers?|mobile-first|offline-first|local ?storage|indexeddb|serverless|cloudflare|browser|desktop|local-first|\d+px)\b|\buse (?:our |the )?(?:[a-z]+ ){0,2}(?:table|api|database|schema|sdk|library)\b/i;

const VAGUE_FIX =
  /\b(?:fix (?:it|this|that)|make it work|try again|do better|still (?:broken|wrong|not working)|not working|doesn't work|that's wrong|wrong again|redo it)\b/i;

const SPECIFIC =
  /\d|\bpx\b|\b(?:instead|rename|move|change\s+\S+\s+to|above|below|left|right|wrap\w*|hide|show|keep|remove|replace|align|resize|rotate)\b|["“”']/i;

const BLIND_ACCEPT =
  /\b(?:as is|as-is|ship (?:it|whatever)|just ship|looks good|lgtm|no need to (?:check|test|review)|don't (?:bother|check|test|review)|without (?:checking|testing|review\w*)|whatever (?:you|the (?:ai|model|assistant)) (?:gave|generated|wrote))\b/i;

const BUILD_VERB =
  /\b(?:build|make|create|add|generate|improve|design|implement|develop|code|ship)\b/i;
const PRODUCT_NOUN =
  /\b(?:app|application|platform|crm|website|site|tool|system|product|saas|marketplace|dashboard)\b/i;

const FOLLOW_UP_START =
  /^(?:fix|change|update|adjust|try again|make it|that|this|it|still|now|again|no[,.]|not quite|close|looks good|lgtm|the [\w' -]{1,40}\b(?:is|are) (?:still|now|broken|wrong)\b)/i;

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Feature items in a list: commas plus "and"/"plus" joins. */
function listItems(text: string): number {
  const commas = (text.match(/,/g) ?? []).length;
  const joins = (text.match(/\b(?:and|plus)\b/gi) ?? []).length;
  return commas + joins + 1;
}

function guessFollowUp(text: string): boolean {
  return FOLLOW_UP_START.test(text.trim());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Rule = { a: Answer; p: number };

const yes = (p = 0.82): Rule => ({ a: "yes", p });
const no = (p = 0.76): Rule => ({ a: "no", p });
const na: Rule = { a: "n/a", p: 0.9 };

type Features = {
  text: string;
  followUp: boolean;
  short: boolean;
  audience: boolean;
  problem: boolean;
  metric: boolean;
  context: boolean;
  steps: boolean;
  scope: boolean;
};

function features(prompt: string, followUp: boolean): Features {
  const text = prompt.trim();
  const numbered = (text.match(NUMBERED) ?? []).length;
  return {
    text,
    followUp,
    short: words(text) < 10,
    audience: AUDIENCE.test(text),
    problem: PROBLEM.test(text),
    metric: METRIC.test(text),
    context: CONTEXT.test(text),
    steps: numbered >= 2 || STEP_WORDS.test(text),
    scope: SCOPE.test(text),
  };
}

const RULES: Record<QuestionId, (f: Features) => Rule> = {
  target_user: (f) =>
    AUDIENCE_VAGUE.test(f.text)
      ? { a: "partly", p: 0.7 }
      : f.audience
        ? yes(0.83)
        : no(),
  problem: (f) => (f.problem ? yes(0.8) : no(0.74)),
  success_metric: (f) => (f.metric ? yes(0.82) : no(0.78)),
  acceptance: (f) =>
    ACCEPTANCE_ASKED.test(f.text)
      ? { a: "partly", p: 0.7 }
      : ACCEPTANCE_GIVEN.test(f.text)
        ? yes(0.8)
        : no(),
  scope_cut: (f) => (f.scope ? yes(0.8) : no()),
  decomposed: (f) => (f.steps ? yes(0.84) : no(0.77)),
  context_given: (f) => (f.context ? yes(0.8) : no(0.75)),
  specific_feedback: (f) => {
    if (!f.followUp) return na;
    if (VAGUE_FIX.test(f.text) && f.short) return no(0.85);
    return words(f.text) >= 8 && SPECIFIC.test(f.text) ? yes(0.78) : no(0.72);
  },
  asks_tests: (f) =>
    TESTS.test(f.text) && !NEGATED_TESTS.test(f.text) ? yes(0.85) : no(),
  cost_latency: (f) => (COST.test(f.text) ? yes(0.79) : no()),
  edge_cases: (f) =>
    EDGE.test(f.text) && !NEGATED_EDGE.test(f.text) ? yes(0.8) : no(0.75),
  constraints: (f) => (CONSTRAINTS.test(f.text) ? yes(0.81) : no(0.75)),
  no_why: (f) => {
    if (f.followUp) return na;
    const why = f.audience || f.problem || f.metric || f.context;
    return !why && BUILD_VERB.test(f.text) ? yes(0.77) : no(0.74);
  },
  kitchen_sink: (f) => {
    if (f.followUp) return na;
    const building = BUILD_VERB.test(f.text);
    if (building && !f.steps && !f.scope && listItems(f.text) >= 5) {
      return yes(0.81);
    }
    if (building && PRODUCT_NOUN.test(f.text) && f.short && !f.scope) {
      return { a: "partly", p: 0.7 };
    }
    return no();
  },
  vague_fix: (f) => {
    if (!f.followUp) return na;
    return VAGUE_FIX.test(f.text) && f.short ? yes(0.9) : no(0.8);
  },
  blind_accept: (f) => (BLIND_ACCEPT.test(f.text) ? yes(0.85) : no(0.8)),
};

const FALLBACK_ORDER: readonly Answer[] = ["n/a", "no", "partly", "yes"];

function fit(rule: Rule, allowed: readonly Answer[]): Rule {
  if (allowed.includes(rule.a)) return rule;
  const a = FALLBACK_ORDER.find((x) => allowed.includes(x)) ?? allowed[0];
  return { a, p: 0.5 };
}

/** Scores one prompt. Exported for tests and the agreement report. */
export function scoreKeyword(
  prompt: string,
  questions: readonly TrackQuestion[],
  context?: ScoreContext,
): ScoredAnswer[] {
  const f = features(prompt, context?.followUp ?? guessFollowUp(prompt));
  return questions.map((question) => {
    const rule = RULES[question.id];
    // A question added after v0 with no rule yet gets a low-confidence default.
    const raw = rule ? rule(f) : { a: "n/a" as Answer, p: 0.5 };
    const { a, p } = fit(raw, question.answers);
    return { q: question.id, a, p: round2(p) };
  });
}

export class KeywordScorer implements Scorer {
  readonly id = "keyword" as const;

  async ready(onProgress?: ProgressCallback): Promise<void> {
    onProgress?.(1);
  }

  async score(
    prompt: string,
    questions: readonly TrackQuestion[],
    context?: ScoreContext,
  ): Promise<ScoredAnswer[]> {
    return scoreKeyword(prompt, questions, context);
  }
}

export function createKeywordScorer(): Scorer {
  return new KeywordScorer();
}
