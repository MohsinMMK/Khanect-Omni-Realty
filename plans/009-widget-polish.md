# Plan 009: Widget polish

## Status: DONE

- `widgetPolicy` on `GET /admin/chatbots/:id/connectors` (origin protection + rate limit summary)
- `POST .../connectors/website/origin-check` admin preview
- Connect admin UI: install status badge, origin check, security policy callout
- Widget script shows retry-after hint on HTTP 429
- Configurable `WIDGET_RATE_LIMIT_MAX` / `WIDGET_RATE_LIMIT_WINDOW_MS`