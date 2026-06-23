# Plan 011: Meta channel webhooks (WhatsApp + Instagram DM)

## Status: DONE

- `GET/POST /api/v1/webhooks/meta/whatsapp`
- `GET/POST /api/v1/webhooks/meta/instagram`
- Hub verification via `META_WEBHOOK_VERIFY_TOKEN`
- POST parses inbound text, grounds via platform RAG (`testMessage`), sends Graph API reply, records channel exchange
- Response: `202 MetaWebhookProcessResponse` (`processed`, `replied`, `skipped`, `failures`)

## Official refs

- [WhatsApp Cloud API send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- [Instagram Messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/)