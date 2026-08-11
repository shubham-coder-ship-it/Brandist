import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import {
    listDesignVersions,
    saveDesignVersion,
    getDesignVersion,
    type DesignVersionListItem,
} from "@/lib/design-doc.functions";

export const Route = createFileRoute("/design")({
    head: () => ({
        meta: [
            { title: "Design system — Brand DNA" },
            {
                name: "description",
                content: "The Invisible Instrument — design system source of truth.",
            },
        ],
    }),
    component: DesignPage,
});

const labelMono =
    "font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground";
const eyebrow =
    "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";
const buttonClass =
    "font-mono text-[12px] uppercase tracking-[0.1em] px-6 py-2 hover:opacity-90 transition-opacity";

const SEED_FALLBACK = `# Brand DNA — Design System Document

## 02. Palette

### Light Mode
\`\`\`
--background:     #F4EFE6
--foreground:     #0A0A0A
--accent:         #8B1A1A
\`\`\`
`;

function DesignPage() {
    const list = useServerFn(listDesignVersions);
    const get = useServerFn(getDesignVersion);
    const save = useServerFn(saveDesignVersion);

    const [versions, setVersions] = useState<DesignVersionListItem[]>([]);
    const [markdown, setMarkdown] = useState("");
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { versions: v } = await list();
                setVersions(v);
                if (v.length > 0) {
                    const head = await get({ data: { id: v[0].id } });
                    setMarkdown(head.markdown);
                } else {
                    setMarkdown(SEED_FALLBACK);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to load");
            }
        })();
    }, [list, get]);

    async function onSave() {
        setBusy(true);
        setError(null);
        try {
            await save({ data: { markdown, label: label.trim() || undefined } });
            const { versions: v } = await list();
            setVersions(v);
            setEditing(false);
            setLabel("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <SiteHeader />
            <main className="mx-auto max-w-5xl px-6 py-12">
                <div className="flex items-baseline justify-between">
                    <div>
                        <p className={eyebrow}>// design system source of truth</p>
                        <h1
                            className="mt-2"
                            style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: "clamp(48px, 7vw, 80px)",
                                lineHeight: 0.95,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            DESIGN.md
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/design/history"
                            className="font-mono text-[12px] uppercase tracking-[0.12em] hover:opacity-70 transition-opacity"
                        >
                            [ History ]
                        </Link>
                        {!editing ? (
                            <button
                                onClick={() => setEditing(true)}
                                className={buttonClass}
                                style={{ border: "1px solid #0A0A0A" }}
                            >
                                [ Edit ]
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setEditing(false);
                                    setLabel("");
                                }}
                                className="font-mono text-[12px] uppercase tracking-[0.12em] hover:opacity-70 transition-opacity"
                            >
                                × Cancel
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="mt-2"
                    style={{ borderTop: "1px solid rgba(10,10,10,0.25)" }}
                />

                {error ? (
                    <p
                        className="mt-6 font-mono text-[12px] uppercase tracking-[0.12em]"
                        style={{ color: "var(--accent)" }}
                    >
                        — {error}
                    </p>
                ) : null}

                <p className={`${labelMono} mt-6`}>
                    {versions.length > 0
                        ? `Viewing v${String(versions[0].version).padStart(2, "0")} · ${new Date(
                            versions[0].created_at,
                        ).toLocaleString()}`
                        : "No snapshots yet — saving will create v01."}
                </p>

                {editing ? (
                    <div className="mt-6 flex flex-col gap-4">
                        <input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="optional label — e.g. tightened contrast"
                            className="font-mono text-[13px] bg-transparent px-3 py-2 outline-none"
                            style={{ border: "1px solid #0A0A0A" }}
                        />
                        <textarea
                            value={markdown}
                            onChange={(e) => setMarkdown(e.target.value)}
                            spellCheck={false}
                            className="w-full font-mono text-[13px] leading-[1.6] bg-transparent p-4 outline-none resize-y"
                            style={{
                                border: "1px solid #0A0A0A",
                                minHeight: "60vh",
                                fontFamily: "'Courier Prime', monospace",
                            }}
                        />
                        <div>
                            <button
                                onClick={onSave}
                                disabled={busy}
                                className={buttonClass}
                                style={{
                                    border: "1px solid #0A0A0A",
                                    backgroundColor: "var(--foreground)",
                                    color: "var(--background)",
                                }}
                            >
                                [ {busy ? "Saving…" : "Save snapshot"} ]
                            </button>
                        </div>
                    </div>
                ) : (
                    <pre
                        className="mt-6 whitespace-pre-wrap break-words p-6 text-[13px] leading-[1.6]"
                        style={{
                            border: "1px solid rgba(10,10,10,0.25)",
                            backgroundColor: "var(--surface-raised, var(--surface))",
                            fontFamily: "'Courier Prime', monospace",
                        }}
                    >
                        {markdown || "—"}
                    </pre>
                )}
            </main>
        </div>
    );
}
