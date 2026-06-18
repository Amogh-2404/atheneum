#!/usr/bin/env python3
"""
gen-dp-figures.py  —  Pattern Codex, Part V (Dynamic Programming)

Hero figure for ch29 "DP Foundations": the single picture that explains *why*
DP exists. The same recurrence — climb(n) = climb(n-1) + climb(n-2) — drawn two
ways:

  LEFT   the naive recursion tree for climb(5): an exponential blow-up where the
         SAME subproblem (climb(3), climb(2), climb(1)) is recomputed again and
         again. The repeats are tinted gold so the waste is impossible to miss.
  RIGHT  the same recurrence as a 1-D DP table dp[0..5] = 1,1,2,3,5,8: every
         state is solved exactly once, left to right, each cell reading the two
         cells before it. State = a cell; transition = the two arrows in.

Memoize the left and you GET the right: exponential -> linear. House style and
helpers follow gen-ds-figures.py / gen-boot-figures.py.

Emits content/pattern-codex/dp-overlapping.svg
"""
import os, math

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "content", "pattern-codex")

INK   = "#3E4C63"; MID = "#5C6B82"; FAINT = "#7C8BA1"; DIM = "#AEB8C6"; HAIR = "#C3CCD8"
GOLD_F, GOLD_S = "#F4E2B0", "#C99A2E"
GREEN_F, GREEN_S = "#CDE8D6", "#3E8E5A"
SLATE_F, SLATE_S = "#E7ECF3", "#A9B6C8"
RED = "#C2603F"
WHITE = "#FFFFFF"
FF   = "ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

W, H = 384, 300


def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def txt(x, y, s, size=12, fill=INK, w=600, anchor="middle", fam=FF, op=1.0, ls=""):
    extra = f' letter-spacing="{ls}"' if ls else ""
    o = f' opacity="{op}"' if op != 1.0 else ""
    return (f'<text x="{x}" y="{y}" font-family="{fam}" font-weight="{w}" font-size="{size}" '
            f'text-anchor="{anchor}" fill="{fill}"{o}{extra}>{esc(s)}</text>\n')


def line(x1, y1, x2, y2, color=FAINT, sw=1.6, op=1.0, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    o = f' opacity="{op}"' if op != 1.0 else ""
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}"{d}{o}/>\n'


def ahead(x, y, ang, color, size=6):
    a = math.radians(ang)
    p1 = (x - size * math.cos(a - math.radians(28)), y - size * math.sin(a - math.radians(28)))
    p2 = (x - size * math.cos(a + math.radians(28)), y - size * math.sin(a + math.radians(28)))
    return f'<path d="M{x:.1f} {y:.1f} L{p1[0]:.1f} {p1[1]:.1f} L{p2[0]:.1f} {p2[1]:.1f} Z" fill="{color}"/>\n'


def node(cx, cy, label, fill, stroke, tcol=INK, r=14, sw=2.0):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
            f'<text x="{cx}" y="{cy+4.5:.1f}" font-family="{MONO}" font-weight="700" font-size="13" '
            f'text-anchor="middle" fill="{tcol}">{esc(label)}</text>\n')


def tree_edge(x1, y1, x2, y2, r=14):
    ang = math.atan2(y2 - y1, x2 - x1)
    sx, sy = x1 + r * math.cos(ang), y1 + r * math.sin(ang)
    ex, ey = x2 - r * math.cos(ang), y2 - r * math.sin(ang)
    return line(sx, sy, ex, ey, HAIR, 1.6)


def chip(cx, cy, s, fill=GOLD_F, stroke=GOLD_S, tcol=INK, fs=9.5, mono=False, pad=8, sw=1.3):
    fam = MONO if mono else FF
    w = len(s) * fs * (0.62 if mono else 0.55) + pad * 2
    h = fs + 9
    return (f'<rect x="{cx-w/2:.1f}" y="{cy-h/2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h/2:.1f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
            f'<text x="{cx}" y="{cy+fs*0.35:.1f}" font-family="{fam}" font-weight="600" font-size="{fs}" '
            f'text-anchor="middle" fill="{tcol}">{esc(s)}</text>\n')


