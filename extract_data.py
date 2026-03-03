#!/usr/bin/env python3
"""
UNMISS HRD 2025 Data Extraction Script

Reads incident data from documents/Yearly 2025 updates.xlsx and generates
js/data.js — a JavaScript module consumed by the Q4 Violence Dashboard.

Sheets used:
  - Matrix: Main casualty data (Killed, Injured, Abducted, CRSV) by state,
    county, payam, gender, perpetrator, quarter.
  - SGBV: Sexual and gender-based violence cases with service-access indicators
    (medical care, psychosocial support, reported, arrested, pregnancy).
  - Yearly casualty trend: Multi-year monthly trend by perpetrator group.

Output: UNMISS_DATA object with q4, quarterly, q4_by_state, q4_by_perpetrator,
q4_locations, all_locations, sgbv, crsv_sgbv, yearly_trend, etc.

Run: python3 extract_data.py
"""
import pandas as pd
import json
import os
from datetime import datetime

EXCEL_PATH = os.path.join(os.path.dirname(__file__), 'documents', 'Yearly 2025 updates.xlsx')
OUTPUT_DIR = os.path.dirname(__file__)

# Draft Q4 Brief reference numbers — used to validate extracted data matches published brief
BRIEF_Q4 = {'total': 830, 'killed': 406, 'injured': 264, 'abducted': 106, 'crsv': 54,
            'male': 591, 'female': 123, 'boys': 56, 'girls': 60, 'sgbv_q4': 58}

VIOLATIONS = ['Killed', 'Injured', 'Abducted', 'CRSV']
QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
STATES = [
    'Warrap', 'Central Equatoria', 'Unity', 'Lakes', 'Eastern Equatoria',
    'Western Equatoria', 'Jonglei', 'Upper Nile', 'Western Bahr el Ghazal',
    'Northern Bahr el Ghazal'
]
PERPS = ['Community-based Militias', 'Conventional Parties', 'Unidentified/Opportunistic']
MONTHS = ['January','February','March','April','May','June',
          'July','August','September','October','November','December']

def normalize_month(m):
    """Convert month string to full name (e.g. 'Jan' -> 'January'). Handles NaN and short/long formats."""
    if pd.isna(m): return ''
    m = str(m).strip().capitalize()
    short_map = {'Jan':'January','Feb':'February','Mar':'March','Apr':'April',
                 'Jun':'June','Jul':'July','Aug':'August','Sep':'September',
                 'Oct':'October','Nov':'November','Dec':'December'}
    return short_map.get(m[:3], m) if len(m) <= 4 else m

def normalize_violation(v):
    """Normalize Forms of Violations column to: Killed, Injured, Abducted, CRSV."""
    if pd.isna(v): return ''
    v = str(v).strip().lower()
    return {'killed':'Killed','injured':'Injured','abducted':'Abducted','crsv':'CRSV'}.get(v, v.capitalize())

def normalize_quarter(q):
    """Extract Q1/Q2/Q3/Q4 from quarter string (e.g. 'Q3 2025' -> 'Q3')."""
    if pd.isna(q): return ''
    q = str(q).strip().upper()
    for i in range(1, 5):
        if f'Q{i}' in q and '2025' in q:
            return f'Q{i}'
    return ''

def normalize_perp(p):
    """Map perpetrator text to one of: Community-based Militias, Conventional Parties, Unidentified/Opportunistic."""
    if pd.isna(p): return 'Unidentified/Opportunistic'
    p = str(p).strip().lower()
    if 'community' in p: return 'Community-based Militias'
    if 'conventional' in p: return 'Conventional Parties'
    return 'Unidentified/Opportunistic'

def normalize_bool(v):
    """Normalize Yes/No/1/true etc. to 'Yes' or 'No' for SGBV service indicators."""
    if pd.isna(v): return 'Unknown'
    return 'Yes' if str(v).strip().lower() in ['yes','y','1','true'] else 'No'

def int_safe(v):
    """Safely coerce value to int; return 0 on invalid input."""
    try: return int(v)
    except: return 0

