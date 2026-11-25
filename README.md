# RTGS TransactFlow • Bank Statement Extractor

A modern, high-performance Bank Statement Extractor with **FastAPI Backend** and a customized **React + Tailwind CSS** UI.

### 🚀 Quick Start (One Command)

```bash
python start.py
```

This single command automatically:
1. Detects or creates the `.venv` virtual environment.
2. Checks and installs all Python packages from `requirements.txt`.
3. Verifies frontend npm packages.
4. Starts the **FastAPI Backend** (`http://127.0.0.1:4501`).
5. Starts the **React + Tailwind CSS UI** (`http://localhost:4500`).
6. Automatically opens the application in your default browser.

---

### 🎨 Architecture & Features

#### 1. Modern Frontend (`frontend/`)
- **Custom Floating Glass Sidebar**:
  - **Extractor**: Multi-statement file upload (PDF, CSV, Excel), live extraction, and split into:
    - 🔴 **Send (Debit / Dr)**: Filterable, with total amounts, and **1-Click Copy** formatted list (`1.SS - PARTY NAME - 1.5L`).
    - 🟢 **Received (Credit / Cr)**: Filterable, with total amounts, and **1-Click Copy** formatted list.
    - 📄 **File Breakdown**: Per-file bank detection, holder detection, and warnings.
  - **Settings**:
    - Live view and search of `config/account_codes.py`.
    - Quick "+ Add New Code" form to save new holder mappings directly.
    - Account sort order visualizer (`config/accounts.py`).
    - Bank layout parsers status.
- **Palette**: Obsidian & Cosmic Zinc base with Sunset Coral, Golden Amber, Electric Violet, and Aurora accents (no boring default blue/green).

#### 2. FastAPI Backend (`backend/main.py`)
- `/api/extract` — Multi-file statement extraction.
- `/api/settings` — Read configuration (account codes, order, supported banks).
- `/api/settings/account-code` — Add new account holder mappings dynamically.
- `/api/banks` — Bank definitions and orders.
- `/api/health` — Backend telemetry & health check.
- Static file serving for production React build.

#### 3. Core Engine (`core/` & `config/`)
- `config/account_codes.py`: Statement Holder Name -> Account Code mapping.
- `config/bank_layouts.py`: Bank detection & column configurations.
- `config/regex_patterns.py`: ROW_START and party extraction patterns.
- `config/name_mappings.py`: Extracted party name normalization.
- `config/accounts.py`: Output sorting sequence.
- `core/extractor.py`: Transaction parsing pipeline.
- `core/holder.py`: Holder auto-detection and suffix stripping.
- `core/tabular.py`: CSV / Excel processor.
