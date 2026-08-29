# Dune Mode Cinematic Redesign — 2026-08-26

Supersedes the *scene* sections (§3–§5) of [`2026-08-24-dune-mode-design.md`](2026-08-24-dune-mode-design.md). The trigger, persistence, isolation architecture, and token-cascade reskin mechanism (§1–§2, Architecture Consequences) are unchanged.

## Why

User review of the shipped heighliner scene (screenshots in `docs/external-sources/dune_screenshot_*.png`) rejected it: the procedural orbit tiles read as noise, the flat entity sphere fought the connect form, and on the graph view the fake planets were indistinguishable from data. Three rounds of hand-drawn CSS/SVG mockups (planet surface, ringed planet, galaxy — then real NASA photography, then a cinematic composite) established the quality bar: **"like something out of the movies," mesmerizing enough to make the user want to stay**. Hand-drawn vectors could not reach it; diffusion-model imagery can.

## Decisions

1. **Base plate is an AI-generated image.** The user generated candidates with ChatGPT from a prompt engineered for this layout (dark upper-left for UI, planet limb sweeping lower-right, sun cresting the limb). Chosen: the single "planetary landscape" image — source PNG committed at `docs/external-sources/ChatGPT Image planetary landscape Aug 25, 2026, 08_20_48 PM.png`, shipped as `src/dune/assets/hero.webp` (1672×941, q90, 125KB). A quadrant sheet of four alternate scenes was split and prototyped; parked, not shipped.
2. **Fluorescent regrade.** Per user direction ("fluorescent blue, greens, spacial colours") the amber dune palette is replaced wholesale. The image is graded at runtime (`hue-rotate(150deg) saturate(1.5)` + a blurred screen-blend duplicate for neon bloom) so the shipped asset stays the un-graded original. All theme tokens regraded to match; triad validation values live in `src/dune/theme.css`'s header comment.
3. **Motion is composited live, not baked.** A "2.5D cinemagraph" system: 80s alternating camera zoom; five parallax layers (base image ×4px, nebula ×10, stars ×14, sun ×8, haze ×20) eased toward the pointer; seeded-deterministic 212-star field with staggered prime-ish twinkle cycles; breathing sun core/bloom/anamorphic streak positioned on the image's baked sun (54vw/41vh at 16:9 cover); two drifting haze bodies; a shooting star every 26s; stepped-jitter film grain. Rejected alternative: AI image-to-video loop (cost, 3–8MB weight, loop seams, kills pointer parallax).
4. **Connect/departure animation removed, deferred.** The still scene gets perfected first (user call, 2026-08-25). `DuneOverlay` therefore drops its capture-phase click listener and the URL-seeded ship generator entirely; `konami.ts` is the only trigger surface left.
5. **Legibility scrim.** The app's connect form is centered, directly over the image's sun. A soft radial darkening (`--dune-scrim`, ellipse 27vw×17vh at 50%/45%) sits in the grade layer behind the form. This is scene-side; ConnectScreen is untouched (isolation constraint).
6. **Accessibility.** The scene is decorative: `aria-hidden`, empty-alt images. `prefers-reduced-motion` disables every animation and the JS parallax, leaving a still frame.

## Constraints carried forward

- No `Math.random()` in `src/dune/` — stars use mulberry32 with a fixed seed.
- Every scene color is a `var(--dune-*)` token in `theme.css`.
- Isolation: no imports or coupling outside `src/dune/`; passive `document`/`window` listeners only.

## Follow-ups

- Connect animation (deliberately deferred — design when the still scene is signed off).
- The four quadrant scenes (`docs/external-sources/…4 quadrants…png`) could become alternate/rotating backdrops; the mockup scene player proved per-scene sun/hue parameterization works.
- If the hero image is ever regenerated, re-check the sun position constants (54vw/41vh) and the scrim placement.
