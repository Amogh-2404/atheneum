#!/usr/bin/env python3
"""Generate the 6-stage SSA-construction scrollytelling SVGs for qualcomm-compiler ch5.
One CFG layout (the book's loop_max example), progressive overlays per stage so the
scrolly cross-fade lines up to the pixel. Palette matches the runtime book's gc/boot SVGs.
"""
import math, os

OUT = "content/qualcomm-compiler"
FF = "ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

# palette (house style)
INK="#3E4C63"; MID="#5C6B82"; FAINT="#7C8BA1"; DIM="#AEB8C6"
GOLD_F="#F4E2B0"; GOLD_S="#C99A2E"
GREEN_F="#CDE8D6"; GREEN_S="#3E8E5A"
BLUE_F="#D6E2F2"; BLUE_S="#4B79B0"
WHITE="#FFFFFF"

W,H = 360,452

# --- CFG node geometry: (cx, cy, w, h) ---
N = {
 "entry":    (150, 40, 104, 30),
 "for.cond": (150,118, 120, 36),
 "for.body": (150,198, 120, 32),
 "if.then":  (288,244,  82, 30),
 "if.end":   (150,276, 110, 32),
 "for.inc":  (150,352, 110, 30),
 "for.end":  (302, 80,  70, 28),
}
def L(n): cx,cy,w,h=N[n]; return (cx-w/2,cy)
def R(n): cx,cy,w,h=N[n]; return (cx+w/2,cy)
def T(n): cx,cy,w,h=N[n]; return (cx,cy-h/2)
def B(n): cx,cy,w,h=N[n]; return (cx,cy+h/2)

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

def arrow(x1,y1,x2,y2,color,sw=1.8,op=1.0,dash=None,head=True,shorten=3):
    ang=math.atan2(y2-y1,x2-x1)
    if shorten:
        x2-=shorten*math.cos(ang); y2-=shorten*math.sin(ang)
    d=f' stroke-dasharray="{dash}"' if dash else ""
    s=f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}" opacity="{op}"{d}/>\n'
    if head:
        sz=7.5; a1=ang+math.radians(150); a2=ang-math.radians(150)
        p1=(x2+sz*math.cos(a1), y2+sz*math.sin(a1)); p2=(x2+sz*math.cos(a2), y2+sz*math.sin(a2))
        s+=f'  <path d="M{x2:.1f} {y2:.1f} L{p1[0]:.1f} {p1[1]:.1f} L{p2[0]:.1f} {p2[1]:.1f} Z" fill="{color}" opacity="{op}"/>\n'
    return s

def curve(x1,y1,cx1,cy1,cx2,cy2,x2,y2,color,sw=2.0,op=1.0,dash=None):
    ang=math.atan2(y2-cy2,x2-cx2)
    sx=x2-3*math.cos(ang); sy=y2-3*math.sin(ang)
    d=f' stroke-dasharray="{dash}"' if dash else ""
    s=f'  <path d="M{x1:.1f} {y1:.1f} C {cx1:.1f} {cy1:.1f} {cx2:.1f} {cy2:.1f} {sx:.1f} {sy:.1f}" fill="none" stroke="{color}" stroke-width="{sw}" opacity="{op}"{d}/>\n'
    sz=7.5; a1=ang+math.radians(150); a2=ang-math.radians(150)
    p1=(x2+sz*math.cos(a1), y2+sz*math.sin(a1)); p2=(x2+sz*math.cos(a2), y2+sz*math.sin(a2))
    s+=f'  <path d="M{x2:.1f} {y2:.1f} L{p1[0]:.1f} {p1[1]:.1f} L{p2[0]:.1f} {p2[1]:.1f} Z" fill="{color}" opacity="{op}"/>\n'
    return s

def box(n,fill,stroke,sw=2.4,tfill=INK,fw=600,fs=13,op=1.0):
    cx,cy,w,h=N[n]
    s=f'  <rect x="{cx-w/2:.1f}" y="{cy-h/2:.1f}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{op}"/>\n'
    s+=f'  <text x="{cx}" y="{cy+fs*0.35:.1f}" font-family="{MONO}" font-size="{fs}" font-weight="{fw}" text-anchor="middle" fill="{tfill}">{esc(n)}</text>\n'
    return s

def chip(cx,cy,text,fill=GOLD_F,stroke=GOLD_S,tfill=INK,fs=9.5,pad=9,mono=True,sw=1.4):
    w=len(text)*fs*0.56+pad*2; h=fs+9
    fam=MONO if mono else FF
    s=f'  <rect x="{cx-w/2:.1f}" y="{cy-h/2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h/2:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>\n'
    s+=f'  <text x="{cx}" y="{cy+fs*0.35:.1f}" font-family="{fam}" font-size="{fs}" font-weight="600" text-anchor="middle" fill="{tfill}">{esc(text)}</text>\n'
    return s

