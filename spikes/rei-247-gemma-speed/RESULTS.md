# REI-247 result note

## Environment and model

- Model: `onnx-community/gemma-3-270m-it-ONNX`, instruction-tuned Gemma 3 270M.
- Browser format/runtime: Transformers.js + ONNX Runtime Web, `device: "webgpu"`, `dtype: "q4f16"`.
- Download: approximately 426 MB for q4f16 ONNX weights, plus tokenizer/config files. Downloaded from Hugging Face at runtime. No weights are checked in.
- License: Gemma Terms of Use; follow the Gemma Prohibited Use Policy.
- Browser: no Chromium binary was available in this environment, so WebGPU availability, Gemma load time, inference speed and browser memory were not measured.
- Node: attempted the same model with Transformers.js on CPU. It failed during download with `ENOSPC`; only 170 MB was free and the q4f16 weights are about 426 MB. No Node Gemma timing or model output was recorded.
- Keyword scorer: measured in Node CPU across the 20 prompts: median 0.68 ms/prompt; p95 7.61 ms/prompt. This excludes app startup and is a scorer-only microbenchmark.

## Agreement with hand labels

The keyword scorer agrees on 249 of 289 scored labels (86.2%). Expected `n/a` labels are excluded. Gemma agreement and Gemma timing are unmeasured.

| Question | Keyword | Gemma |
|---|---:|---:|
| target_user | 17/20 (85%) | Not measured |
| problem | 15/20 (75%) | Not measured |
| success_metric | 15/20 (75%) | Not measured |
| acceptance | 18/20 (90%) | Not measured |
| scope_cut | 19/20 (95%) | Not measured |
| decomposed | 16/20 (80%) | Not measured |
| context_given | 20/20 (100%) | Not measured |
| specific_feedback | 4/5 (80%) | Not measured |
| asks_tests | 19/20 (95%) | Not measured |
| cost_latency | 16/20 (80%) | Not measured |
| edge_cases | 18/20 (90%) | Not measured |
| constraints | 14/20 (70%) | Not measured |
| no_why | 19/20 (95%) | Not measured |
| kitchen_sink | 15/20 (75%) | Not measured |
| vague_fix | 4/4 (100%) | Not measured |
| blind_accept | 20/20 (100%) | Not measured |

## Three keyword output samples

All samples use the shared `{q, a, p}` output shape. These are keyword outputs, not Gemma generations.

```json
{"prompt":"Make me a fitness app.","scores":[{"q":"no_why","a":"yes","p":0.77},{"q":"kitchen_sink","a":"partly","p":0.76}]}
{"prompt":"Fix it.","scores":[{"q":"specific_feedback","a":"no","p":0.78},{"q":"vague_fix","a":"yes","p":0.9}]}
{"prompt":"Ship whatever the assistant generated. Don't spend time checking edge cases or tests.","scores":[{"q":"specific_feedback","a":"n/a","p":0.78},{"q":"asks_tests","a":"no","p":0.85},{"q":"cost_latency","a":"partly","p":0.79},{"q":"blind_accept","a":"yes","p":0.88}]}
```

## Recommendation

Use the keyword scorer for the MVP. Its measured Node scoring time is well below the 3 second target, and it reached 86.2% agreement on this small invented set. Keep Gemma as an optional experiment with keyword fallback until it has been run on a WebGPU laptop and shown to meet the latency target. The current environment could not measure Gemma, so this does not establish whether Gemma meets the target.
