import { pipeline } from "@huggingface/transformers";
import { mergeWithFallback, QUESTIONS, type Score } from "./contract";
import { scoreKeyword } from "./keyword";

export const MODEL_ID = "onnx-community/gemma-3-270m-it-ONNX";
export const MODEL_SIZE =
  "270M parameters; quantized ONNX files downloaded from Hugging Face at runtime (no weights in this repo).";

export const TEMPLATE = `You are a careful evaluator of a user-written product prompt. Assess only what the prompt says; do not invent missing details. Return JSON only as an array of exactly 16 objects, with keys q, a, p. q must use these IDs exactly. a must be yes, partly, no, or n/a. p is your confidence from 0 to 1. Use n/a for specific_feedback when the prompt is not a follow-up. For good habits, answer yes when clearly present, partly when only implied or incomplete, otherwise no. For bad habits, answer yes when clearly present, partly when borderline, otherwise no. Output no markdown or explanation.
Questions:
${QUESTIONS.map(({ id, label, kind }) => `- ${id} (${kind}): ${label}`).join("\n")}

Prompt to evaluate:
<prompt>
{{PROMPT}}
</prompt>

JSON:`;

type TextGenerator = (
  input: string,
  options: Record<string, unknown>,
) => Promise<unknown>;

let generate: TextGenerator | undefined;

function generatedText(output: unknown): string {
  if (Array.isArray(output) && output.length) {
    const row = output[0] as { generated_text?: unknown };
    const result = row?.generated_text;
    if (typeof result === "string") return result;
    if (Array.isArray(result) && result.length) {
      const last = result.at(-1) as { content?: unknown };
      if (typeof last?.content === "string") return last.content;
    }
  }
  return "";
}

function parseJson(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

export async function loadGemma(
  device: "webgpu" | "wasm" | "cpu" = "webgpu",
  onProgress: (progress: {
    status?: string;
    file?: string;
    progress?: number;
  }) => void = () => {},
) {
  const start = performance.now();
  const model = await pipeline("text-generation", MODEL_ID, {
    device,
    dtype: "q4f16",
    progress_callback: onProgress,
  } as never);
  generate = model as unknown as TextGenerator;
  return performance.now() - start;
}

export async function scoreGemma(
  prompt: string,
): Promise<{ scores: Score[]; raw: string }> {
  if (!generate) throw new Error("Load the local Gemma model before scoring.");
  const output = await generate(TEMPLATE.replace("{{PROMPT}}", prompt), {
    max_new_tokens: 320,
    do_sample: false,
    temperature: 0,
  });
  const raw = generatedText(output);
  const scores = mergeWithFallback(parseJson(raw), scoreKeyword(prompt));
  return { scores, raw };
}
