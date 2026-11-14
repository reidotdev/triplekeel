---
status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# Open source: MIT license, one public monorepo, tracks as data files

## Context and problem statement

Rei should live on GitHub as an open source portfolio project. It also makes a privacy promise: prompt text never leaves the browser ([ADR-0004](0004-browser-extension-local-scoring-in-app-nudges.md)). Public code lets anyone check that. But the running service at `agent.rei.dev` uses paid APIs and secret keys, and others should be able to run their own copy. How do we structure and license the code so it can be public without leaking keys or tying it to our deployment?

## Decision drivers

- Public on GitHub, readable as a portfolio project.
- Anyone can verify the privacy claim from the code and the published extension build.
- No secrets in the repo, ever. Our keys and bills stay with our deployment.
- Others can run their own copy with their own keys.
- Writing good questions per field is the hard part of scaling to any knowledge work (g-browser-skill-meter.md § Vision (notes repo: `g-browser-skill-meter.md`)). Outside experts should be able to help.
- Solo builder. Setup must fit in M0.

## Considered options

License:

1. **MIT**
2. **Apache-2.0**
3. **AGPL-3.0**
4. **Open extension only, closed server**

Repo:

- a. **One public monorepo** with the web app, jobs Worker, extension, shared packages, track data and docs.
- b. **Separate repos** per part.

## Decision outcome

Chosen: **MIT, one public monorepo, tracks as data files.** MIT is the simplest license for a portfolio project, one repo keeps the shared schema and scorer in one place, and tracks as files let anyone add a field with a pull request.

**The rule:** the repo holds code and data. A running copy holds the keys and pays the bills. Our copy is `agent.rei.dev`. Anyone else brings their own keys.

### Repo layout

```
rei/
  apps/
    web/          # Next.js dashboard + API (Cloudflare Workers)
    jobs/         # jobs Worker: daily Exa scan, nudges
    extension/    # Chrome extension (Manifest V3)
  packages/
    scorer/       # shared local scorer: extension + paste page
    schema/       # rei.signal.v1 + validator: extension + API
  tracks/         # track data, open to contributions
  supabase/
    migrations/   # SQL schema + RLS policies
    seed/         # loads tracks/
  docs/
    adr/          # ADRs copied from the notes repo
    architecture.md
  .env.example
  LICENSE
  README.md
  CONTRIBUTING.md # how to add a track
  SECURITY.md     # how to report a privacy or security bug
```

- **`packages/schema`** holds the `rei.signal.v1` schema and the strict validator. The extension and `/api/signals` both use it, and its rejection tests are public.
- **`packages/scorer`** is the one local scorer, used by the extension and the paste page.

### Secrets

- `.env.example` lists every variable with no values.
- Real values live in Cloudflare Worker secrets (`wrangler secret put`) and GitHub Actions secrets.
- GitHub secret scanning and push protection are on from the first commit.
- **Public by design:** Clerk publishable key, Supabase URL, Supabase anon key (data is protected by RLS).
- **Never public:** Supabase service role key, Clerk secret key, Clerk webhook secret, Exa key, Claude key, Context.dev key if added.

### Configuration

- No hardcoded domain. The web app uses `APP_URL`. The extension gets its API base URL at build time.
- The extension's `externally_connectable` origin comes from the same build variable, so a self-hosted extension talks only to its own server.
- Our release pins the extension ID with a `key` in the manifest. `CONTRIBUTING.md` explains how others do the same.

### Tracks as data

```
tracks/
  agentic-product-builder/
    track.yaml        # name, job titles it matches
    skill-areas.yaml  # ~10 areas + podcast/search queries
    questions.yaml    # ~30 typed questions with fixed answers
```

- A seed script loads `tracks/` into Supabase. CI validates every track against a schema.
- A new field is a pull request with three files. `CONTRIBUTING.md` explains how to write good questions.

### Model weights

- Not in the repo. The extension downloads Gemma from Hugging Face on first run.
- Gemma ships under the Gemma Terms of Use, which is not an open source license. The README links to the terms and says the MIT license covers our code only. Exa, Claude, Clerk and Gemma keep their own terms.

### Releases

- GitHub Actions run typecheck, tests (including the validator rejection tests) and the extension build on every push.
- Each GitHub Release attaches the built extension zip. That's the "Load unpacked" download, and anyone can check the build came from public code.
- The same zip goes to the Chrome Web Store.

### Two repos stay separate

- **App repo (public):** everything above.
- **The notes repo (private):** planning and personal details. ADRs and diagrams are copied into the app repo's `docs/` when they're final.

### Consequences

- Good: the privacy claim can be checked. The validator, its tests and the extension build are all public.
- Good: a portfolio project with readable decisions (ADRs), diagrams and CI.
- Good: tracks can grow through contributions from people who know their field.
- Good: no lock-in to our deployment. Anyone can run their own copy.
- Bad: about an hour of extra setup in M0 (secret scanning, `.env.example`, config variables, CI release job).
- Bad: MIT lets someone run a closed hosted copy. Acceptable for a portfolio project.
- Bad: public code shows exactly how scoring works, so someone could game their own levels. It only affects their own levels, the same as in ADR-0003.
- Bad: a leaked key in a public repo is found within minutes. Push protection and secret scanning are required, not optional.

### Confirmation

- At M0: secret scanning and push protection on. `.env.example` committed. No secret in `git log -p`.
- At M0: the deploy works from the repo plus Cloudflare secrets only.
- Before the MVP freeze: a GitHub Release with the extension zip exists and installs with "Load unpacked".
- Before the first public release: someone else follows the README and gets a local copy running, or we note where it breaks.

## Pros and cons of the options

### 1. MIT

- Good: simplest, most common, no friction for reuse.
- Bad: no patent grant, and anyone can run a closed copy.

### 2. Apache-2.0

- Good: explicit patent grant, common for AI projects.
- Bad: longer, needs a NOTICE file. More than a portfolio project needs.

### 3. AGPL-3.0

- Good: a hosted copy must share its changes.
- Bad: many companies and contributors avoid it. Overkill here.

### 4. Open extension, closed server

- Good: the privacy-critical part is still checkable.
- Bad: not a full portfolio project, and nobody can run their own copy.

### a. One monorepo

- Good: shared schema and scorer in one place. One CI. One README.
- Bad: a bigger repo to navigate.

### b. Separate repos

- Good: clean boundaries.
- Bad: the shared schema and scorer would need publishing or copying. Too much for the MVP.

## More information

- requirements.md § 9 (notes repo: `requirements.md`) and implementation-plan.md (notes repo: `implementation-plan.md`) M0 and the release steps are updated for this decision.
