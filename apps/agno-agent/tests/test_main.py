from fastapi.testclient import TestClient

from agno_agent_service.main import app


def test_run_rejects_missing_service_token():
    client = TestClient(app)

    response = client.post(
        "/v1/chatbots/run",
        json={
            "message": "When is the gym open?",
            "chatbot": {
                "id": "bot_1",
                "projectId": "project_1",
                "name": "Website assistant",
                "agentKey": "chatbot_bot_1",
                "knowledgeNamespace": "knowledge_bot_1",
            },
            "sources": [],
        },
    )

    assert response.status_code == 401


def test_run_returns_grounded_fallback_answer():
    client = TestClient(app)

    response = client.post(
        "/v1/chatbots/run",
        headers={"authorization": "Bearer phase0_dev_only_agno_service_token"},
        json={
            "message": "When is the gym open?",
            "chatbot": {
                "id": "bot_1",
                "projectId": "project_1",
                "name": "Website assistant",
                "agentKey": "chatbot_bot_1",
                "knowledgeNamespace": "knowledge_bot_1",
                "capabilities": {"faq": True, "leadCapture": True, "appointmentBooking": False},
            },
            "sources": [
                {
                    "chunkId": "chunk_1",
                    "knowledgeSourceId": "source_1",
                    "title": "Gym rules",
                    "excerpt": "The gym is open daily from 6 AM to 10 PM.",
                    "score": 0.75,
                }
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"].startswith("Based on approved sources:")
    assert body["confidence"] == "high"
    assert body["actionTrace"]["runtime"] == "agno"
    assert body["actionTrace"]["toolsEnabled"] == [
        "capture_lead",
        "request_human_handoff",
        "get_business_contact",
    ]
    assert body["agentTraceId"].startswith("trace_")
