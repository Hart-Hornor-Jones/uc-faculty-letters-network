# -*- coding: utf-8 -*-
"""
Refresh the affiliation-network-viz from the live signatory-analyzer rosters.

What it does (idempotent):
  1. Reads the freshest per-letter signatory tables produced by the
     signatory-analyzer's update.ps1 (signatory_viz/signatures/*.csv).
  2. Re-extracts each letter's roster with the SAME name/campus normalization
     the standardized corpus uses (mirrors _standardized_corpus/_build).
  3. Applies the hand-verified cross_letter_merges.csv so a person who signed
     BOTH letters under slightly different name forms collapses to one
     name_norm -> the network sees them as a single bridging signer.
  4. Surgically rewrites ONLY those letters' rows in
     _standardized_corpus/00_INDEX/{all_signatories.csv, statements_index.csv}
     (every other letter is left byte-for-byte untouched), refreshes each
     letter's statements/<id>/ folder, and (re)writes the statement body.
  5. Runs build_network.py to regenerate data/network-data.js etc.

The letter DOSSIERS (data/letter_context.json) and the THEME_BY_ID map in
js/app.js are hand-curated inputs -- a brand-new letter still needs a one-time
dossier entry + theme mapping (see README). This script owns the DATA only.

Usage:
  python build/update_affiliation_viz.py
  python build/update_affiliation_viz.py --signatures-dir "C:/path/to/signatory_viz/signatures"
  python build/update_affiliation_viz.py --skip-build      # patch corpus, don't rebuild
"""
import os, re, csv, json, argparse, subprocess, sys

HERE   = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.normpath(os.path.join(HERE, "..", "..", "_standardized_corpus"))
IDX    = os.path.join(CORPUS, "00_INDEX")
STMT   = os.path.join(CORPUS, "statements")
DATA   = os.path.normpath(os.path.join(HERE, "..", "data"))
INPUTS = os.path.join(HERE, "inputs")

# Where the signatory-analyzer drops its freshest per-letter tables.
DEFAULT_SIG_DIRS = [
    os.environ.get("SIGNATORY_ANALYZER_SIGNATURES", ""),
    r"C:\Users\harth\repos\signatory-analyzer\signatory_viz\signatures",
    "/sessions/peaceful-serene-goldberg/mnt/signatory-analyzer/signatory_viz/signatures",
    os.path.normpath(os.path.join(HERE, "..", "..", "..", "repos", "signatory-analyzer", "signatory_viz", "signatures")),
]

# ---- normalization (mirrors _standardized_corpus/_build/build_streamB4.py + common.py) ----
CMAP = {
 'BERKELEY':('UCB','UC Berkeley'),'UCB':('UCB','UC Berkeley'),'DAVIS':('UCD','UC Davis'),'UCD':('UCD','UC Davis'),
 'IRVINE':('UCI','UC Irvine'),'UCI':('UCI','UC Irvine'),'LOSANGELES':('UCLA','UC Los Angeles'),'UCLA':('UCLA','UC Los Angeles'),
 'MERCED':('UCM','UC Merced'),'UCM':('UCM','UC Merced'),'RIVERSIDE':('UCR','UC Riverside'),'UCR':('UCR','UC Riverside'),
 'SANDIEGO':('UCSD','UC San Diego'),'UCSD':('UCSD','UC San Diego'),'SANFRANCISCO':('UCSF','UC San Francisco'),'UCSF':('UCSF','UC San Francisco'),
 'SANTABARBARA':('UCSB','UC Santa Barbara'),'UCSB':('UCSB','UC Santa Barbara'),'SANTACRUZ':('UCSC','UC Santa Cruz'),'UCSC':('UCSC','UC Santa Cruz')}

def campus_clean(s):
    if not s: return ('','')
    k = re.sub(r'(University of California[,\s]*|^UC[\-\s]?|^U\.C\.\s?)', '', str(s).strip(), flags=re.I)
    key = re.sub(r'[^A-Za-z]', '', k).upper()
    if key in CMAP: return CMAP[key]
    key2 = re.sub(r'[^A-Za-z]', '', str(s)).upper()
    return CMAP.get(key2, ('', str(s).strip()))

