"""Ollama on Modal: the open-weight chat model, in the project's own Modal account.

The backend reaches it at LBTF_LLM_BASE_URL through Modal's proxy auth, so only
requests carrying the workspace's proxy token get in. The GPU runs only while
answering and shuts down after SCALEDOWN_S idle.

    pip install modal && modal setup          # once
    modal deploy deploy/modal_ollama.py       # prints the URL

Keep one container warm (e.g. for a demo), then redeploy without it afterwards:

    LBTF_MIN_CONTAINERS=1 modal deploy deploy/modal_ollama.py

"""
import os
import subprocess

import modal

MODEL = os.environ.get("LBTF_LLM_MODEL", "qwen3.5:9b")
OLLAMA_VERSION = "0.34.4"
PORT = 11434
SCALEDOWN_S = 300

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates", "zstd")
    .run_commands(f"curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION={OLLAMA_VERSION} sh")
    .env({
        "OLLAMA_HOST": f"0.0.0.0:{PORT}",
        "OLLAMA_MODELS": "/models",
        # Keep the model in GPU memory for the container's whole life; the
        # container itself is what scales to zero.
        "OLLAMA_KEEP_ALIVE": "-1",
    })
    # Bake the weights into the image so a cold start loads from local disk
    # instead of downloading several GB.
    .run_commands(f"bash -c 'ollama serve & sleep 5 && ollama pull {MODEL}'")
)

app = modal.App("lbtf-ollama")


@app.function(
    image=image,
    gpu="L4",
    scaledown_window=SCALEDOWN_S,
    min_containers=int(os.environ.get("LBTF_MIN_CONTAINERS", "0")),
    max_containers=1,
    timeout=600,
)
@modal.concurrent(max_inputs=4)
@modal.web_server(PORT, startup_timeout=180, requires_proxy_auth=True)
def serve():
    # Ollama logs request lines, never prompt or answer text (OLLAMA_DEBUG unset).
    subprocess.Popen(["ollama", "serve"])
