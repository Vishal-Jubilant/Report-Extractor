import importlib.util
import os
import subprocess
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
VENV_DIR = os.path.join(BASE_DIR, ".venv")
ENV_FILE = os.path.join(BASE_DIR, ".env")

if os.name == "nt":
    VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe")
    VENV_BIN_DIR = os.path.join(VENV_DIR, "Scripts")
    NPM_CMD = "npm.cmd"
else:
    VENV_PYTHON = os.path.join(VENV_DIR, "bin", "python")
    VENV_BIN_DIR = os.path.join(VENV_DIR, "bin")
    NPM_CMD = "npm"

REQUIRED_MODULES = [
    "fastapi",
    "uvicorn",
    "dotenv",
    "sqlalchemy",
    "psycopg",
    "alembic",
    "pandas",
    "pdfplumber",
    "openpyxl",
    "reportlab",
]


def banner():
    print("=" * 68)
    print("      RTGS TransactFlow - Automated Startup & Preflight Check")
    print("         Backend: FastAPI (:4501) | Frontend: React + Vite (:4500)")
    print("=" * 68)


def _is_running_in_venv() -> bool:
    """Return True if the current Python interpreter belongs to .venv."""
    current_prefix = os.path.abspath(sys.prefix).lower()
    target_venv = os.path.abspath(VENV_DIR).lower()
    current_exe = os.path.abspath(sys.executable).lower()
    target_exe = os.path.abspath(VENV_PYTHON).lower()
    return current_prefix == target_venv or current_exe == target_exe


def _missing_packages(python_exe: str) -> list[str]:
    """Check if any core runtime packages are missing in the target Python."""
    if _is_running_in_venv():
        return [m for m in REQUIRED_MODULES if importlib.util.find_spec(m) is None]

    check_code = (
        "import importlib.util, sys; "
        f"mods = {REQUIRED_MODULES!r}; "
        "missing = [m for m in mods if importlib.util.find_spec(m) is None]; "
        "print(','.join(missing))"
    )
    res = subprocess.run([python_exe, "-c", check_code], capture_output=True, text=True)
    if res.returncode != 0:
        return REQUIRED_MODULES
    raw = (res.stdout or "").strip()
    return [m for m in raw.split(",") if m]


def step1_setup_and_activate_venv():
    """
    STEP 1: Install Virtual Environment & Auto Activation.
    Creates .venv if missing, installs requirements.txt when needed, and
    re-launches start.py inside .venv so all remaining steps run activated.
    """
    is_restarted = os.environ.get("RTGS_VENV_ACTIVATED") == "1"
    if is_restarted and _is_running_in_venv():
        print(f"  [OK] Running inside activated .venv ({sys.executable})")
        os.environ["VIRTUAL_ENV"] = VENV_DIR
        if VENV_BIN_DIR.lower() not in os.environ.get("PATH", "").lower():
            os.environ["PATH"] = VENV_BIN_DIR + os.pathsep + os.environ.get("PATH", "")
        return

    print("\n[STEP 1/5] Virtual Environment Setup & Auto-Activation...")

    created_now = False
    if not os.path.exists(VENV_PYTHON):
        print("  -> Creating virtual environment at .venv...")
        subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)
        created_now = True
        print("  [OK] Virtual environment created.")
    else:
        print("  [OK] Virtual environment found at .venv.")

    req_file = os.path.join(BASE_DIR, "requirements.txt")
    missing = _missing_packages(VENV_PYTHON)
    if os.path.exists(req_file) and (created_now or missing):
        if missing:
            print(f"  -> Installing missing Python dependencies ({', '.join(missing)})...")
        else:
            print("  -> Installing Python dependencies from requirements.txt...")
        subprocess.run([VENV_PYTHON, "-m", "pip", "install", "-r", req_file, "--quiet"], check=True)
        print("  [OK] Python dependencies installed.")
    else:
        print("  [OK] All required Python dependencies are installed.")

    # Auto-activate: if launched with global/system Python, re-run inside .venv Python
    if not _is_running_in_venv():
        if is_restarted:
            print("  [WARN] Unable to switch into .venv automatically; continuing with current Python.")
            return

        print("  -> Auto-activating .venv and resuming startup...", flush=True)
        env = os.environ.copy()
        env["RTGS_VENV_ACTIVATED"] = "1"
        env["VIRTUAL_ENV"] = VENV_DIR
        env["PATH"] = VENV_BIN_DIR + os.pathsep + env.get("PATH", "")

        exit_code = subprocess.call([VENV_PYTHON, os.path.abspath(__file__), *sys.argv[1:]], env=env)
        sys.exit(exit_code)

    # Ensure environment variables reflect activated .venv for child processes
    os.environ["VIRTUAL_ENV"] = VENV_DIR
    if VENV_BIN_DIR.lower() not in os.environ.get("PATH", "").lower():
        os.environ["PATH"] = VENV_BIN_DIR + os.pathsep + os.environ.get("PATH", "")
    print(f"  [OK] Running inside activated .venv ({sys.executable})")


