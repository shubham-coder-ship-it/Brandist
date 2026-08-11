import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { readKitsCache } from "@/lib/kits-cache";
import { useAutoImportFonts, renderFamilyFor } from "@/lib/font-loader";

type Kit = {
    id: string;
    name: string;
    source_url: string | null;
    status: string;
    created_at: string;
    primaryHex: string | null;
    palette?: string[];
    displayFont?: {
        family: string;
        google: boolean;
        source_family?: string | null;
        weights?: string[] | null;
        file_urls?: Array<{ url: string; weight?: string; style?: string; format?: string }> | null;
    } | null;
    logoUrl?: string | null;
};

export function RecentKits() {
    const [kits, setKits] = useState<Kit[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [q, setQ] = useState("");

    useEffect(() => {
        // Landing never starts a Library fetch. First extraction must own the first
        // server request; Library refreshes when the user opens /library.
        const cached = readKitsCache();
        if (cached && cached.length > 0) {
            setKits(cached as Kit[]);
        }
        setLoaded(true);
    }, []);

    // Auto-import each kit's display font: Google Fonts via <link>, self-hosted
    // / Fontshare / foundry CDN via @font-face from discovered file_urls.
    useAutoImportFonts(
        kits
            .map((k) => k.displayFont)
            .filter(Boolean)
            .map((d: any) => ({
                family: d.family,
                source_family: d.source_family,
                google_font: d.google,
                weights: d.weights,
                file_urls: d.file_urls,
            })),
    );

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        const base = term
            ? kits.filter(
                (k) =>
                    k.name.toLowerCase().includes(term) ||
                    (k.source_url ?? "").toLowerCase().includes(term),
            )
            : kits;
        return base.slice(0, 3);
    }, [kits, q]);

    if (!loaded || kits.length === 0) return null;

    return (
        <section className="recent-kits">
            <div className="recent-head">
                <p className="recent-eye">// recent kits</p>
                <Link to="/library" className="recent-all">
                    [ All brand kits → ]
                </Link>
            </div>

            <div className="recent-search">
                <Search className="recent-search-icon" aria-hidden />
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search your kits…"
                    aria-label="Search your kits"
                />
            </div>

            {filtered.length === 0 ? (
                <p className="recent-empty">No kits match "{q}".</p>
            ) : (
                <ul className="recent-list">
                    {filtered.map((k, i) => (
                        <motion.li
                            key={k.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
                        >
                            <Link
                                to="/kit/$kitId"
                                params={{ kitId: k.id }}
                                className="recent-row"
                            >
                                <span
                                    className="recent-mark"
                                    style={{
                                        background: k.primaryHex
                                            ? `color-mix(in oklab, ${k.primaryHex} 8%, #F4EFE6)`
                                            : "rgba(10,10,10,0.04)",
                                        borderLeft: `3px solid ${k.primaryHex ?? "#0A0A0A"}`,
                                    }}
                                >
                                    {k.logoUrl ? (
                                        <img src={k.logoUrl} alt="" loading="lazy" />
                                    ) : (
                                        <span
                                            aria-hidden
                                            style={{
                                                fontFamily: "'Cormorant Garamond', serif",
                                                fontSize: 22,
                                                color: k.primaryHex ?? "#0A0A0A",
                                            }}
                                        >
                                            {(k.name?.[0] ?? "?").toUpperCase()}
                                        </span>
                                    )}
                                </span>

                                <span className="recent-meta">
                                    <span
                                        className="recent-name"
                                        style={{
                                            fontFamily: (() => {
                                                const fam = renderFamilyFor({
                                                    family: k.displayFont?.family ?? null,
                                                    source_family: k.displayFont?.source_family ?? null,
                                                    file_urls: k.displayFont?.file_urls ?? null,
                                                    google_font: k.displayFont?.google ?? null,
                                                });
                                                return fam
                                                    ? `'${fam}', 'Cormorant Garamond', serif`
                                                    : "'Cormorant Garamond', serif";
                                            })(),
                                        }}
                                    >
                                        {k.name}
                                    </span>
                                    {k.source_url && (
                                        <span className="recent-url">
                                            {k.source_url.replace(/^https?:\/\//, "")}
                                        </span>
                                    )}
                                </span>

                                {k.palette && k.palette.length > 0 && (
                                    <span className="recent-pal" aria-hidden>
                                        {k.palette.slice(0, 5).map((hex, idx) => (
                                            <span
                                                key={`${hex}-${idx}`}
                                                style={{ background: hex }}
                                            />
                                        ))}
                                    </span>
                                )}
                            </Link>
                        </motion.li>
                    ))}
                </ul>
            )}

            <style>{css}</style>
        </section>
    );
}

const css = `
  .recent-kits {
    border-top: 1px solid rgba(10,10,10,0.20);
    padding: 56px 40px 96px;
    max-width: 760px;
    margin: 0 auto;
    width: 100%;
  }
  .recent-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
  }
  .recent-eye {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
    margin: 0;
  }
  .recent-all {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: #0A0A0A;
    text-decoration: none;
    opacity: 0.75;
    transition: opacity 150ms ease, color 150ms ease;
  }
  .recent-all:hover { opacity: 1; color: #8B1A1A; }

  .recent-search {
    position: relative;
    margin-bottom: 20px;
  }
  .recent-search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: rgba(10,10,10,0.45);
    pointer-events: none;
  }
  .recent-search input {
    width: 100%;
    height: 42px;
    padding: 0 16px 0 40px;
    border-radius: 9999px;
    border: 1px solid rgba(10,10,10,0.15);
    background: rgba(244,239,230,0.6);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    font-family: 'Courier Prime', monospace;
    font-size: 12px;
    letter-spacing: 0.06em;
    color: #0A0A0A;
    outline: none;
    transition: border-color 150ms ease, background 150ms ease;
  }
  .recent-search input::placeholder {
    color: rgba(10,10,10,0.45);
    text-transform: none;
    letter-spacing: 0.04em;
  }
  .recent-search input:focus {
    border-color: rgba(10,10,10,0.4);
    background: rgba(244,239,230,0.85);
  }

  .recent-empty {
    font-family: 'Libre Baskerville', serif;
    font-style: italic;
    font-size: 14px;
    color: rgba(10,10,10,0.6);
    margin: 0;
    padding: 12px 0;
  }

  .recent-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .recent-list li + li {
    border-top: 1px solid rgba(10,10,10,0.10);
  }
  .recent-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 4px;
    text-decoration: none;
    color: #0A0A0A;
    transition: background 200ms ease;
    border-radius: 12px;
  }
  .recent-row:hover { background: rgba(10,10,10,0.03); }

  .recent-mark {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid rgba(10,10,10,0.12);
    border-radius: 6px;
  }
  .recent-mark img {
    max-width: 32px;
    max-height: 32px;
    object-fit: contain;
  }

  .recent-meta {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .recent-name {
    font-size: 22px;
    font-weight: 500;
    line-height: 1.15;
    color: #0A0A0A;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recent-url {
    font-family: 'Courier Prime', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recent-pal {
    flex: 0 0 auto;
    display: flex;
    gap: 3px;
  }
  .recent-pal span {
    width: 14px;
    height: 14px;
    border: 1px solid rgba(10,10,10,0.12);
  }

  @media (max-width: 640px) {
    .recent-kits { padding: 40px 20px 72px; }
    .recent-head { flex-direction: column; gap: 8px; align-items: flex-start; }
    .recent-pal { display: none; }
  }
`;
