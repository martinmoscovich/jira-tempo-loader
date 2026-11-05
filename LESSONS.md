# Lessons

Append-only. Format: failure mode → detection signal → prevention rule.

## 2026-11-05: Issue keys with digits in the project key rejected

- **Context**: ticket validation flagged `AB2C-8` as invalid although it exists in Jira.
- **Failure mode**: the issue-key regex `^([A-Z]+)-(\d+)$` allowed only letters in the project key, and it was copy-pasted into about 12 places.
- **Detection signal**: user report for a real ticket whose project key is `AB2C`.
- **Prevention rule**: Jira project keys follow `[A-Z][A-Z0-9_]*`. Use `isIssueKey` / `ISSUE_KEY_PREFIX_PATTERN` from `src/utils/ticketValidation.ts`; never inline a new issue-key regex.

## 2026-11-05: First validation after token expiry always failed

- **Context**: the first "validate tickets" of a session reported every ticket as missing; a page reload fixed it.
- **Failure mode**: after a 401, the token refresh never reached the API clients. The refresh handler was a stale closure (`jiraApi` was still `null` when it was captured), the retried request reused its old `Authorization` header, and `getMultipleIssues` swallowed the error and reported all tickets as missing.
- **Detection signal**: user report: "fails the first time, works after reload".
- **Prevention rule**: callbacks handed to long-lived objects (API clients) must not read React state; read storage or refs instead. Set auth headers in a request interceptor, not on the instance. Never turn auth or network errors into domain results such as "not found".

## 2026-11-05: Test with a shared virtual clock hid a concurrency bug

- **Context**: the first test for "a 429 pauses every parallel queue" passed even with the shared wait removed.
- **Failure mode**: the fake `sleep` advanced one global clock, so one worker's wait moved time forward for all workers and made the bug invisible.
- **Detection signal**: mutation check (removing the shared gate) left the test green.
- **Prevention rule**: for timing across concurrent workers, use `vi.useFakeTimers()` so time only moves when timers fire, and always mutation-check concurrency tests.

## 2026-11-05: Retrying non-idempotent requests

- **Context**: parallel worklog upload with retries.
- **Failure mode** (avoided): blindly retrying a POST after a timeout or 5xx can create the same worklog twice.
- **Detection signal**: design review before implementing.
- **Prevention rule**: auto-retry only responses that guarantee nothing was written (429). For ambiguous failures, check the server for the record first; if it cannot be checked, fail and tell the user to verify.

## 2026-11-05: Tests written for a format the parser no longer reads

- **Context**: 3 `googleSheets.test.ts` tests had failed since the first commit, which kept CI red and taught everyone to ignore it.
- **Failure mode**: the tests (and `USAGE.md`) described an old paste layout without the Duration column and with a "Título" column the parser never supported.
- **Detection signal**: CI red on every push and Dependabot PR; failures reproduced on the first commit.
- **Prevention rule**: when a test fails, first decide which side is the source of truth (here the exporter, which writes the Duration column) and fix the other; keep a round-trip test (export then import) for any format the app both reads and writes. Never leave CI red.