def _resolve_db_params() -> dict:
    """Resolve host, port, user, password, and db_name from .env / environment."""
    from dotenv import load_dotenv
    from sqlalchemy.engine.url import make_url

    if os.path.exists(ENV_FILE):
        load_dotenv(dotenv_path=ENV_FILE, override=True)
    else:
        load_dotenv()

    explicit_url = os.getenv("DATABASE_URL", "").strip()
    if explicit_url:
        normalized = explicit_url
        if normalized.startswith("postgresql://"):
            normalized = normalized.replace("postgresql://", "postgresql+psycopg://", 1)
        elif normalized.startswith("postgresql+psycopg2://"):
            normalized = normalized.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
        parsed = make_url(normalized)
        return {
            "host": parsed.host or os.getenv("DB_HOST", "localhost"),
            "port": int(parsed.port or os.getenv("DB_PORT", "5432")),
            "user": parsed.username or os.getenv("DB_USER", "postgres"),
            "password": parsed.password if parsed.password is not None else os.getenv("DB_PASSWORD", ""),
            "db_name": parsed.database or os.getenv("DB_NAME", "rtgs_db"),
        }

    return {
        "host": os.getenv("DB_HOST", "localhost").strip(),
        "port": int(os.getenv("DB_PORT", "5432")),
        "user": os.getenv("DB_USER", "postgres").strip(),
        "password": os.getenv("DB_PASSWORD", ""),
        "db_name": os.getenv("DB_NAME", "rtgs_db").strip(),
    }


def step2_verify_db_credentials() -> dict:
    """
    STEP 2: Database Credentials Verification.
    Validates .env presence, credential fields, and tests authenticating to PostgreSQL.
    """
    import psycopg

    print("\n[STEP 2/5] Database Credentials Verification...")

    if not os.path.exists(ENV_FILE):
        print("  [ERROR] .env file not found in project root. Create a .env file and configure your PostgreSQL credentials.")
        sys.exit(1)

    db = _resolve_db_params()
    if not db["host"] or not db["user"] or not db["db_name"]:
        print("  [ERROR] Missing DB_HOST, DB_USER, or DB_NAME in .env.")
        sys.exit(1)

    if db["password"] == "your_password_here":
        print("  [ERROR] .env still contains the placeholder DB_PASSWORD ('your_password_here'). Update .env first.")
        sys.exit(1)

    print(f"  -> Verifying PostgreSQL connection ({db['user']}@{db['host']}:{db['port']})...")
    try:
        with psycopg.connect(
            host=db["host"],
            port=db["port"],
            user=db["user"],
            password=db["password"],
            dbname="postgres",
            connect_timeout=5,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                ver = cur.fetchone()[0].split(",")[0]
        print(f"  [OK] Credentials verified ({ver}).")
    except psycopg.OperationalError as exc:
        print(f"  [ERROR] Failed to connect/authenticate to PostgreSQL: {exc}")
        sys.exit(1)

    return db


def step3_ensure_database_exists(db: dict):
    """
    STEP 3: Database Existence Check.
    Checks whether the target database exists and creates it automatically if missing.
    """
    import psycopg
    from psycopg import sql

    db_name = db["db_name"]
    print(f"\n[STEP 3/5] Database Existence Check ('{db_name}')...")

    try:
        with psycopg.connect(
            host=db["host"],
            port=db["port"],
            user=db["user"],
            password=db["password"],
            dbname="postgres",
            autocommit=True,
            connect_timeout=5,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (db_name,))
                exists = cur.fetchone() is not None
                if exists:
                    print(f"  [OK] Database '{db_name}' already exists.")
                else:
                    print(f"  -> Database '{db_name}' not found. Creating automatically...")
                    cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
                    print(f"  [OK] Database '{db_name}' created successfully.")

        # Confirm direct connection to target database
        with psycopg.connect(
            host=db["host"],
            port=db["port"],
            user=db["user"],
            password=db["password"],
            dbname=db_name,
            connect_timeout=5,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
        print(f"  [OK] Connected to target database '{db_name}'.")
    except Exception as exc:
        print(f"  [ERROR] Database check/creation failed: {exc}")
        sys.exit(1)


def step4_validate_and_migrate_schema():
    """
    STEP 4: Database Schema Validation & Auto-Migration.
    Runs Alembic migrations ('upgrade head') and validates all ORM model tables exist.
    """
    print("\n[STEP 4/5] Database Schema Validation & Auto-Migration...")

    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)

    from sqlalchemy import inspect
    from backend.database.config import engine
    from backend.database.models import Base

    expected_tables = set(Base.metadata.tables.keys())
    inspector = inspect(engine)
    existing_before = set(inspector.get_table_names())
    print(f"  -> Expected tables: {sorted(expected_tables)}")
    print(f"  -> Running Alembic auto-migration (alembic upgrade head)...")

    mig_res = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
    )
    if mig_res.returncode != 0:
        print("  [ERROR] Alembic migration failed:")
        if mig_res.stdout:
            print(mig_res.stdout)
        if mig_res.stderr:
            print(mig_res.stderr)
        sys.exit(1)

    if mig_res.stdout.strip():
        for line in mig_res.stdout.strip().splitlines():
            print(f"     {line}")

    # Validate tables & columns match ORM models
    inspector = inspect(engine)
    existing_after = set(inspector.get_table_names())
    missing_tables = expected_tables - existing_after
    if missing_tables:
        print(f"  [ERROR] Schema validation failed; missing tables after migration: {sorted(missing_tables)}")
        sys.exit(1)

    for table_name, table_obj in Base.metadata.tables.items():
        actual_cols = {c["name"] for c in inspector.get_columns(table_name)}
        expected_cols = {c.name for c in table_obj.columns}
        missing_cols = expected_cols - actual_cols
        if missing_cols:
            print(
                f"  [ERROR] Schema validation failed; table '{table_name}' is missing columns: {sorted(missing_cols)}"
            )
            sys.exit(1)

    if not existing_before & expected_tables:
        print("  [OK] Initial schema migrated and validated.")
    else:
        print(f"  [OK] Schema up-to-date and validated ({len(expected_tables)} tables verified).")


