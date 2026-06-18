#!/usr/bin/env python3
"""Marquee SVGs: binary-search predicate line + 2D prefix-sum inclusion-exclusion.
House palette."""
import os
OUT="content/pattern-codex"; FF="ui-sans-serif, system-ui, -apple-system, sans-serif"; MONO="ui-monospace, SFMono-Regular, Menlo, monospace"
INK="#3E4C63"; MID="#5C6B82"; FAINT="#7C8BA1"; DIM="#C3CCD8"
GOLD_F="#F4E2B0"; GOLD_S="#C99A2E"; GREEN_F="#CDE8D6"; GREEN_S="#3E8E5A"; RED_F="#F6D6CE"; RED_S="#C0563B"; WHITE="#FFFFFF"
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

# ---------- Binary search: feasible(x) flips false -> true once ----------
def bs_fig():
    W,H=360,210
    bx0,bx1,by=30,330,86; bnd=222; bh=40
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n  <rect width="{W}" height="{H}" fill="none"/>\n'
    # infeasible (left, red) / feasible (right, green)
    s+=f'  <rect x="{bx0}" y="{by}" width="{bnd-bx0}" height="{bh}" rx="5" fill="{RED_F}" stroke="{RED_S}" stroke-width="2"/>\n'
    s+=f'  <rect x="{bnd}" y="{by}" width="{bx1-bnd}" height="{bh}" rx="5" fill="{GREEN_F}" stroke="{GREEN_S}" stroke-width="2"/>\n'
    # false/true ticks inside
    for i,xx in enumerate(range(bx0+24,bnd-10,48)):
        s+=f'  <text x="{xx}" y="{by+bh/2+4:.0f}" font-family="{MONO}" font-size="11" text-anchor="middle" fill="{RED_S}">F</text>\n'
    for i,xx in enumerate(range(bnd+22,bx1-6,44)):
        s+=f'  <text x="{xx}" y="{by+bh/2+4:.0f}" font-family="{MONO}" font-size="11" text-anchor="middle" fill="{GREEN_S}">T</text>\n'
    # region labels
    s+=f'  <text x="{(bx0+bnd)/2:.0f}" y="{by-12:.0f}" font-family="{FF}" font-size="11.5" font-weight="600" text-anchor="middle" fill="{RED_S}">infeasible — x too small</text>\n'
    s+=f'  <text x="{(bnd+bx1)/2:.0f}" y="{by-12:.0f}" font-family="{FF}" font-size="11.5" font-weight="600" text-anchor="middle" fill="{GREEN_S}">feasible</text>\n'
    # lo / hi end labels
    s+=f'  <text x="{bx0}" y="{by+bh+18:.0f}" font-family="{MONO}" font-size="11" text-anchor="middle" fill="{FAINT}">lo</text>\n'
    s+=f'  <text x="{bx1}" y="{by+bh+18:.0f}" font-family="{MONO}" font-size="11" text-anchor="middle" fill="{FAINT}">hi</text>\n'
    # boundary marker (the answer)
    s+=f'  <line x1="{bnd}" y1="{by-4}" x2="{bnd}" y2="{by+bh+22}" stroke="{GOLD_S}" stroke-width="2.5"/>\n'
    s+=f'  <path d="M{bnd} {by+bh+30} l-6 -9 l12 0 Z" fill="{GOLD_S}"/>\n'
    s+=f'  <rect x="{bnd-78:.0f}" y="{by+bh+34:.0f}" width="156" height="22" rx="11" fill="{GOLD_F}" stroke="{GOLD_S}" stroke-width="1.4"/>\n'
    s+=f'  <text x="{bnd:.0f}" y="{by+bh+49:.0f}" font-family="{FF}" font-size="11" font-weight="700" text-anchor="middle" fill="{INK}">answer = smallest feasible x</text>\n'
    # titles
    s+=f'  <text x="{W/2:.0f}" y="34" font-family="{FF}" font-size="14.5" font-weight="700" text-anchor="middle" fill="{INK}">feasible(x) flips false → true exactly once</text>\n'
    s+=f'  <text x="{W/2:.0f}" y="54" font-family="{FF}" font-size="11.5" text-anchor="middle" fill="{FAINT}">so you can binary-search the boundary instead of scanning every x</text>\n'
    s+='</svg>\n'; return s

