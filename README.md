# BRANDIST

> **Steal any brand. Leave nothing behind.**

Brandist is a brand extraction and design-system toolkit that turns a company URL or uploaded brand assets into a structured, browsable, shareable, and exportable brand kit.

Extract:

- 🎨 Color palettes
- 🔤 Typography
- 🖼️ Logos and brand assets
- ✍️ Voice and tone
- 📐 Design tokens
- 📄 `design.md`
- 📦 Exportable brand assets

> **Colors. Typography. Voice. Tokens. Extracted, structured, exported.**

---

## ✨ What Brandist Does

Paste any company URL or provide brand assets such as a deck, logo, screenshot, or PDF.

Brandist analyzes the source and creates a structured brand kit containing:

- Brand colors
- Typography
- Logo variants
- Voice and tone
- Design tokens
- Brand documentation
- Exportable assets

Recent kits are available from the home page, while individual kits can be opened, edited, shared, and exported.

---

## 🚀 How to Use

### 1. Enter a Brand

Go to the home page and paste a company URL or provide supported brand assets.

### 2. Extract

Brandist analyzes the provided source and extracts the available brand information.

### 3. Explore

Browse the generated kit:

- Colors
- Fonts
- Logos
- Voice
- Design tokens
- Brand documentation

### 4. Export

Use the generated brand system in your own projects.

You can export brand information as:

- PDF
- ZIP
- JSON design tokens
- Tailwind theme
- `design.md`

---

## 🎯 Design Philosophy

### The Invisible Instrument

Brandist is designed to feel like a **precision instrument, not a toy**.

The interface takes inspiration from:

- Vercel's precision
- Notion's structure
- Japanese editorial design

The visual language prioritizes:

- Precision
- Legibility
- Restraint
- High contrast
- Editorial typography
- Functional interactions

### One-word target

**Precise.**

### What Brandist is NOT

- Airy SaaS
- Purple-gradient AI tooling
- Warm lifestyle branding
- Playful decorative UI

### What Brandist IS

- Sumi ink
- Washi paper
- Hanko seal red
- Sharp corners
- Hairline rules
- Typewriter-precise data

---

## 🎨 Design System

| Element | Choice |
|---|---|
| Background | Washi paper |
| Foreground | Sumi ink |
| Accent | Hanko seal red |
| Display font | Cormorant Garamond |
| UI / Data font | Courier Prime |
| Body font | Libre Baskerville |
| Border radius | `0px` |
| Elevation | Borders only |
| Shadows | None |
| Motion | Slow, deliberate fades |
| Icons | Functional only |

The complete design specification is available in [`DESIGN.md`](./DESIGN.MD).

---

## 🧩 Core Features

### URL Extraction

Paste a company URL and extract its brand identity.

### File & PDF Ingestion

Use existing brand assets such as:

- PDFs
- Screenshots
- Logos
- Images
- Presentations

### Live Extraction Progress

The application provides staged progress while the brand is being analyzed.

### Color Palette

Extracted colors include:

- Primary colors
- Accent colors
- Surface colors
- Text colors
- Contrast information

### Typography

Brandist identifies typography and provides font previews.

### Logo & Asset Variants

Collect and organize:

- Logos
- Favicons
- Social images
- Brand assets

### Voice & Tone

Generate a concise brand voice profile including:

- Vocabulary
- Tone
- Do's
- Don'ts

### Design Tokens

Extract design tokens for:

- Spacing
- Border radius
- Motion
- Shadows
- Colors

### Brand Guide PDF

Generate a polished brand guide containing the extracted brand system.

### Full ZIP Export

Export the complete brand kit including:

- Brand guide
- Fonts
- Logos
- Assets
- Tokens
- CSS
- `design.md`

### Tailwind Theme

Generate a Tailwind-compatible theme for development.

### AI-Ready `design.md`

Export a structured Markdown brand brief that can be provided to AI coding tools.

### Kit Library

Manage generated kits with:

- Search
- Rename
- Duplicate
- Delete
- Share

### Public Sharing

Generate shareable public links for individual brand kits.

---

## 🗺️ Application Pages

| Route | Purpose |
|---|---|
| `/` | Landing page and kit extraction |
| `/new` | Create a new kit |
| `/kit/:id` | View a brand kit |
| `/kit/:id/design` | View and download `design.md` |
| `/library` | Browse saved and recent kits |

---

## 🏗️ Architecture

Brandist uses a client + server-function architecture powered by TanStack Start.

The extraction flow includes a backend readiness check to prevent users from submitting requests while the backend is still starting.

The application tracks three readiness states:

```text

initializing
ready
error

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
