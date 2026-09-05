# Visual System — Bilal Ahmad & Jennah Samhan

The public site is art-directed around the custom hero video
(`public/video/hero-embroidery.mp4`): pale-blue Palestinian tatreez motifs
stitching themselves across warm linen paper, looping seamlessly over 10
seconds. Every color below was derived from pixel analysis of extracted
video frames (0%, ~23%, 50%, 75%, 100%).

## Extracted video palette (measured)

| Sample | Measured |
| --- | --- |
| Linen paper (blank frames, center) | `#E6E2DA` – `#EDE9E1` |
| Blue thread, average | `#A3B3BB` |
| Blue thread, deepest | `#7D8D95` |
| Taupe/gray thread | `#8B8E8D` – `#A8AAA9` |

## Design tokens (`src/app/globals.css`)

Backgrounds are lifted slightly above the measured linen for on-screen
airiness; text is deepened for contrast. All are Tailwind theme tokens.

| Token | Hex | Role |
| --- | --- | --- |
| `--color-paper` | `#FBFAF6` | page base |
| `--color-paper-pure` | `#FFFFFF` | invitation sheets, button text |
| `--color-linen` | `#F0EDE5` | video-matched surface |
| `--color-ice` | `#F2F5F7` | pale blue section surface |
| `--color-powder` | `#D5E0E8` | borders, numerals, tints |
| `--color-mist` | `#B4C6D2` | light tatreez, thread lines |
| `--color-dusty` | `#86A1B4` | primary tatreez / accent |
| `--color-blue-deep` | `#47637A` | buttons, small caps accents |
| `--color-ink` | `#27343F` | primary text |
| `--color-ink-soft` | `#5A6A75` | secondary text |
| `--color-taupe` | `#A5A198` | decorative warm gray |
| `--color-line` / `--color-line-blue` | `#E5E1D7` / `#DDE6EC` | hairlines |
| `--color-error` | `#A3453D` | functional (validation) only |

Contrast (against `--color-paper`): ink ≈ 12.9:1, ink-soft ≈ 5.6:1,
blue-deep ≈ 6.9:1 — all AA for their usage; blue-deep on white buttons
(white text on `#47637A`) ≈ 6.9:1 AA.

The legacy dark palette (charcoal/ivory/sand/gold/olive/thread) remains
defined in `globals.css` **exclusively for the `/admin` area**, which keeps
its own dark professional theme. It must not be used on the public site.

## Typography

- **Display: Bodoni Moda** (variable, optical sizing on, weight ≈460,
  near-neutral tracking). Used for the couple's names, event titles, large
  numerals, RSVP step headings, review/confirmation moments.
- **Body/UI: Instrument Sans** (variable). Body copy, buttons, forms,
  addresses, small caps labels (`.type-caps`, 0.3em tracking).
- Hero names: `clamp(2.5rem, 10.5vw, 7.25rem)`, single line per name,
  `whitespace-nowrap`; verified unclipped at 320px.

## Hero media strategy

- `public/video/hero-embroidery.mp4` — 1280×720, H.264 yuv420p, CRF 23,
  faststart, audio stream removed: **1.24 MB** (source was 9.3 MB).
- `public/video/hero-poster.webp` — exact first frame (14 KB) so first
  paint and playback start are visually identical; poster carries LCP.
- `<video autoplay muted loop playsinline preload="auto">`, decorative
  (`aria-hidden` wrapper, `tabIndex={-1}`), no controls.
- Portrait crop: `object-position: 12% 50%` below `md` pins the left
  embroidery column into view; desktop uses center.
- Loop: source first/last frames are both blank linen — verified visually;
  no crossfade added.
- **Reduced motion: the video is replaced by the still poster** (documented
  decision), parallax and continuous motion stop, SVG thread-draw renders
  complete; all functionality unchanged.

## Music

- `public/audio/wedding-theme.mp3` (192 kbps stereo, 84 s) via a single
  `Audio` element, independent from the video.
- Plays automatically on load where the browser allows; otherwise a
  one-time listener starts it on the first pointer/keyboard interaction
  anywhere. UI never claims "playing" unless `play()` resolved.
- Volume fades 0 → 0.3; explicit pause is respected for the session; tab
  hide pauses, return resumes.

## Motion principles

- One easing family: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Vocabulary: thread-draw (SVG `pathLength`), mask/blur line reveals,
  gentle scroll parallax (hero text ↑, video 8% drift), stitched progress
  marks, number rolls. No springs, no bounces, no confetti.
- Scroll story: video embroidery → mist thread out of the hero → event
  sections (ice/paper alternation) → thread becomes the envelope seam →
  white invitation sheet (RSVP) → footer star.

## Responsive behavior

Audited via Playwright screenshots at 320/375/390/414/430/768/1024/1280/
1440/1920. Names never wrap or clip; date line is single-line at 320;
video crop is intentional per orientation; no horizontal overflow.
