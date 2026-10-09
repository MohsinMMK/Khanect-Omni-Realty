"""Exercise installed production Python packages using synthetic data only."""

import argparse
import math
import os
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("app", choices=["agno-agent", "rag-embedder"])
    app = parser.parse_args().app
    assert sys.version_info[:2] == (3, 14), sys.version
    assert sys.executable.startswith("/app/.venv/bin/"), sys.executable
    # Match the production uvicorn command's --app-dir src import path.
    sys.path.insert(0, "/app/src")

    if app == "agno-agent":
        import psycopg
        import sqlalchemy
        from agno.agent import Agent
        from agno_agent_service.main import app as runtime, health as runtime_health

        assert runtime.title == "Khanect Agno Agent Runtime"
        assert runtime_health()["status"] == "ok"
        print("Agno production package imports passed")
        return

    # Select the production preset explicitly so a stub cannot satisfy this check.
    os.environ["EMBEDDER_MODE"] = "local"
    os.environ["EMBEDDING_MODEL"] = "BAAI/bge-base-en-v1.5"
    os.environ["FASTEMBED_CACHE_PATH"] = "/tmp/maintenance-model-cache"

    import fastembed
    import numpy
    import onnxruntime
    from PIL import Image
    from rag_embedder_service.main import EmbeddingsRequest, create_embeddings, health

    assert "CPUExecutionProvider" in onnxruntime.get_available_providers()
    status = health()
    assert status["mode"] == "local" and status["dimension"] == 768, status
    result = create_embeddings(
        EmbeddingsRequest(
            model="BAAI/bge-base-en-v1.5",
            input=[
                "Synthetic fixture: property viewings require an appointment.",
                "Synthetic fixture: parking spaces are available beside the building.",
            ],
        )
    )
    assert result.model == "BAAI/bge-base-en-v1.5" and len(result.data) == 2
    for item in result.data:
        assert len(item.embedding) == 768
        assert all(math.isfinite(value) for value in item.embedding)
        assert sum(value * value for value in item.embedding) > 0
    assert result.data[0].embedding != result.data[1].embedding
    print("BGE base production inference passed: two finite 768-dimension vectors")


if __name__ == "__main__":
    main()
