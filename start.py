import importlib.util
import os
import socket
import subprocess
import sys
import time


def _get_local_ip() -> str:
    """Return the machine's LAN IP (e.g. 192.168.x.x). Falls back to 127.0.0.1."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


LOCAL_IP = _get_local_ip()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
VENV_DIR = os.path.join(BASE_DIR, ".venv")
CERTS_DIR = os.path.join(BASE_DIR, "certs")
_BACKEND_ENV = os.path.join(BASE_DIR, "backend", ".env")
_ROOT_ENV = os.path.join(BASE_DIR, ".env")
ENV_FILE = _BACKEND_ENV if os.path.exists(_BACKEND_ENV) else _ROOT_ENV

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
    "pandas",
    "pdfplumber",
    "openpyxl",
    "reportlab",
    "cryptography",
]


def banner():
    print("=" * 68)
    print("      RTGS TransactFlow - Automated Startup & Preflight Check")
    print("         Backend: FastAPI (:4501) | Frontend: React + Vite (:4500)")
    print(f"         Local IP: {LOCAL_IP}")
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

    print("\n[STEP 1/6] Virtual Environment Setup & Auto-Activation...")

    created_now = False
    if not os.path.exists(VENV_PYTHON):
        print("  -> Creating virtual environment at .venv...")
        subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)
        created_now = True
        print("  [OK] Virtual environment created.")
    else:
        print("  [OK] Virtual environment found at .venv.")

    _backend_req = os.path.join(BASE_DIR, "backend", "requirements.txt")
    _root_req = os.path.join(BASE_DIR, "requirements.txt")
    req_file = _backend_req if os.path.exists(_backend_req) else _root_req
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


def step3_verify_db_credentials() -> dict:
    """
    STEP 3: Database Credentials Verification.
    Validates .env presence, credential fields, and tests authenticating to PostgreSQL.
    """
    import psycopg

    print("\n[STEP 3/6] Database Credentials Verification...")

    if not os.path.exists(ENV_FILE):
        print("  [ERROR] .env file not found in backend/.env or project root. Create backend/.env and configure your PostgreSQL credentials.")
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


def step4_ensure_database_exists(db: dict):
    """
    STEP 4: Database Existence Check.
    Checks whether the target database exists and creates it automatically if missing.
    """
    import psycopg
    from psycopg import sql

    db_name = db["db_name"]
    print(f"\n[STEP 4/6] Database Existence Check ('{db_name}')...")

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


def step5_validate_and_init_schema():
    """
    STEP 5: Database Schema Validation & Table Initialization.
    Creates any missing ORM tables via SQLAlchemy metadata and validates all expected tables and columns exist.
    """
    print("\n[STEP 5/6] Database Schema Validation & Table Initialization...")

    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)

    from sqlalchemy import inspect
    from backend.database import init_db
    from backend.database.config import engine
    from backend.database.models import Base

    expected_tables = set(Base.metadata.tables.keys())
    inspector = inspect(engine)
    existing_before = set(inspector.get_table_names())
    print(f"  -> Expected tables: {sorted(expected_tables)}")
    print("  -> Ensuring ORM tables exist (Base.metadata.create_all)...")

    try:
        init_db()
    except Exception as exc:
        print(f"  [ERROR] Database schema initialization failed: {exc}")
        sys.exit(1)

    # Validate tables & columns match ORM models
    inspector = inspect(engine)
    existing_after = set(inspector.get_table_names())
    missing_tables = expected_tables - existing_after
    if missing_tables:
        print(f"  [ERROR] Schema validation failed; missing tables: {sorted(missing_tables)}")
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
        print("  [OK] Initial schema created and validated.")
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


def step2_ensure_ssl_certs(local_ip: str = LOCAL_IP) -> tuple[str, str]:
    """
    STEP 2: SSL Certificate Check & Generation.
    Creates certs/cert.pem and certs/key.pem automatically if missing, expired, or IP changed.
    """
    from datetime import datetime, timedelta, timezone
    import ipaddress
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    print("\n[STEP 2/6] SSL Certificate Check & Generation...")

    os.makedirs(CERTS_DIR, exist_ok=True)
    cert_path = os.path.join(CERTS_DIR, "cert.pem")
    key_path = os.path.join(CERTS_DIR, "key.pem")

    if os.path.exists(cert_path) and os.path.exists(key_path):
        try:
            with open(cert_path, "rb") as f:
                existing = x509.load_pem_x509_certificate(f.read())
            san = existing.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
            ip_strs = {str(ip) for ip in san.get_values_for_type(x509.IPAddress)}
            dns_strs = set(san.get_values_for_type(x509.DNSName))
            now_utc = datetime.now(timezone.utc)
            expiry = getattr(existing, "not_valid_after_utc", None) or existing.not_valid_after.replace(tzinfo=timezone.utc)
            if (
                "localhost" in dns_strs
                and "127.0.0.1" in ip_strs
                and local_ip in ip_strs
                and expiry > now_utc + timedelta(days=7)
            ):
                print(f"  [OK] SSL certificates verified at {CERTS_DIR} (covers localhost & {local_ip}).")
                return cert_path, key_path
            print(f"  -> Existing certificate does not match current IP ({local_ip}) or is expiring soon. Regenerating...")
        except Exception:
            print("  -> Existing certificate is invalid/unreadable. Regenerating...")
    else:
        print("  -> SSL certificate files not found in certs/. Creating automatically...")

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "RTGS TransactFlow"),
    ])

    san_entries = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]
    try:
        parsed_ip = ipaddress.ip_address(local_ip)
        if local_ip != "127.0.0.1":
            san_entries.append(x509.IPAddress(parsed_ip))
    except ValueError:
        pass

    now_utc = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now_utc - timedelta(minutes=5))
        .not_valid_after(now_utc + timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    with open(key_path, "wb") as f:
        f.write(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print(f"  [OK] SSL certificates generated at {CERTS_DIR} (covers localhost & {local_ip}).")
    return cert_path, key_path


def step6_start_servers(cert_path: str, key_path: str):
    """
    STEP 6: Starting Backend & Frontend Servers.
    Starts FastAPI (HTTPS) on 0.0.0.0:4501 and Vite React UI (HTTPS) on 0.0.0.0:4500.
    """
    print("\n[STEP 6/6] Starting Backend & Frontend Servers (HTTPS)...")
    try:
        _ensure_frontend_deps()
    except Exception as exc:
        print(f"  [WARN] Notice on npm setup: {exc}")

    if not (os.path.exists(cert_path) and os.path.exists(key_path)):
        cert_path, key_path = step2_ensure_ssl_certs(LOCAL_IP)

    print(f"  -> Starting FastAPI Backend on https://{LOCAL_IP}:4501 (also https://127.0.0.1:4501)...")
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "4501",
        "--ssl-keyfile",
        key_path,
        "--ssl-certfile",
        cert_path,
        "--reload",
    ]
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=BASE_DIR,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )

    # Wait for backend to be ready before starting frontend (avoids ECONNREFUSED race)
    print("  -> Waiting for backend to be ready...", end="", flush=True)
    import ssl
    import urllib.request
    ssl_ctx = ssl._create_unverified_context()
    backend_ready = False
    for _ in range(20):  # up to 10 seconds
        time.sleep(0.5)
        try:
            urllib.request.urlopen("https://127.0.0.1:4501/docs", timeout=1, context=ssl_ctx)
            backend_ready = True
            break
        except Exception:
            print(".", end="", flush=True)
    print(" OK" if backend_ready else " (timeout, starting frontend anyway)")

    print(f"  -> Starting React + Tailwind UI on https://{LOCAL_IP}:4500...")
    # Write the backend IP and SSL paths into frontend/.env.local so Vite serves HTTPS and proxies cleanly
    env_local_path = os.path.join(FRONTEND_DIR, ".env.local")
    cert_env_path = cert_path.replace("\\", "/")
    key_env_path = key_path.replace("\\", "/")
    with open(env_local_path, "w") as f:
        f.write(f"VITE_BACKEND_HOST={LOCAL_IP}\n")
        f.write("VITE_BACKEND_PORT=4501\n")
        f.write("VITE_FRONTEND_PORT=4500\n")
        f.write("VITE_USE_HTTPS=true\n")
        f.write(f"VITE_SSL_CERT={cert_env_path}\n")
        f.write(f"VITE_SSL_KEY={key_env_path}\n")
    frontend_cmd = f"{NPM_CMD} run dev"
    frontend_process = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )

    print("\n" + "-" * 68)
    print("  App is running over HTTPS!")
    print(f"  Frontend UI:  https://{LOCAL_IP}:4500  (also https://localhost:4500)")
    print(f"  Backend API:  https://{LOCAL_IP}:4501/docs  (also https://127.0.0.1:4501/docs)")
    print("  Note: If the browser warns about the local self-signed certificate,")
    print("        click Advanced -> Proceed to open safely on your LAN.")
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
    """Execute Steps 1 through 5 without launching long-running servers (for verification)."""
    is_restarted_in_venv = os.environ.get("RTGS_VENV_ACTIVATED") == "1"
    if not is_restarted_in_venv:
        banner()
    step1_setup_and_activate_venv()
    step2_ensure_ssl_certs(LOCAL_IP)
    db = step3_verify_db_credentials()
    step4_ensure_database_exists(db)
    step5_validate_and_init_schema()
    print("\n[PREFLIGHT COMPLETE] All 5 preflight checks passed.")


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
    cert_path, key_path = step2_ensure_ssl_certs(LOCAL_IP)
    db = step3_verify_db_credentials()
    step4_ensure_database_exists(db)
    step5_validate_and_init_schema()
    step6_start_servers(cert_path, key_path)


if __name__ == "__main__":
    main()
