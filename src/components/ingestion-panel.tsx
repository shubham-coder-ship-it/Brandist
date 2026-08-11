import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getAnonToken } from "@/lib/anon";
import { createKit, warmServer } from "@/lib/kits.functions";
import { extractKit } from "@/lib/extraction.functions";
import { uploadBrandSource } from "@/lib/uploads.functions";
import { ExtractionProgress } from "@/components/extraction-progress";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.svg,image/*,application/pdf";
const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;

export function IngestionPanel() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const create = useServerFn(createKit);
    const extract = useServerFn(extractKit);
    const upload = useServerFn(uploadBrandSource);
    const warm = useServerFn(warmServer);

    const [url, setUrl] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    const [stage, setStage] = useState<string>("");
    const [stageTick, setStageTick] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const [zoneHover, setZoneHover] = useState(false);
    const dragCounter = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const ownerToken = user?.id ?? getAnonToken();

    // Probe the server function layer before allowing extraction. In the Lovable
    // sandbox the SSR HTML can render before the dev server / worker is actually
    // ready to accept RPC calls; submitting too early fails. Retry until warmServer
    // succeeds, then unlock the form.
    useEffect(() => {
        let cancelled = false;
        let attempt = 0;
        async function probe() {
            while (!cancelled) {
                try {
                    await warm();
                    if (!cancelled) setReady(true);
                    return;
                } catch {
                    attempt += 1;
                    const delay = Math.min(2000, 300 + attempt * 250);
                    await new Promise((r) => setTimeout(r, delay));
                }
            }
        }
        probe();
        return () => {
            cancelled = true;
        };
    }, [warm]);

    const signalIntent = useCallback(() => {
        if (typeof window !== "undefined") window.dispatchEvent(new Event("branddna:ingestion-intent"));
    }, []);

    const addFiles = useCallback((incoming: FileList | File[]) => {
        const next: File[] = [];
        for (const f of Array.from(incoming)) {
            if (f.size > MAX_BYTES) {
                toast.error(`"${f.name}" exceeds 20 MB`);
                continue;
            }
            next.push(f);
        }
        setFiles((prev) => {
            const merged = [...prev, ...next].slice(0, MAX_FILES);
            if (prev.length + next.length > MAX_FILES) {
                toast.error(`Max ${MAX_FILES} files`);
            }
            return merged;
        });
    }, []);

    // Window-wide drag overlay
    useEffect(() => {
        const onEnter = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes("Files")) return;
            dragCounter.current += 1;
            setDragActive(true);
        };
        const onLeave = () => {
            dragCounter.current = Math.max(0, dragCounter.current - 1);
            if (dragCounter.current === 0) setDragActive(false);
        };
        const onOver = (e: DragEvent) => {
            if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
        };
        const onDrop = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes("Files")) return;
            e.preventDefault();
            dragCounter.current = 0;
            setDragActive(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        };
        window.addEventListener("dragenter", onEnter);
        window.addEventListener("dragleave", onLeave);
        window.addEventListener("dragover", onOver);
        window.addEventListener("drop", onDrop);
        return () => {
            window.removeEventListener("dragenter", onEnter);
            window.removeEventListener("dragleave", onLeave);
            window.removeEventListener("dragover", onOver);
            window.removeEventListener("drop", onDrop);
        };
    }, [addFiles]);

    // Cycle a fun, rotating "what we're doing" label while busy
    useEffect(() => {
        if (!busy) return;
        const cycle = [
            "Reading source",
            "Sampling palette",
            "Reading type",
            "Listening for voice",
            "Collecting marks",
            "Inferring tokens",
            "Composing kit",
        ];
        setStage(cycle[0]);
        let i = 0;
        const t = setInterval(() => {
            i = (i + 1) % cycle.length;
            setStage(cycle[i]);
            setStageTick((n) => n + 1);
        }, 1800);
        return () => clearInterval(t);
    }, [busy]);

    function removeFile(i: number) {
        setFiles((prev) => prev.filter((_, idx) => idx !== i));
    }

    async function submit(e?: React.FormEvent) {
        e?.preventDefault();
        if (busy) return;
        if (!ready) {
            toast.error("Initializing — one moment");
            return;
        }
        const trimmed = url.trim();
        const hasUrl = trimmed.length > 0;
        const hasFiles = files.length > 0;
        if (!hasUrl && !hasFiles) {
            toast.error("Paste a URL or drop a file");
            return;
        }
        signalIntent();
        let normUrl: string | undefined;
        if (hasUrl) {
            normUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
            try {
                new URL(normUrl);
            } catch {
                toast.error("Invalid URL");
                return;
            }
        }

        setBusy(true);
        setStage(hasFiles ? "Uploading sources" : "Creating kit");
        try {
            const sourceType: "url" | "upload" | "mixed" =
                hasUrl && hasFiles ? "mixed" : hasUrl ? "url" : "upload";
            const { id } = await create({
                data: { ownerToken, isAuthed: !!user, sourceType, sourceUrl: normUrl },
            });

            let imageUrls: string[] | undefined;
            let pdfTexts: string[] | undefined;
            if (hasFiles) {
                const fd = new FormData();
                fd.append("kitId", id);
                fd.append("ownerToken", ownerToken);
                for (const f of files) fd.append("file", f);
                const res = await upload({ data: fd });
                imageUrls = res.imageUrls.length ? res.imageUrls : undefined;
                pdfTexts = res.pdfTexts.length ? res.pdfTexts : undefined;
            }

            setStage("Extracting brand");
            const extracted = await extract({
                data: { kitId: id, ownerToken, url: normUrl, imageUrls, pdfTexts },
            });
            if (!extracted.ok) {
                throw new Error(extracted.error ?? "Extraction failed");
            }
            navigate({ to: "/kit/$kitId", params: { kitId: id } });
        } catch (err: any) {
            toast.error(err?.message ?? "Extraction failed");
        } finally {
            setBusy(false);
            setStage("");
        }
    }

    return (
        <>
            <style>{panelCss}</style>

            <form className="ingest" onSubmit={submit} aria-label="Brand ingestion">
                <div className="ingest-row">
                    <span className="ingest-prefix" aria-hidden="true">URL /</span>
                    <input
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="paste any website"
                        value={url}
                        onChange={(e) => {
                            signalIntent();
                            setUrl(e.target.value);
                        }}
                        onFocus={signalIntent}
                        disabled={busy || !ready}
                        className="ingest-input"
                        aria-label="Website URL"
                    />
                    <button type="submit" className="ingest-go" disabled={busy || !ready} aria-label="Extract">
                        {!ready ? (
                            <span className="ingest-go-label is-busy">
                                [ INITIALIZING<span className="ingest-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span> ]
                            </span>
                        ) : busy ? (
                            <span className="ingest-go-label is-busy">
                                [ EXTRACTING<span className="ingest-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span> ]
                            </span>
                        ) : (
                            <span key={stageTick} className="ingest-go-label">[ EXTRACT → ]</span>
                        )}
                    </button>
                </div>

                {busy && (
                    <div className="ingest-progress">
                        <ExtractionProgress variant="panel" hint="Usually 15–30 seconds" />
                    </div>
                )}

                <div
                    className={`ingest-zone${zoneHover ? " is-hover" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => !busy && inputRef.current?.click()}
                    onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !busy) {
                            e.preventDefault();
                            inputRef.current?.click();
                        }
                    }}
                    onDragOver={(e) => {
                        if (e.dataTransfer.types.includes("Files")) {
                            e.preventDefault();
                            setZoneHover(true);
                        }
                    }}
                    onDragLeave={() => setZoneHover(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setZoneHover(false);
                        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                    }}
                    aria-label="Drop assets or click to browse"
                >
                    <span className="ingest-zone-eyebrow">// drop zone</span>
                    <span className="ingest-zone-title">
                        Drag &amp; drop a deck, logo, screenshot, or PDF
                    </span>
                    <span className="ingest-zone-meta">
                        — OR <u>CLICK TO BROWSE</u> · PDF · PNG · JPG · WEBP · SVG ·[LESS THAN 20 MB EACH]
                    </span>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={ACCEPT}
                        hidden
                        onChange={(e) => {
                            if (e.target.files) addFiles(e.target.files);
                            e.target.value = "";
                        }}
                    />
                </div>

                {files.length > 0 && (
                    <ul className="ingest-files">
                        {files.map((f, i) => (
                            <li key={`${f.name}-${i}`}>
                                <span className="ingest-file-name">— {f.name}</span>
                                <span className="ingest-file-meta">{Math.round(f.size / 1024)} KB</span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(i)}
                                    aria-label={`Remove ${f.name}`}
                                    disabled={busy}
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </form>

            {dragActive && (
                <div className="ingest-overlay" aria-hidden="true">
                    <div className="ingest-overlay-card">
                        <span className="ingest-overlay-eyebrow">// drop to ingest</span>
                        <span className="ingest-overlay-title">Release file</span>
                        <span className="ingest-overlay-meta">
                            PDF · PNG · JPG · WEBP · SVG — max {MAX_FILES} files, 20 MB each
                        </span>
                    </div>
                </div>
            )}
        </>
    );
}

const panelCss = `
  .ingest {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    max-width: 720px;
  }
  .ingest-row {
    display: flex;
    align-items: stretch;
    border: 1px solid rgba(10,10,10,0.18);
    background: rgba(249, 246, 240, 0.55);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    backdrop-filter: blur(18px) saturate(140%);
    border-radius: 999px;
    padding: 4px 4px 4px 0;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.7),
      inset 0 -1px 0 rgba(10,10,10,0.04),
      0 10px 30px -16px rgba(10,10,10,0.22),
      0 1px 2px rgba(10,10,10,0.05);
    overflow: hidden;
    transition: box-shadow 200ms ease, border-color 200ms ease;
  }
  .ingest-row:focus-within {
    border-color: rgba(10,10,10,0.45);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.85),
      0 14px 40px -18px rgba(10,10,10,0.28),
      0 0 0 4px rgba(10,10,10,0.04);
  }
  .ingest-prefix {
    display: inline-flex;
    align-items: center;
    padding: 0 16px 0 20px;
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
    border-right: 1px solid rgba(10,10,10,0.12);
    background: transparent;
  }
  .ingest-input {
    flex: 1;
    min-width: 0;
    padding: 14px 18px;
    border: 0;
    outline: 0;
    background: transparent;
    font-family: 'Courier Prime', monospace;
    font-size: 14px;
    color: #0A0A0A;
    letter-spacing: 0.02em;
  }
  .ingest-input::placeholder {
    color: rgba(10,10,10,0.40);
  }
  .ingest-input:disabled { opacity: 0.5; }
  .ingest-go {
    appearance: none;
    border: 0;
    background: linear-gradient(180deg, #1a1a1a 0%, #0A0A0A 100%);
    color: #F4EFE6;
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    padding: 0 22px;
    margin: 0;
    border-radius: 999px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.12),
      0 6px 18px -8px rgba(10,10,10,0.5);
    cursor: pointer;
    transition: background 200ms ease, transform 200ms ease, box-shadow 200ms ease;
  }
  .ingest-go:hover:not(:disabled) {
    background: linear-gradient(180deg, #a02020 0%, #8B1A1A 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.18),
      0 10px 26px -8px rgba(139,26,26,0.55);
  }
  .ingest-go:disabled { opacity: 0.6; cursor: progress; }
  .ingest-go-label {
    display: inline-block;
    animation: ingestFade 600ms ease both;
  }
  @keyframes ingestFade {
    from { opacity: 0; transform: translateY(2px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ingest-dots { display: inline-block; letter-spacing: 0.05em; margin-left: 2px; }
  .ingest-dots span {
    display: inline-block;
    opacity: 0.2;
    animation: ingestDot 1.2s infinite ease-in-out both;
  }
  .ingest-dots span:nth-child(2) { animation-delay: 0.2s; }
  .ingest-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes ingestDot {
    0%, 80%, 100% { opacity: 0.2; }
    40% { opacity: 1; }
  }

  .ingest-progress { margin-top: 6px; }

  .ingest-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 24px;
    border: 1px dashed rgba(10,10,10,0.30);
    background: rgba(249, 246, 240, 0.40);
    -webkit-backdrop-filter: blur(14px) saturate(130%);
    backdrop-filter: blur(14px) saturate(130%);
    border-radius: 28px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
    text-align: center;
    cursor: pointer;
    transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
    outline: 0;
  }
  .ingest-zone:hover,
  .ingest-zone:focus-visible,
  .ingest-zone.is-hover {
    border-color: rgba(10,10,10,0.55);
    background: rgba(249, 246, 240, 0.65);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 8px 24px -14px rgba(10,10,10,0.22);
  }
  .ingest-zone-eyebrow {
    font-family: 'Courier Prime', monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
  }
  .ingest-zone-title {
    font-family: 'Cormorant Garamond', 'Fraunces', serif;
    font-style: italic;
    font-weight: 400;
    font-size: 22px;
    line-height: 1.15;
    color: #0A0A0A;
  }
  .ingest-zone-meta {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
  }
  .ingest-zone-meta u { text-decoration: underline; text-underline-offset: 3px; }

  .ingest-foot {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
  }
  .ingest-browse {
    appearance: none;
    border: 1px solid rgba(10,10,10,0.20);
    background: transparent;
    padding: 6px 10px;
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: #0A0A0A;
    cursor: pointer;
    transition: border-color 150ms ease, color 150ms ease;
  }
  .ingest-browse:hover:not(:disabled) { border-color: #0A0A0A; color: #8B1A1A; }
  .ingest-browse:disabled { opacity: 0.5; }

  .ingest-files {
    list-style: none;
    margin: 0;
    padding: 12px 16px;
    border: 1px solid rgba(10,10,10,0.15);
    background: rgba(249, 246, 240, 0.45);
    -webkit-backdrop-filter: blur(14px) saturate(130%);
    backdrop-filter: blur(14px) saturate(130%);
    border-radius: 18px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ingest-files li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'Courier Prime', monospace;
    font-size: 12px;
    color: #0A0A0A;
  }
  .ingest-file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ingest-file-meta { color: rgba(10,10,10,0.50); letter-spacing: 0.08em; }
  .ingest-files button {
    appearance: none;
    border: 0;
    background: transparent;
    color: rgba(10,10,10,0.55);
    font-family: 'Courier Prime', monospace;
    font-size: 14px;
    cursor: pointer;
    padding: 0 6px;
    transition: color 150ms ease;
  }
  .ingest-files button:hover { color: #8B1A1A; }

  .ingest-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(244, 239, 230, 0.55);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    backdrop-filter: blur(20px) saturate(140%);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .ingest-overlay-card {
    border: 1px solid rgba(10,10,10,0.20);
    padding: 48px 64px;
    background: rgba(249, 246, 240, 0.75);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    backdrop-filter: blur(24px) saturate(150%);
    border-radius: 36px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.7),
      0 30px 60px -30px rgba(10,10,10,0.35);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .ingest-overlay-eyebrow {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
  }
  .ingest-overlay-title {
    font-family: 'Cormorant Garamond', 'Fraunces', serif;
    font-weight: 300;
    font-style: italic;
    font-size: 56px;
    line-height: 1;
    color: #0A0A0A;
  }
  .ingest-overlay-meta {
    font-family: 'Courier Prime', monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(10,10,10,0.55);
  }

  @media (max-width: 720px) {
    .ingest-row { flex-wrap: wrap; border-radius: 24px; padding: 6px; }
    .ingest-prefix { width: 100%; padding: 10px 16px; border-right: 0; border-bottom: 1px solid rgba(10,10,10,0.12); }
    .ingest-go { width: 100%; padding: 14px 22px; margin-top: 6px; }
  }
`;