# ═══════════════════════════════════════════════════════════════════════════════
# LOAD AND NORMALIZE MATRIX SHEET (main casualty data)
# ═══════════════════════════════════════════════════════════════════════════════
xl = pd.ExcelFile(EXCEL_PATH)
df_raw = pd.read_excel(xl, sheet_name='Matrix')
# Column mapping: supports both named headers (Yearly 2025 updates) and legacy positional format
MATRIX_RENAME = {
    'Month of Report': 'month', 'Forms of Violations': 'violation',
    'Total Victims': 'total', 'Male': 'male', 'Female': 'female',
    'Boys': 'boys', 'Girls': 'girls', 'State': 'state',
    'Location of Incident': 'location', 'Lat': 'lat', 'long': 'long',
    'Payam': 'payam', 'County': 'county',
    'Generalized Perpetrator Group': 'perpetrator',
    'Reporting Quarter': 'quarter',
}
if set(MATRIX_RENAME.keys()).issubset(set(df_raw.columns)):
    df = df_raw[list(MATRIX_RENAME.keys())].copy()
    df = df.rename(columns=MATRIX_RENAME)
else:
    df = df_raw.iloc[:, :16].copy()
    df.columns = ['month','violation','total','male','female','boys','girls',
                  'state','location','lat','long','payam','county','perpetrator',
                  'casualty','quarter']

df['month']      = df['month'].apply(normalize_month)
df['violation']  = df['violation'].apply(normalize_violation)
df['quarter']    = df['quarter'].apply(normalize_quarter)
df['perpetrator']= df['perpetrator'].apply(normalize_perp)
df['state']      = df['state'].apply(lambda x: str(x).strip() if pd.notna(x) else '')
df['county']     = df['county'].apply(lambda x: str(x).strip() if pd.notna(x) else '')
df['payam']      = df['payam'].apply(lambda x: str(x).strip() if pd.notna(x) else '')

for col in ['total','male','female','boys','girls']:
    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
for col in ['lat','long']:
    df[col] = pd.to_numeric(df[col], errors='coerce')

df = df[df['violation'].isin(VIOLATIONS)]
df = df[df['quarter'].isin(QUARTERS)]
df_q4 = df[df['quarter'] == 'Q4'].copy()

# ═══════════════════════════════════════════════════════════════════════════════
# LOAD SGBV SHEET (sexual violence cases + service-access indicators)
# ═══════════════════════════════════════════════════════════════════════════════
df_sgbv_raw = pd.read_excel(xl, sheet_name='SGBV')
sg = df_sgbv_raw.copy()
SGBV_RENAME = {
    'Month of Report': 'month', 'Forms of Violations': 'violation',
    'Total Victims': 'total', 'Male': 'male', 'Female': 'female',
    'Boys': 'boys', 'Girls': 'girls', 'State': 'state',
    'Location of Incident': 'location', 'Lat': 'lat', 'long': 'long',
    'Payam': 'payam', 'County': 'county', 'Perpetrator Group': 'perpetrator',
    'Medical care': 'medical_care', 'Psycosocial support': 'psychosocial',
    'Report to authority': 'reported', 'Perpetrators arrested?': 'arrested',
    'PREGNANCIES RESULTING': 'pregnancy',
}
if set(SGBV_RENAME.keys()).issubset(set(sg.columns)):
    sg = sg[[c for c in SGBV_RENAME if c in sg.columns]].copy()
    sg = sg.rename(columns={k:v for k,v in SGBV_RENAME.items() if k in sg.columns})
    for c in ['medical_care','psychosocial','reported','arrested','pregnancy']:
        if c in sg.columns:
            sg[c] = sg[c].apply(normalize_bool)
        else:
            sg[c] = 'Unknown'
else:
    sg.columns = ['month','violation','total','male','female','boys','girls',
                  'state','location','lat','long','payam','county','perpetrator',
                  'region','medical_care','psychosocial','reported','arrested','pregnancy']
    for col in ['medical_care','psychosocial','reported','arrested','pregnancy']:
        sg[col] = sg[col].apply(normalize_bool)

