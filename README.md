# BRANDIST

**Steal any brand. Leave nothing behind.**

Brandist extracts a brand's full design system — palette, typography, voice, and design tokens — from a single URL or a dropped asset (deck, logo, screenshot, PDF). Every extraction is packaged into a browsable, shareable, exportable kit.

> Colors. Typography. Voice. Tokens. Extracted, structured, exported.

---

## 01. What It Does

Paste any company URL. Brandist extracts the brand's palette, typography, voice, and design tokens — and packages them as a kit you can browse, share, and export.

Recent kits show up on the home page. Open one to see colors, fonts, logos, and a generated `design.md`.

Drop these files into Lovable or your AI agent to use their brand.

---

## 02. How to Use It

1. Go to the home page and paste a company URL into the input.
2. Wait a few seconds while Brandist extracts the brand data.
3. Browse the generated kit: colors, fonts, logos, and design tokens.
4. Save, share, or export the kit for your projects.

---

## 03. Design Philosophy — *The Invisible Instrument*

**Core emotion:** *"This is a precision instrument, not a toy."*

The interface draws from Vercel's precision, Notion's structure, and the execution of a Japanese art catalog — high-contrast, editorial, and deliberately undecorated. Every visual choice serves legibility and restraint over ornament.

**One-word target:** *Precise.*

**What this is not:** airy SaaS, purple-gradient AI tooling, warm lifestyle branding, playful or decorative UI.

**What this is:** sumi ink on washi paper, a hanko seal red used like a signature stamp, sharp corners, hairline rules, and typewriter-precise data.

---

## 04. Design System Highlights

| Element | Choice |
|---|---|
| Palette | Washi paper background, sumi ink foreground, hanko seal red accent — no other colors |
| Display type | Cormorant Garamond (serif, bold/italic) |
| Data / UI type | Courier Prime (mono, uppercase, tracked) |
| Body type | Libre Baskerville |
| Border radius | `0px` everywhere — no exceptions |
| Elevation | Borders only, never box-shadows |
| Motion | Slow, deliberate fades — no bounce or spring easing |
| Iconography | Functional only (copy, download, external link, close) — no decorative or "AI" icons |

Full specification lives in [`design.md`](./design.md).

---

## 05. Architecture Notes

Brandist runs on a client + server-function layer (TanStack Start), with a readiness gate on the homepage extraction panel to prevent submissions during cold-start windows:

- The extract control is disabled and shows `INITIALIZING · PLEASE WAIT` until a lightweight `warmServer` server function confirms the backend is live.
- Readiness is tracked explicitly as `"initializing" | "ready" | "error"`, decoupled from unrelated UI signals like the recent-kits list.
- Submission is blocked client-side until the server round-trip succeeds, with a short retry loop for sandbox cold starts.

This does not eliminate infrastructure cold-start time — it prevents users from submitting into a fragile startup window, which was the source of intermittent preview failures.

---

## 06. Pages

| Route | Purpose |
|---|---|
| `/` | Landing + kit extraction panel |
| `/new` | Kit creation — URL, Upload, or Manual entry |
| `/kit/:id` | Kit viewer — colors, typography, tokens, export |
| `/kit/:id/design` | Rendered, downloadable `design.md` brand brief |
| `/library` | Recent and saved kits |

---

## 07. Tech Stack

- TanStack Start (SSR)
- Supabase (database, auth)
- Google Gemini (brand extraction / AI reasoning)
- Tailwind CSS

---

## Author

**S. Sharma**

- GitHub: [github.com/shubham-coder-ship-it](https://github.com/shubham-coder-ship-it)
- LinkedIn: [linkedin.com/in/shubham-sharma-55ab97367](https://www.linkedin.com/in/shubham-sharma-55ab97367/)
