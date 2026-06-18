#!/usr/bin/env python3
"""Monotonic-stack 'next greater element' figure for pattern-codex ch8.
Array as bars; green arcs point each bar to its next greater element. House palette."""
import os, math
OUT="content/pattern-codex"; FF="ui-sans-serif, system-ui, -apple-system, sans-serif"; MONO="ui-monospace, SFMono-Regular, Menlo, monospace"
INK="#3E4C63"; FAINT="#7C8BA1"; DIM="#C3CCD8"
GOLD_F="#F4E2B0"; GOLD_S="#C99A2E"; GREEN_S="#3E8E5A"; SLATE_F="#DCE3EC"
W,H=360,252
vals=[2,1,5,3,4]
nge={0:2,1:2,3:4}      # index -> index of next greater; 2 and 4 have none
bw=40; gap=16; x0=44; base=186
def cx(i): return x0+i*(bw+gap)+bw/2
def htop(i): return base-(22+vals[i]*16)
s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n  <rect width="{W}" height="{H}" fill="none"/>\n'
# baseline
s+=f'  <line x1="{x0-8}" y1="{base}" x2="{cx(4)+bw/2+8:.0f}" y2="{base}" stroke="{DIM}" stroke-width="1.5"/>\n'
# bars
for i,v in enumerate(vals):
    top=htop(i); hasnge=i in nge
    fill=GOLD_F if not hasnge else SLATE_F; stroke=GOLD_S if not hasnge else FAINT
    s+=f'  <rect x="{cx(i)-bw/2:.0f}" y="{top:.0f}" width="{bw}" height="{base-top:.0f}" rx="4" fill="{fill}" stroke="{stroke}" stroke-width="2"/>\n'
    s+=f'  <text x="{cx(i):.0f}" y="{top+18:.0f}" font-family="{MONO}" font-size="15" font-weight="700" text-anchor="middle" fill="{INK}">{v}</text>\n'
    s+=f'  <text x="{cx(i):.0f}" y="{base+16:.0f}" font-family="{MONO}" font-size="10" text-anchor="middle" fill="{FAINT}">{i}</text>\n'
    if not hasnge:
        s+=f'  <text x="{cx(i):.0f}" y="{top+36:.0f}" font-family="{FF}" font-size="9" text-anchor="middle" fill="{GOLD_S}">none</text>\n'
# NGE arcs (green) above the bars
for i,j in nge.items():
    x1,y1=cx(i),htop(i)-6; x2,y2=cx(j),htop(j)-6
    cxm=(x1+x2)/2; cym=min(y1,y2)-26
    ang=math.atan2(y2-cym,x2-cxm)
    ex=x2-3*math.cos(ang); ey=y2-3*math.sin(ang)
    s+=f'  <path d="M{x1:.0f} {y1:.0f} Q {cxm:.0f} {cym:.0f} {ex:.0f} {ey:.0f}" fill="none" stroke="{GREEN_S}" stroke-width="2" opacity="0.9"/>\n'
    a1=ang+math.radians(150); a2=ang-math.radians(150); sz=7
    s+=f'  <path d="M{x2:.0f} {y2:.0f} L{x2+sz*math.cos(a1):.0f} {y2+sz*math.sin(a1):.0f} L{x2+sz*math.cos(a2):.0f} {y2+sz*math.sin(a2):.0f} Z" fill="{GREEN_S}"/>\n'
# titles
s+=f'  <text x="{W/2:.0f}" y="26" font-family="{FF}" font-size="14.5" font-weight="700" text-anchor="middle" fill="{INK}">Next greater element, in one pass</text>\n'
s+=f'  <text x="{W/2:.0f}" y="44" font-family="{FF}" font-size="11" text-anchor="middle" fill="{FAINT}">each bar points to the first taller bar on its right</text>\n'
s+=f'  <text x="{W/2:.0f}" y="{base+38:.0f}" font-family="{FF}" font-size="10.5" text-anchor="middle" fill="{INK}">Keep a decreasing stack; a taller bar resolves everything it pops.</text>\n'
s+='</svg>\n'
os.makedirs(OUT,exist_ok=True)
open(os.path.join(OUT,"monostack-nge.svg"),"w").write(s); print("wrote monostack-nge.svg")