sg['month']       = sg['month'].apply(normalize_month)
sg['perpetrator'] = sg['perpetrator'].apply(normalize_perp)
sg['state']       = sg['state'].apply(lambda x: str(x).strip() if pd.notna(x) else '')
sg['county']      = sg['county'].apply(lambda x: str(x).strip() if pd.notna(x) else '')
for col in ['total','male','female','boys','girls']:
    sg[col] = pd.to_numeric(sg[col], errors='coerce').fillna(0).astype(int)
for col in ['lat','long']:
    sg[col] = pd.to_numeric(sg[col], errors='coerce')
for col in ['medical_care','psychosocial','reported','arrested','pregnancy']:
    sg[col] = sg[col].apply(normalize_bool)

MONTH_TO_Q = {m: f'Q{(i//3)+1}' for i,m in enumerate(MONTHS)}
sg['quarter'] = sg['month'].map(MONTH_TO_Q)
sg_q4 = sg[sg['quarter'] == 'Q4'].copy()

# ═══════════════════════════════════════════════════════════════════════════════
# LOAD YEARLY CASUALTY TREND (multi-year monthly by perpetrator)
# ═══════════════════════════════════════════════════════════════════════════════
df_trend = pd.read_excel(xl, sheet_name='Yearly casualty trend')

# ═══════════════════════════════════════════════════════════════════════════════
# AGGREGATION HELPERS — build summary dicts from filtered DataFrame subsets
# ═══════════════════════════════════════════════════════════════════════════════

def agg_total(sub):
    """Sum total victims and per-violation (killed, injured, abducted, crsv) counts."""
    r = {'total': int_safe(sub['total'].sum())}
    for v in VIOLATIONS:
        r[v.lower()] = int_safe(sub[sub['violation']==v]['total'].sum())
    return r

def agg_gender(sub):
    """Sum male, female, boys, girls victim counts."""
    return {k: int_safe(sub[k].sum()) for k in ['male','female','boys','girls']}

def agg_full(sub):
    """Full aggregation: total, per-violation, gender, and by_violation_gender breakdown."""
    r = agg_total(sub)
    r['gender'] = agg_gender(sub)
    r['by_violation_gender'] = {
        v.lower(): agg_gender(sub[sub['violation']==v]) for v in VIOLATIONS
    }
    return r

# ═══════════════════════════════════════════════════════════════════════════════
# BUILD DATA DICTIONARY (output structure for UNMISS_DATA)
# ═══════════════════════════════════════════════════════════════════════════════
data = {}

# Q4 2025 overview totals and gender breakdown──
data['q4'] = agg_full(df_q4)

# Quarterly summaries (Q1–Q4) for trend charts
data['quarterly'] = {}
for q in QUARTERS:
    data['quarterly'][q] = agg_full(df[df['quarter']==q])

# Q4 totals and breakdowns per state (violations, gender, perpetrator)
data['q4_by_state'] = {}
for state in STATES:
    sub = df_q4[df_q4['state']==state]
    if len(sub) == 0: continue
    d = agg_total(sub)
    d['gender'] = agg_gender(sub)
    d['by_perpetrator'] = {p: int_safe(sub[sub['perpetrator']==p]['total'].sum()) for p in PERPS}
    d['by_violation_gender'] = {v.lower(): agg_gender(sub[sub['violation']==v]) for v in VIOLATIONS}
    data['q4_by_state'][state] = d

# State totals per quarter (for heatmaps, line charts)
data['quarterly_by_state'] = {q: {} for q in QUARTERS}
for q in QUARTERS:
    for state in STATES:
        sub = df[(df['quarter']==q) & (df['state']==state)]
        data['quarterly_by_state'][q][state] = int_safe(sub['total'].sum())

