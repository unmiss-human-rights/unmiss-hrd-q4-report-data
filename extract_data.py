#!/usr/bin/env python3
"""
UNMISS HRD 2025 Data Extraction Script
Extracts data from 'Yearly 2025.xlsx' and generates js/data.js
"""
import pandas as pd
import json
import os
from datetime import datetime

EXCEL_PATH = os.path.join(os.path.dirname(__file__), 'Yearly 2025.xlsx')
OUTPUT_DIR = os.path.dirname(__file__)

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
    if pd.isna(m): return ''
    m = str(m).strip().capitalize()
    short_map = {'Jan':'January','Feb':'February','Mar':'March','Apr':'April',
                 'Jun':'June','Jul':'July','Aug':'August','Sep':'September',
                 'Oct':'October','Nov':'November','Dec':'December'}
    return short_map.get(m[:3], m) if len(m) <= 4 else m

def normalize_violation(v):
    if pd.isna(v): return ''
    v = str(v).strip().lower()
    return {'killed':'Killed','injured':'Injured','abducted':'Abducted','crsv':'CRSV'}.get(v, v.capitalize())

def normalize_quarter(q):
    if pd.isna(q): return ''
    q = str(q).strip().upper()
    for i in range(1, 5):
        if f'Q{i}' in q and '2025' in q:
            return f'Q{i}'
    return ''

def normalize_perp(p):
    if pd.isna(p): return 'Unidentified/Opportunistic'
    p = str(p).strip().lower()
    if 'community' in p: return 'Community-based Militias'
    if 'conventional' in p: return 'Conventional Parties'
    return 'Unidentified/Opportunistic'

def normalize_bool(v):
    if pd.isna(v): return 'Unknown'
    return 'Yes' if str(v).strip().lower() in ['yes','y','1','true'] else 'No'

def int_safe(v):
    try: return int(v)
    except: return 0

# ── Load Matrix ──────────────────────────────────────────────────────────────
xl = pd.ExcelFile(EXCEL_PATH)
df_raw = pd.read_excel(xl, sheet_name='Matrix')
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

# ── SGBV Sheet ────────────────────────────────────────────────────────────────
df_sgbv_raw = pd.read_excel(xl, sheet_name='SGBV')
sg = df_sgbv_raw.copy()
sg.columns = ['month','violation','total','male','female','boys','girls',
              'state','location','lat','long','payam','county','perpetrator',
              'region','medical_care','psychosocial','reported','arrested','pregnancy']

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

# ── Yearly Trend Sheet ────────────────────────────────────────────────────────
df_trend = pd.read_excel(xl, sheet_name='Yearly casualty trend')

# ── Helper aggregators ────────────────────────────────────────────────────────
def agg_total(sub):
    r = {'total': int_safe(sub['total'].sum())}
    for v in VIOLATIONS:
        r[v.lower()] = int_safe(sub[sub['violation']==v]['total'].sum())
    return r

def agg_gender(sub):
    return {k: int_safe(sub[k].sum()) for k in ['male','female','boys','girls']}

def agg_full(sub):
    r = agg_total(sub)
    r['gender'] = agg_gender(sub)
    r['by_violation_gender'] = {
        v.lower(): agg_gender(sub[sub['violation']==v]) for v in VIOLATIONS
    }
    return r

# ═══════════════════════════════════════════════════════════════════════════════
data = {}

# ── Q4 Overview ───────────────────────────────────────────────────────────────
data['q4'] = agg_full(df_q4)

# ── Quarterly Summary ─────────────────────────────────────────────────────────
data['quarterly'] = {}
for q in QUARTERS:
    data['quarterly'][q] = agg_full(df[df['quarter']==q])

# ── Q4 by State ───────────────────────────────────────────────────────────────
data['q4_by_state'] = {}
for state in STATES:
    sub = df_q4[df_q4['state']==state]
    if len(sub) == 0: continue
    d = agg_total(sub)
    d['gender'] = agg_gender(sub)
    d['by_perpetrator'] = {p: int_safe(sub[sub['perpetrator']==p]['total'].sum()) for p in PERPS}
    d['by_violation_gender'] = {v.lower(): agg_gender(sub[sub['violation']==v]) for v in VIOLATIONS}
    data['q4_by_state'][state] = d

# ── Quarterly by State ────────────────────────────────────────────────────────
data['quarterly_by_state'] = {q: {} for q in QUARTERS}
for q in QUARTERS:
    for state in STATES:
        sub = df[(df['quarter']==q) & (df['state']==state)]
        data['quarterly_by_state'][q][state] = int_safe(sub['total'].sum())

# ── Q4 State × Perpetrator × Violation ───────────────────────────────────────
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

