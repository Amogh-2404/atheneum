# Atheneum — Figure & Visual-Transition Doctrine (the pixel bar)

> Sir's standing law, applies to EVERY figure, diagram, derivation, and scrolly-transition
> you ever author or touch — autonomously or on request. Read this before building any visual.

## The one rule above all

**LAYOUT IS EVERYTHING. The layout IS the diagram.** Engineer every element placement with
VLSI-chip precision — every coordinate calculated, nothing eyeballed. Colour and animation are
decoration on top of a *perfect* layout; they never rescue a bad one.

**Zero-tolerance — NOT entertained, ever:**
- ❌ overlaps (elements, labels, arrows over boxes, text over text)
- ❌ misalignment (off-grid edges, ragged baselines, uneven gaps)
- ❌ clutter (too many elements, no breathing room)
- ❌ overflow (text spilling its box, content past the viewBox, horizontal scroll on mobile)
- ❌ crossings (arrows crossing each other or through unrelated nodes)

If a render shows ANY of the above, it is broken. Fix it. Re-render. Repeat until perfect.

## Layout engineering (do the math)

1. **Grid.** Place everything on an explicit grid (e.g. 8px). Snap x/y/width/height to it.
   Equal gutters, equal padding, aligned edges. Compute coordinates; never guess.
2. **Budget the canvas.** Max ~5–7 primary elements per view. More than that → split into
   sequential reveal steps (a scrolly), not one crowded frame. Cognitive load is a layout input.
3. **Text fits its box.** Measure label width vs box width. Pad ≥12px. Wrap or shrink before
   you overflow. No label ever touches or crosses an edge.
4. **Arrows.** Thick, labelled, orthogonal or clean curves. Route around nodes — never through
   one. Step-number badges on flow arrows. No two arrows cross if a reroute avoids it.
5. **Semantic colour per tier**, one accent family, restrained. Flat 2D (ByteByteGo gold
   standard). No gradients-as-crutch, no drop-shadow soup.
6. **Consistent type scale** across a figure: one title size, one label size, one annotation
   size. Aligned baselines.

## Mobile is the acceptance test (sir reads on a 390px phone)

- Responsive `viewBox` + `preserveAspectRatio`; the figure scales, never clips.
- At 390px: no overflow, no horizontal scroll, every label legible (≥11px effective), tap
  targets ≥44px for any interactive element.
- A scrolly-figure's sticky figure and its step text must NEVER overlap — size the figure to
  leave room; the step copy sits clearly separated, one idea per step.

## Scrolly-transitions & derivations specifically

- **Scrolly:** each step changes ONE thing, builds on the last, reads as a smooth progression.
  The figure is the constant; the step text is short and unambiguous. Verify every step frame.
- **Derivations:** KaTeX lines left-aligned on the relation; the changed sub-expression (delta)
  highlighted cleanly; one-sentence notes that don't crowd the math. Every line valid KaTeX.

## The mandatory QA loop (no figure ships unrendered)

For EVERY figure/transition you author or edit:
1. Render it (chrome-headless-shell against the running app, the real block in context).
2. **Screenshot it at 390px AND desktop, and READ the screenshot** — actually look.
3. Scan for the five zero-tolerance defects above. If you find one, FIX and go to step 1.
4. Only when it is pixel-clean at both widths is it allowed to ship.

Skipping the render-and-look step is the #1 cause of shipped overlaps. Never skip it.

## Content quality rides alongside

Visuals serve a grounded, AAA explanation — never decoration for its own sake. Every figure
earns its place by making one idea click. No fabrication; ground every diagram in the chapter's
real content. Refined writing + refined visuals, together, every time.
