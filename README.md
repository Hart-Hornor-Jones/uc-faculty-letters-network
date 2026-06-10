# The UC Open-Letter Network

An interactive, static visualization of the standardized corpus of UC-faculty open letters,
petitions, and collective statements (2009–2026) as a **two-mode (affiliation) network**:
documents tied by shared signatories, and signatories tied by shared documents.

Live site: https://hart-hornor-jones.github.io/uc-faculty-letters-network/

Current data: **35 letters · ~10,900 signature records · 9,335 unique signers** (2,517 signed ≥2).
Every letter carries a researched context dossier (background, outcome, sources — verified
June 2026 against contemporary reporting), and 34 of 35 embed the full statement text.

## Views
- **Timeline** *(opens first)* — every letter on a 2009–2026 axis, sized by signatures, in theme
  lanes (budget, protest & policing, governance, labor, curriculum & admissions, Jewish community,
  cybersecurity, federal pressure), with key contextual events marked. Click = details; double-click = read.
- **Letter network** — letters tied by shared signers (count / Jaccard / overlap; prune slider;
  force, year-ring, or date-circle layouts; colour by theme, era, or scope).
- **Signatory network** — repeat signers tied by co-signed letters, plus a sortable top-connectors table.
- **Matrix** — 35×35 shared-signer heatmap, reorderable (seriation / date / theme / title).
- **Explorer** — bipartite ego-expansion: a letter's signers; a signer's letters; intersections.
- **Catalogue** — card list of all letters with theme, scope, dates (with confidence badges), text status.
- **Reader** — full statement text + dossier for any letter (also deep-linkable: `#/letter/<id>`).
- **Global search** (Ctrl/Cmd-K) — all 35 letters and all 9,335 signers.
- Light/dark theme toggle (persisted).

## Architecture
Static, no build step, no server required: plain HTML/CSS/JS + Cytoscape.js (CDN).
Open `index.html` from disk or host on GitHub Pages as-is.

```
index.html                  entry point
css/styles.css              design system (dark default + [data-theme=light])
js/app.js                   all views + reader + search (vanilla JS)
data/network-data.js        window.NET bundle (letters, edges, persons, incidence, orders)
data/letter-texts.js        window.NET_TEXTS (full statement bodies)
data/letter_context.json    researched dossiers (background/outcome/links/date provenance)
data/*.json                 the same data as separate files, for reproducibility
build/build_network.py      regenerates data/ from the corpus
```

## Rebuild after the corpus changes
```
python3 build/build_network.py
```
Reads `../_standardized_corpus/00_INDEX/{all_signatories,statements_index,letter_overrides}.csv`,
statement bodies from `../_standardized_corpus/statements/*/statement.md`, and merges
`data/letter_context.json`. Date corrections & recovered metadata live in `letter_overrides.csv`
(both are inputs — safe to re-run any time).

## Deploy (GitHub Pages)
Push the contents of this folder to the `uc-faculty-letters-network` repo (root).
Settings → Pages → deploy from branch `main`, folder `/ (root)`. No other configuration:
all asset paths are relative.

## Caveats (also in the site's "About the data")
Identity across letters is matched by normalized name (homonyms may merge, variants may split —
affects the signatory network most). Rosters reflect captured snapshots of sign-on letters that may
have kept growing. Dates follow the document or its sign-on log; `approx` badges mark dates inferred
from coverage. Names are drawn from public letters.
