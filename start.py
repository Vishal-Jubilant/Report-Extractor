import os
import sys
import time
import subprocess
import webbrowser
import signal

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
VENV_DIR = os.path.join(BASE_DIR, ".venv")

# Determine python executable (prefer .venv if exists)
if os.name == "nt":
    VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe")
    NPM_CMD = "npm.cmd"
else:
    VENV_PYTHON = os.path.join(VENV_DIR, "bin", "python")
    NPM_CMD = "npm"

PYTHON_EXEC = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable


def banner():
    print("=" * 65)
    print("      🚀 RTGS TransactFlow • Bank Statement Extractor")
    print("         Backend: FastAPI | Frontend: React + Tailwind CSS")
    print("=" * 65)


def check_and_setup_venv():
    """Create .venv and install requirements if needed."""
    if not os.path.exists(VENV_PYTHON):
        print("\n📦 Setting up virtual environment (.venv)...")
        subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)
        print("✅ Virtual environment created at .venv")

    req_file = os.path.join(BASE_DIR, "requirements.txt")
    if os.path.exists(req_file):
        print("📦 Checking Python dependencies...")
        subprocess.run([VENV_PYTHON, "-m", "pip", "install", "-r", req_file, "--quiet"])
        print("✅ Python requirements verified.")


def check_frontend():
    """Ensure frontend dependencies are installed."""
    node_modules = os.path.join(FRONTEND_DIR, "node_modules")
    if not os.path.exists(node_modules):
        print("📦 Installing frontend npm dependencies...")
        subprocess.run([NPM_CMD, "install"], cwd=FRONTEND_DIR, shell=True, check=True)
        print("✅ Frontend dependencies installed.")


def main():
    banner()

    # 1. Check / setup environment
    try:
        check_and_setup_venv()
    except Exception as e:
        print(f"⚠️ Notice on venv setup: {e}. Falling back to system Python.")

    # Determine final python to run
    py_exec = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable

    # 2. Check frontend
    try:
        check_frontend()
    except Exception as e:
        print(f"⚠️ Notice on npm setup: {e}")

    # 3. Start FastAPI Backend
    print("\n⚡ Starting FastAPI Backend on http://127.0.0.1:8000...")
    backend_cmd = [
        py_exec,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--reload"
    ]
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=BASE_DIR,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    )

    # 4. Start React Frontend
    print("⚡ Starting React + Tailwind UI on http://localhost:5173...")
    frontend_cmd = f"{NPM_CMD} run dev"
    frontend_process = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    )

    print("\n" + "-" * 65)
    print("  🌐 App is running!")
    print("  👉 Frontend UI:  http://localhost:5173")
    print("  👉 Backend API:  http://127.0.0.1:8000/docs")
    print("  ⌨️  Press Ctrl+C in this terminal to stop both servers.")
    print("-" * 65 + "\n")

    # Give servers 2 seconds then launch browser
    time.sleep(2.5)
    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    # Keep alive and handle graceful exit
    try:
        while True:
            time.sleep(1)
            if backend_process.poll() is not None:
                print("❌ Backend stopped unexpectedly.")
                break
            if frontend_process.poll() is not None:
                print("❌ Frontend stopped unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n\n🛑 Shutting down backend and frontend...")
    finally:
        if os.name == "nt":
            subprocess.call(f"taskkill /F /T /PID {backend_process.pid}", shell=True)
            subprocess.call(f"taskkill /F /T /PID {frontend_process.pid}", shell=True)
        else:
            backend_process.terminate()
            frontend_process.terminate()
        print("✅ Both servers stopped successfully.")


if __name__ == "__main__":
    main()