def phi_badge(n):
    """small green φ circle at top-left of a block."""
    x,y=L(n); cx=x+9; cy=N[n][1]-N[n][3]/2+1
    return (f'  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="9.5" fill="{GREEN_S}" stroke="{WHITE}" stroke-width="1.5"/>\n'
            f'  <text x="{cx:.1f}" y="{cy+3.5:.1f}" font-family="{FF}" font-size="11" font-weight="700" text-anchor="middle" fill="{WHITE}">φ</text>\n')

def ring(n,color,r_extra=7,sw=2.6,dash="5,3"):
    cx,cy,w,h=N[n]
    return f'  <rect x="{cx-w/2-r_extra:.1f}" y="{cy-h/2-r_extra:.1f}" width="{w+2*r_extra}" height="{h+2*r_extra}" rx="10" fill="none" stroke="{color}" stroke-width="{sw}" stroke-dasharray="{dash}"/>\n'

EDGES = [  # (a-side point fn, b-side point fn, label, label_dx, label_dy)
 (B("entry"),  T("for.cond"), None, 0,0),
 (B("for.cond"),T("for.body"), "T", 9,-22),
 (R("for.cond"),L("for.end"), "F", 0,-7),
 (R("for.body"),T("if.then"), "T", 18,8),
 (B("for.body"),T("if.end"),  "F", 9,-2),
 (B("if.then"), R("if.end"),  None,0,0),
 (B("if.end"),  T("for.inc"), None,0,0),
]

def base_edges(active=None, dim=False):
    active=active or set()
    s=""
    for (a,b,lbl,ldx,ldy) in EDGES:
        key=None
        col=FAINT; sw=1.8; op=0.62
        if dim: col=DIM; op=0.4
        s+=arrow(a[0],a[1],b[0],b[1],col,sw=sw,op=op)
        if lbl:
            mx=(a[0]+b[0])/2+ldx; my=(a[1]+b[1])/2+ldy
            tc=FAINT if not dim else DIM
            s+=f'  <text x="{mx:.1f}" y="{my:.1f}" font-family="{FF}" font-size="10" font-weight="700" text-anchor="middle" fill="{tc}">{lbl}</text>\n'
    # back edge for.inc -> for.cond
    lx,ly=L("for.inc"); tx,ty=L("for.cond")
    col=FAINT if not dim else DIM; op=0.62 if not dim else 0.4
    s+=curve(lx,ly,36,ly,36,ty,tx,ty,col,sw=1.9,op=op)
    s+=f'  <text x="30" y="{(ly+ty)/2:.1f}" font-family="{FF}" font-size="9" font-weight="600" text-anchor="middle" fill="{col}" transform="rotate(-90 30 {(ly+ty)/2:.1f})">back-edge</text>\n'
    return s

def title(t,sub):
    return (f'  <text x="180" y="418" font-family="{FF}" font-size="14.5" font-weight="700" text-anchor="middle" fill="{INK}">{esc(t)}</text>\n'
            f'  <text x="180" y="438" font-family="{FF}" font-size="11.5" font-weight="400" text-anchor="middle" fill="{FAINT}">{esc(sub)}</text>\n')

def svg(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n'
            f'  <rect x="0" y="0" width="{W}" height="{H}" fill="none"/>\n{body}</svg>\n')

def nodes_default(highlight=None, ssa=False):
    """draw all 7 boxes; highlight: dict name->(fill,stroke,tfill)."""
    highlight=highlight or {}
    s=""
    order=["entry","for.cond","for.body","if.then","if.end","for.inc","for.end"]
    for n in order:
        if n in highlight:
            f,st,tf=highlight[n]; s+=box(n,f,st,sw=2.8,tfill=tf)
        else:
            s+=box(n,WHITE,INK,sw=2.2,tfill=INK)
    return s

stages=[]

# ---------- Stage 0 : the problem ----------
b = base_edges()
b += nodes_default(highlight={"entry":(GOLD_F,GOLD_S,INK),"if.then":(GOLD_F,GOLD_S,INK)})
b += chip(N["entry"][0]+0, N["entry"][1]-26, "max = a[0]", )   # above entry
b += chip(288, 270, "max = a[i]")                               # below if.then
b += title("One name, written twice", "Which write reaches each later use?")
stages.append(("ssa-0.svg", svg(b)))

