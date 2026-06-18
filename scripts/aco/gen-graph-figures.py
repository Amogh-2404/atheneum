#!/usr/bin/env python3
"""Hero figures for The Pattern Codex, Part IV (Graphs). House palette.
  bfs-layers.svg     ch19 - BFS explores in concentric distance layers
  dijkstra-graph.svg ch20 - Dijkstra's finalized shortest-path tree + dist labels
"""
import os, math
OUT = "content/pattern-codex"
FF = "ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"
INK = "#3E4C63"; MID = "#5C6B82"; FAINT = "#7C8BA1"; DIM = "#C3CCD8"
GOLD_F = "#F4E2B0"; GOLD_S = "#C99A2E"
GREEN_F = "#CDE8D6"; GREEN_S = "#3E8E5A"
SLATE_F = "#DCE3EC"; WHITE = "#FFFFFF"; PAPER = "#F4F6F9"
R = 17


def head(W, H):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'fill="none">\n  <rect width="{W}" height="{H}" fill="none"/>\n')


def title(s, W, t, sub, y=26):
    s += (f'  <text x="{W/2:.0f}" y="{y}" font-family="{FF}" font-size="14.5" '
          f'font-weight="700" text-anchor="middle" fill="{INK}">{t}</text>\n')
    s += (f'  <text x="{W/2:.0f}" y="{y+18}" font-family="{FF}" font-size="11" '
          f'text-anchor="middle" fill="{FAINT}">{sub}</text>\n')
    return s


def node(cx, cy, label, fill, stroke, tcol=INK, r=R):
    out = (f'  <circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" '
           f'stroke="{stroke}" stroke-width="2.2"/>\n')
    out += (f'  <text x="{cx}" y="{cy+5:.0f}" font-family="{MONO}" font-size="14" '
            f'font-weight="700" text-anchor="middle" fill="{tcol}">{label}</text>\n')
    return out


def edge(p, q, col, w, directed=False, weight=None, lift=0):
    """Straight edge between node centers p,q, trimmed to the rims."""
    x1, y1 = p; x2, y2 = q
    ang = math.atan2(y2 - y1, x2 - x1)
    sx, sy = x1 + R * math.cos(ang), y1 + R * math.sin(ang)
    ex, ey = x2 - R * math.cos(ang), y2 - R * math.sin(ang)
    out = (f'  <line x1="{sx:.1f}" y1="{sy:.1f}" x2="{ex:.1f}" y2="{ey:.1f}" '
           f'stroke="{col}" stroke-width="{w}"/>\n')
    if directed:
        a1, a2, sz = ang + math.radians(152), ang - math.radians(152), 9
        out += (f'  <path d="M{ex:.1f} {ey:.1f} '
                f'L{ex+sz*math.cos(a1):.1f} {ey+sz*math.sin(a1):.1f} '
                f'L{ex+sz*math.cos(a2):.1f} {ey+sz*math.sin(a2):.1f} Z" '
                f'fill="{col}"/>\n')
    if weight is not None:
        mx, my = (sx + ex) / 2, (sy + ey) / 2
        # offset the weight label perpendicular to the edge
        nx, ny = -math.sin(ang), math.cos(ang)
        wx, wy = mx + nx * 12 + lift * nx, my + ny * 12 + lift * ny
        out += (f'  <circle cx="{wx:.1f}" cy="{wy:.1f}" r="9.5" fill="{WHITE}" '
                f'stroke="{col}" stroke-width="1.3"/>\n')
        out += (f'  <text x="{wx:.1f}" y="{wy+4:.1f}" font-family="{MONO}" '
                f'font-size="11" font-weight="700" text-anchor="middle" '
                f'fill="{INK}">{weight}</text>\n')
    return out


