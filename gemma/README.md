# Gemma Decisions

A small FastAPI service for text decisions using **hosted Gemma 4 through the Gemini API**.
The boolean/choice/score concepts resemble MediaPipe Decision Maker, but this service does
not use MediaPipe, diffusion, local inference, or the Jev wire protocol. No GPU is needed.

## Start on Windows (PowerShell)

Open a terminal in this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

The API key comes from `GEMINI_API_KEY` in the **repo-root `.env`** (the same file the
Next.js backend uses), or from a real environment variable, which takes precedence. Get a
key at https://aistudio.google.com/apikey; `.env` is git-ignored, so the key stays local.
`.venv/` is git-ignored too.

Visit http://127.0.0.1:8000/docs for the interactive API playground, and
http://127.0.0.1:8000/health to confirm `api_key_configured: true`.

The default model is `gemma-4-26b-a4b-it`. To switch, set `GEMMA_MODEL="gemma-4-31b-it"`
in `.env` (or as an environment variable) before starting the server.

## API

**`POST /v1/decide`** makes one decision about one context. Set `kind` to select the decision:

- Boolean: `{ "kind": "boolean", "context": "...", "condition": "..." }`
- Choice: `{ "kind": "choice", "context": "...", "instructions": "...", "criteria": { "key": "description", "other": "description" } }`
- Score: `{ "kind": "score", "context": "...", "instructions": "...", "rubric": ["Low", "Medium", "High"] }`

Each request is one model call at temperature 0.
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

Each question uses the same fields as the matching `/v1/decide` kind (without `context` or
`thinking`). Names may use letters, digits, `_`, `-`, and `.`; at most 32
questions. The response has `answers` keyed by name, each with `kind`, `value`, `label`,
and `status` (`decided` or `insufficient_information`), plus `model`, `model_version`, and
`latency_ms`. The reply must answer exactly the supplied questions with allowed values, or
the whole batch fails with 502.

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
No confidence or probability is reported: a generated judgment is not a probability.

## Behavior and limits

The service prompts for JSON and validates it locally. It does not assume that hosted
Gemma supports provider-enforced JSON schemas. Unknown labels, wrong types, truncation,
blocked responses, and malformed output return HTTP 502 instead of an invented decision.
Timeouts return 504, upstream quota errors 429, invalid inputs 422, and missing configuration 503.
Google's API occasionally fails transiently (HTTP 5xx or a dropped connection); those get
**exactly one retry**. Timeouts, 429s, and invalid model output are never retried.
Latency includes the upstream call and parsing, but not the caller's connection to this service.

This is a localhost development API with no inbound authentication. Before publishing it,
add authentication, quotas, and appropriate deployment controls. Submitted context is sent
to Google's Gemini API. No model requests or prompt logging occur at startup.

## No calibration, by design

There is no statistical calibration: that would need hundreds of hand-labelled answers
for every question. Instead, the service keeps judgments honest by construction:

- **Strict output.** The reply must be exactly the requested JSON with allowed values;
  anything else is a 502, never a guessed or repaired answer.
- **"Can't tell" stays visible.** `null` / `insufficient_information` is returned as-is,
  so callers can treat it as "not yet" (the webwrite backend counts it as not completed).
- **No re-asking.** An invalid answer fails; the model is never re-asked until it looks
  good. (Only Google-side outages get one retry; see above.)

Accuracy has not been formally measured. In a spot check with `gemma-4-26b-a4b-it` on one
chemistry question, it separated complete, partial, wrong, keyword-dump, and prompt-injection
answers sensibly and gave the same result on repeat runs (about 1 s per batch). To check a
question properly, hand-label a few dozen answers and compare them with what the service
returns; reword unclear rubric levels or conditions if they disagree.

References: [Google's hosted Gemma guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
and [MediaPipe Decision Maker concepts](https://developers.google.com/edge/mediapipe/solutions/decision/decision_maker/python).
