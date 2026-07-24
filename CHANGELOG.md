# Changelog

## 2026-07-24

### Download safety

- Removed the fixed MCP `pageId=9`; the OPENGA tab is now discovered from each `list_pages` response.
- Replaced the fixed `2026-07-24` end date with the current `Asia/Seoul` month-to-date range.
- Added fail-closed checks for missing or duplicate OPENGA tabs.
- Accepted an already-selected health-insurance value of `Y` and verified the final value.
- Scoped the Excel confirmation to the `Excel Download` popup.
- Added a refreshed download-history baseline, request-time boundary, exact screen name, fresh row identity, and row-scoped download action.
- Added tests that reject stale, wrong-date, ambiguous, and unexpected download rows.

### Pipeline safety

- Replaced “latest xlsx” guessing with a required, verified xlsx input path.
- Replaced substring status matching with exact `계약상태 == 정상`.
- Added dynamic header-row detection and removed the pandas dependency.
- Added deterministic extraction and HTML-generation tests.
- Fixed the banner path to `resources/banner.png`.
- Switched capture to `puppeteer-core` with an explicitly resolved Chrome executable.
- Added fresh PNG, banner, container-size, and ranking-row checks.
- Changed `run_pipeline.ps1` to accept a verified `-ExcelPath` instead of pretending that the plan-only downloader performs MCP automation.
