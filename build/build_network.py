# -*- coding: utf-8 -*-
"""Build affiliation-network data from the standardized corpus."""
import csv, json, os, itertools, math
from collections import Counter, defaultdict

HERE=os.path.dirname(os.path.abspath(__file__))
IDX=os.path.normpath(os.path.join(HERE,"..","..","_standardized_corpus","00_INDEX"))
OUT=os.path.normpath(os.path.join(HERE,"..","data"))
os.makedirs(OUT, exist_ok=True)

sig=list(csv.DictReader(open(os.path.join(IDX,"all_signatories.csv"),encoding="utf-8")))
idx=list(csv.DictReader(open(os.path.join(IDX,"statements_index.csv"),encoding="utf-8")))

# ---- letter nodes ----
def yr(d): 
    d=(d or "").strip(); 
    return int(d[:4]) if d[:4].isdigit() else None
letters=[]
for m in idx:
    letters.append(dict(id=m["statement_id"], title=m["title"], date_iso=m["date_iso"],
        year=yr(m["date_iso"]), type=m["type"], stance=m["stance"], topic=m["topic"],
        campus_scope=m["campus_scope"], n_signatories=int(m["n_signatories"] or 0),
        text_status=m["statement_text_status"], source_url=m["source_url"]))
lid=[l["id"] for l in letters]

# ---- incidence ----
signers=defaultdict(list)          # sid -> list of (name_norm, display, campus) in order
letters_of=defaultdict(set)        # name_norm -> set(sid)
disp=defaultdict(Counter); camp=defaultdict(Counter)
for r in sig:
    nn=(r.get("name_norm") or "").strip()
    sid=r["statement_id"]
    if not nn: continue
    signers[sid].append((nn, r.get("name") or nn, r.get("campus_code") or ""))
    letters_of[nn].add(sid)
    if r.get("name"): disp[nn][r["name"].strip()]+=1
    if r.get("campus_code"): camp[nn][r["campus_code"].strip()]+=1
sset={sid:set(nn for nn,_,_ in lst) for sid,lst in signers.items()}

# ---- letter-letter edges ----
ledges=[]
for a,b in itertools.combinations(lid,2):
    inter=sset.get(a,set()) & sset.get(b,set())
    s=len(inter)
    if s<=0: continue
    uni=len(sset.get(a,set()) | sset.get(b,set()))
    mn=min(len(sset.get(a,set())),len(sset.get(b,set()))) or 1
    ledges.append(dict(source=a,target=b,shared=s,
        jaccard=round(s/uni,4) if uni else 0, overlap=round(s/mn,4)))

# ---- persons (bridgers) ----
nlet={nn:len(s) for nn,s in letters_of.items()}
dist=Counter(v for v in nlet.values())
def count_ge(k): return sum(1 for v in nlet.values() if v>=k)
order_by_date={sid:(letters[i]["date_iso"] or "9999") for i,sid in enumerate(lid)}
persons=[]
for nn,k in nlet.items():
    if k<2: continue
    dn=disp[nn].most_common(1)[0][0] if disp[nn] else nn.title()
    cp=camp[nn].most_common(1)[0][0] if camp[nn] else ""
    ls=sorted(letters_of[nn], key=lambda s:order_by_date.get(s,"9999"))
    persons.append(dict(id=nn,name=dn,campus_primary=cp,n_letters=k,letters=ls))
persons.sort(key=lambda p:-p["n_letters"])

# ---- choose NETWORK_MIN (smallest k>=3 giving <=350 nodes) ----
NETWORK_MIN=next((k for k in (3,4,5,6) if count_ge(k)<=350), 6)
node_ids=set(nn for nn,k in nlet.items() if k>=NETWORK_MIN)
pair=Counter()
for sid,st in sset.items():
    sub=[nn for nn in st if nn in node_ids]
    for a,b in itertools.combinations(sorted(sub),2):
        pair[(a,b)]+=1
EDGE_KEEP=4
pedges=[dict(source=a,target=b,shared_letters=w) for (a,b),w in pair.items() if w>=EDGE_KEEP]

# ---- incidence lookups ----
incidence=dict(
  byLetter={sid:[dict(id=nn,name=dn,campus=cc) for nn,dn,cc in lst] for sid,lst in signers.items()},
  byPerson={nn:sorted(s,key=lambda x:order_by_date.get(x,"9999")) for nn,s in letters_of.items()})

# ---- matrix orders ----
shared_lookup=defaultdict(dict)
for e in ledges:
    shared_lookup[e["source"]][e["target"]]=e["shared"]; shared_lookup[e["target"]][e["source"]]=e["shared"]
order_date=sorted(lid,key=lambda s:order_by_date.get(s,"9999"))
order_alpha=sorted(lid,key=lambda s:next(l["title"] for l in letters if l["id"]==s).lower())
order_topic=sorted(lid,key=lambda s:(next(l["topic"] for l in letters if l["id"]==s),order_by_date.get(s,"9999")))
# greedy seriation by shared signers
deg={s:sum(shared_lookup[s].values()) for s in lid}
start=max(lid,key=lambda s:deg[s]); order_cluster=[start]; rem=set(lid)-{start}
while rem:
    last=order_cluster[-1]
    nxt=max(rem,key=lambda s:(shared_lookup[last].get(s,0), -1))
    order_cluster.append(nxt); rem.discard(nxt)
orders=dict(date=order_date,topic=order_topic,alpha=order_alpha,cluster=order_cluster)

meta=dict(n_letters=len(letters), n_letter_edges=len(ledges),
  n_persons_total=len(nlet), n_bridgers_ge2=count_ge(2),
  network_min=NETWORK_MIN, edge_keep=EDGE_KEEP, node_min_default=6, edge_min_default=5,
  n_person_nodes=len(node_ids), n_person_edges=len(pedges),
  generated_from="_standardized_corpus/00_INDEX")

bundle=dict(letters=letters, letterEdges=ledges, persons=persons, personEdges=pedges,
  incidence=incidence, orders=orders, meta=meta)

for name,obj in [("letters.json",letters),("letter_edges.json",ledges),
                 ("persons.json",persons),("person_edges.json",pedges),
                 ("incidence.json",incidence),("orders.json",orders),("meta.json",meta)]:
    json.dump(obj, open(os.path.join(OUT,name),"w",encoding="utf-8"), ensure_ascii=False)
with open(os.path.join(OUT,"network-data.js"),"w",encoding="utf-8") as f:
    f.write("window.NET = "); json.dump(bundle,f,ensure_ascii=False); f.write(";\n")

print("=== DIAGNOSTICS ===")
print("letters:",len(letters),"| letter-edges:",len(ledges),"(max possible",len(lid)*(len(lid)-1)//2,")")
print("unique persons:",len(nlet))
for k in (2,3,4,5,6,7,8,9): print(f"  signed >= {k} letters: {count_ge(k)}")
print("NETWORK_MIN chosen:",NETWORK_MIN,"-> person nodes:",len(node_ids),"| person edges:",len(pedges))
import os as _o
for fn in ("network-data.js","incidence.json","persons.json","letter_edges.json","person_edges.json"):
    print(f"  {fn}: {_o.path.getsize(os.path.join(OUT,fn))//1024} KB")
print("top connectors:", [(p['name'],p['n_letters']) for p in persons[:8]])
