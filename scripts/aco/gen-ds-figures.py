#!/usr/bin/env python3
"""Hero figures for The Pattern Codex, Part III (Data Structures). House palette.
  dsu-forest.svg       ch12 - path compression flattens a chain into a star
  fenwick-ranges.svg   ch13 - which prefix range each bit[i] is responsible for
  segtree-structure.svg ch14 - a range query splits into O(log n) canonical nodes
"""
import os
OUT = "content/pattern-codex"
FF = "ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"
INK = "#3E4C63"; MID = "#5C6B82"; FAINT = "#7C8BA1"; DIM = "#C3CCD8"
GOLD_F = "#F4E2B0"; GOLD_S = "#C99A2E"
GREEN_F = "#CDE8D6"; GREEN_S = "#3E8E5A"
SLATE_F = "#DCE3EC"; WHITE = "#FFFFFF"; PAPER = "#F4F6F9"


def head(W, H):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'fill="none">\n  <rect width="{W}" height="{H}" fill="none"/>\n')


def title(s, W, t, sub, y=26):
    s += (f'  <text x="{W/2:.0f}" y="{y}" font-family="{FF}" font-size="14.5" '
          f'font-weight="700" text-anchor="middle" fill="{INK}">{t}</text>\n')
    s += (f'  <text x="{W/2:.0f}" y="{y+18}" font-family="{FF}" font-size="11" '
          f'text-anchor="middle" fill="{FAINT}">{sub}</text>\n')
    return s


# ---------- ch12: DSU path compression ----------
def dsu_fig():
    W, H = 360, 268
    s = head(W, H)
    s = title(s, W, "Path compression", "find(3) flattens the chain to the root in one stroke")
    r = 15

    def node(cx, cy, label, fill, stroke, tcol=INK):
        out = (f'  <circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" '
               f'stroke="{stroke}" stroke-width="2"/>\n')
        out += (f'  <text x="{cx}" y="{cy+5:.0f}" font-family="{MONO}" '
                f'font-size="14" font-weight="700" text-anchor="middle" '
                f'fill="{tcol}">{label}</text>\n')
        return out

    def edge(x1, y1, x2, y2, col=FAINT):
        # child (x1,y1) -> parent (x2,y2), arrow stops at parent rim
        import math
        ang = math.atan2(y2 - y1, x2 - x1)
        ex, ey = x2 - (r + 3) * math.cos(ang), y2 - (r + 3) * math.sin(ang)
        sx, sy = x1 + (r + 2) * math.cos(ang), y1 + (r + 2) * math.sin(ang)
        out = (f'  <line x1="{sx:.0f}" y1="{sy:.0f}" x2="{ex:.0f}" y2="{ey:.0f}" '
               f'stroke="{col}" stroke-width="2"/>\n')
        a1, a2, sz = ang + math.radians(150), ang - math.radians(150), 7
        out += (f'  <path d="M{ex:.0f} {ey:.0f} '
                f'L{ex+sz*math.cos(a1):.0f} {ey+sz*math.sin(a1):.0f} '
                f'L{ex+sz*math.cos(a2):.0f} {ey+sz*math.sin(a2):.0f} Z" '
                f'fill="{col}"/>\n')
        return out

    # ----- LEFT: the chain (before) -----
    lx = 70
    ys = [72, 122, 172, 222]   # nodes 0(root),1,2,3 top->bottom
    s += f'  <text x="{lx}" y="56" font-family="{FF}" font-size="11" font-weight="600" text-anchor="middle" fill="{MID}">before</text>\n'
    s += edge(lx, ys[1], lx, ys[0])      # 1 -> 0
    s += edge(lx, ys[2], lx, ys[1])      # 2 -> 1
    s += edge(lx, ys[3], lx, ys[2])      # 3 -> 2
    s += node(lx, ys[0], "0", GREEN_F, GREEN_S)
    s += node(lx, ys[1], "1", SLATE_F, FAINT)
    s += node(lx, ys[2], "2", SLATE_F, FAINT)
    s += node(lx, ys[3], "3", GOLD_F, GOLD_S)
    s += f'  <text x="{lx}" y="248" font-family="{FF}" font-size="9.5" text-anchor="middle" fill="{FAINT}">find walks 3 hops to root</text>\n'

    # ----- middle arrow -----
    import math
    mx0, mx1, my = 110, 196, 150
    s += f'  <line x1="{mx0}" y1="{my}" x2="{mx1}" y2="{my}" stroke="{GOLD_S}" stroke-width="2.5"/>\n'
    s += f'  <path d="M{mx1} {my} l-9 -6 l0 12 Z" fill="{GOLD_S}"/>\n'
    s += f'  <text x="{(mx0+mx1)/2:.0f}" y="{my-10}" font-family="{FF}" font-size="10.5" font-weight="700" text-anchor="middle" fill="{GOLD_S}">find(3)</text>\n'
    s += f'  <text x="{(mx0+mx1)/2:.0f}" y="{my+18}" font-family="{FF}" font-size="9.5" text-anchor="middle" fill="{FAINT}">re-point every</text>\n'
    s += f'  <text x="{(mx0+mx1)/2:.0f}" y="{my+30}" font-family="{FF}" font-size="9.5" text-anchor="middle" fill="{FAINT}">hop to root</text>\n'

    # ----- RIGHT: the star (after) -----
    rxc, ry0 = 280, 92
    leaf_y = 192
    leaves = [(245, "1"), (280, "2"), (315, "3")]
    s += f'  <text x="{rxc}" y="56" font-family="{FF}" font-size="11" font-weight="600" text-anchor="middle" fill="{MID}">after</text>\n'
    for (lxp, lab) in leaves:
        col = GOLD_S if lab == "3" else FAINT
        s += edge(lxp, leaf_y, rxc, ry0, col)
    s += node(rxc, ry0, "0", GREEN_F, GREEN_S)
    for (lxp, lab) in leaves:
        fill = GOLD_F if lab == "3" else SLATE_F
        st = GOLD_S if lab == "3" else FAINT
        s += node(lxp, leaf_y, lab, fill, st)
    s += f'  <text x="{rxc}" y="224" font-family="{FF}" font-size="9.5" text-anchor="middle" fill="{FAINT}">every later find is one hop</text>\n'
    s += '</svg>\n'
    return s