# ── Q4 by Perpetrator ─────────────────────────────────────────────────────────
data['q4_by_perpetrator'] = {}
for p in PERPS:
    sub = df_q4[df_q4['perpetrator']==p]
    d = agg_total(sub)
    d['gender'] = agg_gender(sub)
    d['by_state'] = {state: int_safe(sub[sub['state']==state]['total'].sum()) for state in STATES}
    d['by_violation_gender'] = {v.lower(): agg_gender(sub[sub['violation']==v]) for v in VIOLATIONS}
    data['q4_by_perpetrator'][p] = d

# ── Quarterly by Perpetrator ──────────────────────────────────────────────────
data['quarterly_by_perpetrator'] = {q: {} for q in QUARTERS}
for q in QUARTERS:
    for p in PERPS:
        sub = df[(df['quarter']==q) & (df['perpetrator']==p)]
        data['quarterly_by_perpetrator'][q][p] = int_safe(sub['total'].sum())

# ── Monthly 2025 ──────────────────────────────────────────────────────────────
data['monthly_2025'] = {}
for m in MONTHS:
    sub = df[df['month']==m]
    d = agg_total(sub)
    for p in PERPS:
        key = p.split()[0].lower()
        d[key] = int_safe(sub[sub['perpetrator']==p]['total'].sum())
    data['monthly_2025'][m] = d

# ── Q4 by County ─────────────────────────────────────────────────────────────
data['q4_by_county'] = {}
for (state, county), sub in df_q4.groupby(['state','county']):
    if county and county.lower() not in ['nan','']:
        d = agg_total(sub)
        d['state'] = state
        d['gender'] = agg_gender(sub)
        data['q4_by_county'][county] = d

# ── Q4 by Payam ───────────────────────────────────────────────────────────────
data['q4_by_payam'] = {}
for (state, county, payam), sub in df_q4.groupby(['state','county','payam']):
    if payam and payam.lower() not in ['nan','']:
        data['q4_by_payam'][payam] = {
            'state': state, 'county': county,
            'total': int_safe(sub['total'].sum())
        }

# ── Q4 Locations (for map) ────────────────────────────────────────────────────
locs = df_q4[df_q4['lat'].notna() & df_q4['long'].notna()].copy()
loc_list = []
for (lat, lng, state, county, payam, perp), sub in locs.groupby(
        ['lat','long','state','county','payam','perpetrator'], dropna=False):
    d = agg_total(sub)
    d.update({'lat': round(float(lat),6), 'long': round(float(lng),6),
              'state': state, 'county': county, 'payam': payam, 'perpetrator': perp})
    loc_list.append(d)
data['q4_locations'] = loc_list

# All-year locations
all_locs = df[df['lat'].notna() & df['long'].notna()].copy()
all_loc_list = []
for (lat, lng, state, county, quarter), sub in all_locs.groupby(
        ['lat','long','state','county','quarter'], dropna=False):
    entry = agg_total(sub)
    entry.update({
        'lat': round(float(lat),6), 'long': round(float(lng),6),
        'state': state, 'county': county, 'quarter': quarter
    })
    all_loc_list.append(entry)
data['all_locations'] = all_loc_list

# ── SGBV ─────────────────────────────────────────────────────────────────────
sgbv = {}

def agg_sgbv_support(sub):
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

sg_locs = sg_q4[sg_q4['lat'].notna() & sg_q4['long'].notna()].copy()
sgbv_loc_list = []
for (lat, lng, state, county), sub in sg_locs.groupby(['lat','long','state','county'], dropna=False):
    sgbv_loc_list.append({
        'lat': round(float(lat),6), 'long': round(float(lng),6),
        'state': state, 'county': county, 'total': int_safe(sub['total'].sum())
    })
sgbv['q4_locations'] = sgbv_loc_list
data['sgbv'] = sgbv

# ── CRSV vs SGBV ─────────────────────────────────────────────────────────────
data['crsv_sgbv'] = {}
for q in QUARTERS:
    data['crsv_sgbv'][q] = {
        'crsv': int_safe(df[(df['quarter']==q)&(df['violation']=='CRSV')]['total'].sum()),
        'sgbv': int_safe(sg[sg['quarter']==q]['total'].sum())
    }

# ── Historical Yearly Trend ───────────────────────────────────────────────────
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

# ── Write output ──────────────────────────────────────────────────────────────
os.makedirs(os.path.join(OUTPUT_DIR, 'js'), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, 'css'), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, 'assets'), exist_ok=True)

output = f"""// UNMISS HRD Q4 2025 – Auto-generated data file
// Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Source: Yearly 2025.xlsx
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