def build():
    s = ""
    s += txt(W / 2, 20, "ONE RECURRENCE, TWO COSTS", 10, FAINT, 700, ls="1.3")
    s += txt(W / 2, 36, "climb(n) = climb(n−1) + climb(n−2)", 12.5, INK, 700, fam=MONO)

    # ---- LEFT: naive recursion tree for climb(5) -------------------------
    lx = 96  # left-panel centre
    s += txt(lx, 58, "naive recursion", 10, MID, 700)
    # geometry: argument value -> (x, y)
    L1 = (lx, 78)            # 5
    L2a, L2b = (lx - 44, 116), (lx + 44, 116)   # 4 , 3
    L3a, L3b = (lx - 66, 156), (lx - 22, 156)   # 3 , 2  (under 4)
    L3c, L3d = (lx + 22, 156), (lx + 66, 156)   # 2 , 1  (under 3)
    # edges
    for (a, b) in [(L1, L2a), (L1, L2b), (L2a, L3a), (L2a, L3b), (L2b, L3c), (L2b, L3d)]:
        s += tree_edge(a[0], a[1], b[0], b[1])
    # nodes: repeated subproblems (3, 2) tinted gold; others slate
    def n(pt, val, repeat):
        f, st, tc = (GOLD_F, GOLD_S, INK) if repeat else (SLATE_F, SLATE_S, MID)
        return node(pt[0], pt[1], val, f, st, tc)
    s += n(L1, "5", False)
    s += n(L2a, "4", False)
    s += n(L2b, "3", True)
    s += n(L3a, "3", True)     # climb(3) AGAIN
    s += n(L3b, "2", True)
    s += n(L3c, "2", True)     # climb(2) AGAIN
    s += n(L3d, "1", False)
    # "explodes further" ellipses under the L3 nodes
    for pt in (L3a, L3b, L3c):
        s += txt(pt[0], pt[1] + 30, "⋮", 13, DIM, 700)
    # callout: the duplicate climb(3)
    s += line(L2b[0], L2b[1] + 15, L3a[0], L3a[1] - 15, GOLD_S, 1.4, op=0.0)  # spacer (no-op)
    s += chip(lx, 200, "climb(3) twice · climb(2) 3× · …", fill="#FBEEDD", stroke=GOLD_S, tcol="#8A5A12", fs=9)
    s += chip(lx, 222, "≈ 2ⁿ calls — exponential", fill=WHITE, stroke=RED, tcol=RED, fs=9.5)

    # ---- centre: memoize arrow ------------------------------------------
    s += line(184, 150, 208, 150, GREEN_S, 2.4)
    s += ahead(208, 150, 0, GREEN_S, 7)
    s += txt(196, 142, "memoize", 9, GREEN_S, 700)
    s += txt(196, 165, "÷ huge", 8.5, FAINT, 600)

    # ---- RIGHT: the DP table dp[0..5] -----------------------------------
    rx0 = 224
    s += txt((rx0 + W - 8) / 2, 58, "one DP table", 10, MID, 700)
    vals = [1, 1, 2, 3, 5, 8]
    cw, ch = 24, 26
    gap = 2
    cy = 96
    xs = []
    for i, v in enumerate(vals):
        cx = rx0 + i * (cw + gap)
        xs.append(cx + cw / 2)
        base = i <= 1
        f, st, tc = (GREEN_F, GREEN_S, INK) if base else (GOLD_F, GOLD_S, INK)
        s += f'<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="5" fill="{f}" stroke="{st}" stroke-width="1.8"/>\n'
        s += f'<text x="{cx+cw/2:.1f}" y="{cy+ch/2+5:.1f}" font-family="{MONO}" font-weight="700" font-size="12" text-anchor="middle" fill="{tc}">{v}</text>\n'
        s += txt(cx + cw / 2, cy + ch + 13, str(i), 9, FAINT, 600)
    s += txt(rx0, cy - 8, "dp[i]", 9, FAINT, 700, anchor="start")
    # transition arrows into dp[5] from dp[4] and dp[3]  (the two cells before)
    top = cy - 4
    for src in (4, 3):
        x1, x2 = xs[src], xs[5]
        midy = top - 14 - (6 if src == 3 else 0)
        s += f'<path d="M{x1:.1f} {top:.1f} C {x1:.1f} {midy:.1f}, {x2:.1f} {midy:.1f}, {x2:.1f} {top:.1f}" fill="none" stroke="{GOLD_S}" stroke-width="1.7"/>\n'
        s += ahead(x2, top, 90, GOLD_S, 5)
    s += chip((rx0 + W - 8) / 2, cy + ch + 34, "state = a cell · transition = the 2 arrows in",
              fill="#FBEEDD", stroke=GOLD_S, tcol="#8A5A12", fs=8.5)
    s += chip((rx0 + W - 8) / 2, cy + ch + 56, "n states, each solved once — linear",
              fill=WHITE, stroke=GREEN_S, tcol=GREEN_S, fs=9.5)

    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n{s}</svg>\n')


def main():
    p = os.path.join(OUT, "dp-overlapping.svg")
    with open(p, "w") as f:
        f.write(build())
    print("wrote", p, len(build()), "bytes")


if __name__ == "__main__":
    main()
