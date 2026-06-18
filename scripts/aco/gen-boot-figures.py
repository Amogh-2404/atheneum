#!/usr/bin/env python3
"""
gen-boot-figures.py  —  runtime book, ch3 "How main Gets Called"

Rebuilds the chapter's hero scrollytelling figure. The old boot-0..3.svg were a
plain vertical flowchart (boxes + arrows, the active box turning green). This
replaces them with a real *call-stack-in-memory* visualization that actually
teaches the chapter:

  - the kernel builds a fresh stack (argc/argv/envp/auxv) and JUMPS to _start
    (a dashed one-way arrow — no return address is created);
  - a CALL pushes a return address (solid arrow down + a gold return-arc back
    up into the caller) — the jump-vs-call distinction the prose hammers on;
  - __libc_start_main walks .init_array, so your globals are constructed
    *before* main exists;
  - main is highlighted as a single frame in the MIDDLE of a stack you never
    wrote — a callback, not the entry point;
  - main's int return value travels up the return path into exit(), which runs
    atexit (LIFO) / .fini_array / the stdio flush, then _exit/exit_group hands
    the status to the kernel — a symmetric bookend to the opening jump.

Six stages, cross-faded by the scrolly-figure block. Light paper background to
match every other figure in the book; palette + helpers follow the house style
in gen-ds-figures.py / gen-ssa-scrolly.py.

Emits content/runtime/boot-0.svg .. boot-5.svg.
"""
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "content", "runtime")

# ── palette (house style) ────────────────────────────────────────────────
INK   = "#3E4C63"   # primary figure text
MID   = "#5C6B82"   # secondary text
FAINT = "#7C8BA1"   # labels / inert strokes
DIM   = "#AEB8C6"   # very faded
HAIR  = "#C3CCD8"   # hairlines
GOLD_F, GOLD_S = "#F4E2B0", "#C99A2E"   # YOUR code / the int value
GREEN_F, GREEN_S = "#CDE8D6", "#3E8E5A" # the running frame
SLATE_F = "#E7ECF3"   # inert frame fill (a touch lighter than DCE3EC)
SLATE_S = "#A9B6C8"
PAPER = "#F4F6F9"     # kernel band cells
WHITE = "#FFFFFF"
KFILL = "#E2E7EF"     # kernel band fill
FF   = "ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

W, H = 380, 480

# ── stack geometry — fixed slots so the stack feels STABLE across stages ──
SX, SW = 56, 212                 # stack column: x and width  (right edge = 268)
SR = SX + SW                     # 268
AXIS = 30                        # address axis x
# slot -> (y, height)
SLOT = {
    "kin":   (52, 44),           # kernel-built stack (high addresses)
    "start": (112, 44),          # _start (crt0)
    "libc":  (170, 58),          # __libc_start_main  (taller: ret row)
    "main":  (244, 54),          # main()  /  exit()  share this slot
    "kout":  (320, 44),          # _exit -> kernel (low ; status out)
}


# ── tiny svg helpers ─────────────────────────────────────────────────────
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def txt(x, y, s, size=13, fill=INK, w=600, anchor="middle", fam=FF, op=1.0, ls=""):
    extra = f' letter-spacing="{ls}"' if ls else ""
    o = f' opacity="{op}"' if op != 1.0 else ""
    return (f'<text x="{x}" y="{y}" font-family="{fam}" font-weight="{w}" '
            f'font-size="{size}" text-anchor="{anchor}" fill="{fill}"{o}{extra}>{esc(s)}</text>\n')


def rect(x, y, w, h, rx=8, fill="none", stroke="none", sw=2.0, op=1.0, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    o = f' opacity="{op}"' if op != 1.0 else ""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}{o}/>\n')


