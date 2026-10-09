# Gemma Decisions

A small FastAPI service for text decisions using **hosted Gemma 4 through the Gemini API**.
The boolean/choice/score concepts resemble MediaPipe Decision Maker, but this service does
not use MediaPipe, diffusion, local inference, or the Jev wire protocol. No GPU is needed.

## Start on Windows (PowerShell)

Open a terminal in this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:GEMINI_API_KEY = 'your-key-from-google-ai-studio'
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Visit http://127.0.0.1:8000/docs for the interactive API playground. Expand `/v1/decide`,
click **Try it out**, edit the included example, and execute. The API key stays on the server.
Get a key at https://aistudio.google.com/apikey; do not commit it to your repository.
An `.env` file is not automatically loaded; use the environment variable above.

The default model is `gemma-4-26b-a4b-it`. To switch before starting the server:

```powershell
$env:GEMMA_MODEL = 'gemma-4-31b-it'
```

## API

There is one inference endpoint: **`POST /v1/decide`**. Set `kind` to select the decision:

- Boolean: `{ "kind": "boolean", "context": "...", "condition": "..." }`
- Choice: `{ "kind": "choice", "context": "...", "instructions": "...", "criteria": { "key": "description", "other": "description" } }`
- Score: `{ "kind": "score", "context": "...", "instructions": "...", "rubric": ["Low", "Medium", "High"] }`

`mode` defaults to `decision` (one call). `sample` collects scores (five parallel calls by
default). `calibrated` applies a fitted conformal profile to those sampled scores (also five calls).
`GET /health` is a separate process/configuration check; it does not call or verify the model.
The old `/v1/boolean`, `/v1/choice`, and `/v1/score` routes have been removed.

### Batch: several questions about one context

**`POST /v1/decide/batch`** asks several named questions about the same context in
**one** model call, e.g. grading one student explanation against several key ideas:

```json
{
  "context": "Sharing lets both hydrogen atoms fill their valence shells.",
  "questions": {
    "idea1": { "kind": "score", "instructions": "Does it say the shared electrons attract both nuclei?",
               "rubric": ["Not completed", "In progress", "Included"] },
    "misconception": { "kind": "boolean", "condition": "The explanation states something incorrect." }
  }
}
```

Each question uses the same fields as the matching `/v1/decide` kind (without `context`,
`thinking`, or `mode`). Names may use letters, digits, `_`, `-`, and `.`; at most 32
questions. The response has `answers` keyed by name, each with `kind`, `value`, `label`,
and `status` (`decided` or `insufficient_information`), plus `model`, `model_version`, and
`latency_ms`. The reply must answer exactly the supplied questions with allowed values, or
the whole batch fails with 502. Batch requests use decision mode only (no sampling).

All decisions accept `"thinking": true` (default false). Off maps to Gemini API
`thinkingLevel: minimal`; on maps to `high`. Thinking gets a larger output budget.

Example from a second PowerShell terminal:

```powershell
$body = @{
    kind = 'boolean'
    context = 'I was charged twice for one order.'
    condition = 'The customer reports duplicate billing.'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/v1/decide -ContentType application/json -Body $body
```

An illustrative response excerpt (not a live measurement):

```json
{
  "kind": "boolean",
  "value": true,
  "label": null,
  "status": "decided",
  "model": "gemma-4-26b-a4b-it",
  "latency_ms": 1234.5
}
```

For choices, `value` is an allowed key and `label` is its description. For scores,
`value` is the **zero-based integer rubric index** and `label` is the level description.
This is a discrete generated rating, not MediaPipe's probability-weighted expected score.
Insufficient evidence returns `value: null` and `status: insufficient_information`.
No confidence or probability is reported: generated judgments are not calibrated probabilities.

## Behavior and limits

The service prompts for JSON and validates it locally. It does not assume that hosted
Gemma supports provider-enforced JSON schemas. Unknown labels, wrong types, truncation,
blocked responses, and malformed output return HTTP 502 instead of an invented decision.
Timeouts return 504, upstream quota errors 429, invalid inputs 422, and missing configuration 503.
There are no automatic retries or extra model calls. Latency includes the upstream call
and parsing, but not the caller's connection to this local service.

This is a localhost development API with no inbound authentication. Before publishing it,
add authentication, quotas, and appropriate deployment controls. Submitted context is sent
to Google's Gemini API. No model requests or prompt logging occur at startup.

## Split conformal prediction

