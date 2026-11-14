import prompts from "../prompts.json";
import type { Score } from "./contract";
import {
  agreement,
  type PromptRow,
  percentile,
  resultMarkdown,
  type TimedRow,
} from "./evaluate";
import { loadGemma, MODEL_ID, scoreGemma } from "./gemma";
import { scoreKeyword } from "./keyword";
import "./style.css";

const $ = (selector: string) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing page element: ${selector}`);
  return element;
};
const runButton = $("#run") as HTMLButtonElement;
const copyButton = $("#copy") as HTMLButtonElement;
const gpuStatus = $("#gpu-status");
const progressWrap = $("#progress-wrap");
const progress = $("#progress") as HTMLProgressElement;
let webgpuAvailable = false;
let markdown = "";

const corpus = prompts as PromptRow[];

async function checkWebGpu() {
  try {
    if (!("gpu" in navigator))
      throw new Error("WebGPU API is missing in this browser.");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No WebGPU adapter was found.");
    webgpuAvailable = true;
    gpuStatus.innerHTML = '<span class="dot ready"></span>WebGPU available';
    runButton.disabled = false;
    return;
  } catch (error) {
    gpuStatus.innerHTML = `<span class="dot fail"></span>${escapeHtml((error as Error).message)}`;
    $("#run-state").textContent =
      "Gemma WebGPU cannot run in this browser. The keyword scorer still works locally; use the Node command in the README to try the same ONNX model on CPU.";
    runButton.disabled = false;
    runButton.textContent = "Run keyword benchmark";
  }
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (ch) => entities[ch] ?? ch);
}

function timeKeyword(rows: PromptRow[]): TimedRow[] {
  return rows.map((row) => {
    const start = performance.now();
    const scores: Score[] = scoreKeyword(row.text);
    return { ...row, scores, ms: performance.now() - start };
  });
}

async function browserMemory() {
  const api = performance as Performance & {
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
  };
  if (!api.measureUserAgentSpecificMemory) return undefined;
  try {
    return await api.measureUserAgentSpecificMemory();
  } catch {
    return undefined;
  }
}

function render(
  keywordRows: TimedRow[],
  gemmaRows?: TimedRow[],
  loadMs?: number,
  memoryBytes?: number,
) {
  const kAgreement = agreement(keywordRows);
  const gAgreement = gemmaRows ? agreement(gemmaRows) : undefined;
  $("#load-time").textContent =
    loadMs === undefined ? "Not run" : `${(loadMs / 1000).toFixed(1)}s`;
  $("#median-time").textContent = gemmaRows
    ? `${percentile(
        gemmaRows.map((r) => r.ms),
        0.5,
      ).toFixed(0)}ms`
    : "—";
  $("#p95-time").textContent = gemmaRows
    ? `${percentile(
        gemmaRows.map((r) => r.ms),
        0.95,
      ).toFixed(0)}ms`
    : "—";
  $("#memory").textContent =
    memoryBytes === undefined
      ? "Unavailable"
      : `${(memoryBytes / 1024 / 1024).toFixed(0)} MB`;
  $("#question-results").innerHTML = kAgreement.perQuestion
    .map(
      (item, i) =>
        `<tr><td>${escapeHtml(item.id)}<br><span class="muted">${escapeHtml(item.label)}</span></td><td>${item.correct}/${item.total} · ${item.percent.toFixed(0)}%</td><td>${gAgreement ? `${gAgreement.perQuestion[i].correct}/${gAgreement.perQuestion[i].total} · ${gAgreement.perQuestion[i].percent.toFixed(0)}%` : "—"}</td></tr>`,
    )
    .join("");
  const sampleRows = [0, 9, 19]
    .map((index) => {
      const row = keywordRows[index];
      const gemma = gemmaRows?.[index];
      const format = (scores?: Score[]) =>
        scores
          ?.slice(0, 4)
          .map((score) => `${score.q}:${score.a}`)
          .join(", ") ?? "—";
      return `<tr><td>${row.id}</td><td>${escapeHtml(format(Object.entries(row.expected).map(([q, a]) => ({ q, a: a as Score["a"], p: 1 }))))}</td><td>${escapeHtml(format(row.scores))}</td><td>${escapeHtml(format(gemma?.scores))}</td><td>${gemma?.ms.toFixed(0) ?? "—"}</td></tr>`;
    })
    .join("");
  $("#prompt-results").innerHTML =
    `<table><thead><tr><th>Sample</th><th>Expected (first 4)</th><th>Keyword</th><th>Gemma + fallback</th><th>Gemma ms</th></tr></thead><tbody>${sampleRows}</tbody></table>`;
  const memory =
    memoryBytes === undefined
      ? undefined
      : `${(memoryBytes / 1024 / 1024).toFixed(0)} MB`;
  markdown = resultMarkdown({
    webgpu: webgpuAvailable ? "available" : "unavailable",
    loadMs,
    memory,
    keywordRows,
    gemmaRows,
    location: webgpuAvailable ? "browser WebGPU" : "browser keyword-only",
  });
  const summary =
    `Keyword ${kAgreement.correct}/${kAgreement.total} (${kAgreement.percent.toFixed(1)}%)` +
    (gAgreement
      ? ` · Gemma ${gAgreement.correct}/${gAgreement.total} (${gAgreement.percent.toFixed(1)}%)`
      : "");
  $("#run-state").textContent = `${summary}. Keyword median ${percentile(
    keywordRows.map((r) => r.ms),
    0.5,
  ).toFixed(2)} ms, p95 ${percentile(
    keywordRows.map((r) => r.ms),
    0.95,
  ).toFixed(2)} ms.`;
  copyButton.disabled = false;
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  copyButton.disabled = true;
  progressWrap.classList.remove("hidden");
  const keywordRows = timeKeyword(corpus);
  if (!webgpuAvailable) {
    $("#progress-label").textContent = "Keyword scorer complete; Gemma not run";
    $("#progress-value").textContent = "—";
    progress.value = 0;
    $("#runtime-note").textContent =
      "No WebGPU fallback is attempted. Model text stays local; the static app downloads model assets directly from Hugging Face only when WebGPU is available.";
    render(keywordRows);
    runButton.disabled = false;
    return;
  }
  try {
    $("#progress-label").textContent = `Loading ${MODEL_ID}`;
    const loadMs = await loadGemma("webgpu", (event) => {
      const value =
        typeof event.progress === "number"
          ? Math.max(0, Math.min(100, event.progress))
          : 0;
      progress.value = value;
      $("#progress-value").textContent = `${Math.round(value)}%`;
      $("#progress-label").textContent = event.file
        ? `Loading ${event.file}`
        : (event.status ?? "Loading model files");
    });
    const gemmaRows: TimedRow[] = [];
    for (let i = 0; i < corpus.length; i++) {
      const row = corpus[i];
      $("#progress-label").textContent =
        `Scoring prompt ${i + 1} of ${corpus.length}`;
      $("#progress-value").textContent =
        `${Math.round((i / corpus.length) * 100)}%`;
      progress.value = (i / corpus.length) * 100;
      const start = performance.now();
      const { scores } = await scoreGemma(row.text);
      gemmaRows.push({ ...row, scores, ms: performance.now() - start });
    }
    progress.value = 100;
    $("#progress-label").textContent = "Benchmark complete";
    $("#progress-value").textContent = "100%";
    const memory = await browserMemory();
    $("#runtime-note").textContent =
      "20 prompts scored sequentially; model files cached by the browser for future runs.";
    render(keywordRows, gemmaRows, loadMs, memory?.bytes);
  } catch (error) {
    $("#progress-label").textContent = "Model could not load or run";
    $("#runtime-note").textContent =
      `${(error as Error).message}. No cloud scoring fallback was used.`;
    render(keywordRows);
  } finally {
    runButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(markdown);
  copyButton.textContent = "Copied";
  setTimeout(() => {
    copyButton.textContent = "Copy results";
  }, 1500);
});

void checkWebGpu();
