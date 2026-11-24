import pandas as pd
import streamlit as st

from config.bank_layouts import BANK_LAYOUTS
from core.extractor import (account_sort_key, detect_bank, identify_account,
                            extract_transactions)
from core.formatting import indian_format, to_float

st.set_page_config(page_title="Bank Statement Extractor", page_icon="🏦", layout="wide")
st.title("🏦 Bank Statement Extractor")
st.caption("Upload ICICI / Kotak / Axis / IDBI / IDFC statement PDF, CSV or Excel files. "
           "Account code is taken from the ACCOUNT HOLDER NAME inside the file "
           "(add holder -> code in `config/account_codes.py`)")

files = st.file_uploader("Statement upload (PDF / CSV / Excel)",
                         type=["pdf", "csv", "xlsx", "xls"], accept_multiple_files=True)

frames, per_file = [], []
for f in files or []:
    try:
        bank = detect_bank(f)
    except Exception as e:                       # unreadable file / missing excel package
        st.error(f"❌ {f.name}: {e}")
        continue
    f.seek(0)
    if bank is None:
        bank = st.selectbox(f"{f.name}: Bank auto-detection failed. Please select:",
                            list(BANK_LAYOUTS), key=f"bank_{f.name}")
    code, holder, warn = identify_account(f, bank, f.name)
    f.seek(0)
    if warn:
        st.warning(f"⚠️ {f.name}: {warn}")
    rows = extract_transactions(f, bank, code, holder)
    f.seek(0)
    df = pd.DataFrame(rows)
    per_file.append((f.name, code, bank, df, holder))
    if not df.empty:
        df.insert(0, "File", f.name)
        matched = df[df.Status != "NO_REGEX"]
        if not matched.empty:
            frames.append(matched)

# ------------------------------------------------------------ combined Send / Received
if frames:
    alldf = pd.concat(frames, ignore_index=True)
    alldf["_o"] = alldf["Account"].map(account_sort_key)
    alldf = alldf.sort_values("_o", kind="stable").drop(columns="_o")

    send = alldf[alldf.Type == "Dr"].reset_index(drop=True)
    recv = alldf[alldf.Type == "Cr"].reset_index(drop=True)

    def lines(df):
        return "\n".join(f"{i}.{r.Account} - {r.Name} - {r.Short}"
                         for i, r in enumerate(df.itertuples(), 1))

    def total(df):
        return f"{len(df)} transactions | Total: {indian_format(sum(to_float(a) for a in df.Amount))}"

    st.header("Result")
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("🔴 Send (withdrawal / debit)")
        if send.empty:
            st.info("No debit transactions")
        else:
            st.code(lines(send), language=None)
            st.caption(total(send))
    with c2:
        st.subheader("🟢 Received (credit)")
        if recv.empty:
            st.info("No credit transactions")
        else:
            st.code(lines(recv), language=None)
            st.caption(total(recv))

    text_out = ("Send (withdrawal/debit)\n\n" + lines(send) +
                "\n\nReceived (credit)\n\n" + lines(recv) + "\n")
    d1, d2 = st.columns(2)
    d1.download_button("⬇️ Text download", text_out, "send_received.txt", "text/plain")
    d2.download_button("⬇️ CSV download",
                       alldf.drop(columns=["Status"]).to_csv(index=False),
                       "transactions.csv", "text/csv")

# ------------------------------------------------------------ per-file details + warnings
if per_file:
    st.divider()
    st.header("File-wise details")
for name, code, bank, df, holder in per_file:
    with st.expander(f"📄 {name}  —  Account: {code}  |  Holder: {holder or '?'}  |  Bank: {bank}"):
        if df.empty:
            st.warning("No transactions found.")
            continue
        matched = df[df.Status != "NO_REGEX"]
        left, right = st.columns(2)
        for col, typ, title in ((left, "Dr", "🔴 Debit"), (right, "Cr", "🟢 Credit")):
            with col:
                st.markdown(f"**{title}**")
                part = matched[matched.Type == typ]
                if part.empty:
                    st.caption("None")
                else:
                    st.dataframe(part[["Name", "Amount"]], hide_index=True,
                                 use_container_width=True)

        no_regex = df[df.Status == "NO_REGEX"]
        if not no_regex.empty:
            st.error(f"⚠️ No regex matched for these rows. Please add regex for "
                     f"{bank} in `config/regex_patterns.py`:")
            st.code("\n".join(no_regex["Raw Name"]), language=None)

        unmapped = df[df.Status == "UNMAPPED"]["Raw Name"].drop_duplicates()
        if not unmapped.empty:
            st.info("Unmapped names (please update in `config/name_mappings.py`):")
            st.code("\n".join(f'    "{n}": "{n}",' for n in unmapped), language="python")
