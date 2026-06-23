from __future__ import annotations

import os
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


Confidence = Literal["none", "low", "medium", "high"]
Channel = Literal["website", "whatsapp", "instagram_dm"]


class ChatbotCapabilities(BaseModel):
    faq: bool = True
    leadCapture: bool = True
    appointmentBooking: bool = False


class ChatbotRuntime(BaseModel):
    id: str
    projectId: str
    name: str
    purpose: str = ""
    capabilities: ChatbotCapabilities = Field(default_factory=ChatbotCapabilities)
    agentKey: str
    knowledgeNamespace: str


class Source(BaseModel):
    chunkId: str
    knowledgeSourceId: str | None = None
    title: str
    excerpt: str
    score: float = 0


class RunRequest(BaseModel):
    message: str
    channel: Channel = "website"
    chatbot: ChatbotRuntime
    sources: list[Source] = Field(default_factory=list)


class RunResponse(BaseModel):
    answer: str
    model: str
    confidence: Confidence
    actionTrace: dict[str, Any]
    agentTraceId: str


app = FastAPI(title="Khanect Agno Agent Runtime", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "runtime": "agno"}


@app.post("/v1/chatbots/run")
def run_chatbot(request: RunRequest, authorization: str | None = Header(default=None)) -> RunResponse:
    require_service_auth(authorization)
    if not request.sources:
        return RunResponse(
            answer="I do not have an approved source for that yet.",
            model=model_name(),
            confidence="none",
            actionTrace={"runtime": "agno", "reason": "no_sources"},
            agentTraceId=f"trace_{uuid4().hex}",
        )

    agent_answer = try_run_agno_agent(request)
    if agent_answer:
        return agent_answer

    source_ids = [source.chunkId for source in request.sources]
    answer = "Based on approved sources: " + "\n\n".join(source.excerpt for source in request.sources)
    return RunResponse(
        answer=answer,
        model=model_name(),
        confidence="high" if request.sources[0].score >= 0.66 else "medium",
        actionTrace={
            "runtime": "agno",
            "mode": "deterministic_grounded_fallback",
            "agentKey": request.chatbot.agentKey,
            "knowledgeNamespace": request.chatbot.knowledgeNamespace,
            "sourceIds": source_ids,
            "toolsEnabled": enabled_tools(request.chatbot.capabilities),
        },
        agentTraceId=f"trace_{uuid4().hex}",
    )


def require_service_auth(authorization: str | None) -> None:
    expected = os.getenv("AGNO_SERVICE_TOKEN", "phase0_dev_only_agno_service_token")
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid service token")


def model_name() -> str:
    return os.getenv("AGNO_MODEL", "gpt-5-mini")


def enabled_tools(capabilities: ChatbotCapabilities) -> list[str]:
    tools: list[str] = []
    if capabilities.leadCapture:
        tools.append("capture_lead")
        tools.append("request_human_handoff")
    if capabilities.appointmentBooking:
        tools.append("request_appointment")
    tools.append("get_business_contact")
    return tools


def try_run_agno_agent(request: RunRequest) -> RunResponse | None:
    if not os.getenv("AGNO_USE_LIVE_AGENT"):
        return None

    try:
        from agno.agent import Agent
    except Exception:
        return None

    instructions = [
        "Answer only from the approved source excerpts.",
        "If the excerpts do not contain the answer, say there is no approved source yet.",
        f"Chatbot: {request.chatbot.name}",
        f"Capabilities: {request.chatbot.capabilities.model_dump()}",
    ]
    context = "\n".join(f"[{index + 1}] {source.title}: {source.excerpt}" for index, source in enumerate(request.sources))
    agent = Agent(name=request.chatbot.agentKey, instructions=instructions)
    result = agent.run(f"Question: {request.message}\n\nApproved sources:\n{context}")
    answer = getattr(result, "content", None) or str(result)
    return RunResponse(
        answer=answer.strip(),
        model=model_name(),
        confidence="medium",
        actionTrace={
            "runtime": "agno",
            "mode": "live_agent",
            "agentKey": request.chatbot.agentKey,
            "knowledgeNamespace": request.chatbot.knowledgeNamespace,
            "toolsEnabled": enabled_tools(request.chatbot.capabilities),
        },
        agentTraceId=f"trace_{uuid4().hex}",
    )


def create_agent_os_app() -> Any | None:
    try:
        from agno.agent import Agent, AgentFactory
        from agno.factory import RequestContext
        from agno.os import AgentOS
    except Exception:
        return None

    def build_chatbot_agent(ctx: RequestContext) -> Agent:
        factory_input = ctx.input or {}
        if not isinstance(factory_input, dict):
            factory_input = {}
        agent_key = str(factory_input.get("agentKey") or "khanect-chatbot")
        chatbot_name = str(factory_input.get("name") or "Khanect chatbot")
        purpose = str(factory_input.get("purpose") or "Answer from approved business knowledge.")
        return Agent(
            name=agent_key,
            instructions=[
                f"You are {chatbot_name}.",
                purpose,
                "Answer only from approved business knowledge.",
                "If the approved knowledge does not contain the answer, say there is no approved source yet.",
            ],
            markdown=True,
        )

    factory = AgentFactory(
        id="khanect-chatbot-factory",
        factory=build_chatbot_agent,
        name="Khanect per-chatbot agent factory",
        description="Builds a request-scoped chatbot agent from Fastify-verified chatbot metadata.",
    )
    return AgentOS(agents=[factory]).get_app()


agent_os_app = create_agent_os_app()
if agent_os_app is not None:
    app.mount("/agent-os", agent_os_app)
