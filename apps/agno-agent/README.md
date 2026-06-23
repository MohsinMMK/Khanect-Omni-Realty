# Khanect Agno Agent Service

Internal-only chatbot agent runtime. Fastify remains the public gateway for admin APIs, widgets, channel credentials, domain validation, and persistence.

Local run:

```bash
uv run uvicorn agno_agent_service.main:app --app-dir src --host 0.0.0.0 --port 8000
```

Required service auth:

```bash
AGNO_SERVICE_TOKEN=phase0_dev_only_agno_service_token
```

The service returns grounded answers from approved source excerpts in development. When Agno model credentials are configured, the same endpoint can build an Agno agent per chatbot from the request metadata.
