import asyncio
from contextlib import asynccontextmanager
import io
import os
import re
import socket
import sys
import tempfile
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.config import account_codes, accounts, bank_layouts, enterprise_banks, name_mappings, regex_patterns
from backend.config.pdf_generator import create_zip_archive, get_collection_zip_filename, process_excel_to_pdfs
from backend.database import get_worker_session, init_db
from backend.database.models import Bank, Enterprise, AccountCode
from backend.core.extractor import (
    account_sort_key,
    detect_bank,
    extract_transactions,
    identify_account,
    _reload_config,
)
from backend.core.formatting import indian_format, to_float

def _get_local_ip() -> str:
    """Return the machine's LAN IP. Falls back to 127.0.0.1."""
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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Ensure database tables exist when the FastAPI app starts directly."""
    try:
        init_db()
    except Exception as exc:
        print(f"[WARN] Database table initialization skipped/failed: {exc}")
    yield


app = FastAPI(
    title="RTGS Bank Statement Extractor API",
    version="2.1.0",
    lifespan=lifespan,
)

# Security: Specific local origins + LAN IP (HTTP/HTTPS) + regex for any local dev port
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4500",
        "https://localhost:4500",
        "http://127.0.0.1:4500",
        "https://127.0.0.1:4500",
        "http://localhost:4501",
        "https://localhost:4501",
        "http://127.0.0.1:4501",
        "https://127.0.0.1:4501",
        f"http://{LOCAL_IP}:4500",
        f"https://{LOCAL_IP}:4500",
        f"http://{LOCAL_IP}:4501",
        f"https://{LOCAL_IP}:4501",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Request & Response Schemas (RORO Pattern & Type Safety)
# -----------------------------------------------------------------------------

class AccountCodeRequest(BaseModel):
    holder_name: str
    account_code: str


class EnterpriseModel(BaseModel):
    code: str
    name: str
    banks: List[str]


class EnterpriseUpdateModel(BaseModel):
    name: Optional[str] = None
    banks: List[str]


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str


class BanksResponse(BaseModel):
    banks: List[str]
    account_order: List[str]


class SettingsResponse(BaseModel):
    holder_to_code: Dict[str, str]
    account_order: List[str]
    supported_banks: List[str]
    name_mappings_count: int
    regex_patterns_count: int
    enterprise_banks: Dict[str, Any]


class EnterpriseListResponse(BaseModel):
    enterprises: List[Dict[str, Any]]
    supported_banks: List[str]


class GroupEnterpriseItem(BaseModel):
    name: str
    code: Optional[str] = None
    banks: List[str]


class GroupRequestModel(BaseModel):
    group_name: str
    enterprises: List[GroupEnterpriseItem]


class GroupResponseItem(BaseModel):
    group_name: str
    enterprises: List[Dict[str, Any]]


class GroupListResponse(BaseModel):
    groups: List[GroupResponseItem]
    supported_banks: List[str]


class BankRequest(BaseModel):
    name: str


class QuickEnterpriseRequest(BaseModel):
    code: str
    name: Optional[str] = None


class EnterpriseActionResponse(BaseModel):
    message: str
    enterprise: Optional[Dict[str, Any]] = None


class SimpleMessageResponse(BaseModel):
    message: str
    status: Optional[str] = None


class PrecheckFileItem(BaseModel):
    filename: str
    bank: Optional[str] = None
    account_code: Optional[str] = None
    holder_name: Optional[str] = None
    in_group: bool = True
    group_name: Optional[str] = None
    not_in_group_reason: Optional[str] = None


class PrecheckEnterpriseItem(BaseModel):
    code: str
    name: str
    expected_banks: List[str]
    uploaded_banks: List[str]
    missing_banks: List[str]
    group_name: Optional[str] = None
    is_entire_enterprise_missing: bool = False


class PrecheckResponse(BaseModel):
    has_missing: bool
    has_not_in_group: bool = False
    enterprises: List[PrecheckEnterpriseItem]
    files: List[PrecheckFileItem]
    not_in_group_files: List[PrecheckFileItem] = []


class TransactionItem(BaseModel):
    index: int
    account: str
    bank: str
    name: str
    raw_name: str
    amount: str
    amount_num: float
    short: str
    type: str
    status: str
    file: str
    line_text: str


class TransactionGroup(BaseModel):
    transactions: List[TransactionItem]
    count: int
    total_formatted: str
    total_num: float
    text: str


class FileSummaryItem(BaseModel):
    filename: str
    bank: str
    account_code: str
    holder_name: str
    warning: Optional[str] = None
    status: str
    transactions_count: int
    total_rows_found: Optional[int] = None


class ExtractResponse(BaseModel):
    send: TransactionGroup
    received: TransactionGroup
    combined_text: str
    files: List[FileSummaryItem]


# -----------------------------------------------------------------------------
# Synchronous Core Worker Routines (Offloaded to worker threadpool)
# -----------------------------------------------------------------------------

def _norm_identifier(val: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (val or "").upper())


def _match_grouped_enterprise(
    finfo: dict,
    grouped_enterprises: Dict[str, dict],
) -> Optional[dict]:
    """Match an uploaded file against enterprises that belong to configured groups."""
    f_code = (finfo.get("account_code") or "").strip().upper()
    f_holder = (finfo.get("holder_name") or "").strip().upper()
    f_name = (finfo.get("filename") or "").strip().upper()
    f_code_norm = _norm_identifier(f_code)
    f_holder_norm = _norm_identifier(f_holder)

    if f_code and f_code != "?":
        for ent in grouped_enterprises.values():
            if (
                f_code == ent["code"]
                or f_code == ent["name"]
                or (f_code_norm and f_code_norm == _norm_identifier(ent["name"]))
            ):
                return ent
        for ac_holder, ac_code in account_codes.HOLDER_TO_CODE.items():
            if (ac_code or "").strip().upper() == f_code:
                ac_holder_norm = _norm_identifier(ac_holder)
                for ent in grouped_enterprises.values():
                    if ac_holder_norm and ac_holder_norm == _norm_identifier(ent["name"]):
                        return ent

    if f_holder:
        for ent in grouped_enterprises.values():
            ent_name_norm = _norm_identifier(ent["name"])
            if (
                f_holder == ent["name"]
                or f_holder == ent["code"]
                or (f_holder_norm and f_holder_norm == ent_name_norm)
            ):
                return ent

    if not f_holder:
        for ent in grouped_enterprises.values():
            tcode = ent["code"]
            if tcode and re.search(rf"(?<![A-Z0-9]){re.escape(tcode)}(?![A-Z0-9])", f_name):
                return ent

    return None


def _sync_precheck(
    payloads: List[Tuple[str, bytes]],
    selected_enterprise: Optional[str] = None
) -> dict:
    """CPU-bound statement pre-check executed in worker thread to prevent event loop blocking."""
    _reload_config()
    eb_data = enterprise_banks.load_enterprise_banks()
    groups_data = enterprise_banks.load_groups()

    grouped_enterprises: Dict[str, dict] = {}
    for grp in groups_data:
        grp_name = (grp.get("group_name") or "").strip().upper()
        if not grp_name:
            continue
        for ent in grp.get("enterprises", []):
            ent_code = (ent.get("code") or "").strip().upper()
            ent_name = (ent.get("name") or ent_code).strip().upper()
            ent_banks = [b.strip().upper() for b in ent.get("banks", []) if b.strip()]
            if ent_code:
                grouped_enterprises[ent_code] = {
                    "code": ent_code,
                    "name": ent_name,
                    "group_name": grp_name,
                    "banks": ent_banks,
                }

    uploaded_files_info = []
    not_in_group_files = []
    active_groups = set()
    detected_codes = set()
    file_matched_codes: Dict[int, str] = {}

    for idx, (fname, file_bytes) in enumerate(payloads):
        stream = io.BytesIO(file_bytes)
        stream.name = fname

        try:
            bank = detect_bank(stream)
        except Exception:
            bank = None

        stream.seek(0)
        code, holder = "?", ""
        if bank:
            try:
                code, holder, _ = identify_account(stream, bank, fname)
            except Exception:
                pass

        f_bank = (bank or "").strip().upper()
        finfo = {
            "filename": fname,
            "bank": bank,
            "account_code": code,
            "holder_name": holder,
            "in_group": True,
            "group_name": None,
            "not_in_group_reason": None,
        }

        matched_ent = _match_grouped_enterprise(finfo, grouped_enterprises) if f_bank else None

        if not f_bank:
            finfo["in_group"] = False
            finfo["not_in_group_reason"] = "Bank could not be detected. This file is not in any group."
        elif matched_ent is None:
            finfo["in_group"] = False
            label = (holder or (code if code and code != "?" else "")).strip()
            if label:
                finfo["not_in_group_reason"] = f"'{label}' is not in any group."
            else:
                finfo["not_in_group_reason"] = "This file is not in any group."
        elif matched_ent["banks"] and f_bank not in matched_ent["banks"]:
            finfo["in_group"] = False
            finfo["group_name"] = matched_ent["group_name"]
            finfo["not_in_group_reason"] = (
                f"{f_bank} statement for {matched_ent['name']} ({matched_ent['code']}) "
                f"is not in group '{matched_ent['group_name']}'."
            )
        else:
            finfo["in_group"] = True
            finfo["group_name"] = matched_ent["group_name"]
            active_groups.add(matched_ent["group_name"])
            detected_codes.add(matched_ent["code"])
            file_matched_codes[idx] = matched_ent["code"]

        if not finfo["in_group"]:
            not_in_group_files.append(finfo)

        uploaded_files_info.append(finfo)

    # Step 2: Build target enterprises belonging to the active groups
    sel = (selected_enterprise or "").strip().upper()
    target_codes = []
    seen_codes = set()

    if sel and sel not in ("ALL", "AUTO", ""):
        target_codes = [sel]
    else:
        for code, ent_info in grouped_enterprises.items():
            if ent_info["group_name"] in active_groups and code not in seen_codes:
                target_codes.append(code)
                seen_codes.add(code)

    enterprise_summaries = []
    has_missing = False

    for tcode in target_codes:
        ent_info = grouped_enterprises.get(tcode) or eb_data.get(tcode)
        if not ent_info:
            continue

        expected_banks = [b.upper() for b in ent_info.get("banks", [])]
        ent_name = ent_info.get("name", tcode)
        ent_group = ent_info.get("group_name")
        if not expected_banks:
            continue

        uploaded_for_ent = []
        for idx, finfo in enumerate(uploaded_files_info):
            if not finfo["in_group"]:
                continue
            f_bank = (finfo.get("bank") or "").strip().upper()
            if file_matched_codes.get(idx) == tcode and f_bank:
                uploaded_for_ent.append(f_bank)
            elif sel and sel not in ("ALL", "AUTO", "") and f_bank:
                f_code = (finfo.get("account_code") or "").strip().upper()
                f_holder = (finfo.get("holder_name") or "").strip().upper()
                if f_code == tcode or (f_holder and ent_name.upper() in f_holder):
                    uploaded_for_ent.append(f_bank)

        uploaded_unique = sorted(list(set(uploaded_for_ent)))
        missing = [b for b in expected_banks if b not in uploaded_unique]
        is_entire_enterprise_missing = (len(uploaded_unique) == 0)

        if missing:
            has_missing = True

        enterprise_summaries.append({
            "code": tcode,
            "name": ent_name,
            "expected_banks": expected_banks,
            "uploaded_banks": uploaded_unique,
            "missing_banks": missing,
            "group_name": ent_group,
            "is_entire_enterprise_missing": is_entire_enterprise_missing,
        })

    return {
        "has_missing": has_missing,
        "has_not_in_group": len(not_in_group_files) > 0,
        "enterprises": enterprise_summaries,
        "files": uploaded_files_info,
        "not_in_group_files": not_in_group_files,
    }


def _sync_extract(payloads: List[Tuple[str, bytes]]) -> dict:
    """CPU-bound PDF and tabular extraction executed in worker thread to prevent event loop blocking."""
    _reload_config()

    frames = []
    file_summaries = []

    for fname, file_bytes in payloads:
        stream = io.BytesIO(file_bytes)
        stream.name = fname

        try:
            bank = detect_bank(stream)
        except Exception as e:
            file_summaries.append({
                "filename": fname,
                "bank": "UNKNOWN",
                "account_code": "?",
                "holder_name": "",
                "warning": f"Unreadable file: {str(e)}",
                "status": "error",
                "transactions_count": 0,
                "total_rows_found": 0,
            })
            continue

        stream.seek(0)
        if bank is None:
            file_summaries.append({
                "filename": fname,
                "bank": "UNKNOWN",
                "account_code": "?",
                "holder_name": "",
                "warning": "Bank auto-detection failed. Could not determine bank layout.",
                "status": "bank_not_detected",
                "transactions_count": 0,
                "total_rows_found": 0,
            })
            continue

        code, holder, warn = identify_account(stream, bank, fname)
        stream.seek(0)

        rows = extract_transactions(stream, bank, code, holder)
        stream.seek(0)

        df = pd.DataFrame(rows)
        file_matched_count = 0

        if not df.empty:
            df.insert(0, "File", fname)
            matched = df[df.Status != "NO_REGEX"]
            file_matched_count = len(matched)
            if not matched.empty:
                frames.append(matched)

        file_summaries.append({
            "filename": fname,
            "bank": bank,
            "account_code": code,
            "holder_name": holder,
            "warning": warn or None,
            "status": "success",
            "transactions_count": file_matched_count,
            "total_rows_found": len(df),
        })

    send_list = []
    received_list = []
    send_formatted_lines = ""
    received_formatted_lines = ""
    send_total_sum = 0.0
    received_total_sum = 0.0

    if frames:
        alldf = pd.concat(frames, ignore_index=True)
        alldf["_o"] = alldf["Account"].map(account_sort_key)
        alldf = alldf.sort_values("_o", kind="stable").drop(columns="_o")

        send_df = alldf[alldf.Type == "Dr"].reset_index(drop=True)
        recv_df = alldf[alldf.Type == "Cr"].reset_index(drop=True)

        for i, r in enumerate(send_df.itertuples(), 1):
            amount_val = to_float(r.Amount)
            send_total_sum += amount_val
            send_list.append({
                "index": i,
                "account": r.Account,
                "bank": r.Bank,
                "name": r.Name,
                "raw_name": getattr(r, "Raw Name", r.Name),
                "amount": r.Amount,
                "amount_num": amount_val,
                "short": r.Short,
                "type": r.Type,
                "status": r.Status,
                "file": r.File,
                "line_text": f"{i}.{r.Account} - {r.Name} - {r.Short}",
            })

        for i, r in enumerate(recv_df.itertuples(), 1):
            amount_val = to_float(r.Amount)
            received_total_sum += amount_val
            received_list.append({
                "index": i,
                "account": r.Account,
                "bank": r.Bank,
                "name": r.Name,
                "raw_name": getattr(r, "Raw Name", r.Name),
                "amount": r.Amount,
                "amount_num": amount_val,
                "short": r.Short,
                "type": r.Type,
                "status": r.Status,
                "file": r.File,
                "line_text": f"{i}.{r.Account} - {r.Name} - {r.Short}",
            })

        send_formatted_lines = "\n".join(item["line_text"] for item in send_list)
        received_formatted_lines = "\n".join(item["line_text"] for item in received_list)

    return {
        "send": {
            "transactions": send_list,
            "count": len(send_list),
            "total_formatted": indian_format(send_total_sum),
            "total_num": send_total_sum,
            "text": send_formatted_lines,
        },
        "received": {
            "transactions": received_list,
            "count": len(received_list),
            "total_formatted": indian_format(received_total_sum),
            "total_num": received_total_sum,
            "text": received_formatted_lines,
        },
        "combined_text": (
            "Yesterday Send Transaction\n\n"
            + send_formatted_lines
            + "\n\nYesterday Received Transaction\n\n"
            + received_formatted_lines
            + "\n"
        ),
        "files": file_summaries,
    }


# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "app": "RTGS Extractor", "version": "2.1.0"}


@app.get("/api/banks", response_model=BanksResponse)
def get_supported_banks():
    _reload_config()
    try:
        with get_worker_session() as session:
            db_banks = [b.name for b in session.query(Bank).order_by(Bank.name).all()]
    except Exception:
        db_banks = []
    all_banks = sorted(list(set(list(bank_layouts.BANK_LAYOUTS.keys()) + db_banks)))
    return {
        "banks": all_banks,
        "account_order": accounts.ACCOUNT_ORDER,
    }


@app.post("/api/banks", response_model=SimpleMessageResponse)
def add_bank(data: BankRequest):
    _reload_config()
    b_name = data.name.strip().upper()
    if not b_name:
        raise HTTPException(status_code=400, detail="Bank name is required")
    with get_worker_session() as session:
        existing = session.query(Bank).filter_by(name=b_name).first()
        if not existing:
            session.add(Bank(name=b_name))
            session.commit()
    return {"message": f"Bank '{b_name}' added successfully"}


@app.delete("/api/banks/{name}", response_model=SimpleMessageResponse)
def delete_bank(name: str):
    _reload_config()
    b_name = name.strip().upper()
    with get_worker_session() as session:
        bank = session.query(Bank).filter_by(name=b_name).first()
        if bank:
            session.delete(bank)
            session.commit()
            return {"message": f"Bank '{b_name}' deleted successfully"}
    return {"message": f"Bank '{b_name}' removed"}


@app.get("/api/enterprises/list")
def get_distinct_enterprises():
    _reload_config()
    with get_worker_session() as session:
        ents = session.query(Enterprise).order_by(Enterprise.code).all()
        # Fallback map for full holder names in account codes if an enterprise name equals its code
        ac_map = {
            a.account_code: a.holder_name 
            for a in session.query(AccountCode).all() 
            if a.holder_name != a.account_code
        }
        return {
            "enterprises": [
                {
                    "code": e.code, 
                    "name": e.name if (e.name and e.name != e.code) else (ac_map.get(e.code) or e.name or e.code)
                }
                for e in ents
            ]
        }


@app.post("/api/enterprises/quick-add", response_model=SimpleMessageResponse)
def quick_add_enterprise(data: QuickEnterpriseRequest):
    _reload_config()
    code = data.code.strip().upper()
    name = (data.name or code).strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Enterprise code is required")
    with get_worker_session() as session:
        ac = session.query(AccountCode).filter_by(holder_name=name).first()
        if not ac:
            session.add(AccountCode(holder_name=name, account_code=code))
        ent = session.query(Enterprise).filter_by(code=code).first()
        if not ent:
            session.add(Enterprise(code=code, name=name, group_name=code))
        session.commit()
    account_codes.HOLDER_TO_CODE = account_codes.load_account_codes()
    _reload_config()
    return {"message": f"Enterprise '{code}' added successfully"}


@app.get("/api/settings", response_model=SettingsResponse)
def get_settings():
    _reload_config()
    return {
        "holder_to_code": account_codes.load_account_codes(),
        "account_order": accounts.ACCOUNT_ORDER,
        "supported_banks": list(bank_layouts.BANK_LAYOUTS.keys()),
        "name_mappings_count": len(name_mappings.NAME_MAPPINGS),
        "regex_patterns_count": sum(len(v) for v in regex_patterns.BANK_PATTERNS.values()),
        "enterprise_banks": enterprise_banks.load_enterprise_banks(),
    }


@app.get("/api/enterprises", response_model=EnterpriseListResponse)
def get_enterprises():
    _reload_config()
    eb_data = enterprise_banks.load_enterprise_banks()
    return {
        "enterprises": list(eb_data.values()),
        "supported_banks": list(bank_layouts.BANK_LAYOUTS.keys()),
    }


@app.get("/api/groups", response_model=GroupListResponse)
def get_groups():
    _reload_config()
    groups_data = enterprise_banks.load_groups()
    return {
        "groups": groups_data,
        "supported_banks": list(bank_layouts.BANK_LAYOUTS.keys()),
    }


@app.post("/api/groups", response_model=SimpleMessageResponse)
def create_group(data: GroupRequestModel):
    _reload_config()
    grp_name = data.group_name.strip().upper()
    if not grp_name:
        raise HTTPException(status_code=400, detail="Group Name is required")
    if not data.enterprises:
        raise HTTPException(status_code=400, detail="At least one enterprise must be added under the group")

    for ent in data.enterprises:
        if not ent.name.strip():
            raise HTTPException(status_code=400, detail="Enterprise Name cannot be empty")
        if not ent.banks:
            raise HTTPException(status_code=400, detail=f"Please select at least one bank statement for enterprise '{ent.name}'")

    enterprise_banks.save_group(
        group_name=grp_name,
        enterprises_list=[item.model_dump() for item in data.enterprises]
    )
    _reload_config()
    return {"message": f"Group '{grp_name}' saved successfully"}


@app.put("/api/groups/{group_name}", response_model=SimpleMessageResponse)
def update_group(group_name: str, data: GroupRequestModel):
    _reload_config()
    new_grp = data.group_name.strip().upper()
    if not new_grp:
        raise HTTPException(status_code=400, detail="Group Name is required")
    if not data.enterprises:
        raise HTTPException(status_code=400, detail="At least one enterprise must be added under the group")

    for ent in data.enterprises:
        if not ent.name.strip():
            raise HTTPException(status_code=400, detail="Enterprise Name cannot be empty")
        if not ent.banks:
            raise HTTPException(status_code=400, detail=f"Please select at least one bank statement for enterprise '{ent.name}'")

    enterprise_banks.save_group(
        group_name=new_grp,
        enterprises_list=[item.model_dump() for item in data.enterprises],
        old_group_name=group_name.strip().upper()
    )
    _reload_config()
    return {"message": f"Group '{new_grp}' updated successfully"}


@app.delete("/api/groups/{group_name}", response_model=SimpleMessageResponse)
def delete_group(group_name: str):
    _reload_config()
    deleted = enterprise_banks.delete_group(group_name)
    if deleted:
        _reload_config()
        return {"message": f"Group '{group_name}' deleted successfully"}
    raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")


@app.post("/api/enterprises", response_model=EnterpriseActionResponse)
def create_or_update_enterprise(data: EnterpriseModel):
    _reload_config()
    code = data.code.strip().upper()
    name = data.name.strip().upper() or code
    banks = [b.strip().upper() for b in data.banks if b.strip()]
    if not code:
        raise HTTPException(status_code=400, detail="Enterprise code is required")
    if not banks:
        raise HTTPException(status_code=400, detail="At least one bank must be selected")

    saved_ent = enterprise_banks.create_or_update_enterprise(code, name, banks)
    # Auto-sync: automatically register holder name -> code in account_codes
    account_codes.add_account_code(name, code)
    _reload_config()
    return {"message": f"Enterprise '{code}' saved successfully", "enterprise": saved_ent}


@app.put("/api/enterprises/{code}", response_model=EnterpriseActionResponse)
def update_enterprise(code: str, data: EnterpriseUpdateModel):
    _reload_config()
    code_key = code.strip().upper()
    eb_data = enterprise_banks.load_enterprise_banks()
    if code_key not in eb_data:
        raise HTTPException(status_code=404, detail=f"Enterprise '{code_key}' not found")

    name = (data.name or "").strip().upper() or eb_data[code_key].get("name", code_key)
    banks = [b.strip().upper() for b in data.banks if b.strip()]
    if not banks:
        raise HTTPException(status_code=400, detail="At least one bank must be selected")

    updated_ent = enterprise_banks.create_or_update_enterprise(code_key, name, banks)
    # Auto-sync: update holder name -> code in account_codes
    account_codes.add_account_code(name, code_key)
    _reload_config()
    return {"message": f"Enterprise '{code_key}' updated successfully", "enterprise": updated_ent}


@app.delete("/api/enterprises/{code}", response_model=SimpleMessageResponse)
def delete_enterprise(code: str):
    _reload_config()
    code_key = code.strip().upper()
    deleted = enterprise_banks.delete_enterprise(code_key)
    if deleted:
        # Also clean up associated account_codes for this enterprise code
        from backend.database import get_worker_session
        from backend.database.models import AccountCode
        with get_worker_session() as session:
            session.query(AccountCode).filter_by(account_code=code_key).delete()
            session.commit()
        account_codes.HOLDER_TO_CODE = account_codes.load_account_codes()
        _reload_config()
        return {"message": f"Enterprise '{code_key}' deleted successfully"}
    raise HTTPException(status_code=404, detail=f"Enterprise '{code_key}' not found")


@app.post("/api/settings/account-code", response_model=SimpleMessageResponse)
def add_account_code(data: AccountCodeRequest):
    """Safely adds or updates an account holder mapping directly in PostgreSQL."""
    _reload_config()
    holder = data.holder_name.strip().upper()
    code = data.account_code.strip().upper()
    if not holder or not code:
        raise HTTPException(status_code=400, detail="Holder name and Account code are required")

    try:
        is_new, msg = account_codes.add_account_code(holder, code)
        _reload_config()
        return {"message": msg, "status": "success" if is_new else "existing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update account codes: {str(e)}")


@app.post("/api/precheck", response_model=PrecheckResponse)
async def precheck_statements(
    files: List[UploadFile] = File(...),
    selected_enterprise: Optional[str] = Form(None)
):
    """
    Non-blocking pre-scan of uploaded statements.
    Reads bytes asynchronously and executes statement inspection in a worker thread.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    payloads = []
    for f in files:
        file_bytes = await f.read()
        payloads.append((f.filename, file_bytes))

    return await asyncio.to_thread(_sync_precheck, payloads, selected_enterprise)


