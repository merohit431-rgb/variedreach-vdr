# Phase 3C Live Pilot Checklist — Anthropic Claude Integration

Companion to the Phase 3C implementation. Everything described in this document is **not yet
executed** — Phase 3C ships with `CLAUDE_API_ENABLED=false`, and this checklist is what the
brief's Step 3 requires before that changes: "Implement the integration and automated tests
without requiring live API calls... Do not activate paid API requests until a dedicated staging
Anthropic API key is configured, a spending limit is explicitly approved, and a small
synthetic-document pilot is authorised."

Until every item below is actually done and the pilot has actually run, treat every Claude-specific
claim in this codebase as **implemented and mocked-tested, not live-verified** — per the brief's own
instruction, mocked tests must never be reported as live API verification.

## 1. Preconditions (none of these exist yet)

- [ ] A **dedicated staging Anthropic API key** — never the organisation's production key, never a
  personal key. Request this from whoever owns the Anthropic account.
- [ ] An **explicitly approved spending cap**, communicated back to this engagement before the key
  is ever set in staging's `.env`. The `AI_MAX_*` env vars (`claude.config.ts` / `ai-budget.config.ts`
  defaults — see `.env.example`) ship with conservative suggested numbers; they are not an approval,
  only a mechanism. Confirm the actual approved figures before raising them, if different.
- [ ] A small, fixed set of **synthetic PDF documents** — reuse the disposable staging test rooms
  already established in this engagement (never a real customer document, never anything from
  Ecstasy Realty or any other production Data Room).
- [ ] Agreement on **how many controlled requests** the pilot will make — the brief says "a small
  number," not an open-ended testing session.

## 2. Turning the feature on (only after every box in §1 is checked)

```bash
ssh vdr
cd /opt/variedreach-vdr-staging
# Edit apps/backend/.env directly on the server -- never commit a real key:
#   CLAUDE_API_ENABLED=true
#   ANTHROPIC_API_KEY=<the dedicated staging key>
#   (adjust AI_MAX_* only if the approved cap differs from the shipped defaults)
docker compose -p variedreach-vdr-staging -f docker-compose.yml -f docker-compose.staging.yml \
  up -d --no-deps backend   # picks up the new .env; no image rebuild needed for an env-only change
```

`validate-production-env.ts`'s boot check (NODE_ENV=production is set on staging too) will refuse
to start if `CLAUDE_API_ENABLED=true` is set without `ANTHROPIC_API_KEY` — if the container fails to
come up, check `docker logs vdr_staging_backend` for that exact message first.

## 3. What to run

Use the existing, already-authorised disposable staging org/room pattern. For each synthetic
document in the agreed pilot set:

1. Upload it to a disposable Data Room.
2. Request an AI Summary through the real UI (or the real API) — this is the actual, metered,
   first-ever live Claude call this product will ever make.
3. Let it complete (or fail) naturally. Do not retry indefinitely if something looks wrong — capture
   the failure and move to the next item below instead.

## 4. What to record, per request

Pull this from the real `AiSummaryRun` / `AiUsageLedger` rows this request creates, not from
assumption:

- **Actual model used** (`AiSummaryRun.modelUsed` — confirm it matches `CLAUDE_SUMMARY_MODEL`,
  since Anthropic could in principle route to a different snapshot).
- **Input / output tokens** (`AiUsageLedger.inputTokens` / `.outputTokens`).
- **Estimated vs. actual cost** (`AiUsageLedger.estimatedCostMicroUsd` vs. `.actualCostMicroUsd`) —
  this is the one piece of real data that validates (or invalidates) the cost-estimation logic in
  `ClaudeSynthesisService.estimateChunkCostMicroUsd()`, which has only ever been checked against a
  char/4 heuristic, never a real response.
- **Processing time** (`AiSummaryRun.startedAt` → `.completedAt`).
- **Summary accuracy** — manual read-through: does the Executive Summary / Parties / Dates / etc.
  actually reflect the document correctly?
- **Source-reference accuracy** — for a sample of statements, manually open the cited page(s) and
  confirm the citation genuinely supports the claim, independent of what
  `StatementVerificationService` already computed (its own `verificationStatus` is also worth
  recording, but a human spot-check is the real test of whether that automated check is
  trustworthy).
- **OCR accuracy**, if any pilot document includes scanned pages — compare `ExtractedPage.ocrConfidence`
  against a manual read of the actual recognized text.
- **Failures and retries** — anything that didn't go cleanly: a `ClaudeRateLimitedError`, a
  `ClaudeTimeoutError`, a budget block, a dropped statement (all cited IDs invalid), etc. Each is
  already visible in `AiUsageLedger.status` and the application logs.

## 5. Specifically worth confirming on the first call

The Claude provider's request shape (`claude-prompt.builder.ts`) was built from Anthropic's
documented pattern for delivering untrusted content via a synthetic `tool_use`/`tool_result` pair —
reasoned carefully, but never exercised against the real API before this pilot. On the very first
real call, specifically check:

- Does the API accept a synthetic `assistant` `tool_use` turn that was never actually returned by a
  prior model turn, followed immediately by its `tool_result`? (This is the part most worth
  double-checking — if Anthropic's API rejects this shape, every test built on top of the current
  `claude-summary.provider.spec.ts` mocks is validating the wrong contract.)
- Does `output_config.format` with a `json_schema` type actually constrain the response the way the
  current docs describe, on the exact pinned SDK version / model in use?
- Does the response's `usage` object land in the shape `claude-summary.provider.ts` expects
  (`input_tokens` / `output_tokens` at the top level of `response.usage`)?

If any of these differ from what's implemented, fix the provider/prompt-builder code, re-run the
full mocked test suite, and only then continue the pilot.

## 6. After the pilot

- Turn `CLAUDE_API_ENABLED` back to `false` on staging unless there's a specific reason to keep it
  on (e.g., a follow-up round of testing is already planned) — this is a deliberate, default-off
  feature; don't leave paid calls active by accident between testing sessions.
- Write up the results from §4 — this is the raw material for the brief's Step 18 completion
  report sections 17 ("Live API pilot status") and 13 ("Performance results"), neither of which can
  be written honestly until this pilot has actually happened.
- If costs, latency, or accuracy meaningfully diverge from what the mocked tests assumed, that's a
  real finding — document it rather than quietly adjusting the numbers to match.

## Explicitly not in scope for this pilot

- Production. Nothing here ever touches `vdr.variedreach.com`, the production database, or any
  production credentials.
- Raising `AI_MAX_*` budgets beyond whatever was actually approved in §1 — a pilot showing the
  feature works is not itself approval for a higher ongoing budget.
- Any provider other than Anthropic. This phase does not implement, and must not implement, an
  OpenAI fallback or any other provider switch.
