# Manual browser test

1. From the TripleKeel checkout, serve the prepared static page:

   ```bash
   npx serve .spike-builds/rei-247/site
   ```

2. Open the local URL in Chrome on your laptop. The page checks WebGPU and displays whether an adapter is available.
3. Press **Run benchmark**. On the first run, wait while Gemma is downloaded from Hugging Face and initialized. The page reports load progress and then scores all 20 prompts with Gemma and the keyword baseline.
4. Review agreement by question, overall agreement, median and p95 prompt time, and memory if Chrome exposes it.
5. Press **Copy results** and paste the Markdown into Linear ticket REI-247.

If WebGPU is unavailable, the page runs the keyword benchmark and says Gemma was not run. It does not use a cloud fallback. For a local CPU comparison from the spike source folder, use `npm install` followed by `npm run benchmark:node`; this runs the same ONNX model in Node and does not count as a browser measurement.

## Privacy and model files

The prompt text is sent only to the local model runtime in your browser. Model files are fetched from Hugging Face on first load; they contain model weights, not prompt content. The page does not send prompts or scores to a scoring API.
