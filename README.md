# UNMISS HRD – Q4 2025 Violence Against Civilians Dashboard

An interactive data visualization companion to the UNMISS Human Rights Division quarterly brief on violence affecting civilians in South Sudan (October–December 2025).

## Pages

| Page | Description |
|------|-------------|
| **Overview** | Q4 highlights, violation breakdown, quarterly/monthly trends, perpetrator & state summaries |
| **Gender** | Full gender-disaggregated analysis across violations, states, perpetrators & quarters |
| **Perpetrators** | Actor attribution deep-dive: community militias, conventional parties, opportunistic elements |
| **Geographic** | State → County → Payam hotspot analysis with heatmaps and tables |
| **SGBV** | Sexual & gender-based violence analysis with support services indicators |
| **Maps** | Interactive Leaflet maps for casualty and SGBV data with filters |

## Data

Source: `Yearly 2025.xlsx` — UNMISS HRD Incident Database 2025.

Three sheets used:
- **Matrix** — 1,481 rows of casualty data (Killed · Injured · Abducted · CRSV) with state, county, payam, gender and perpetrator fields
- **SGBV** — 243 rows of sexual & gender-based violence cases with service access indicators
- **Yearly casualty trend** — Multi-year monthly trend by perpetrator group (2023–2025)

## Setup / Regenerate Data

```bash
cd "Q4 report"
python3 extract_data.py   # regenerates js/data.js from Yearly 2025.xlsx
```

Requires: `pandas openpyxl` — install with `pip3 install pandas openpyxl`

## GitHub Pages Deployment

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages** → Source: `main` branch, `/ (root)` folder
3. The site will be live at `https://<username>.github.io/<repo-name>/`

No build step required — pure static HTML/CSS/JS.

## Tech Stack

- [Plotly.js](https://plotly.com/javascript/) — interactive charts
- [Leaflet.js](https://leafletjs.com/) — interactive maps (CartoDB dark tiles)
- [Inter & Space Grotesk](https://fonts.google.com/) — typography
- Pure HTML/CSS/JS — no framework, no build tool

## Notes

Data is non-exhaustive and likely underrepresents the actual scale of harm. UNMISS HRD investigations were constrained by limited resources, access denials, and fear of reprisals. SGBV is significantly underreported due to social stigma.

---

© 2025 UNMISS Human Rights Division · For advocacy and awareness purposes
