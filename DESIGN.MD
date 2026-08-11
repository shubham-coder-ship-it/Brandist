# Brand DNA — Design System Document
### The Invisible Instrument

---

## 01. Design Philosophy

**Core emotion:** *"This is a precision instrument, not a toy."*

The user should feel like they've stepped into a high-end, quiet archive or a master's studio. Intimidatingly simple. The "Brute" element comes from the cold, raw efficiency of the tool. The "Shodō" element makes it feel like an art form. The feeling of a sharp scalpel hitting expensive paper — quiet, surgical, and final.

**One-word target:** *Precise.*

**What this is not:**
- Not Stripe/Loom airy SaaS
- Not purple-gradient AI tool
- Not warm lifestyle brand (Aesop)
- Not playful or approachable
- Not decorative

**What this is:**
- High-contrast editorial
- Vercel's precision + Notion's structure + Japanese Art Catalog execution
- Shodō (Japanese calligraphy): bold, high-contrast ink strokes
- A blank, intentional canvas that doesn't distract from the identities it extracts

---

## 02. Palette

**Concept:** Sumi ink on washi paper. The only color is a hanko seal red — used like a signature stamp, sparingly.

### Light Mode
```
--background:     #F4EFE6   /* washi paper */
--foreground:     #0A0A0A   /* sumi ink */
--surface:        #EDE8DE   /* heavier paper, cards */
--surface-raised: #F9F6F0   /* lightest surface */
--border:         #0A0A0A   /* full ink — structural borders only */
--border-subtle:  rgba(10,10,10,0.20)  /* hairline rules */
--accent:         #8B1A1A   /* hanko seal red */
--accent-fg:      #F4EFE6
--muted:          rgba(10,10,10,0.45)
```

### Dark Mode
```
--background:     #0A0A0A
--foreground:     #F4EFE6
--surface:        #141414
--surface-raised: #1A1A1A
--border:         #F4EFE6
--border-subtle:  rgba(244,239,230,0.20)
--accent:         #C0392B
--accent-fg:      #0A0A0A
--muted:          rgba(244,239,230,0.45)
```

**Rules:**
- Hanko red used only for: primary CTA button active state, error states, one decorative accent element per page maximum
- No other colors. No purple, teal, blue, orange.
- When in doubt: black and white only.

---

## 03. Typography

**Concept:** Luxury serif for titles (the ink stroke). Raw typewriter mono for data and labels (the instrument). Refined serif for body prose.

| Role | Family | Weight | Usage |
|---|---|---|---|
| Display / Headings | Cormorant Garamond | 700 upright / 400 italic | H1, H2, hero titles, section headers, CTA quotes |
| Data / Labels / UI | Courier Prime | 400 / 700 | Nav, buttons, tabs, badges, captions, form inputs, numbers, code |
| Body Prose | Libre Baskerville | 400 / 700 | Descriptions, card body, long-form content |

**Rules:**
- All buttons: Courier Prime, uppercase, letter-spacing 0.10em
- All nav items: Courier Prime, uppercase, letter-spacing 0.12em
- All section eyebrows: Courier Prime, 11px, uppercase, letter-spacing 0.15em, muted
- Hero headline: Cormorant Garamond 700, `clamp(72px, 10vw, 110px)`, line-height 0.95, tracking -0.02em
- Second hero line: Cormorant Garamond italic 400, same size, `--muted` color (~60% opacity — whisper, not absent)
- No Inter. No Roboto. No system fonts in visible UI.

---

## 04. Shape & Space

**Border radius:** `0px` everywhere. No exceptions. Sharp corners only — this is a scalpel, not a pill.

**Borders:**
- Structural (header bottom, section dividers, card edges): `1px solid #0A0A0A` (full ink)
- Hairline rules (index rows, subtle separators): `1px solid rgba(10,10,10,0.20)`
- Never use box-shadows for elevation — use borders instead

**Spacing rhythm:**
- Hero content: upper-center third of viewport, not dead-center
- Sections: generous vertical padding (py-24 to py-32)
- Index rows: py-8 per row with hairline separators between
- Maximum content width: 4xl for hero copy, 7xl for full layout container

**Texture:**
- CSS grain overlay on `body::before` — SVG fractal noise, opacity ~0.06, `mix-blend-mode: multiply`
- Feels like heavy paper weight, not digital noise

---

## 05. UI Components

### Buttons
```
Primary:
  background: var(--foreground)
  color: var(--background)
  font: Courier Prime, 12–13px, uppercase, tracking 0.10em
  padding: 12px 32px
  border: none
  border-radius: 0

Secondary / Ghost:
  background: transparent
  border: 1px solid var(--border)
  color: var(--foreground)
  same font rules

Bracket format: [ LABEL ] — the brackets are part of the visual language
```

### Form Inputs
```
background: transparent
border: 1px solid var(--border)
border-radius: 0
font: Courier Prime
padding: 12px 16px
focus: border-color stays ink, add no glow/ring — just ink
```

