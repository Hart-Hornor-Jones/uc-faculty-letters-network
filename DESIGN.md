# Affiliation-Network Visualization — Design Spec

**Goal.** A static, client-side interactive graphic for GitHub Pages that represents the corpus of
UC-faculty collective statements as a **two-mode (affiliation) network**: documents (letters) and
people (signatories), where letters are tied by shared signatories and people are tied by shared
letters. Built on the standardized corpus produced in the companion task.

**Status of inputs.** Source of truth is the standardized corpus:
`_standardized_corpus/00_INDEX/all_signatories.csv` (the person↔letter incidence list) and
`statements_index.csv` (letter attributes). Current size: **27 letters, ~10,656 signature rows**
(grows as the corpus grows; the build step re-reads these files, so the visualization updates
automatically). Max letters signed by one person so far ≈ 9; campuses span all 10 UC campuses + UCOP.

**Tech (chosen).** Cytoscape.js for the node-link views; a small hand-rolled SVG/Canvas grid for the
matrix view. No framework, no build step required (plain ES modules + CDN scripts) so it deploys to
GitHub Pages as-is.

---

## 1. Data model

### 1.1 Identity and the core caveat
- **Person key = `name_norm`** (lowercased, whitespace-normalized) from `all_signatories.csv`.
- **Caveat to surface in the UI:** cross-letter identity is *approximate*. Two distinct people with
  the same normalized name will be merged into one node; one person who signed under spelling variants
  will be split. This mostly affects the **person network**. The spec includes an optional manual
  `person_id` reconciliation layer (§8) for later; v1 uses `name_norm` and shows a disclaimer.
- Letters are keyed by **`statement_id`** (already stable, dated slugs).

### 1.2 Structures derived from the incidence matrix B (persons × letters)
- **Letter projection** `L = Bᵀ·B`: `L[i][j]` = number of signatories common to letters *i* and *j*;
  diagonal = number of signers of letter *i*. Ship three edge-weight flavors so the UI can toggle:
  - `shared` (raw count of common signers)
  - `jaccard` = |i∩j| / |i∪j|
  - `overlap` = |i∩j| / min(|i|,|j|)  (useful when letter sizes are very unequal, e.g., a 1,500-signer
    petition vs. an 18-signer departmental statement)
- **Person projection** `P = B·Bᵀ`: `P[a][b]` = number of letters co-signed by persons *a* and *b*.
  The full person graph is large; v1 ships the **"bridgers" subgraph** = persons who signed **≥ k**
  letters (default **k = 2**, with a UI toggle for k = 2/3/4). Everyone with k = 1 is, by definition,
  not a connector and is omitted from the person *network* (still reachable via the bipartite explorer).

### 1.3 Precomputed artifacts to ship (so the browser does no heavy joins)
A Python build step (§7) emits these into `data/`:

- `letters.json` — letter nodes:
  `{ "id": "2024-05-01_no-police-actions-ucla", "title": "...", "date_iso": "2024-05-01",
     "year": 2024, "type": "open_letter", "stance": "demand", "topic": "campus policing/protest (Gaza)",
     "campus_scope": "systemwide", "n_signatories": 901, "text_status": "full (retrieved from source_url)" }`
- `letter_edges.json` — letter–letter edges (one record per unordered pair with shared ≥ 1):
  `{ "source": "...", "target": "...", "shared": 142, "jaccard": 0.18, "overlap": 0.41 }`
- `persons.json` — bridger nodes (k ≥ 2):
  `{ "id": "judith butler", "name": "Judith Butler", "campus_primary": "UCB",
     "n_letters": 6, "letters": ["2009-...","2024-...", ...] }`
- `person_edges.json` — person–person edges among bridgers:
  `{ "source": "judith butler", "target": "colleen lye", "shared_letters": 4 }`
- `incidence.json` — two lookups for the bipartite explorer:
  `{ "byLetter": { "<statement_id>": [ {"id":"name norm","name":"Display","campus":"UCB"}... ] },
     "byPerson": { "<name_norm>": ["<statement_id>", ...] } }`
- Keep `all_signatories.csv` in `data/` too, for power users / reproducibility.

Optional precomputed extras (nice-to-have, §10): Louvain community id per node (for coloring);
a seriation order for the matrix; degree/centrality metrics.

### 1.4 Feasibility / sizes
- Letter network: 27 nodes, ≤ 351 edges — trivial for Cytoscape; renders instantly.
- Person bridgers (k ≥ 2): expected few-hundred to low-thousands nodes. Cytoscape with `fcose`
  handles ~1–2k nodes / a few-k edges acceptably; if the k=2 graph is too dense, default to k ≥ 3 and
  expose the slider. (The full ~thousands-node person graph is explicitly *not* a v1 goal under
  Cytoscape; that would be the case for a WebGL renderer later.)
