import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { IngestionPanel } from "@/components/ingestion-panel";
import { RecentKits } from "@/components/recent-kits";
import { StartHereButton } from "@/components/start-here-button";

export const Route = createFileRoute("/")({
    head: () => ({
        meta: [
            { title: "Brand DNA — extract any brand's design system" },
            {
                name: "description",
                content:
                    "Paste a URL or drop assets. Get the palette, type, voice, and tokens — ready for your next pitch deck or build.",
            },
        ],
        links: [
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Courier+Prime:wght@400;700&family=Libre+Baskerville:ital@0;1&display=swap",
            },
        ],
    }),
    component: Landing,
});

function Landing() {
    return (
        <>
            <style>{css}</style>

            <div className="page">
                <nav className="nav">
                    <Link to="/" className="brand">BRANDIST</Link>
                    <div className="nav-center">
                        <StartHereButton />
                    </div>
                    <div className="nav-links">
                        <Link to="/library">
                            <BookOpen aria-hidden /> Library
                        </Link>
                    </div>
                </nav>

                <main className="hero">
                    <h1 className="headline">
                        BRANDIST
                    </h1>

                    <div className="panel-mount">
                        <IngestionPanel />
                    </div>
                </main>

                <RecentKits />
            </div>
        </>
    );
}

const css = `
  :root {
    --washi: #F4EFE6;
    --sumi: #0A0A0A;
    --hairline: rgba(10,10,10,0.20);
    --hanko: #8B1A1A;
  }

  html, body {
    background: var(--washi);
    color: var(--sumi);
    font-family: 'Libre Baskerville', Georgia, serif;
    -webkit-font-smoothing: antialiased;
  }
  *::selection { background: var(--sumi); color: var(--washi); }

  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ---------- Nav ---------- */
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 40px;
    border-bottom: 1px solid var(--hairline);
  }
  .nav-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }
  .nav { position: relative; }
  .brand {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--sumi);
    text-decoration: none;
  }
  .nav-links {
    display: flex;
    gap: 28px;
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.20em;
    text-transform: uppercase;
  }
  .nav-links a {
    color: var(--sumi);
    text-decoration: none;
    opacity: 0.75;
    transition: opacity 150ms ease, color 150ms ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .nav-links a:hover { opacity: 1; color: var(--hanko); }
  .nav-links a svg { width: 13px; height: 13px; stroke-width: 1.5; }

  /* ---------- Hero ---------- */
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 96px 40px 64px;
    max-width: 760px;
    margin: 0 auto;
    width: 100%;
  }

  .eyebrow {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
    margin-bottom: 36px;
  }

  .headline {
    font-family: 'Cormorant Garamond', 'Times New Roman', serif;
    font-weight: 300;
    font-style: normal;
    font-size: clamp(56px, 9vw, 112px);
    line-height: 0.98;
    letter-spacing: -0.01em;
    margin: 0 0 28px;
  }
  .headline em {
    font-style: italic;
    font-weight: 400;
  }

  .lede {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-style: italic;
    font-size: 16px;
    line-height: 1.55;
    color: rgba(10,10,10,0.72);
    max-width: 480px;
    margin: 0 0 48px;
  }

  .panel-mount {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .foot-meta {
    margin-top: 28px;
    font-family: 'Courier Prime', monospace;
    font-size: 10px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.45);
  }

  /* ---------- How ---------- */
  .how {
    border-top: 1px solid var(--hairline);
    padding: 64px 40px 96px;
    max-width: 760px;
    margin: 0 auto;
    width: 100%;
  }
  .how-eyebrow {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
    margin-bottom: 28px;
  }
  .how-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .how-list li {
    display: grid;
    grid-template-columns: 56px 1fr 2fr;
    align-items: baseline;
    gap: 24px;
    padding: 22px 0;
    border-bottom: 1px solid var(--hairline);
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
  }
  .how-list .num {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: rgba(10,10,10,0.55);
  }
  .how-list .dim {
    font-family: 'Libre Baskerville', serif;
    font-style: italic;
    font-size: 14px;
    color: rgba(10,10,10,0.65);
  }

  @media (max-width: 640px) {
    .nav { padding: 18px 20px; }
    .nav-links { gap: 18px; }
    .hero { padding: 56px 20px 48px; }
    .how { padding: 48px 20px 72px; }
    .how-list li { grid-template-columns: 40px 1fr; }
    .how-list .dim { grid-column: 2; }
  }
`;