# State × Perpetrator × Violation detail (for treemap, heatmaps)
data['q4_state_perp_detail'] = {}
for state in STATES:
    data['q4_state_perp_detail'][state] = {}
    sub_s = df_q4[df_q4['state']==state]
    for p in PERPS:
        sub_p = sub_s[sub_s['perpetrator']==p]
        data['q4_state_perp_detail'][state][p] = {
            v.lower(): int_safe(sub_p[sub_p['violation']==v]['total'].sum()) for v in VIOLATIONS
        }
        data['q4_state_perp_detail'][state][p]['total'] = int_safe(sub_p['total'].sum())

# Q4 totals and breakdowns per perpetrator (violations, gender, by state)
data['q4_by_perpetrator'] = {}
for p in PERPS:
    sub = df_q4[df_q4['perpetrator']==p]
    d = agg_total(sub)
    d['gender'] = agg_gender(sub)
    d['by_state'] = {state: int_safe(sub[sub['state']==state]['total'].sum()) for state in STATES}
    d['by_violation_gender'] = {v.lower(): agg_gender(sub[sub['violation']==v]) for v in VIOLATIONS}
    data['q4_by_perpetrator'][p] = d

# Perpetrator totals per quarter (for quarterly bar charts)
data['quarterly_by_perpetrator'] = {q: {} for q in QUARTERS}
for q in QUARTERS:
    for p in PERPS:
        sub = df[(df['quarter']==q) & (df['perpetrator']==p)]
        data['quarterly_by_perpetrator'][q][p] = int_safe(sub['total'].sum())

# Monthly 2025 totals by violation and perpetrator (for trend line charts)
data['monthly_2025'] = {}
for m in MONTHS:
    sub = df[df['month']==m]
    d = agg_total(sub)
    for p in PERPS:
        key = p.split()[0].lower()
        d[key] = int_safe(sub[sub['perpetrator']==p]['total'].sum())
    data['monthly_2025'][m] = d

# Q4 totals by county (with state, gender) — for geographic tables and bars
data['q4_by_county'] = {}
for (state, county), sub in df_q4.groupby(['state','county']):
    if county and county.lower() not in ['nan','']:
        d = agg_total(sub)
        d['state'] = state
        d['gender'] = agg_gender(sub)
        data['q4_by_county'][county] = d

# Q4 totals by payam (county-level breakdown for sub-state analysis)
data['q4_by_payam'] = {}
for (state, county, payam), sub in df_q4.groupby(['state','county','payam']):
    if payam and payam.lower() not in ['nan','']:
        data['q4_by_payam'][payam] = {
            'state': state, 'county': county,
            'total': int_safe(sub['total'].sum())
        }

# Q4 locations with coordinates — for casualty map markers (grouped by lat/long/state/county/payam/perp)
locs = df_q4[df_q4['lat'].notna() & df_q4['long'].notna()].copy()
loc_list = []
for (lat, lng, state, county, payam, perp), sub in locs.groupby(
        ['lat','long','state','county','payam','perpetrator'], dropna=False):
    d = agg_total(sub)
    d.update({'lat': round(float(lat),6), 'long': round(float(lng),6),
              'state': state, 'county': county, 'payam': payam, 'perpetrator': perp})
    loc_list.append(d)
data['q4_locations'] = loc_list

# All-year locations (Q1–Q4) for map quarter filter; includes perpetrator for colouring
all_locs = df[df['lat'].notna() & df['long'].notna()].copy()
all_locs['perpetrator'] = all_locs['perpetrator'].fillna('Unidentified/Opportunistic')
all_locs['payam'] = all_locs['payam'].fillna('')
all_loc_list = []
for (lat, lng, state, county, payam, quarter, perp), sub in all_locs.groupby(
        ['lat','long','state','county','payam','quarter','perpetrator'], dropna=False):
    entry = agg_total(sub)
    entry.update({
        'lat': round(float(lat),6), 'long': round(float(lng),6),
        'state': state, 'county': county, 'payam': payam or None,
        'quarter': quarter, 'perpetrator': perp
    })
    all_loc_list.append(entry)
