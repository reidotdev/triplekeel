import { type Answer, QUESTIONS, type Score } from "./contract";

const patterns: Record<string, RegExp> = {
  audience:
    /\b(for|users?\s+(?:who|that|say|need)|patients|customers|students|parents|renters|workers|designers|researchers|volunteers|nonprofit)\b/i,
  problem:
    /\b(because|problem|currently|spends? too long|miss(?:es|ing)?|forget|abandon|confusing|report(?:s|ed)?|loses?|too many|just to)\b/i,
  metric:
    /\b(success|target|aim|reduce|cut|increase|within|under|at least|by)\b|\b\d+(?:\.\d+)?\s*(?:%|percent|seconds?|minutes?|hours?|days?|weeks?|months?)\b/i,
  acceptance:
    /\b(acceptance|done means|must |can |cannot|should be able to|completed sign-up|returns?|survives?)\b/i,
  scope:
    /\b(out of scope|mvp|first version|exclude|don't (?:add|build|change)|do not (?:add|build|change)|keep .* to|preserve)\b/i,
  steps:
    /(?:^|[.!?]\s*)(?:first|second|third|then|\d+[.)])\s|\b(step 1|build in this order)\b/i,
  context:
    /\b(attached|screenshot|sketch|figma|existing|current|baseline|sample|reference|brand guide|link)\b/i,
  tests:
    /\b(test|tests|testing|verify|check|regression|benchmark|reproduce)\b/i,
  speed:
    /\b(cost|latency|speed|fast(?:er)?|load under|within \d|under \d|budget|4g|seconds?|minutes?|limits?|spend time)\b/i,
  edge: /\b(empty|error|overdue|duplicate|offline|denied|timezone|edge case|small screens?|long drafts?|unavailable|restart)\b/i,
  constraints:
    /\b(use (?:react|next\.js|indexeddb|local storage|browser)|\b(?:react|next\.js|indexeddb|local storage|api|mobile-first|keyboard|screen reader|wcag|local|offline|no account|no reload)\b)/i,
  vagueFix:
    /^\s*(?:please\s+)?(?:just\s+)?(?:fix it|fix this|make it work|try again|do better)[.!\s]*$/i,
  specific:
    /\b(wrapping|under \d+px|preserv(?:e|ing)|rename|reproduce|overlap|instead|because|shows? .* and)\b/i,
  blindAccept:
    /\b(ship|accept|use) whatever (?:the )?(?:assistant|model|ai) (?:generated|output)|\bno need to (?:check|test)|don't (?:check|test)/i,
};

function scoreFor(
  id: string,
  text: string,
  followUp: boolean,
): [Answer, number] {
  const has = (name: string) => patterns[name].test(text);
  const short = text.trim().split(/\s+/).length < 10;
  const noWhy = !has("audience") && !has("problem");
  const followUpPrompt =
    /^(?:fix|change|update|adjust|try again|make it work|that|this|it)\b/i.test(
      text,
    ) ||
    /^(?:users? (?:say|report)|the (?:chart|export|onboarding)|the current onboarding)\b/i.test(
      text,
    );
  const manyFeatures =
    (text.match(/\b(?:and|with|include|plus)\b/gi) ?? []).length >= 4;
  const negatedTests =
    /\b(?:don't|do not|never|without)\b[^.!?]{0,40}\b(?:test|check|verify)/i.test(
      text,
    );
  const map: Record<string, [Answer, number]> = {
    target_user: [
      has("audience") ? "yes" : "no",
      has("audience") ? 0.83 : 0.76,
    ],
    problem: [has("problem") ? "yes" : "no", has("problem") ? 0.8 : 0.74],
    success_metric: [has("metric") ? "yes" : "no", has("metric") ? 0.82 : 0.78],
    acceptance: [
      has("acceptance") ? "yes" : "no",
      has("acceptance") ? 0.84 : 0.76,
    ],
    scope_cut: [has("scope") ? "yes" : "no", has("scope") ? 0.82 : 0.76],
    decomposed: [has("steps") ? "yes" : "no", has("steps") ? 0.79 : 0.77],
    context_given: [
      has("context") ? "yes" : "no",
      has("context") ? 0.82 : 0.75,
    ],
    specific_feedback: [
      followUp
        ? has("specific") || text.split(/\s+/).length > 8
          ? "yes"
          : "no"
        : "n/a",
      0.78,
    ],
    asks_tests: [
      has("tests") && !negatedTests ? "yes" : "no",
      has("tests") ? 0.85 : 0.76,
    ],
    cost_latency: [
      has("speed") ? (text.match(/\bspend time\b/i) ? "partly" : "yes") : "no",
      has("speed") ? 0.79 : 0.76,
    ],
    edge_cases: [has("edge") ? "yes" : "no", has("edge") ? 0.8 : 0.75],
    constraints: [
      has("constraints") ? "yes" : "no",
      has("constraints") ? 0.81 : 0.75,
    ],
    no_why: [noWhy && !followUpPrompt ? "yes" : "no", 0.77],
    kitchen_sink: [
      manyFeatures
        ? "yes"
        : noWhy && /\b(?:make|build|create)\b/i.test(text)
          ? "partly"
          : "no",
      manyFeatures ? 0.81 : 0.76,
    ],
    vague_fix: [followUp && short && has("vagueFix") ? "yes" : "no", 0.9],
    blind_accept: [has("blindAccept") ? "yes" : "no", 0.88],
  };
  return map[id] ?? ["no", 0.5];
}

export function scoreKeyword(prompt: string): Score[] {
  const text = prompt.trim();
  const followUp =
    /^(?:fix|change|update|adjust|try again|make it work|that|this|it)\b/i.test(
      text,
    ) ||
    /^(?:users? (?:say|report)|the (?:chart|export|onboarding)|the current onboarding)\b/i.test(
      text,
    );
  return QUESTIONS.map(({ id }) => {
    const [a, p] = scoreFor(id, text, followUp);
    return { q: id, a, p };
  });
}
