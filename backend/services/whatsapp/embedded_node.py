"""
Embedded Node service launcher.

Spawns the Baileys-based wa-web-service as a subprocess of this Python
process. Designed to work even when Railway overrides the Dockerfile
ENTRYPOINT with its own Start Command — by launching from the FastAPI
lifespan we are independent of how the container was started.

Multi-worker safe: uses an exclusive file lock so only ONE uvicorn worker
ends up owning the Node subprocess; the others detect the lock and skip.
"""
from __future__ import annotations

import os
import sys
import secrets
import shutil
import subprocess
import atexit
import threading
import time
from pathlib import Path

_NODE_PROC: subprocess.Popen | None = None
_LOCK_FD = None
_LOCK_PATH = "/tmp/plexify-wa-web.lock"


def _find_service_dir() -> Path | None:
    """Locate the wa-web-service folder. Tries the repo path first, then /app."""
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "wa-web-service",
        Path("/app/wa-web-service"),
        Path("./wa-web-service"),
    ]
    for c in candidates:
        if (c / "src" / "index.js").is_file():
            return c
    return None


def _acquire_lock() -> bool:
    """Try to acquire the cross-worker lock. Returns True if we got it."""
    global _LOCK_FD
    try:
        import fcntl
    except ImportError:
        # Windows dev — no flock; rely on port conflict detection
        return True
    try:
        _LOCK_FD = open(_LOCK_PATH, "w")
        fcntl.flock(_LOCK_FD, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _LOCK_FD.write(str(os.getpid()))
        _LOCK_FD.flush()
        return True
    except BlockingIOError:
        if _LOCK_FD:
            try:
                _LOCK_FD.close()
            except Exception:
                pass
            _LOCK_FD = None
        return False
    except Exception as e:
        print(f"[wa-web] lock error: {e}")
        return False


def _stream_logs(proc: subprocess.Popen):
    """Pipe Node stdout/stderr into our logs prefixed with [wa-web]."""
    if not proc.stdout:
        return

    def reader():
        try:
            for line in iter(proc.stdout.readline, b""):
                try:
                    decoded = line.decode("utf-8", errors="replace").rstrip()
                except Exception:
                    decoded = repr(line)
                if decoded:
                    print(f"[wa-web] {decoded}", flush=True)
        except Exception as e:
            print(f"[wa-web] log reader stopped: {e}", flush=True)

    t = threading.Thread(target=reader, daemon=True, name="wa-web-logger")
    t.start()


def start_embedded_node() -> bool:
    """Launch the Node service as a child process.

    Returns True if started (or already running in another worker), False otherwise.
    Sets WA_WEB_SERVICE_TOKEN in os.environ so the Python sender uses the same
    token Node expects.
    """
    global _NODE_PROC

    service_dir = _find_service_dir()
    if not service_dir:
        print("[wa-web] service dir not found — Node will NOT start")
        return False

    if shutil.which("node") is None:
        print("[wa-web] WARN: `node` binary not on PATH — install Node 20 in the image")
        return False

    if not _acquire_lock():
        print("[wa-web] another uvicorn worker owns the Node process; skipping")
        return True  # not an error — another worker has it

    # Generate a runtime token if none was provided. Both this Python process
    # and the Node child see the same env so they agree.
    if not os.environ.get("WA_WEB_SERVICE_TOKEN"):
        os.environ["WA_WEB_SERVICE_TOKEN"] = secrets.token_hex(32)
        print("[wa-web] generated runtime token (32 bytes)")

    # Defaults — embedded mode talks loopback.
    os.environ.setdefault("WA_WEB_PORT", "3100")
    os.environ.setdefault("BIND_HOST", "127.0.0.1")
    os.environ.setdefault("SESSIONS_DIR", "/app/sessions")
    os.environ.setdefault("WA_WEB_SERVICE_URL", f"http://127.0.0.1:{os.environ['WA_WEB_PORT']}")

    Path(os.environ["SESSIONS_DIR"]).mkdir(parents=True, exist_ok=True)

    env = {
        **os.environ,
        "PORT": os.environ["WA_WEB_PORT"],
        "BIND_HOST": os.environ["BIND_HOST"],
    }

    cmd = ["node", "src/index.js"]
    print(f"[wa-web] launching from {service_dir} on {env['BIND_HOST']}:{env['PORT']}")

    try:
        _NODE_PROC = subprocess.Popen(
            cmd,
            cwd=str(service_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
        )
    except FileNotFoundError as e:
        print(f"[wa-web] failed to spawn: {e}")
        return False

    _stream_logs(_NODE_PROC)

    # Health check — wait up to 10s for the listener to come up
    deadline = time.time() + 10
    healthy = False
    while time.time() < deadline:
        if _NODE_PROC.poll() is not None:
            print(f"[wa-web] process exited early with code {_NODE_PROC.returncode}")
            return False
        try:
            import socket
            with socket.create_connection(("127.0.0.1", int(env["PORT"])), timeout=0.5):
                healthy = True
                break
        except OSError:
            time.sleep(0.3)

    if healthy:
        print(f"[wa-web] ready (pid={_NODE_PROC.pid})")
    else:
        print(f"[wa-web] WARN: did not become healthy in 10s but proc still alive (pid={_NODE_PROC.pid})")

    atexit.register(stop_embedded_node)
    return True


def stop_embedded_node():
    global _NODE_PROC, _LOCK_FD
    if _NODE_PROC and _NODE_PROC.poll() is None:
        try:
            _NODE_PROC.terminate()
            _NODE_PROC.wait(timeout=5)
        except Exception:
            try:
                _NODE_PROC.kill()
            except Exception:
                pass
    _NODE_PROC = None
    if _LOCK_FD:
        try:
            _LOCK_FD.close()
        except Exception:
            pass
        _LOCK_FD = None
