# REI-320 check model spike

A command-line harness that tests Apple's on-device model as the Stage 1 check for the Mac coach. It answers the 16 habit questions for the 20 invented REI-247 prompts and compares the answers with the hand labels.

Everything runs on the Mac. The harness has no network code. The prompts are invented, so no real prompt text is used.

## What it measures

- **Agreement** with the REI-247 labels, strict and "found vs not found". It's compared with the keyword scorer's 86.2% on the same labels.
- **Quotes:** for each yes or partly answer, the model quotes the words that show the habit. The harness checks the quote appears in the prompt. The app would underline these words.
- **Speed:** p50 and p95 per call and per prompt, plus the first third vs the last third of calls, to catch the M1 Air slowing down as it heats up.

It runs two modes:

- **batch:** one call per prompt, with all 16 habits in one typed response.
- **single:** one call per habit. Slower, but each call is short.

Both use guided generation (`@Generable`), so answers are always `yes`, `partly`, `no` or `notApplicable`.

## Requirements

- An Apple silicon Mac on macOS 26, with Apple Intelligence turned on and its model downloaded.
- Xcode 26 or the matching Command Line Tools (`xcode-select --install`).

## Run it

From this folder:

```bash
swift run CheckModels
```

The first build takes a minute or two. The full run is 20 batch calls and 320 single calls, so expect several minutes. Keep the Mac plugged in and Low Power Mode off.

Options:

| Option                       | Default                               | Meaning                                                  |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------- |
| `--mode batch\|single\|both` | `both`                                | Which modes to run                                       |
| `--runs N`                   | `1`                                   | Repeat the whole set. Use 3 or more to see heat slowdown |
| `--only p01,p03`             | all                                   | Run only some prompts                                    |
| `--habits path`              | `habits.json`                         | Habit definitions to test                                |
| `--prompts path`             | `../rei-247-gemma-speed/prompts.json` | Prompts and labels                                       |
| `--out dir`                  | `results`                             | Where to save the results                                |

A quick first check:

```bash
swift run CheckModels --mode batch --only p01,p03,p10
```

## Results

The Markdown summary prints at the end and is saved to `results/<time>.md`. Paste it into REI-320. Every call, with its answers and quotes, is saved to `results/<time>.json`. The `results` folder is ignored by git.

While it runs, watch **Memory Pressure** in Activity Monitor. The model runs in a system process, so the harness can't measure its memory itself.

## Tuning the definitions

`habits.json` holds a one-line definition for each habit, with examples. They're sharper than the track's question texts, because the manual Shortcuts tests showed the model confusing `acceptance` with `success_metric` and missing stack choices as `constraints`. Edit the file and run again to compare. Keep all 16 IDs; the harness checks them.

## Caveats

- The labels come from REI-247 and are one person's judgement. The keyword scorer was built against the same prompts, so its 86.2% is likely flattering.
- 20 prompts is a small set. Treat differences of a few points as noise.
- The harness was written on Linux and hasn't been compiled yet. If the build fails, paste the error into the session.