def norm_name(n):
    if not n: return ''
    return re.sub(r'\s+', ' ', str(n)).strip().lower()

SIG_COLS = ["statement_id","order_in_list","entity_type","name","name_norm",
            "campus_code","campus","affiliation","role_title","signer_role","raw_line","source_file"]
MCOLS = ["statement_id","statement_title","statement_date","statement_type","stance","campus_scope",
         "order_in_list","entity_type","name","name_norm","campus_code","campus","affiliation",
         "role_title","signer_role","source_file"]
INDEX_COLS = ["statement_id","title","type","stance","topic","date_iso","date_raw",
              "addressee","campus_scope","signatory_unit","n_signatories",
              "n_signatories_reported","n_with_campus","statement_text_status",
              "source_kind","source_file","source_url","source_group",
              "extraction_method","stream","notes"]

# ---- the letters this site sources from the signatory-analyzer ----
# meta = authoritative statements_index fields; the n_* counts are filled in dynamically.
LETTERS = [
  dict(key="stem", csv="ucstudentsuccess_table.csv",
       id="2026-05-25_uc-stem-faculty-sat-act-letter",
       body_file=None,                       # keep the existing (pdfplumber-extracted) body
       apply_merges=False,
       meta=dict(
         statement_id="2026-05-25_uc-stem-faculty-sat-act-letter",
         title="Open Letter from UC STEM Faculty (reinstate SAT/ACT for STEM majors)",
         type="open_letter", stance="demand", topic="admissions / standardized testing (STEM)",
         date_iso="2026-05-25", date_raw="May 25, 2026",
         addressee="UC Regents, UCOP, Academic Senate leadership, and the people of California",
         campus_scope="systemwide", signatory_unit="individuals (STEM faculty)",
         statement_text_status="full (local source)", source_kind="pdf+csv",
         source_file="2026-05-25-Open-Letter-from-STEM-Faculty.pdf", source_url="",
         source_group="uploaded PDF + signatory table (ucstudentsuccess_table.csv)",
         extraction_method="PDF body + CSV signatory table", stream="B",
         notes="Led by UC mathematics faculty; calls for SAT/ACT math requirement for STEM-major applicants from the 2027 cycle.")),
  dict(key="ssh", csv="socscihum_table.csv",
       id="2026-06-11_uc-ssh-faculty-sat-act-letter",
       body_file="ssh_letter_body.txt",
       apply_merges=True,                     # collapse the dual STEM+SSH signers
       meta=dict(
         statement_id="2026-06-11_uc-ssh-faculty-sat-act-letter",
         title="Open Letter from UC Social Sciences, Humanities & Professional Faculty (use SAT/ACT verbal + math in admissions)",
         type="open_letter", stance="demand", topic="admissions / standardized testing (verbal + math)",
         date_iso="2026-06-11", date_raw="June 11, 2026",
         addressee="UC Academic Senate leadership, UC Regents, UCOP, and the people of California",
         campus_scope="systemwide",
         signatory_unit="individuals (social sciences, humanities, arts, business, law, education & other non-STEM faculty)",
         statement_text_status="full (local source)", source_kind="pdf+csv",
         source_file="2026-06-11-SS-H-P-SAT-Letter.pdf",
         source_url="https://ucstudentsuccess.org/socscihum/",
         source_group="ucstudentsuccess.org/socscihum (PDF + signatory table)",
         extraction_method="PDF body + CSV signatory table", stream="B",
         notes="Counterpart to the May 25, 2026 STEM faculty letter; endorses it and additionally calls for using the SAT/ACT verbal-reasoning component in admissions. Signed by non-STEM faculty (social sciences, humanities, arts, business, law, education).")),
]