def _ensure_frontend_deps():
    """Ensure frontend npm dependencies are installed."""
    node_modules = os.path.join(FRONTEND_DIR, "node_modules")
    if not os.path.exists(node_modules):
        print("  -> Installing frontend npm dependencies...")
        subprocess.run([NPM_CMD, "install"], cwd=FRONTEND_DIR, shell=True, check=True)
        print("  [OK] Frontend dependencies installed.")
    else:
        print("  [OK] Frontend node_modules verified.")


def step5_start_servers():
    """
    STEP 5: Starting Backend & Frontend Servers.
    Starts FastAPI on 127.0.0.1:4501 and Vite React UI on localhost:4500.
    """
    print("\n[STEP 5/5] Starting Backend & Frontend Servers...")
    try:
        _ensure_frontend_deps()
    except Exception as exc:
        print(f"  [WARN] Notice on npm setup: {exc}")

    print("  -> Starting FastAPI Backend on http://127.0.0.1:4501...")
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "4501",
        "--reload",
    ]
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=BASE_DIR,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )

    # Wait for backend to be ready before starting frontend (avoids ECONNREFUSED race)
    print("  -> Waiting for backend to be ready...", end="", flush=True)
    import urllib.request
    backend_ready = False
    for _ in range(20):  # up to 10 seconds
        time.sleep(0.5)
        try:
            urllib.request.urlopen("http://127.0.0.1:4501/docs", timeout=1)
            backend_ready = True
            break
        except Exception:
            print(".", end="", flush=True)
    print(" OK" if backend_ready else " (timeout, starting frontend anyway)")

    print("  -> Starting React + Tailwind UI on http://localhost:4500...")
    frontend_cmd = f"{NPM_CMD} run dev"
    frontend_process = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )

    print("\n" + "-" * 68)
    print("  App is running!")
    print("  Frontend UI:  http://localhost:4500")
    print("  Backend API:  http://127.0.0.1:4501/docs")
    print("  Press Ctrl+C in this terminal to stop both servers.")
    print("-" * 68 + "\n")

    try:
        while True:
            time.sleep(1)
            if backend_process.poll() is not None:
                print("[ERROR] Backend stopped unexpectedly.")
                break
            if frontend_process.poll() is not None:
                print("[ERROR] Frontend stopped unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n\nShutting down backend and frontend...")
    finally:
        if os.name == "nt":
            subprocess.call(f"taskkill /F /T /PID {backend_process.pid}", shell=True)
            subprocess.call(f"taskkill /F /T /PID {frontend_process.pid}", shell=True)
        else:
            backend_process.terminate()
            frontend_process.terminate()
        print("Both servers stopped successfully.")


def run_preflight_only():
    """Execute Steps 1 through 4 without launching long-running servers (for verification)."""
    is_restarted_in_venv = os.environ.get("RTGS_VENV_ACTIVATED") == "1"
    if not is_restarted_in_venv:
        banner()
    step1_setup_and_activate_venv()
    db = step2_verify_db_credentials()
    step3_ensure_database_exists(db)
    step4_validate_and_migrate_schema()
    print("\n[PREFLIGHT COMPLETE] All 4 preflight checks passed.")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)

    if "--check-only" in sys.argv:
        run_preflight_only()
        return

    is_restarted_in_venv = os.environ.get("RTGS_VENV_ACTIVATED") == "1"
    if not is_restarted_in_venv:
        banner()
    step1_setup_and_activate_venv()
    db = step2_verify_db_credentials()
    step3_ensure_database_exists(db)
    step4_validate_and_migrate_schema()
    step5_start_servers()


if __name__ == "__main__":
    main()