@app.post("/api/extract", response_model=ExtractResponse)
async def extract_statements(
    files: List[UploadFile] = File(...),
    manual_banks: Optional[str] = Form(None)
):
    """
    Non-blocking extraction of transactions from bank statements.
    Reads files asynchronously and executes CPU-bound table extraction in a worker thread.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    payloads = []
    for f in files:
        file_bytes = await f.read()
        payloads.append((f.filename, file_bytes))

    return await asyncio.to_thread(_sync_extract, payloads)


def _sync_generate_collection_report(filename: str, file_bytes: bytes) -> Tuple[bytes, str, int]:
    """Generate categorized PDF reports from an Excel stream and return ZIP bytes, filename, and PDF count."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_output_dir = os.path.join(tmp_dir, "pdfs")
        os.makedirs(pdf_output_dir, exist_ok=True)

        pdf_files = process_excel_to_pdfs(io.BytesIO(file_bytes), pdf_output_dir)
        if not pdf_files:
            raise ValueError("No PDF reports could be generated from the uploaded Excel file.")

        zip_filename = get_collection_zip_filename()
        zip_path = os.path.join(tmp_dir, zip_filename)

        create_zip_archive(pdf_files, zip_path)
        with open(zip_path, "rb") as zf:
            zip_bytes = zf.read()

        return zip_bytes, zip_filename, len(pdf_files)


@app.post("/api/collection-report/generate")
async def generate_collection_report(file: UploadFile = File(...)):
    """
    Accepts an Excel file (.xlsx or .xls), generates categorized Branch, Consultant,
    and Collection Executive PDF reports, and streams back a downloadable ZIP archive.
    """
    filename = file.filename or "report.xlsx"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".xlsx", ".xls"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Please upload an Excel file (.xlsx or .xls).",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded Excel file is empty.")

    try:
        zip_bytes, zip_filename, pdf_count = await asyncio.to_thread(
            _sync_generate_collection_report, filename, file_bytes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate collection report: {str(e)}")

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
            "X-Pdf-Count": str(pdf_count),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Pdf-Count",
        },
    )


# Mount production React build if dist exists
dist_dir = os.path.join(BASE_DIR, "frontend", "dist")
if os.path.exists(dist_dir):
    index_html = os.path.join(dist_dir, "index.html")

    @app.get("/extractor", include_in_schema=False)
    @app.get("/collection-report", include_in_schema=False)
    @app.get("/settings", include_in_schema=False)
    def serve_spa_routes():
        return FileResponse(index_html)

    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