def line(x1, y1, x2, y2, color=FAINT, sw=2.0, op=1.0, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    o = f' opacity="{op}"' if op != 1.0 else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"{d}{o}/>\n'


def head(x, y, ang, color, size=7):
    """arrowhead path, ang in degrees pointing direction of travel."""
    import math
    a = math.radians(ang)
    p1 = (x - size * math.cos(a - math.radians(28)), y - size * math.sin(a - math.radians(28)))
    p2 = (x - size * math.cos(a + math.radians(28)), y - size * math.sin(a + math.radians(28)))
    return (f'<path d="M{x:.1f} {y:.1f} L{p1[0]:.1f} {p1[1]:.1f} L{p2[0]:.1f} {p2[1]:.1f} Z" '
            f'fill="{color}"/>\n')


def varrow(x, y1, y2, color=FAINT, sw=2.0, op=1.0, dash=None):
    """vertical arrow y1->y2."""
    ang = 90 if y2 > y1 else -90
    return line(x, y1, x, y2, color, sw, op, dash) + head(x, y2, ang, color)


def chip(cx, cy, s, fill=GOLD_F, stroke=GOLD_S, tfill=INK, fs=10.5, mono=False, pad=9, sw=1.4, op=1.0):
    fam = MONO if mono else FF
    w = len(s) * fs * (0.62 if mono else 0.56) + pad * 2
    h = fs + 11
    x, y = cx - w / 2, cy - h / 2
    o = f' opacity="{op}"' if op != 1.0 else ""
    return (f'<g{o}><rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h/2:.1f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
            f'<text x="{cx}" y="{cy + fs*0.35:.1f}" font-family="{fam}" font-weight="600" '
            f'font-size="{fs}" text-anchor="middle" fill="{tfill}">{esc(s)}</text></g>\n')


def reg(x, y, name, color=GOLD_S, to_left=True):
    """register pointer tag sitting in the right rail, arrow pointing into stack."""
    s = ""
    tx = x + 16
    s += f'<text x="{tx}" y="{y + 4}" font-family="{MONO}" font-weight="700" font-size="11.5" text-anchor="start" fill="{color}">{esc(name)}</text>\n'
    # little arrow from the tag toward the stack edge (leftwards)
    s += line(x + 12, y, x - 2, y, color, 2.0)
    s += head(x - 2, y, 180, color, 6)
    return s


def frame(slot, label, sub=None, state="inert", ret=None, label_mono=True):
    """draw a stack frame in `slot`.
    state: active | your | inert | ghost
    ret:   text for the return-address strip at top (or None)
    """
    y, h = SLOT[slot]
    if state == "active":
        fill, stroke, tcol, sw = GREEN_F, GREEN_S, INK, 2.6
    elif state == "your":
        fill, stroke, tcol, sw = GOLD_F, GOLD_S, INK, 2.8
    elif state == "ghost":
        fill, stroke, tcol, sw = KFILL, DIM, FAINT, 1.6
    else:
        fill, stroke, tcol, sw = SLATE_F, SLATE_S, MID, 2.0
    s = rect(SX, y, SW, h, 9, fill, stroke, sw)
    # return-address strip (the saved RA sits at the top of the callee region)
    body_top = y
    if ret is not None:
        rh = 17
        s += rect(SX + 6, y + 6, SW - 12, rh, 5, WHITE, stroke, 1.1, op=0.9)
        s += f'<text x="{SX+13}" y="{y+6+rh-5}" font-family="{MONO}" font-weight="600" font-size="9.5" text-anchor="start" fill="{MID}">↳ saved ret → {esc(ret)}</text>\n'
        body_top = y + 6 + rh
    # label
    cy = (body_top + y + h) / 2
    fam = MONO if label_mono else FF
    s += f'<text x="{(SX+SR)/2}" y="{cy + 5:.1f}" font-family="{fam}" font-weight="700" font-size="14" text-anchor="middle" fill="{tcol}">{esc(label)}</text>\n'
    if sub:
        s += txt((SX + SR) / 2, cy + 19, sub, 9.5, tcol if state in ("active", "your") else FAINT, 500)
    return s


def kernel_band(slot, label, cells, state="ghost", sub=None):
    y, h = SLOT[slot]
    if state == "active":
        fill, stroke, tcol = GREEN_F, GREEN_S, INK
    else:
        fill, stroke, tcol = KFILL, DIM, FAINT
    s = rect(SX, y, SW, h, 9, fill, stroke, 1.8 if state != "active" else 2.6)
    s += txt(SX + 10, y + 14, label, 9.5, tcol, 700, anchor="start")
    # mini cells
    n = len(cells)
    gap = 5
    cw = (SW - 16 - gap * (n - 1)) / n
    cx = SX + 8
    cyy = y + 20
    chh = h - 26
    for c in cells:
        s += rect(cx, cyy, cw, chh, 4, WHITE if state != "active" else "#EAF6EE", stroke, 1.1, op=0.95)
        s += f'<text x="{cx+cw/2:.1f}" y="{cyy+chh/2+4:.1f}" font-family="{MONO}" font-weight="600" font-size="10" text-anchor="middle" fill="{tcol}">{esc(c)}</text>\n'
        cx += cw + gap
    if sub:
        s += txt(SX + SW - 8, y + 14, sub, 9, tcol, 500, anchor="end")
    return s


def axis(low_hi=True):
    s = ""
    top, bot = SLOT["kin"][0] - 2, SLOT["kout"][0] + SLOT["kout"][1] + 2
    s += line(AXIS, top, AXIS, bot, HAIR, 1.6)
    s += txt(AXIS, top - 6, "HIGH", 8.5, FAINT, 700, ls="0.5")
    s += txt(AXIS, bot + 14, "LOW", 8.5, FAINT, 700, ls="0.5")
    # downward growth ticks
    s += head(AXIS, bot, 90, HAIR, 6)
    s += (f'<text x="{AXIS-2}" y="{(top+bot)/2:.0f}" font-family="{FF}" font-weight="600" '
          f'font-size="9" text-anchor="middle" fill="{FAINT}" transform="rotate(-90 {AXIS-2} {(top+bot)/2:.0f})">stack grows down ↓</text>\n')
    return s


def eyebrow(title):
    s = txt(W / 2, 22, "HOW main GETS CALLED", 9.5, FAINT, 700, ls="1.4")
    s += txt(W / 2, 40, title, 14.5, INK, 700)
    return s


def call_arc(y_from, y_to, color=GOLD_S):
    """gold return-arc on the right rail: from callee top (y_to) back up into
    caller (y_from) — visualizes the recorded return path of a CALL."""
    x0 = SR - 2          # leave from stack right edge near callee top
    x1 = SR + 30         # bulge into the rail
    s = (f'<path d="M{x0} {y_to} C {x1} {y_to}, {x1} {y_from}, {x0} {y_from}" '
         f'fill="none" stroke="{color}" stroke-width="1.8" stroke-dasharray="3,3" opacity="0.95"/>\n')
    s += head(x0, y_from + 0.5, 180, color, 6)
    s += txt((x1 + SR) / 2 + 6, (y_from + y_to) / 2 + 3, "ret", 8.5, color, 700, anchor="middle")
    return s


def svg(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n'
            f'{body}</svg>\n')


# ── stages ───────────────────────────────────────────────────────────────
def stage0():
    """kernel builds the stack and JUMPS to _start."""
    b = eyebrow("The kernel jumps in")
    b += axis()
    b += kernel_band("kin", "kernel-built stack", ["argc", "argv", "envp", "auxv"], sub="sets e_entry")
    ys = SLOT["start"][0]
    ykin_bot = SLOT["kin"][0] + SLOT["kin"][1]
    # the jump: a dashed ONE-WAY arrow from the kernel band into _start — no
    # return address is created (the whole point: reached by a jump, not a call)
    b += (f'<path d="M{SX+SW-36} {ykin_bot} C {SR+6} {ykin_bot+6}, {SR+6} {ys-6}, {SR-34} {ys-2}" '
          f'fill="none" stroke="{MID}" stroke-width="2" stroke-dasharray="5,4" opacity="0.9"/>\n')
    b += head(SR - 34, ys - 2, 118, MID, 7)
    b += txt(SR + 30, (ykin_bot + ys) / 2 - 4, "jmp", 9.5, MID, 700)
    b += txt(SR + 30, (ykin_bot + ys) / 2 + 8, "e_entry", 8, FAINT, 600, fam=MONO)
    b += frame("start", "_start", "crt0 · hand-written asm", state="active")
    # _start specifics: no return address, rbp tombstone
    b += reg(SR + 8, ys + 10, "%rsp", GOLD_S)
    b += chip(SX + SW / 2, ys + SLOT["start"][1] + 22, "no return address  ·  %rbp = 0  ⊥",
              fill="#FBEEDD", stroke=GOLD_S, tfill="#8A5A12", fs=9.5)
    # faint future frames (not yet pushed)
    for sl in ("libc", "main"):
        yy, hh = SLOT[sl]
        b += rect(SX, yy, SW, hh, 9, "none", HAIR, 1.4, dash="2,6", op=0.7)
    return svg(b)


def stage1():
    """_start CALLs __libc_start_main — a call pushes a return address."""
    b = eyebrow("A call records its way back")
    b += axis()
    b += kernel_band("kin", "kernel-built stack", ["argc", "argv", "envp", "auxv"])
    b += frame("start", "_start", "rbp = 0  ⊥", state="inert")
    b += frame("libc", "__libc_start_main", "the C runtime launcher", state="active",
               ret="_start")
    # call arrow down + gold return arc back up
    ystart_bot = SLOT["start"][0] + SLOT["start"][1]
    ylibc_top = SLOT["libc"][0]
    b += varrow((SX + SR) / 2, ystart_bot + 1, ylibc_top - 1, GREEN_S, 2.4)
    b += txt((SX + SR) / 2 - 26, (ystart_bot + ylibc_top) / 2 + 3, "call", 9, GREEN_S, 700)
    b += call_arc(ystart_bot - 6, ylibc_top + 14)
    b += reg(SR + 8, ylibc_top + 10, "%rsp", GOLD_S)
    b += chip(SX + SW / 2, SLOT["libc"][0] + SLOT["libc"][1] + 22,
              "TLS · malloc · stdio · atexit(rtld_fini)",
              fill="#FBEEDD", stroke=GOLD_S, tfill="#8A5A12", fs=9.5)
    yy, hh = SLOT["main"]
    b += rect(SX, yy, SW, hh, 9, "none", HAIR, 1.4, dash="2,6", op=0.7)
    return svg(b)


def stage2():
    """__libc_start_main walks .init_array — globals come alive before main."""
    b = eyebrow("Your globals wake up first")
    b += axis()
    b += kernel_band("kin", "kernel-built stack", ["argc", "argv", "envp", "auxv"])
    b += frame("start", "_start", state="inert")
    b += frame("libc", "__libc_start_main", "walking .init_array …", state="active",
               ret="_start")
    # the ctor table drawn in the (still empty) main slot region, full width
    yy, hh = SLOT["main"]
    ay = yy + 6
    b += txt(SX, ay - 2, ".init_array[]  — constructor table", 9.5, MID, 700, anchor="start")
    cells = ["&ctor", "&ctor", "&ctor"]
    n = len(cells)
    gap = 6
    cw = (SW - gap * (n - 1)) / n
    cx = SX
    cyy = ay + 6
    for i, c in enumerate(cells):
        on = i <= 1
        b += rect(cx, cyy, cw, 26, 5, GREEN_F if on else WHITE, GREEN_S if on else HAIR,
                  2.0 if on else 1.3)
        b += f'<text x="{cx+cw/2:.1f}" y="{cyy+17:.1f}" font-family="{MONO}" font-weight="600" font-size="10" text-anchor="middle" fill="{INK if on else FAINT}">{esc(c)}</text>\n'
        cx += cw + gap
    # sweep marker over the table
    sweep_x = SX + cw + gap + cw / 2
    b += varrow(sweep_x, cyy - 12, cyy - 1, GOLD_S, 2.2)
    # globals lighting up below
    gy = cyy + 38
    b += txt(SX, gy - 6, "global objects, constructed:", 9, FAINT, 600, anchor="start")
    for i, g in enumerate(["g_cfg", "registry"]):
        gx = SX + 8 + i * 104
        b += rect(gx, gy, 96, 22, 6, GREEN_F, GREEN_S, 1.8)
        b += f'<text x="{gx+48:.1f}" y="{gy+15:.1f}" font-family="{MONO}" font-weight="600" font-size="10" text-anchor="middle" fill="{INK}">{esc(g)} ✓</text>\n'
    b += chip(W / 2, gy + 56, "all of this runs BEFORE main()",
              fill="#FBEEDD", stroke=GOLD_S, tfill="#8A5A12", fs=9.5)
    return svg(b)


def stage3():
    """__libc_start_main CALLs main — the callback, one frame deep."""
    b = eyebrow("main() — the callback in the middle")
    b += axis()
    b += kernel_band("kin", "kernel-built stack", ["argc", "argv", "envp", "auxv"])
    b += frame("start", "_start", state="inert")
    b += frame("libc", "__libc_start_main", "holding your return value", state="inert",
               ret="_start")
    b += frame("main", "main(argc, argv)", "YOUR code", state="your", ret="__libc_start_main")
    ylibc_bot = SLOT["libc"][0] + SLOT["libc"][1]
    ymain_top = SLOT["main"][0]
    b += varrow((SX + SR) / 2, ylibc_bot + 1, ymain_top - 1, GOLD_S, 2.4)
    b += txt((SX + SR) / 2 - 26, (ylibc_bot + ymain_top) / 2 + 3, "call", 9, GOLD_S, 700)
    b += call_arc(ylibc_bot - 6, ymain_top + 14)
    b += reg(SR + 8, ymain_top + 10, "%rsp", GOLD_S)
    # halo ring around main
    yy, hh = SLOT["main"]
    b += rect(SX - 6, yy - 6, SW + 12, hh + 12, 12, "none", GOLD_S, 1.8, dash="5,4", op=0.8)
    b += chip(W / 2, yy + hh + 20, "one frame deep — not the entry point",
              fill="#FBEEDD", stroke=GOLD_S, tfill="#8A5A12", fs=9.5)
    # hint: main's own locals would grow further down
    b += txt(W / 2, yy + hh + 48, "main's own locals & callees grow ↓ from here", 9, FAINT, 500)
    return svg(b)


def stage4():
    """main returns its int -> exit() runs the teardown."""
    b = eyebrow("return 0  ≡  exit(0)")
    b += axis()
    b += kernel_band("kin", "kernel-built stack", ["argc", "argv", "envp", "auxv"])
    b += frame("start", "_start", state="inert")
    b += frame("libc", "__libc_start_main", "calls exit(status)", state="inert", ret="_start")
    # main slot now hosts exit()
    yy, hh = SLOT["main"]
    b += frame("main", "exit(0)", "graceful teardown", state="active")
    # the int value travelling up the return path (gold token)
    ymain_top = SLOT["main"][0]
    ylibc_bot = SLOT["libc"][0] + SLOT["libc"][1]
    b += call_arc(ylibc_bot - 6, ymain_top + 12, color=GOLD_S)
    b += chip(SR + 16, (ylibc_bot + ymain_top) / 2, "0", fill=GOLD_F, stroke=GOLD_S, tfill="#8A5A12",
              fs=11, mono=True, pad=7)
    # teardown checklist to the right / below the exit frame
    ty = yy + hh + 10
    for i, (lbl) in enumerate(["atexit handlers  (LIFO)", ".fini_array destructors", "flush every stdio buffer"]):
        ly = ty + i * 19
        b += f'<text x="{SX+8}" y="{ly}" font-family="{MONO}" font-weight="600" font-size="9.5" text-anchor="start" fill="{MID}">{esc("3 " if False else "")}</text>\n'
        b += txt(SX + 10, ly, "✓ " + lbl, 9.5, MID, 600, anchor="start")
    return svg(b)


def stage5():
    """_exit/exit_group hands the status to the kernel — symmetric bookend."""
    b = eyebrow("The kernel reclaims the process")
    b += axis()
    b += kernel_band("kin", "(address space being torn down)", ["argc", "argv", "envp", "auxv"],
                     state="ghost")
    # frames fading away
    for sl, lbl in (("start", "_start"), ("libc", "__libc_start_main"), ("main", "exit()")):
        yy, hh = SLOT[sl]
        b += rect(SX, yy, SW, hh, 9, SLATE_F, SLATE_S, 1.6, op=0.45)
        b += txt((SX + SR) / 2, (yy + hh / 2) + 5, lbl, 13, FAINT, 600, fam=MONO, op=0.55)
    # the status handed down to the kernel band at the bottom
    ymain_bot = SLOT["main"][0] + SLOT["main"][1]
    ykout = SLOT["kout"][0]
    b += varrow((SX + SR) / 2, ymain_bot + 2, ykout - 1, GREEN_S, 2.4)
    b += chip((SX + SR) / 2 + 30, (ymain_bot + ykout) / 2, "status 0", fill=GOLD_F, stroke=GOLD_S,
              tfill="#8A5A12", fs=10, mono=True, pad=7)
    b += kernel_band("kout", "_exit → exit_group syscall", ["kernel reaps  ·  parent woken"],
                     state="active")
    return svg(b)


def main():
    stages = [stage0(), stage1(), stage2(), stage3(), stage4(), stage5()]
    for i, s in enumerate(stages):
        path = os.path.join(OUT, f"boot-{i}.svg")
        with open(path, "w") as f:
            f.write(s)
        print(f"wrote {path}  ({len(s)} bytes)")


if __name__ == "__main__":
    main()
