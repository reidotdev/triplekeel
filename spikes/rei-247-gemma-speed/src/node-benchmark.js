import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { pipeline } from "@huggingface/transformers";

const modelId = "onnx-community/gemma-3-270m-it-ONNX";
const prompts = JSON.parse(
  await readFile(new URL("../prompts.json", import.meta.url), "utf8"),
);
const questions = [
  "target_user",
  "problem",
  "success_metric",
  "acceptance",
  "scope_cut",
  "decomposed",
  "context_given",
  "specific_feedback",
  "asks_tests",
  "cost_latency",
  "edge_cases",
  "constraints",
  "no_why",
  "kitchen_sink",
  "vague_fix",
  "blind_accept",
];
const template = `Assess this product prompt. Return JSON only as an array of objects {"q":"question_id","a":"yes|partly|no|n/a","p":0.0}. Use only the exact IDs: ${questions.join(", ")}. For good habits say yes if present, partly if implied, otherwise no. For bad habits say yes if present, otherwise no. specific_feedback is n/a unless it is a follow-up. Prompt: <prompt>{{PROMPT}}</prompt> JSON:`;
const loadStart = performance.now();
const model = await pipeline("text-generation", modelId, {
  device: "cpu",
  dtype: "q4f16",
});
const loadMs = performance.now() - loadStart;
const rows = [];
for (const prompt of prompts) {
  const start = performance.now();
  const out = await model(template.replace("{{PROMPT}}", prompt.text), {
    max_new_tokens: 320,
    do_sample: false,
  });
  const ms = performance.now() - start;
  rows.push({
    id: prompt.id,
    ms,
    output: out?.[0]?.generated_text?.at?.(-1)?.content ?? "",
  });
  console.log(`${prompt.id}\t${ms.toFixed(0)} ms`);
}
const sorted = rows.map((row) => row.ms).sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      modelId,
      location: "Node CPU",
      loadMs,
      medianMs: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      firstOutput: rows[0].output,
      rows,
    },
    null,
    2,
  ),
);