data['all_locations'] = all_loc_list

# SGBV (Sexual and Gender-Based Violence) aggregates — q4, quarterly, by_state, by_perpetrator, locations
sgbv = {}

def agg_sgbv_support(sub):
    """Aggregate SGBV service indicators: yes/no counts for medical_care, psychosocial, reported, arrested, pregnancy."""
    r = {}
    for col in ['medical_care','psychosocial','reported','arrested','pregnancy']:
        vc = sub[col].value_counts().to_dict()
        r[col] = {'yes': int_safe(vc.get('Yes',0)), 'no': int_safe(vc.get('No',0))}
    return r

sgbv['q4'] = {
    'total': int_safe(sg_q4['total'].sum()),
    'gender': agg_gender(sg_q4),
    **agg_sgbv_support(sg_q4)
}

sgbv['quarterly'] = {q: int_safe(sg[sg['quarter']==q]['total'].sum()) for q in QUARTERS}

sgbv['q4_by_state'] = {}
for state in sg_q4['state'].unique():
    if state:
        sub = sg_q4[sg_q4['state']==state]
        sgbv['q4_by_state'][state] = {
            'total': int_safe(sub['total'].sum()),
            'gender': agg_gender(sub),
            **agg_sgbv_support(sub)
        }

sgbv['q4_by_perpetrator'] = {p: int_safe(sg_q4[sg_q4['perpetrator']==p]['total'].sum()) for p in PERPS}
sgbv['monthly'] = {m: int_safe(sg[sg['month']==m]['total'].sum()) for m in MONTHS}

sgbv['quarterly_by_state'] = {q: {} for q in QUARTERS}
for q in QUARTERS:
    for state in STATES:
        sgbv['quarterly_by_state'][q][state] = int_safe(
            sg[(sg['quarter']==q)&(sg['state']==state)]['total'].sum())

# SGBV Q4 locations
sg_locs = sg_q4[sg_q4['lat'].notna() & sg_q4['long'].notna()].copy()
sgbv_loc_list = []
for (lat, lng, state, county), sub in sg_locs.groupby(['lat','long','state','county'], dropna=False):
    sgbv_loc_list.append({
        'lat': round(float(lat),6), 'long': round(float(lng),6),
        'state': state, 'county': county, 'total': int_safe(sub['total'].sum())
    })
sgbv['q4_locations'] = sgbv_loc_list

# SGBV all-year locations (with quarter) for map filter
sg_all = sg[sg['lat'].notna() & sg['long'].notna()].copy()
sgbv_all_loc_list = []
for (lat, lng, state, county, quarter), sub in sg_all.groupby(
        ['lat','long','state','county','quarter'], dropna=False):
    sgbv_all_loc_list.append({
        'lat': round(float(lat),6), 'long': round(float(lng),6),
        'state': state, 'county': county, 'quarter': quarter,
        'total': int_safe(sub['total'].sum())
    })
sgbv['all_locations'] = sgbv_all_loc_list
data['sgbv'] = sgbv

# CRSV (from Matrix) vs SGBV (separate sheet) per quarter — for comparative charts
data['crsv_sgbv'] = {}
for q in QUARTERS:
    data['crsv_sgbv'][q] = {
        'crsv': int_safe(df[(df['quarter']==q)&(df['violation']=='CRSV')]['total'].sum()),
        'sgbv': int_safe(sg[sg['quarter']==q]['total'].sum())
    }

# Historical yearly trend (Yearly casualty trend sheet) — year → month → {community, conventional, opportunistic, total}
yearly = {}
for _, row in df_trend.iterrows():
    if pd.isna(row.iloc[0]): continue
    yr = str(int(row.iloc[0]))
    month = normalize_month(row.iloc[1])
    if not month: continue
    if yr not in yearly: yearly[yr] = {}
    yearly[yr][month] = {
        'community':     int_safe(row.iloc[2]) if pd.notna(row.iloc[2]) else 0,
        'conventional':  int_safe(row.iloc[3]) if pd.notna(row.iloc[3]) else 0,
        'opportunistic': int_safe(row.iloc[4]) if pd.notna(row.iloc[4]) else 0,
        'total':         int_safe(row.iloc[5]) if pd.notna(row.iloc[5]) else 0,
    }