# ---------- ch19: BFS distance layers (matches ch19 blk_bd08 example) ----------
def bfs_fig():
    W, H = 440, 304
    s = head(W, H)
    s = title(s, W, "BFS explores in layers",
              "a queue visits every node at distance d before any at d+1")
    # exact graph from the chapter: edges 0-1,0-2,1-3,2-3,3-4; vertex 5 isolated
    pos = {0: (66, 150), 1: (174, 98), 2: (174, 202), 3: (282, 150), 4: (390, 150)}
    dist = {0: 0, 1: 1, 2: 1, 3: 2, 4: 3}
    all_edges = [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4)]
    tree = {(0, 1), (0, 2), (1, 3), (3, 4)}   # discovery edges; 2-3 is non-tree

    col_x = {0: 66, 1: 174, 2: 282, 3: 390}
    for d, x in col_x.items():
        s += (f'  <line x1="{x}" y1="70" x2="{x}" y2="248" stroke="{DIM}" '
              f'stroke-width="1" stroke-dasharray="2 5" opacity="0.6"/>\n')
        s += (f'  <text x="{x}" y="64" font-family="{FF}" font-size="10.5" '
              f'font-weight="600" text-anchor="middle" fill="{FAINT}">dist {d}</text>\n')

    for (a, b) in all_edges:
        on = (a, b) in tree or (b, a) in tree
        s += edge(pos[a], pos[b], GOLD_S if on else DIM, 2.4 if on else 1.4)
    for v, p in pos.items():
        fill, stroke = (GREEN_F, GREEN_S) if v == 0 else (SLATE_F, FAINT)
        s += node(p[0], p[1], str(v), fill, stroke, INK)
        s += (f'  <text x="{p[0]}" y="{p[1]+30:.0f}" font-family="{MONO}" '
              f'font-size="9.5" text-anchor="middle" fill="{GOLD_S}">d={dist[v]}</text>\n')
    # isolated vertex 5, off in its own component
    ix, iy = 220, 264
    s += (f'  <circle cx="{ix}" cy="{iy}" r="{R}" fill="{WHITE}" stroke="{DIM}" '
          f'stroke-width="2" stroke-dasharray="3 3"/>\n')
    s += (f'  <text x="{ix}" y="{iy+5}" font-family="{MONO}" font-size="14" '
          f'font-weight="700" text-anchor="middle" fill="{FAINT}">5</text>\n')
    s += (f'  <text x="{ix+26}" y="{iy+4}" font-family="{FF}" font-size="10" '
          f'text-anchor="start" fill="{FAINT}">no edges → d = −1 (unreachable)</text>\n')
    s += (f'  <text x="{W/2:.0f}" y="298" font-family="{FF}" font-size="10" '
          f'text-anchor="middle" fill="{FAINT}">gold = the BFS tree; edge 2–3 is '
          f'skipped (3 was already reached via 1)</text>\n')
    s += '</svg>\n'
    return s


# ---------- ch20: Dijkstra shortest-path tree ----------
def dijkstra_fig():
    # exact graph from ch20 blk_dk08: edges 0->1(2),0->2(5),1->2(1),1->3(7),
    # 2->3(3),2->4(8),3->4(2); final dist [0,2,3,6,8]; SP-tree path 0->1->2->3->4
    W, H = 460, 322
    s = head(W, H)
    s = title(s, W, "Dijkstra finalizes the nearest node first",
              "relax edges; the gold tree is the final shortest paths from 0")
    pos = {0: (74, 168), 1: (198, 92), 2: (214, 250), 3: (344, 150), 4: (398, 256)}
    edges = [(0, 1, 2), (0, 2, 5), (1, 2, 1), (1, 3, 7),
             (2, 3, 3), (2, 4, 8), (3, 4, 2)]
    tree = {(0, 1), (1, 2), (2, 3), (3, 4)}     # shortest-path tree edges
    dist = {0: 0, 1: 2, 2: 3, 3: 6, 4: 8}

    for (a, b, w) in edges:
        on = (a, b) in tree
        s += edge(pos[a], pos[b], GOLD_S if on else DIM,
                  2.6 if on else 1.5, directed=True, weight=w)
    for v, p in pos.items():
        fill, stroke = (GREEN_F, GREEN_S) if v == 0 else (GOLD_F, GOLD_S)
        s += node(p[0], p[1], str(v), fill, stroke, INK)
        # place the dist tag above for top nodes, below for bottom ones
        dy = -24 if p[1] < 170 else 32
        s += (f'  <text x="{p[0]}" y="{p[1]+dy:.0f}" font-family="{MONO}" '
              f'font-size="10.5" font-weight="700" text-anchor="middle" '
              f'fill="{GREEN_S}">d={dist[v]}</text>\n')
    s += (f'  <text x="{W/2:.0f}" y="{H-10}" font-family="{FF}" font-size="10" '
          f'text-anchor="middle" fill="{FAINT}">vertex 2 settles at d=3 via 0→1→2 — '
          f'cheaper than the direct 0→2 of weight 5</text>\n')
    s += '</svg>\n'
    return s


os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "bfs-layers.svg"), "w").write(bfs_fig())
print("wrote bfs-layers.svg")
open(os.path.join(OUT, "dijkstra-graph.svg"), "w").write(dijkstra_fig())
print("wrote dijkstra-graph.svg")