# ---------- 2D prefix sum inclusion-exclusion ----------
def ps_fig():
    W,H=340,360
    n=5; cell=44; x0=46; y0=64
    def cx(c): return x0+c*cell
    def cy(r): return y0+r*cell
    r1,c1,r2,c2=2,2,4,4    # query rectangle (1-indexed cells r1..r2, c1..c2)
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n  <rect width="{W}" height="{H}" fill="none"/>\n'
    # grid cells (rows 0..n cols 0..n; row/col 0 = zero border)
    for r in range(0,n+1):
        for c in range(0,n+1):
            border = (r==0 or c==0)
            inq = (r1<=r<=r2 and c1<=c<=c2)
            fill = "#EEF1F5" if border else (GOLD_F if inq else WHITE)
            stroke = DIM if border else (GOLD_S if inq else "#D8DEE7")
            s+=f'  <rect x="{cx(c)}" y="{cy(r)}" width="{cell}" height="{cell}" fill="{fill}" stroke="{stroke}" stroke-width="1.4"/>\n'
    # index headers
    for c in range(0,n+1):
        s+=f'  <text x="{cx(c)+cell/2:.0f}" y="{y0-8:.0f}" font-family="{MONO}" font-size="10" text-anchor="middle" fill="{FAINT}">{c}</text>\n'
    for r in range(0,n+1):
        s+=f'  <text x="{x0-10:.0f}" y="{cy(r)+cell/2+4:.0f}" font-family="{MONO}" font-size="10" text-anchor="middle" fill="{FAINT}">{r}</text>\n'
    # corner markers: +(r2,c2)  -(r1-1,c2)  -(r2,c1-1)  +(r1-1,c1-1)
    def corner(r,c,sign,col,colf):
        px,py=cx(c)+cell,cy(r)+cell  # bottom-right lattice point of cell (r,c) == P[r][c] coordinate
        s2=f'  <circle cx="{px}" cy="{py}" r="11" fill="{colf}" stroke="{col}" stroke-width="2"/>\n'
        s2+=f'  <text x="{px}" y="{py+4:.0f}" font-family="{FF}" font-size="13" font-weight="700" text-anchor="middle" fill="{col}">{sign}</text>\n'
        return s2
    s+=corner(r2,c2,"+",GREEN_S,GREEN_F)
    s+=corner(r1-1,c2,"−",RED_S,RED_F)
    s+=corner(r2,c1-1,"−",RED_S,RED_F)
    s+=corner(r1-1,c1-1,"+",GREEN_S,GREEN_F)
    # title + formula
    s+=f'  <text x="{W/2:.0f}" y="30" font-family="{FF}" font-size="14.5" font-weight="700" text-anchor="middle" fill="{INK}">2D prefix sum: a rectangle in O(1)</text>\n'
    s+=f'  <text x="{W/2:.0f}" y="48" font-family="{FF}" font-size="11" text-anchor="middle" fill="{FAINT}">four corners, inclusion–exclusion (gold = the queried submatrix)</text>\n'
    fy=cy(n+1)+18
    s+=f'  <text x="{W/2:.0f}" y="{fy:.0f}" font-family="{MONO}" font-size="11.5" font-weight="600" text-anchor="middle" fill="{INK}">sum = P[r2][c2] − P[r1−1][c2] − P[r2][c1−1] + P[r1−1][c1−1]</text>\n'
    s+='</svg>\n'; return s

os.makedirs(OUT,exist_ok=True)
open(os.path.join(OUT,"bs-predicate.svg"),"w").write(bs_fig()); print("wrote bs-predicate.svg")
open(os.path.join(OUT,"ps-2d.svg"),"w").write(ps_fig()); print("wrote ps-2d.svg")