# ---------------------------------------------------------------------------
def resolve_sig_dir(cli):
    for cand in ([cli] if cli else []) + DEFAULT_SIG_DIRS:
        if cand and os.path.isdir(cand):
            return cand
    raise SystemExit("[update] Could not find the signatory-analyzer signatures dir.\n"
                     "         Pass --signatures-dir <path> or set SIGNATORY_ANALYZER_SIGNATURES.")

def load_norm_remap(sig_dir):
    """cross_letter_merges.csv -> {norm(ssh_name): norm(stem_name)} so dual signers share a name_norm."""
    fp = os.path.join(sig_dir, "cross_letter_merges.csv")
    remap = {}
    if not os.path.exists(fp):
        return remap
    for r in csv.DictReader(open(fp, encoding="utf-8-sig")):
        a = norm_name(r.get("ssh_name", "")); b = norm_name(r.get("stem_name", ""))
        if a and b and a != b:
            remap[a] = b
    return remap

def parse_roster(csv_path, remap):
    rows = list(csv.reader(open(csv_path, encoding="utf-8-sig", errors="replace")))
    hdr = next(i for i, r in enumerate(rows) if len(r) > 1 and r[1].strip().lower() == "name")
    declared = None
    for r in rows[:hdr + 1]:
        if "signator" in " ".join(r).lower():
            for c in r:
                cc = (c or "").replace(",", "").strip()
                if cc.isdigit() and len(cc) >= 2:
                    declared = int(cc); break
        if declared: break
    out, seen, o = [], set(), 0
    for r in rows[hdr + 1:]:
        if len(r) < 5 or not r[1].strip():
            continue
        name = r[1].strip()
        nn = norm_name(name)
        nn = remap.get(nn, nn)
        if nn in seen:
            continue
        seen.add(nn); o += 1
        code, full = campus_clean(r[4])
        out.append(dict(order_in_list=o, entity_type="person", name=name, name_norm=nn,
                        campus_code=code, campus=full, affiliation=(r[3] or "").strip(),
                        role_title=(r[2] or "").strip(), signer_role="Signer", raw_line=""))
    return out, declared

def yamlval(v):
    return '"' + str("" if v is None else v).replace('"', '\\"') + '"'

def write_statement_md(folder, meta, body):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "statement.md"), "w", encoding="utf-8", newline="") as f:
        f.write("---\n")
        for k in INDEX_COLS:
            if k in meta:
                f.write(f"{k}: {yamlval(meta[k])}\n")
        f.write("---\n\n")
        f.write(f"# {meta.get('title','(untitled)')}\n\n## Statement\n\n")
        if body and body.strip():
            f.write(re.sub(r'\n{3,}', '\n\n', body).strip() + "\n")
        else:
            f.write("_Statement body not stored locally. See `source_url` in the front matter.\n")
        f.write("\n## Signatories\n\nSee `signatories.csv` in this folder (and the combined `00_INDEX/all_signatories.csv`).\n")

def existing_body(sid):
    fp = os.path.join(STMT, sid, "statement.md")
    if not os.path.exists(fp):
        return None
    md = open(fp, encoding="utf-8").read()
    m = re.search(r"## Statement\s*\n(.*?)(?=\n## Signatories)", md, re.S)
    b = (m.group(1) if m else "").strip()
    return None if (not b or b.startswith("_Statement body not stored")) else b

# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--signatures-dir", default="")
    ap.add_argument("--skip-build", action="store_true")
    args = ap.parse_args()

    sig_dir = resolve_sig_dir(args.signatures_dir)
    remap = load_norm_remap(sig_dir)
    print(f"[update] signatures dir : {sig_dir}")
    print(f"[update] cross-letter merges loaded: {len(remap)}")

    # 1) parse each letter's fresh roster
    target_ids = set()
    parsed = {}   # id -> (spec, sigs, declared)
    for spec in LETTERS:
        csv_path = os.path.join(sig_dir, spec["csv"])
        if not os.path.exists(csv_path):
            raise SystemExit(f"[update] missing roster CSV: {csv_path}")
        sigs, declared = parse_roster(csv_path, remap if spec["apply_merges"] else {})
        nwc = sum(1 for s in sigs if s["campus_code"])
        spec["meta"]["n_signatories"] = len(sigs)
        spec["meta"]["n_with_campus"] = nwc
        spec["meta"]["n_signatories_reported"] = declared if declared else len(sigs)
        parsed[spec["id"]] = (spec, sigs, declared)
        target_ids.add(spec["id"])
        print(f"[update] {spec['key']:>4}: extracted {len(sigs):>5} signers "
              f"({nwc} w/campus; site-declared {declared})  {spec['id']}")

    # 2) all_signatories.csv  (keep every other letter byte-identical)
    master_fp = os.path.join(IDX, "all_signatories.csv")
    old = list(csv.DictReader(open(master_fp, encoding="utf-8")))
    kept = [r for r in old if r["statement_id"] not in target_ids]
    new_rows = []
    for spec in LETTERS:
        m = spec["meta"]; _, sigs, _ = parsed[spec["id"]]
        for s in sigs:
            new_rows.append(dict(statement_id=spec["id"], statement_title=m["title"],
                statement_date=m["date_iso"], statement_type=m["type"], stance=m["stance"],
                campus_scope=m["campus_scope"], order_in_list=s["order_in_list"],
                entity_type=s["entity_type"], name=s["name"], name_norm=s["name_norm"],
                campus_code=s["campus_code"], campus=s["campus"], affiliation=s["affiliation"],
                role_title=s["role_title"], signer_role=s["signer_role"], source_file=m["source_file"]))
    with open(master_fp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=MCOLS); w.writeheader()
        for r in kept: w.writerow({k: r.get(k, "") for k in MCOLS})
        for r in new_rows: w.writerow(r)
    print(f"[update] all_signatories.csv: {len(kept)} kept + {len(new_rows)} refreshed = {len(kept)+len(new_rows)} rows")

    # 3) statements_index.csv  (update/insert target rows, keep the rest, sort by date)
    index_fp = os.path.join(IDX, "statements_index.csv")
    idx_rows = {r["statement_id"]: r for r in csv.DictReader(open(index_fp, encoding="utf-8"))}
    for spec in LETTERS:
        row = idx_rows.get(spec["id"], {})
        row.update({k: spec["meta"].get(k, row.get(k, "")) for k in INDEX_COLS})
        idx_rows[spec["id"]] = row
    ordered = sorted(idx_rows.values(), key=lambda m: (str(m.get("date_iso") or "9999"), m.get("statement_id")))
    with open(index_fp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=INDEX_COLS); w.writeheader()
        for m in ordered: w.writerow({k: m.get(k, "") for k in INDEX_COLS})
    print(f"[update] statements_index.csv: {len(ordered)} statements")

    # 4) per-statement folders (signatories.csv + statement.md body)
    for spec in LETTERS:
        m = spec["meta"]; _, sigs, _ = parsed[spec["id"]]
        folder = os.path.join(STMT, spec["id"]); os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, "signatories.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=SIG_COLS); w.writeheader()
            for s in sigs:
                w.writerow({**{k: "" for k in SIG_COLS}, "statement_id": spec["id"], **{k: s.get(k, "") for k in s},
                            "source_file": m["source_file"]})
        if spec["body_file"]:
            body = open(os.path.join(INPUTS, spec["body_file"]), encoding="utf-8").read()
        else:
            body = existing_body(spec["id"])
        write_statement_md(folder, m, body)
        print(f"[update] wrote folder {spec['id']}  (body {'yes' if body else 'no'})")

    # 5) rebuild the viz data
    if args.skip_build:
        print("[update] --skip-build: corpus patched; not rebuilding network data.")
        return
    print("[update] running build_network.py ...")
    subprocess.run([sys.executable, os.path.join(HERE, "build_network.py")], check=True)
    print("[update] done.")

if __name__ == "__main__":
    main()
