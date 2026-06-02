# UC Faculty Collective Statements — Affiliation Network

An interactive, static visualization of the standardized corpus of UC-faculty open letters,
petitions, and collective statements as a **two-mode (affiliation) network**: documents tied by
shared signatories, and signatories tied by shared documents.

Built from the companion corpus (`_standardized_corpus/`). Current data: **27 letters, ~10,656
signature records, 7,044 unique signers** (1,968 signed ≥2 letters).

## Views
- **Letter network** — the 27 letters; node size = #signatories, colour = theme/era/scope; edges =
  shared signers (toggle raw count / Jaccard / overlap; prune with the "min shared" slider). Click a
  letter for metadata + its most-overlapping letters; "Open in bipartite explorer" to see its signers.
- **Matrix** — a 27×27 heatmap of shared signers (or Jaccard), reorderable by cluster/date/topic/title.
  Click a cell to open that intersection in the bipartite explorer.
- **Bipartite explorer** — pick a letter to see its signers; click a person to add the other letters
  they signed; click a letter to add its signers. (Large rosters are capped — see the slider.)
- **Signatory network** — the repeat signers (default: signed ≥6 letters), tied where they co-signed
  ≥5 letters; plus a sortable "top connectors" table covering everyone who signed ≥2.

## View it
The data is embedded as a JavaScript global (`data/network-data.js`), so **no web server is required** —
you can simply open `index.html` in a browser locally, *and* it works on GitHub Pages.

### Deploy to GitHub Pages
1. Put this folder in a repo (root, or a `/docs` folder).
2. Settings → Pages → Source: your branch, folder root (or `/docs`).
3. Visit the published URL; `index.html` is the entry point.

Dependencies (Cytoscape.js + fcose) load from a CDN at runtime; nothing to install.

## Rebuild the data (after the corpus changes)
```
python3 build/build_network.py
```
It reads `../_standardized_corpus/00_INDEX/all_signatories.csv` and `statements_index.csv` and
regenerates everything in `data/` (including `network-data.js`). Re-run whenever you add or update
letters; the visualization updates automatically.

### Files
```
index.html                 entry point
css/styles.css             styling
js/app.js                  all four views + interactions (Cytoscape.js, vanilla JS)
data/network-data.js       window.NET bundle consumed by the app
data/*.json                same data as separate files (reproducibility)
build/build_network.py     regenerates data/ from the corpus CSVs
```

## Tuning (defaults chosen for readability)
- The signatory co-sign graph is intrinsically dense (repeat signers nearly all co-signed the big 2024
  letters), so the signatory network defaults to **≥6 letters / edge ≥5 co-signed** and exposes both
  sliders. `build_network.py` emits person nodes for ≥5 letters and edges for ≥4 co-signed; raise
  `NETWORK_MIN` / `EDGE_KEEP` in the script to change what's emitted.

## Caveats
- **Identity matching is approximate** (normalized name): homonyms may merge, spelling variants may
  split — this most affects the signatory network. An optional `person_overrides.csv` reconciliation
  layer is described in `DESIGN.md`.
- Signatures are **long-format** (a person appears once per letter signed); cross-letter overlap is the
  point of the graphic. The "Delay the Cybersecurity Mandate" petition overlaps the two Trellix letters
  by construction.
- Roster completeness varies by source (clean exports vs. PDF parses); see each letter's `text_status`.
- Names are drawn from public letters.

See `DESIGN.md` for the full design rationale and planned extensions.
