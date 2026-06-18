#!/usr/bin/env python3
"""3-stage sliding-window scrolly for pattern-codex ch4. Array [2,1,5,1,3,2], K=7.
Stage 0 expand, stage 1 overflow, stage 2 shrink. Palette matches house SVGs."""
import os
OUT="content/pattern-codex"; FF="ui-sans-serif, system-ui, -apple-system, sans-serif"; MONO="ui-monospace, SFMono-Regular, Menlo, monospace"
INK="#3E4C63"; MID="#5C6B82"; FAINT="#7C8BA1"; DIM="#C3CCD8"
GOLD_F="#F4E2B0"; GOLD_S="#C99A2E"; GREEN_F="#CDE8D6"; GREEN_S="#3E8E5A"; RED_F="#F6D6CE"; RED_S="#C0563B"; WHITE="#FFFFFF"
W,H=330,236
A=[2,1,5,1,3,2]; CW=44; GAP=4; X0=28; CY=104; CH=44
def cx(i): return X0+i*(CW+GAP)
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def cells(l,r,valid):
    s=""
    # window band
    wx=cx(l)-3; wx2=cx(r)+CW+3
    band=GREEN_F if valid else RED_F; bstroke=GREEN_S if valid else RED_S
    s+=f'  <rect x="{wx:.0f}" y="{CY-9}" width="{wx2-wx:.0f}" height="{CH+18}" rx="9" fill="{band}" stroke="{bstroke}" stroke-width="2.4" opacity="0.9"/>\n'
    for i,v in enumerate(A):
        inwin = l<=i<=r
        fill=WHITE; stroke=INK if inwin else DIM; tf=INK if inwin else FAINT; sw=2.4 if inwin else 1.8
        s+=f'  <rect x="{cx(i):.0f}" y="{CY}" width="{CW}" height="{CH}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>\n'
        s+=f'  <text x="{cx(i)+CW/2:.0f}" y="{CY+CH/2+6:.0f}" font-family="{MONO}" font-size="18" font-weight="600" text-anchor="middle" fill="{tf}">{v}</text>\n'
        s+=f'  <text x="{cx(i)+CW/2:.0f}" y="{CY-14:.0f}" font-family="{MONO}" font-size="9" text-anchor="middle" fill="{DIM}">{i}</text>\n'
    # pointer arrows below
    def ptr(idx,label,off):
        px=cx(idx)+CW/2+off; py=CY+CH+8
        return (f'  <path d="M{px:.0f} {py+18:.0f} L{px-5:.0f} {py+26:.0f} L{px+5:.0f} {py+26:.0f} Z" fill="{INK}"/>\n'
                f'  <line x1="{px:.0f}" y1="{py:.0f}" x2="{px:.0f}" y2="{py+18:.0f}" stroke="{INK}" stroke-width="2"/>\n'
                f'  <text x="{px:.0f}" y="{py+40:.0f}" font-family="{MONO}" font-size="14" font-weight="700" text-anchor="middle" fill="{INK}">{label}</text>\n')
    if l==r:
        s+=ptr(l,"l",-8); s+=ptr(r,"r",8)
    else:
        s+=ptr(l,"l",0); s+=ptr(r,"r",0)
    return s
def head(sumval,K,ok,note):
    col=GREEN_S if ok else RED_S; mark="✓" if ok else "✗"
    s=f'  <text x="{W/2:.0f}" y="34" font-family="{MONO}" font-size="15" font-weight="700" text-anchor="middle" fill="{INK}">sum = {sumval}  {mark}  (K = {K})</text>\n'
    s+=f'  <text x="{W/2:.0f}" y="56" font-family="{FF}" font-size="12.5" font-weight="600" text-anchor="middle" fill="{col}">{esc(note)}</text>\n'
    return s
def svg(body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n  <rect width="{W}" height="{H}" fill="none"/>\n{body}</svg>\n'
stages=[
 ("tp-0.svg", head(2,7,True,"valid — expand r to grow the window")+cells(0,0,True)),
 ("tp-1.svg", head(8,7,False,"too big — the window is invalid")+cells(0,2,False)),
 ("tp-2.svg", head(6,7,True,"shrink l until valid — length 2 recorded")+cells(1,2,True)),
]
os.makedirs(OUT,exist_ok=True)
for fn,b in stages:
    open(os.path.join(OUT,fn),"w").write(svg(b)); print("wrote",fn)