# ---------- ch13: Fenwick responsibility ranges ----------
def fenwick_fig():
    n = 8
    cell = 38
    x0 = 26
    W = x0 * 2 + n * cell
    rowh = 23
    gap = 7
    base = 214          # baseline y (index row)
    H = 256
    s = head(W, H)
    s = title(s, W, "What each bit[i] covers", "bit[i] holds the sum of the range [i−lowbit(i)+1 .. i]")
    # worked descent annotation in the headroom
    s += (f'  <text x="{W/2:.0f}" y="62" font-family="{MONO}" font-size="11" '
          f'text-anchor="middle" fill="{GOLD_S}">prefix(7) = bit[7] + bit[6] + bit[4]'
          f'</text>\n')
    s += (f'  <text x="{W/2:.0f}" y="76" font-family="{FF}" font-size="9.5" '
          f'text-anchor="middle" fill="{FAINT}">'
          f'(strip the lowest set bit each step: 7 → 6 → 4 → 0)</text>\n')

    def lowbit(i):
        return i & (-i)

    def colx(c):       # left edge of 1-indexed column c
        return x0 + (c - 1) * cell

    # baseline + index labels (1..n) and the underlying array cells
    for c in range(1, n + 1):
        s += (f'  <rect x="{colx(c)}" y="{base}" width="{cell}" height="26" '
              f'fill="{PAPER}" stroke="{DIM}" stroke-width="1.2"/>\n')
        s += (f'  <text x="{colx(c)+cell/2:.0f}" y="{base+17:.0f}" '
              f'font-family="{MONO}" font-size="12" text-anchor="middle" '
              f'fill="{FAINT}">{c}</text>\n')

    level_col = {1: (SLATE_F, FAINT), 2: (GREEN_F, GREEN_S),
                 4: (GOLD_F, GOLD_S), 8: (GOLD_F, GOLD_S)}
    import math
    for i in range(1, n + 1):
        lb = lowbit(i)
        lvl = int(math.log2(lb))         # 0,1,2,3
        lo = i - lb + 1
        y = base - gap - (lvl + 1) * (rowh + 4)
        x = colx(lo)
        wdt = (i - lo + 1) * cell
        fill, stroke = level_col[lb]
        s += (f'  <rect x="{x+2}" y="{y}" width="{wdt-4}" height="{rowh}" rx="5" '
              f'fill="{fill}" stroke="{stroke}" stroke-width="1.8"/>\n')
        s += (f'  <text x="{x+wdt/2:.0f}" y="{y+15:.0f}" font-family="{MONO}" '
              f'font-size="11" font-weight="700" text-anchor="middle" '
              f'fill="{INK}">bit[{i}]</text>\n')
    s += (f'  <text x="{W/2:.0f}" y="{H-8}" font-family="{FF}" font-size="9.5" '
          f'text-anchor="middle" fill="{FAINT}">'
          f'wider bar = bigger lowbit; a prefix sums the bars that tile [1..i]</text>\n')
    s += '</svg>\n'
    return s


