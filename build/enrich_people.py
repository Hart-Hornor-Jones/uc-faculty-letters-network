# -*- coding: utf-8 -*-
import os, re, csv, json, openpyxl
from collections import Counter, defaultdict
PI=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","People Info"))
IDX=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","_standardized_corpus","00_INDEX"))
OUT=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","data"))
def norm(n):
    if not n: return ""
    n=re.sub(r'\s+',' ',str(n)).strip().lower()
    n=re.sub(r'\s*\(.*?\)','',n)         # drop parentheticals
    return n.strip()
CAMP=[("berkeley","UCB"),("davis","UCD"),("irvine","UCI"),("los angeles","UCLA"),("ucla","UCLA"),
 ("merced","UCM"),("riverside","UCR"),("san diego","UCSD"),("ucsd","UCSD"),("san francisco","UCSF"),
 ("ucsf","UCSF"),("santa barbara","UCSB"),("ucsb","UCSB"),("santa cruz","UCSC"),("ucsc","UCSC"),
 ("ucb","UCB"),("ucd","UCD"),("uci","UCI"),("ucr","UCR"),("ucm","UCM")]
def campus_code(s):
    if not s: return ""
    t=str(s).lower()
    for pat,code in CAMP:
        if re.search(r'\b'+re.escape(pat)+r'\b',t): return code
    return ""
ROLE={'chair','vice chair','member','analyst','director','dean','staff','student','representative',
 'ex officio','provost','faculty','emeritus','none','tbd','vacant','co-chair','consultant','guest'}
def good_dept(d):
    if not d: return ""
    d=re.sub(r'\s+',' ',str(d)).strip()
    if d.lower() in ROLE or len(d)<3: return ""
    return d[:60]

camp=defaultdict(Counter); dept=defaultdict(Counter)

# 1) senate rosters: MemberName, CampusInferred, DepartmentOrTitle
wb=openpyxl.load_workbook(os.path.join(PI,"uc_senate_rosters_2002_2026.xlsx"),read_only=True,data_only=True)
ws=wb["roster"]; rows=ws.iter_rows(values_only=True); h=next(rows)
iN=h.index("MemberName"); iC=h.index("CampusInferred"); iD=h.index("DepartmentOrTitle")
for r in rows:
    nn=norm(r[iN]);
    if not nn: continue
    cc=campus_code(r[iC]);
    if cc: camp[nn][cc]+=1
    dd=good_dept(r[iD]);
    if dd: dept[nn][dd]+=1

# 2) directory_with_emails: Name, 'Salient Identity / Affil'
wb=openpyxl.load_workbook(os.path.join(PI,"directory_with_emails.xlsx"),read_only=True,data_only=True)
ws=wb["Directory"]; rows=list(ws.iter_rows(values_only=True)); h=[str(x) for x in rows[0]]
def col(*subs):
    for i,c in enumerate(h):
        if any(sub.lower() in c.lower() for sub in subs): return i
    return -1
iN=col("Name"); iA=col("Salient","Affil","Identity")
for r in rows[1:]:
    nn=norm(r[iN]);
    if not nn: continue
    aff=str(r[iA] or "")
    cc=campus_code(aff)
    if cc: camp[nn][cc]+=2
    parts=re.split(r'[/|;]',aff)
    for p in parts:
        if campus_code(p): continue
        dd=good_dept(p)
        if dd: dept[nn][dd]+=2; break

# 3) committees master: campus, name_raw (campus only)
with open(os.path.join(PI,"uc_senate_committees_master_3-21.csv"),encoding="utf-8-sig",errors="replace") as f:
    rd=csv.DictReader(f)
    for r in rd:
        nn=norm(r.get("name_raw"));
        if not nn: continue
        cc=campus_code(r.get("campus"))
        if cc: camp[nn][cc]+=1

enrich={}
alln=set(camp)|set(dept)
for nn in alln:
    e={}
    if camp[nn]: e["campus"]=camp[nn].most_common(1)[0][0]
    if dept[nn]: e["dept"]=dept[nn].most_common(1)[0][0]
    if e: enrich[nn]=e
json.dump(enrich, open(os.path.join(OUT,"person_enrich.json"),"w",encoding="utf-8"), ensure_ascii=False)

# coverage vs corpus signatories
sig=list(csv.DictReader(open(os.path.join(IDX,"all_signatories.csv"),encoding="utf-8")))
names=set((r.get("name_norm") or "").strip() for r in sig if (r.get("name_norm") or "").strip())
blankcamp=set((r.get("name_norm") or "").strip() for r in sig if not (r.get("campus_code") or "").strip())
match=names & set(enrich)
print("enrichment map size:",len(enrich))
print("corpus unique signers:",len(names))
print("signers matched in enrich map:",len(match), f"({100*len(match)//max(1,len(names))}%)")
print("of those, have dept:",sum(1 for n in match if "dept" in enrich[n]),"| have campus:",sum(1 for n in match if "campus" in enrich[n]))
print("blank-campus signers that map provides a campus for:",sum(1 for n in (blankcamp&set(enrich)) if "campus" in enrich[n]))
print("samples:",[(n,enrich[n]) for n in list(match)[:5]])