# ---------- Stage 1 : dominators ----------
b = base_edges(dim=True)
b += nodes_default(highlight={"entry":(BLUE_F,BLUE_S,INK)})
# idom dashed arrows: child -> idom
idom={"for.cond":"entry","for.body":"for.cond","if.then":"for.body","if.end":"for.body","for.inc":"if.end","for.end":"for.cond"}
for c,p in idom.items():
    a=T(c) if N[p][1]<N[c][1] else B(c)
    # point from child top toward parent bottom
    pa=B(p) if N[p][1]<N[c][1] else T(p)
    b+=arrow(a[0],a[1],pa[0],pa[1],GREEN_S,sw=1.7,op=0.9,dash="4,3")
b += chip(180, 392, "dashed → immediate dominator (idom)", fill=GREEN_F, stroke=GREEN_S, fs=9.5, mono=False)
b += title("Dominators", "idom = each block's parent in the dom-tree")
stages.append(("ssa-1.svg", svg(b)))

# ---------- Stage 2 : merge points ----------
b = base_edges()
b += nodes_default(highlight={"for.cond":(BLUE_F,BLUE_S,INK),"if.end":(BLUE_F,BLUE_S,INK)})
b += ring("for.cond",BLUE_S); b += ring("if.end",BLUE_S)
b += chip(240, N["for.cond"][1], "2 preds", fill=BLUE_F, stroke=BLUE_S, fs=9, mono=False)
b += chip(243, N["if.end"][1], "2 preds", fill=BLUE_F, stroke=BLUE_S, fs=9, mono=False)
b += title("Where can a φ live?", "Only at merges — blocks with ≥ 2 preds")
stages.append(("ssa-2.svg", svg(b)))

# ---------- Stage 3 : dominance frontier of a def ----------
b = base_edges(dim=True)
b += nodes_default(highlight={"if.then":(GOLD_F,GOLD_S,INK),"if.end":(GREEN_F,GREEN_S,INK)})
b += ring("if.end",GREEN_S)
# flood arrow if.then -> if.end (its frontier)
a=B("if.then"); c=R("if.end")
b += arrow(a[0],a[1],c[0],c[1],GREEN_S,sw=2.4,op=0.95)
b += chip(288, 216, "def max", fill=GOLD_F, stroke=GOLD_S, fs=9)
b += chip(250, N["if.end"][1], "DF = {if.end}", fill=GREEN_F, stroke=GREEN_S, fs=8.5)
b += title("Dominance frontier", "DF(X) = first blocks X stops dominating")
stages.append(("ssa-3.svg", svg(b)))

# ---------- Stage 4 : iterated DF -> phi placement ----------
b = base_edges(dim=True)
b += nodes_default(highlight={"if.then":(GOLD_F,GOLD_S,INK),"if.end":(GREEN_F,GREEN_S,INK),"for.cond":(GREEN_F,GREEN_S,INK)})
# iteration arrows: if.then => if.end => for.cond
b += arrow(B("if.then")[0],B("if.then")[1],R("if.end")[0],R("if.end")[1],GREEN_S,sw=2.2,op=0.9)
b += curve(L("if.end")[0],L("if.end")[1],52,N["if.end"][1],52,N["for.cond"][1]+18,L("for.cond")[0],L("for.cond")[1]+8,GREEN_S,sw=2.0,op=0.9,dash=None)
b += phi_badge("if.end"); b += phi_badge("for.cond")
b += chip(240, N["for.cond"][1], "φ max", fill=GREEN_F, stroke=GREEN_S, fs=9)
b += chip(243, N["if.end"][1], "φ max", fill=GREEN_F, stroke=GREEN_S, fs=9)
b += title("Iterated dominance frontier", "A φ is a def too — so the frontier iterates")
stages.append(("ssa-4.svg", svg(b)))

# ---------- Stage 5 : rename -> SSA ----------
b = base_edges()
b += nodes_default(highlight={"for.cond":(GREEN_F,GREEN_S,INK),"if.end":(GREEN_F,GREEN_S,INK)})
b += phi_badge("if.end"); b += phi_badge("for.cond")
# source-value chips
b += chip(N["entry"][0], N["entry"][1]-26, "%0 = a[0]", fill=GOLD_F, stroke=GOLD_S, fs=9)
b += chip(288, 216, "%1 = a[i]", fill=GOLD_F, stroke=GOLD_S, fs=9)
# phi value chips
b += chip(180, 160, "%max.0 = φ [%0, entry] [%max.1, for.inc]", fill=GREEN_F, stroke=GREEN_S, fs=8.2)
b += chip(176, 314, "%max.1 = φ [%1, if.then] [%max.0, for.body]", fill=GREEN_F, stroke=GREEN_S, fs=8.2)
b += title("After renaming", "Each use now reads exactly one definition")
stages.append(("ssa-5.svg", svg(b)))

os.makedirs(OUT, exist_ok=True)
for fn, content in stages:
    open(os.path.join(OUT, fn), "w").write(content)
    print("wrote", os.path.join(OUT, fn), len(content), "bytes")
print("done:", len(stages), "stages")