# ---------- ch14: segment tree query decomposition ----------
def segtree_fig():
    # tree over indices 0..7; highlight query [2,5] -> canonical nodes [2,3],[4,5]
    leaves = 8
    nodes = []   # (lo,hi,depth,x,y)
    leaf_w = 50
    x_left = 30
    top = 64
    dy = 46
    leaf_x = [x_left + i * leaf_w + leaf_w / 2 for i in range(leaves)]

    pos = {}

    def build(lo, hi, depth):
        if lo == hi:
            x = leaf_x[lo]
        else:
            mid = (lo + hi) // 2
            xl = build(lo, mid, depth + 1)
            xr = build(mid + 1, hi, depth + 1)
            x = (xl + xr) / 2
        y = top + depth * dy
        pos[(lo, hi)] = (x, y, depth)
        return x

    build(0, 7, 0)
    W = x_left * 2 + leaves * leaf_w - 2 * (leaf_w - leaf_w)  # = x_left*2 + leaves*leaf_w
    W = int(x_left * 2 + leaves * leaf_w)
    H = top + 4 * dy + 48
    s = head(W, H)
    s = title(s, W, "A range splits into O(log n) nodes",
              "query [2,5] is covered by just the gold nodes [2,3] and [4,5]")

    returned = {(2, 3), (4, 5)}
    path = {(0, 7), (0, 3), (4, 7)}     # visited en route

    # edges first
    def children(lo, hi):
        if lo == hi:
            return []
        mid = (lo + hi) // 2
        return [(lo, mid), (mid + 1, hi)]

    for (lo, hi), (x, y, d) in pos.items():
        for (clo, chi) in children(lo, hi):
            cx, cy, cd = pos[(clo, chi)]
            on = ((lo, hi) in path or (lo, hi) in returned) and \
                 ((clo, chi) in path or (clo, chi) in returned)
            col = GOLD_S if on else DIM
            wd = 2.2 if on else 1.3
            s += (f'  <line x1="{x:.0f}" y1="{y+12:.0f}" x2="{cx:.0f}" '
                  f'y2="{cy-12:.0f}" stroke="{col}" stroke-width="{wd}"/>\n')

    # nodes
    bw, bh = 42, 24
    for (lo, hi), (x, y, d) in pos.items():
        if (lo, hi) in returned:
            fill, stroke, tcol = GOLD_F, GOLD_S, INK
        elif (lo, hi) in path:
            fill, stroke, tcol = WHITE, GOLD_S, INK
        else:
            fill, stroke, tcol = WHITE, DIM, FAINT
        label = f"{lo}" if lo == hi else f"{lo}-{hi}"
        s += (f'  <rect x="{x-bw/2:.0f}" y="{y-bh/2:.0f}" width="{bw}" '
              f'height="{bh}" rx="6" fill="{fill}" stroke="{stroke}" '
              f'stroke-width="{2 if (lo,hi) in returned or (lo,hi) in path else 1.3}"/>\n')
        s += (f'  <text x="{x:.0f}" y="{y+4:.0f}" font-family="{MONO}" '
              f'font-size="11" font-weight="{700 if (lo,hi) in returned else 600}" '
              f'text-anchor="middle" fill="{tcol}">{label}</text>\n')
    s += (f'  <text x="{W/2:.0f}" y="{H-12}" font-family="{FF}" font-size="10" '
          f'text-anchor="middle" fill="{FAINT}">recursion stops at a node fully '
          f'inside the query (gold) and never enters disjoint ones</text>\n')
    s += '</svg>\n'
    return s


os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "dsu-forest.svg"), "w").write(dsu_fig())
print("wrote dsu-forest.svg")
open(os.path.join(OUT, "fenwick-ranges.svg"), "w").write(fenwick_fig())
print("wrote fenwick-ranges.svg")
open(os.path.join(OUT, "segtree-structure.svg"), "w").write(segtree_fig())
print("wrote segtree-structure.svg")
