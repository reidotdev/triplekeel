# REI-247 Gemma speed spike

This is a standalone local benchmark for the 16 TripleKeel prompt habits. It compares the keyword rules with Gemma 3 270M IT on 20 invented PM prompts. Prompt text is processed locally. The page makes no scoring API calls.

## Model choice

The model is [`onnx-community/gemma-3-270m-it-ONNX`](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX), an instruction-tuned Gemma 3 270M model exported for Transformers.js. It is the smallest instruction-tuned Gemma export I found that has a Transformers.js path usable in both a browser and Node. Transformers.js uses ONNX Runtime Web with `device: "webgpu"` in the browser and ONNX Runtime Node with `device: "cpu"` for the fallback experiment. The model weights are downloaded from Hugging Face at runtime and are cached by Transformers.js; this repository contains no weights.

The ONNX repository labels the model `gemma`. Use is subject to [Google's Gemma Terms of Use](https://ai.google.dev/gemma/terms) and the Gemma Prohibited Use Policy. Gemma 3 270M has 270 million parameters. The selected quantized `q4f16` ONNX weights are about 426 MB on Hugging Face, plus small tokenizer/config files ([model files](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX/tree/refs/pr/1/onnx)). Actual download bytes are reported by the browser loader and can change with the Hugging Face revision.

I chose Transformers.js over MediaPipe because the published ONNX export supports the same model on browser WebGPU and Node CPU. MediaPipe's Web LLM API is currently maintenance-only, and its current recommended LiteRT-LM WebGPU Gemma models are larger. WebLLM has Gemma 3 1B browser builds, but that model is larger than this 270M export.

## Run the page

```bash
npm install
npm run build
npx serve dist
```

Open the local URL in a WebGPU-capable Chrome. Press **Run benchmark**. The first run downloads the model to the browser cache. Later runs reuse that cache. If WebGPU is unavailable, the page still runs the keyword scorer and records that Gemma was not run. There is no cloud scoring fallback.

Press **Copy results** and paste the Markdown into the REI-247 Linear ticket. The agreement excludes `n/a` expected labels from the denominator. Gemma results use keyword fallback for missing or invalid model rows.

## Run the Node CPU comparison

```bash
npm run benchmark:node
```

This downloads the same ONNX model at runtime and runs all 20 prompts using Node CPU. It prints load time, per-prompt times and generated sample output. It is a correctness and rough CPU speed check, not a browser WebGPU measurement.

## What the measurements mean

- Model load time includes first download, initialization and graph setup; it will be much shorter after cache warm-up.
- Per-prompt times are serial generation times and exclude initial model load.
- Browser memory uses `performance.measureUserAgentSpecificMemory()` when available and permitted; otherwise the page reports unavailable.
- A 270M model may not follow the JSON-only instruction reliably. Every answer is checked against the frozen ID and answer enums. Missing or invalid rows use the keyword scorer.

Model files and versions can change on Hugging Face. Record the displayed date, environment and cache state with measurements.