- Matrix: 27×27 = 729 cells — render as SVG rects.
- Bipartite: never render the whole 10k-edge two-mode graph at once; it is **ego-expansion only**.

---

## 2. Views

### A. Letter–Letter Network  *(centerpiece)*
- **Nodes** = 27 letters. Size ∝ √(n_signatories). Fill color = `topic` (categorical) by default;
  switchable to `year/era` (sequential) or `campus_scope` (categorical). Optional border encodes `stance`.
- **Edges** = shared signatories. Width ∝ weight (selected metric); low-weight edges fade. A
  **min-shared slider** prunes the hairball; a **metric toggle** switches count / Jaccard / overlap.
- **Layouts** (switch): `fcose` (force, default), `concentric`/`circle ordered by date` (reveals the
  temporal spine), `grid`. 
- **Interactions:** hover → tooltip (title, date, addressee, #signers, topic, text_status); click →
  highlight ego-network, dim the rest, open a side panel with the letter's metadata, a link to its
  `statement.md`, and a ranked list of its most-overlapping letters with the shared-signer counts;
  double-click → jump to the Bipartite explorer focused on that letter. Plus search, topic/year/campus
  filters, and a legend.
- **Why it's the centerpiece:** it makes visible which letters share constituencies — e.g., the dense
  2024 Gaza-era cluster (No Police Actions ↔ UC Demands ↔ UCLA Sociology ↔ non-retaliation pledge), the
  2009–11 budget/policing cluster, and the Trellix triangle (June Drake ↔ Aug Milliken ↔ the
  "Delay the Cybersecurity Mandate" petition, which by design overlaps both heavily — annotate so it
  isn't misread as three independent letters).

### B. Signatory Network — "bridgers"
- **Nodes** = persons with ≥ k letters (k toggle, default 2). Size ∝ n_letters. Color = `campus_primary`
  (or precomputed community).
- **Edges** = co-signed ≥ 1 letter (toggle to ≥ 2 to thin it). Width ∝ shared_letters.
- **Layout:** `fcose`; optional community coloring (Louvain, precomputed).
- **Interactions:** hover → name, campus, dept, n_letters; click → side panel listing that person's
  letters in chronological order (so you can read a trajectory, e.g., someone who signed both the 2009
  budget letters and the 2024 Gaza letters); name search. **Prominent disclaimer** about name-based
  identity (§1.1).
- **Companion:** a sortable **"Top connectors" table** (name, campus, #letters, span of years) — robust
  even where the graph is busy.

### C. Adjacency Matrix / Heatmap  *(no-hairball complement)*
- 27×27 grid. Cell color = `shared` (or Jaccard, toggle). Diagonal = letter size (or blanked).
- **Row/column ordering** toggle: by date, by topic, alphabetical, or by **cluster/seriation**
  (precomputed optimal-leaf order) — reordering surfaces block structure (the Gaza block, the budget
  block) far more legibly than a node-link.
- **Interactions:** hover cell → "Letter A ∩ Letter B = N shared (Jaccard …)" plus a few example shared
  names; click cell → open the Bipartite explorer on that *intersection* (the people in both letters);
  click a row/column header → select that letter and sync the other views.
- **Implementation note:** build this as a lightweight custom SVG/Canvas grid (D3 only for scales is
  fine) — matrices are not Cytoscape's strength — but keep it inside the same app and selection state.

### D. Bipartite Explorer  *(two-mode browsing)*
- A focused **ego / expandable** two-mode view (Cytoscape, left-right or two-row bipartite layout), not
  the whole graph. Select a **letter** → show its signatories; select a **person** → show their letters.
  Each node can be **expanded** one hop (a person's other letters; a letter's other signers) with a cap
  and a "load more," so density stays controlled.
- **Interactions:** breadcrumb trail; expand/collapse; a "connect two nodes" mode that highlights the
  letters linking person X and person Y (or the signers linking letter A and letter B). Drives directly
  off `incidence.json`.

---

## 3. Cross-view interaction & app architecture
- A single **global state object**: `{ activeView, selectedLetterId, selectedPersonId, filters,
  weightMetric, k }`. Selecting a letter/person in any view highlights it in all of them.
- The four views are tabs/panels sharing that state. Selection + filters + active view are encoded in
  the **URL hash** so any configuration is a shareable deep link (valuable on a public GitHub Pages site).
- Suggested module split:
  ```
  js/
    state.js          // global state + pub/sub, URL-hash sync
    data.js           // fetch + index the JSON artifacts
    views/letterNet.js // Cytoscape instance + styles + handlers
    views/personNet.js
    views/matrix.js    // SVG/Canvas heatmap
    views/bipartite.js // Cytoscape ego-expansion
    ui.js              // legend, filters, side panel, tooltips
    app.js             // bootstrap, tab switching
  ```

## 4. Visual encoding & accessibility
- Color: a colorblind-safe categorical palette for topic/campus; a perceptually-uniform sequential ramp
  (e.g., viridis) for year and for matrix intensity. One shared legend component.
- Always pair color with text: tooltips carry the raw numbers; the matrix shows values on hover.
- Edge weight → width **and** opacity. Keep default min-shared threshold > 0 so the letter graph opens
  readable rather than as a hairball.

## 5. Dependencies (all CDN; no bundler needed)
- `cytoscape` (core) + `cytoscape-fcose` (layout) + `cytoscape-popper` + `tippy.js` (tooltips).
- `d3-scale` / `d3-scale-chromatic` (color + size scales; tiny) — or hand-roll to drop the dep.
- Optional `papaparse` only if you choose to load `all_signatories.csv` client-side; v1 loads the
  precomputed JSON instead, so this is optional.
- Everything via `<script>`/`import` from a CDN (e.g., jsDelivr). An optional Vite setup is documented in
  the README for anyone who prefers bundling, but is not required for Pages.

## 6. Repository layout (GitHub Pages)
```
affiliation-network-viz/
  index.html              # entry; loads CDN libs + js/app.js
  css/styles.css
  js/ ...                 # modules from §3
  data/                   # generated by build/build_network.py
    letters.json
    letter_edges.json
    persons.json
    person_edges.json
    incidence.json
    all_signatories.csv   # copy, for reproducibility
  build/
    build_network.py      # reads ../../_standardized_corpus/00_INDEX/*.csv -> data/*.json
  README.md               # how to rebuild data + deploy
```
- **Deploy:** push to a repo; in Settings → Pages, serve from `main` branch root (or `/docs`). `index.html`
  is the entry; `fetch('data/letters.json')` works because it's same-origin on Pages. No server code.

## 7. Build / precompute plan (Python; reuses the corpus)
`build/build_network.py` (pure pandas/stdlib; deterministic, idempotent):
1. Read `all_signatories.csv` (+ `statements_index.csv`).
2. Build incidence sets: `signers[letter] = set(name_norm)`, `letters_of[person] = set(statement_id)`.
3. Letter projection: for each pair with non-empty intersection, emit `shared`, `jaccard`, `overlap`.
4. Person projection: keep persons with `len(letters_of) >= k_min` (ship k=2 graph; UI thresholds higher
   client-side); emit pairwise `shared_letters`.
5. Per-letter signer lists and per-person letter lists → `incidence.json` (use display `name` where
   available, dedup by `name_norm`).
6. Letter node attributes from `statements_index.csv`.
7. Optional: Louvain communities (`networkx`/`python-louvain`) and matrix seriation
   (`scipy.cluster.hierarchy` optimal leaf ordering) → extra fields.
8. Write JSON to `data/`. Re-run whenever the corpus changes.

(This script is straightforward to generate from the existing pipeline when you're ready — it's the
natural next deliverable after this spec.)

## 8. Data caveats to display in-product
- **Name identity is approximate** (`name_norm`); the person network may merge homonyms / split variants.
  Offer an optional `person_overrides.csv` (map variant `name_norm` → canonical `person_id`) that the
  build step applies, for incremental hand-cleaning.
- **Long-format signatures**: cross-letter overlap is the subject of the graphic, but note the
  **Trellix campaign** (the petition + two letters) overlaps by construction; consider visually grouping
  or labeling it.
- **Roster completeness varies** (some rosters came from clean exports, some from PDF parses; one letter
  is signatory-only). Encode `text_status`/source confidence on the letter node (e.g., a ring) so users
  can weight overlaps accordingly.
- **Privacy:** names are drawn from public letters, but the site makes them browsable; note this in the
  README and an "About the data" panel.

## 9. Suggested build roadmap (when you return)
- **Phase 0** — `build_network.py` → `data/*.json` (from the current 27-letter corpus).
- **Phase 1** — `index.html` + Letter–Letter network (Cytoscape) with tooltips, filters, legend.
- **Phase 2** — Matrix view + shared selection state + URL-hash deep links.
- **Phase 3** — Bipartite explorer (ego + expansion).
- **Phase 4** — Signatory bridgers network + Top-connectors table.
- **Phase 5** — Polish (palette, mobile/responsive, accessibility, "About the data"), deploy to Pages.

## 10. Optional analytical extensions
Temporal animation (letters appearing by year); per-letter campus-composition bar in the side panel;
centrality measures (which letters/people are the strongest bridges); a "shared-signers" CSV export for
any selected pair; filter persons by campus/department; switch the person graph to a WebGL renderer
(sigma.js) if you later want the *entire* signatory network rather than the bridger subgraph.

## 11. Decisions to confirm later
- Default person-graph threshold (k = 2 vs 3) once we see the real bridger counts.
- Default letter coloring: `topic` vs `era`.
- Whether to include metadata-only rosters as-is or flag them differently.
- Whether to invest in `person_id` reconciliation before publishing the person network.
