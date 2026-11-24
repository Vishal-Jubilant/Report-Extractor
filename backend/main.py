import io
import os
import sys
from typing import List, Optional
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from config import account_codes, accounts, bank_layouts, enterprise_banks, name_mappings, regex_patterns
from core.extractor import (
    account_sort_key,
    detect_bank,
    extract_transactions,
    identify_account,
    _reload_config,
)
from core.formatting import indian_format, to_float

app = FastAPI(title="RTGS Bank Statement Extractor API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "RTGS Extractor", "version": "2.0.0"}


@app.get("/api/banks")
def get_supported_banks():
    _reload_config()
    return {
        "banks": list(bank_layouts.BANK_LAYOUTS.keys()),
        "account_order": accounts.ACCOUNT_ORDER,
    }


@app.get("/api/settings")
def get_settings():
    _reload_config()
    return {
        "holder_to_code": account_codes.HOLDER_TO_CODE,
        "account_order": accounts.ACCOUNT_ORDER,
        "supported_banks": list(bank_layouts.BANK_LAYOUTS.keys()),
        "name_mappings_count": len(name_mappings.NAME_MAPPINGS),
        "regex_patterns_count": sum(len(v) for v in regex_patterns.BANK_PATTERNS.values()),
        "enterprise_banks": enterprise_banks.load_enterprise_banks(),
    }


@app.get("/api/enterprises")
def get_enterprises():
    _reload_config()
    eb_data = enterprise_banks.load_enterprise_banks()
    return {
        "enterprises": list(eb_data.values()),
        "supported_banks": list(bank_layouts.BANK_LAYOUTS.keys()),
    }


@app.post("/api/enterprises")
def create_or_update_enterprise(data: EnterpriseModel):
    _reload_config()
    code = data.code.strip().upper()
    name = data.name.strip().upper() or code
    banks = [b.strip().upper() for b in data.banks if b.strip()]
    if not code:
        raise HTTPException(status_code=400, detail="Enterprise code is required")
    if not banks:
        raise HTTPException(status_code=400, detail="At least one bank must be selected")

    eb_data = enterprise_banks.load_enterprise_banks()
    eb_data[code] = {
        "code": code,
        "name": name,
        "banks": banks,
    }
    enterprise_banks.save_enterprise_banks(eb_data)
    _reload_config()
    return {"message": f"Enterprise '{code}' saved successfully", "enterprise": eb_data[code]}


@app.put("/api/enterprises/{code}")
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

    eb_data[code_key] = {
        "code": code_key,
        "name": name,
        "banks": banks,
    }
    enterprise_banks.save_enterprise_banks(eb_data)
    _reload_config()
    return {"message": f"Enterprise '{code_key}' updated successfully", "enterprise": eb_data[code_key]}


@app.delete("/api/enterprises/{code}")
def delete_enterprise(code: str):
    _reload_config()
    code_key = code.strip().upper()
    eb_data = enterprise_banks.load_enterprise_banks()
    if code_key in eb_data:
        del eb_data[code_key]
        enterprise_banks.save_enterprise_banks(eb_data)
        _reload_config()
        return {"message": f"Enterprise '{code_key}' deleted successfully"}
    raise HTTPException(status_code=404, detail=f"Enterprise '{code_key}' not found")


@app.post("/api/precheck")
async def precheck_statements(
    files: List[UploadFile] = File(...),
    selected_enterprise: Optional[str] = Form(None)
):
    """
    Quick pre-scan of uploaded statements to detect bank layouts and account holders,
    and verify whether all expected bank statements for the enterprise are uploaded.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    _reload_config()
    eb_data = enterprise_banks.load_enterprise_banks()

    uploaded_files_info = []
    detected_codes = set()
    detected_banks_overall = set()

    for f in files:
        file_bytes = await f.read()
        stream = io.BytesIO(file_bytes)
        stream.name = f.filename

        try:
            bank = detect_bank(stream)
        except Exception:
            bank = None

        stream.seek(0)
        code, holder = "?", ""
        if bank:
            detected_banks_overall.add(bank.upper())
            try:
                code, holder, _ = identify_account(stream, bank, f.filename)
                if code and code != "?":
                    detected_codes.add(code.upper())
            except Exception:
                pass

        uploaded_files_info.append({
            "filename": f.filename,
            "bank": bank,
            "account_code": code,
            "holder_name": holder,
        })

    sel = (selected_enterprise or "").strip().upper()
    target_codes = []
    if sel and sel not in ("ALL", "AUTO", ""):
        target_codes = [sel]
    elif detected_codes:
        target_codes = list(detected_codes)
    else:
        target_codes = []

    enterprise_summaries = []
    has_missing = False

    for tcode in target_codes:
        ent_info = eb_data.get(tcode)
        if ent_info:
            expected_banks = [b.upper() for b in ent_info.get("banks", [])]
            ent_name = ent_info.get("name", tcode)
        else:
            matched = None
            for k, v in eb_data.items():
                if v.get("name", "").upper() == tcode or k.upper() == tcode:
                    matched = v
                    break
            if matched:
                expected_banks = [b.upper() for b in matched.get("banks", [])]
                ent_name = matched.get("name", tcode)
                tcode = matched.get("code", tcode)
            else:
                expected_banks = []
                ent_name = tcode

        if not expected_banks:
            continue

        if sel and sel not in ("ALL", "AUTO", ""):
            uploaded_for_ent = [
                finfo["bank"].upper() for finfo in uploaded_files_info if finfo["bank"]
            ]
        else:
            uploaded_for_ent = [
                finfo["bank"].upper() for finfo in uploaded_files_info 
                if finfo["bank"] and finfo["account_code"] == tcode
            ]
            if not uploaded_for_ent:
                uploaded_for_ent = list(detected_banks_overall)

        uploaded_unique = sorted(list(set(uploaded_for_ent)))
        missing = [b for b in expected_banks if b not in uploaded_unique]

        if missing:
            has_missing = True

        enterprise_summaries.append({
            "code": tcode,
            "name": ent_name,
            "expected_banks": expected_banks,
            "uploaded_banks": uploaded_unique,
            "missing_banks": missing,
        })

    return {
        "has_missing": has_missing,
        "enterprises": enterprise_summaries,
        "files": uploaded_files_info,
    }


@app.post("/api/settings/account-code")
def add_account_code(data: AccountCodeRequest):
    _reload_config()
    holder = data.holder_name.strip().upper()
    code = data.account_code.strip().upper()
    if not holder or not code:
        raise HTTPException(status_code=400, detail="Holder name and Account code are required")

    config_path = os.path.join(BASE_DIR, "config", "account_codes.py")
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check if already present
        if f'"{holder}"' in content.upper():
            return {"message": f"Account '{holder}' already exists in configuration", "status": "existing"}

        # Append before the closing bracket of HOLDER_TO_CODE
        entry_str = f'    "{holder}": "{code}",\n'
        target = "    # Add new accounts here:"
        if target in content:
            updated = content.replace(target, f'{entry_str}{target}')
        else:
            # find HOLDER_TO_CODE closing bracket
            idx = content.rfind("}")
            if idx != -1:
                updated = content[:idx] + entry_str + content[idx:]
            else:
                updated = content + f'\nHOLDER_TO_CODE["{holder}"] = "{code}"\n'

        with open(config_path, "w", encoding="utf-8") as f:
            f.write(updated)

        _reload_config()
        return {"message": f"Added '{holder}' -> '{code}' successfully", "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update account_codes.py: {str(e)}")


@app.post("/api/extract")
async def extract_statements(
    files: List[UploadFile] = File(...),
    manual_banks: Optional[str] = Form(None)
):
    """
    Extract transactions from uploaded PDF, CSV, or Excel bank statements.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    _reload_config()

    frames = []
    file_summaries = []

    for f in files:
        file_bytes = await f.read()
        stream = io.BytesIO(file_bytes)
        stream.name = f.filename

        try:
            bank = detect_bank(stream)
        except Exception as e:
            file_summaries.append({
                "filename": f.filename,
                "bank": "UNKNOWN",
                "account_code": "?",
                "holder_name": "",
                "warning": f"Unreadable file: {str(e)}",
                "status": "error",
                "transactions_count": 0,
            })
            continue

        stream.seek(0)
        if bank is None:
            # Bank auto detection failed
            file_summaries.append({
                "filename": f.filename,
                "bank": "UNKNOWN",
                "account_code": "?",
                "holder_name": "",
                "warning": "Bank auto-detection failed. Could not determine bank layout.",
                "status": "bank_not_detected",
                "transactions_count": 0,
            })
            continue

        code, holder, warn = identify_account(stream, bank, f.filename)
        stream.seek(0)

        rows = extract_transactions(stream, bank, code, holder)
        stream.seek(0)

        df = pd.DataFrame(rows)
        file_matched_count = 0

        if not df.empty:
            df.insert(0, "File", f.filename)
            matched = df[df.Status != "NO_REGEX"]
            file_matched_count = len(matched)
            if not matched.empty:
                frames.append(matched)

        file_summaries.append({
            "filename": f.filename,
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

        # Build Send List
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

        # Build Received List
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
            "Send (withdrawal/debit)\n\n"
            + send_formatted_lines
            + "\n\nReceived (credit)\n\n"
            + received_formatted_lines
            + "\n"
        ),
        "files": file_summaries,
    }


# Mount production React build if dist exists
dist_dir = os.path.join(BASE_DIR, "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")