This implements split-conformal classification from
[Angelopoulos & Bates](https://arxiv.org/abs/2107.07511). It does **not** implement
temperature scaling or claim calibrated class probabilities. Hosted Gemma logprob
availability has not been established, so the scorer works with generated labels only.
The sampling scorer is an engineering choice within the general conformal framework,
not a published Gemma-specific performance guarantee.

For each input, take K independent API requests at temperature 0.7 (K defaults to 5).
For candidate y, use `s(x,y) = 1 - count(y)/K`. A null response stays in the denominator;
malformed/failed calls abort the request instead of being silently removed. Scores are
nonconformity values (lower is better), **not probabilities of being correct**. Score-map
keys are JSON encodings of labels: `true`, `false`, `0`, or `"billing"` including its quotes.

On n labeled calibration examples, sort the scores assigned to the true labels and take
rank `ceil((n+1)*(1-alpha))`, without interpolation. If rank exceeds n, use the maximum
possible score, 1, to include every label. At inference include every label with score
at most this threshold. Inclusive ties make small-K sampling conservative; all-label
sets can be common, and increasing K costs more without guaranteeing better results.

The standard coverage statement is **marginal** coverage of at least `1-alpha` under
exchangeability, a fixed model/scoring procedure, and correct labels. It is not a guarantee
for each class, individual input, or the subset receiving singleton decisions. The score
rubric is treated as classification over its discrete levels, not a regression interval.
Future inputs must resemble the calibration population. An alias updating silently can
invalidate calibration even if the provider does not expose a changed model version.
Failures must be tracked as failures/abstentions, not discarded to inflate reported quality.

### Fit and evaluate

1. Freeze the question, label descriptions/rubric, model, thinking setting, and sample count.
2. Prepare separate calibration and test JSONL files with manually verified labels.
   Each line has `id`, `request` (a `/v1/decide` payload), and `label`.
   Boolean labels are JSON booleans; choices use keys; scores use zero-based integers.
   Example format only, **not a calibration dataset**:

   ```json
   {"id":"cal-001","request":{"kind":"boolean","context":"I was billed twice for order 17.","condition":"The customer reports duplicate billing."},"label":true}
   ```

   Use one fixed schema per profile. Include representative hard and negative examples.
   If 'insufficient evidence' is a ground-truth class, use a choice question with an
   explicit unknown key; null is a model abstention, not a calibration label.
   A few hundred examples is a useful starting point, not a mathematical requirement.
   Do not tune prompts on these held-out files or reuse the test set for model selection.
3. Start the server with your key, then collect calibration scores and fit:

   ```powershell
   .\.venv\Scripts\python.exe calibrate.py fit calibration.jsonl --profile profile.json --alpha 0.1
   .\.venv\Scripts\python.exe calibrate.py evaluate test.jsonl --profile profile.json --report evaluation.json
   ```

   These commands make **5 model calls per row** by default, consuming API quota and any
   applicable charges. There are no automatic retries. Evaluation reports coverage,
   average set size, abstention rate, and singleton accuracy. It rejects overlapping
   IDs/exact contexts; you must also keep paraphrases and related examples from leaking
   across splits. Evaluate each failure explicitly; the CLI aborts rather than dropping it.
4. Set the profile path in the server environment and restart:

   ```powershell
   $env:CALIBRATION_FILE = (Resolve-Path profile.json).Path
   .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
   ```

   Send the same question/schema with new context and `"mode": "calibrated"` to
   `/v1/decide`. Response fields include `prediction_set`, `target_coverage`, and
   `calibration_n`. `value` is returned only for singleton sets; empty/multiple sets
   yield `status: abstained`.

Without a profile, calibrated mode returns 503; it never silently falls back to an
uncalibrated answer. Profile mismatches return 409. Profiles are bound to the exact
question/settings, model, sample count, temperature, system prompt and prompt template,
`SCORER_VERSION`, and reported model version. Only one profile is configured per server.
Changing `DECISION_SAMPLES` (2–20), prompts, or model requires refitting. If you change
answer parsing, the request payload, or vote scoring, bump `SCORER_VERSION` in `app.py`
so old profiles are rejected. No calibrated profile is bundled, and no live model
evaluation has been performed without an API key and labeled data.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pip install pytest
.\.venv\Scripts\python.exe -m pytest -q
```

Tests exercise the HTTP API with a simulated Google transport. They do not prove model
accuracy, hosted availability, or actual inference latency; those need a real API key.

References: [Google's hosted Gemma guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
and [MediaPipe Decision Maker concepts](https://developers.google.com/edge/mediapipe/solutions/decision/decision_maker/python).
