import { QUESTIONS, type Score } from "./contract";

export type PromptRow = { id: string; text: string; expected: Record<string, string> };
export type TimedRow = { id: string; text: string; expected: Record<string, string>; scores: Score[]; ms: number };

export function agreement(rows: TimedRow[]) {
  const perQuestion = QUESTIONS.map(({ id, label }) => {
    let correct = 0;
    let total = 0;
    for (const row of rows) {
      const score = row.scores.find((item) => item.q === id);
      if (!score || !row.expected[id] || row.expected[id] === "n/a") continue;
      total++;
      if (score.a === row.expected[id]) correct++;
    }
    return { id, label, correct, total, percent: total ? correct / total * 100 : 0 };
  });
  const correct = perQuestion.reduce((sum, item) => sum + item.correct, 0);
  const total = perQuestion.reduce((sum, item) => sum + item.total, 0);
  return { perQuestion, correct, total, percent: total ? correct / total * 100 : 0 };
}

export function percentile(values: number[], pct: number) {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length) return 0;
  return ordered[Math.ceil(pct * ordered.length) - 1] ?? 0;
}

export function resultMarkdown(data: {
  webgpu: string; loadMs?: number; memory?: string;
  keywordRows: TimedRow[]; gemmaRows?: TimedRow[]; location: string;
}) {
  const keyword = agreement(data.keywordRows);
  const gemma = data.gemmaRows ? agreement(data.gemmaRows) : undefined;
  const lines = [
    `## REI-247 benchmark (${data.location})`,
    `WebGPU: ${data.webgpu}; model load: ${data.loadMs === undefined ? "not run" : `${data.loadMs.toFixed(0)} ms`}; memory: ${data.memory ?? "not exposed"}.`,
    "",
    "| Scorer | Agreement | Median ms/prompt | p95 ms/prompt |",
    "|---|---:|---:|---:|",
    `| Keyword | ${keyword.correct}/${keyword.total} (${keyword.percent.toFixed(1)}%) | ${percentile(data.keywordRows.map((r) => r.ms), .5).toFixed(2)} | ${percentile(data.keywordRows.map((r) => r.ms), .95).toFixed(2)} |`,
    ...(gemma ? [`| Gemma + keyword fallback | ${gemma.correct}/${gemma.total} (${gemma.percent.toFixed(1)}%) | ${percentile(data.gemmaRows!.map((r) => r.ms), .5).toFixed(0)} | ${percentile(data.gemmaRows!.map((r) => r.ms), .95).toFixed(0)} |`] : []),
    "",
    "| Question | Keyword | Gemma |",
    "|---|---:|---:|",
    ...keyword.perQuestion.map((row, i) => `| ${row.id} | ${row.correct}/${row.total} (${row.percent.toFixed(0)}%) | ${gemma ? `${gemma.perQuestion[i].correct}/${gemma.perQuestion[i].total} (${gemma.perQuestion[i].percent.toFixed(0)}%)` : "—"} |`),
    "",
    "| Prompt | Expected sample | Keyword | Gemma raw sample |",
    "|---|---|---|---|",
    ...[0, 9, 19].map((index) => {
      const k = data.keywordRows[index]; const g = data.gemmaRows?.[index];
      const answers = (row?: TimedRow) => row ? row.scores.slice(0, 4).map((s) => `${s.q}:${s.a}`).join(", ") : "—";
      return `| ${k.id} | ${Object.entries(k.expected).slice(0, 4).map(([q, a]) => `${q}:${a}`).join(", ")} | ${answers(k)} | ${answers(g)} |`;
    }),
  ];
  return lines.join("\n");
}