data['yearly_trend'] = yearly

# ═══════════════════════════════════════════════════════════════════════════════
# WRITE OUTPUT — generate js/data.js
# ═══════════════════════════════════════════════════════════════════════════════
os.makedirs(os.path.join(OUTPUT_DIR, 'js'), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, 'css'), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, 'assets'), exist_ok=True)

output = f"""// UNMISS HRD Q4 2025 – Auto-generated data file (do not edit manually)
// Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Source: documents/Yearly 2025 updates.xlsx — run python3 extract_data.py to regenerate
//
// Structure: q4, quarterly, q4_by_state, q4_by_perpetrator, q4_by_county, q4_by_payam,
// q4_locations, all_locations, sgbv, crsv_sgbv, monthly_2025, yearly_trend
const UNMISS_DATA = {json.dumps(data, indent=2, ensure_ascii=False)};
"""

out_path = os.path.join(OUTPUT_DIR, 'js', 'data.js')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(output)

# Print summary
q4 = data['q4']
print(f"✓ data.js generated → {out_path}")
print(f"\n📊 Q4 2025 SUMMARY")
print(f"   Total Victims : {q4['total']:,}")
print(f"   Killed        : {q4['killed']:,}  ({q4['killed']/max(q4['total'],1)*100:.1f}%)")
print(f"   Injured       : {q4['injured']:,}  ({q4['injured']/max(q4['total'],1)*100:.1f}%)")
print(f"   Abducted      : {q4['abducted']:,}  ({q4['abducted']/max(q4['total'],1)*100:.1f}%)")
print(f"   CRSV          : {q4['crsv']:,}  ({q4['crsv']/max(q4['total'],1)*100:.1f}%)")
print(f"   Male          : {q4['gender']['male']:,}")
print(f"   Female        : {q4['gender']['female']:,}")
print(f"   Boys          : {q4['gender']['boys']:,}")
print(f"   Girls         : {q4['gender']['girls']:,}")
print(f"\n📍 Q4 States: {list(data['q4_by_state'].keys())}")
print(f"📍 Q4 Counties: {len(data['q4_by_county'])}")
print(f"📍 Q4 Payams:   {len(data['q4_by_payam'])}")
print(f"📍 Q4 Locations:{len(data['q4_locations'])}")
print(f"\n🔴 SGBV Q4: {data['sgbv']['q4']['total']}")
print(f"\n✅ Quarterly:")
for q in QUARTERS:
    print(f"   {q}: {data['quarterly'][q]['total']:,} victims")

# Compare extracted totals against Draft Q4 Brief reference numbers
print(f"\n📋 BRIEF VALIDATION (vs Draft Q4 Brief):")
def check(name, extracted, brief_val):
    m = "✓" if extracted == brief_val else "⚠"
    return f"   {m} {name}: extracted={extracted}, brief={brief_val}"

print(check("Q4 total", q4['total'], BRIEF_Q4['total']))
print(check("Q4 killed", q4['killed'], BRIEF_Q4['killed']))
print(check("Q4 injured", q4['injured'], BRIEF_Q4['injured']))
print(check("Q4 abducted", q4['abducted'], BRIEF_Q4['abducted']))
print(check("Q4 CRSV", q4['crsv'], BRIEF_Q4['crsv']))
print(check("Q4 male", q4['gender']['male'], BRIEF_Q4['male']))
print(check("Q4 female", q4['gender']['female'], BRIEF_Q4['female']))
print(check("Q4 boys", q4['gender']['boys'], BRIEF_Q4['boys']))
print(check("Q4 girls", q4['gender']['girls'], BRIEF_Q4['girls']))
print(check("SGBV Q4", data['sgbv']['q4']['total'], BRIEF_Q4['sgbv_q4']))