### Cards
```
background: var(--surface) or var(--surface-raised)
border: 1px solid var(--border-subtle)
border-radius: 0
padding: 24px
No box-shadow
```

### Tabs
```
Active tab: border-bottom 2px solid var(--foreground), Courier Prime uppercase
Inactive: muted, same font
No background fills on tabs
```

### Header
```
height: 48px
background: var(--background)
border-bottom: 1px solid #0A0A0A  ← full ink, not subtle
Wordmark: "BRAND DNA" — Courier Prime, 13px, uppercase, tracking 0.2em
Nav: Courier Prime, 12px, uppercase, tracking 0.12em
CTA: [ NEW KIT ] — primary button, smaller (padding 8px 16px)
No icons. No logo mark.
```

---

## 06. Icons & Decoration

**Rule: No decorative icons.**

Lucide icons permitted only for functional actions:
- Copy (`ti-copy`)
- Download (`ti-download`)
- External link (`ti-external-link`)
- Close (`ti-x`)

Replace all icon-on-tinted-square patterns with typographic markers:
- `//` for section eyebrows
- `01.` `02.` for numbered lists
- `—` for list items
- `[ ]` for interactive states
- `×` for close/remove

No sparkles. No brain. No wand. No AI iconography of any kind.

---

## 07. Motion

**Tempo:** Slow and deliberate. Ink bleeding in, not bouncing.

- Page load: staggered fade-up, 400ms, `cubic-bezier(0.16, 1, 0.3, 1)` — one orchestrated reveal, not element-by-element chaos
- Hover states: `opacity` and `color` transitions only, 150ms
- No scale transforms on hover (too playful)
- No bounce, spring, or elastic easing
- Tab transitions: instant or 100ms fade — no sliding panels

---

## 08. Copy Voice

**Tone:** Authoritative. Terse. Confident without selling. Like a brief from a senior creative director.

**Rules:**
- Short sentences. Periods land hard.
- No exclamation marks. Ever.
- No "powerful", "seamless", "game-changing", "next-level"
- No speed claims ("in 30 seconds", "instant", "lightning fast")
- Precision over promise
- The tool does something specific — say what it does, not how great it is

**Key lines (locked):**
- Hero H1: `Steal any brand.`
- Hero H2: `Leave nothing behind.`
- Subhead: `Colors. Typography. Voice. Tokens. Extracted, structured, exported.`
- CTA section quote: `The brief is already out there.`
- CTA subhead: `Every competitor's colors, every font, every token — one URL away.`
- Primary CTA: `[ EXTRACT A BRAND KIT ]`
- Secondary CTA: `[ START EXTRACTING ]`

---

## 09. Page-by-Page Notes

### Landing (`/`)
- Hero: content in upper-center third, not dead-center
- Headline dominates viewport — feel almost too big, like a newspaper masthead
- Index section: numbered two-column editorial list, hairline rules between rows
- CTA section: slightly different background (`--surface`), separated by full-ink top border
- Footer: one line, `BRAND DNA` left / `v1.0` right, mono, hairline top border

### Kit Creation (`/new`)
- Three tabs (URL / Upload / Manual): Courier Prime, uppercase, no background fills
- URL input dominates — large, full-width, typewriter feel
- Submit: `[ EXTRACT ]` primary button, right-aligned or below input
- All three tabs submit on Enter (fix from audit)

### Kit Viewer (`/kit/:id`)
- Tab bar: horizontal, full-width, `border-bottom: 1px solid var(--border)`
- Each tab: Courier Prime uppercase, 12px, muted inactive / ink active with 2px bottom border
- Cards within tabs: `--surface` background, 0 radius, hairline borders
- Color swatches: square (0 radius), with hex + role label in Courier Prime below
- Type specimens: render in the extracted font, fallback to Cormorant Garamond
- Export section: list of download options, each as a row with label + `[ DOWNLOAD ]` button

### design.md (`/kit/:id/design`)
- Rendered in-app page — feels like a printed brand brief
- Full-width, max-w-3xl centered, generous vertical padding
- Sections separated by full-ink horizontal rules
- Downloadable as `.md` file
- Structure: Brand Name → Palette → Typography → Voice → Tokens → Positioning

---

## 10. What to Avoid (Never List)

- Purple gradients on white
- Rounded pill buttons
- Icon-on-tinted-square patterns
- Inter, Roboto, Arial, Space Grotesk
- "AI" iconography (sparkles, brains, wands, stars)
- Drop shadows for elevation
- Bounce/spring animations
- Speed claims in copy
- Exclamation marks
- The word "powerful", "seamless", "intuitive", "game-changing"
- Colored section backgrounds (only --surface shift, never brand color fills)
- More than one accent color usage per screen

---

*Last updated: Prompt 2 execution — landing page + global design system*
*Next: Prompt 3 — /new route | Prompt 4 — kit viewer | Prompt 5 — design.md*
