import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { diffDesignVersions } from "@/lib/design-doc.functions";
import {
    summarizeDiff,
    type DesignDocDiff,
    type DesignDocFieldDiff,
} from "@/lib/design-doc";

const searchSchema = z.object({
    a: z.string().uuid(),
    b: z.string().uuid(),
});

export const Route = createFileRoute("/design/history/diff")({
    validateSearch: (search) => searchSchema.parse(search),
    head: () => ({
        meta: [
            { title: "Design diff — Brand DNA" },
            { name: "description", content: "Structured diff between two design system snapshots." },
        ],
    }),
    component: DiffPage,
});

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";
const mono = "font-mono text-[12px] uppercase tracking-[0.12em]";
const monoCell = "font-mono text-[13px]";

type DiffResult = {
    a: { version: number; label: string | null; created_at: string };
    b: { version: number; label: string | null; created_at: string };
    diff: DesignDocDiff;
};

function DiffPage() {
    const { a, b } = Route.useSearch();
    const run = useServerFn(diffDesignVersions);
    const [data, setData] = useState<DiffResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showUnchanged, setShowUnchanged] = useState(false);

    useEffect(() => {
        run({ data: { aId: a, bId: b } })
            .then((res: DiffResult) => setData(res))
            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to diff"));
    }, [a, b, run]);

    const summary = data ? summarizeDiff(data.diff) : null;

    return (
        <div className="min-h-screen bg-background">
            <SiteHeader />
            <main className="mx-auto max-w-5xl px-6 py-12">
                <div className="flex items-baseline justify-between">
                    <div>
                        <p className={eyebrow}>// structured diff</p>
                        <h1
                            className="mt-2"
                            style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: "clamp(40px, 5vw, 64px)",
                                lineHeight: 0.95,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {data
                                ? `v${String(data.a.version).padStart(2, "0")} → v${String(
                                    data.b.version,
                                ).padStart(2, "0")}`
                                : "—"}
                        </h1>
                    </div>
                    <Link to="/design/history" className={mono + " hover:opacity-70 transition-opacity"}>
                        ← History
                    </Link>
                </div>

                <div className="mt-2" style={{ borderTop: "1px solid rgba(10,10,10,0.25)" }} />

                {error ? (
                    <p className={mono + " mt-6"} style={{ color: "var(--accent)" }}>
                        — {error}
                    </p>
                ) : null}

                {summary ? (
                    <div className="mt-6 flex items-center gap-8">
                        <p className={eyebrow}>
                            {summary.changed} changed · {summary.added} added · {summary.removed} removed
                        </p>
                        <button
                            onClick={() => setShowUnchanged((v) => !v)}
                            className={mono + " hover:opacity-70 transition-opacity"}
                        >
                            [ {showUnchanged ? "Hide" : "Show"} unchanged ]
                        </button>
                    </div>
                ) : null}

                {data ? (
                    <div className="mt-12 flex flex-col gap-12">
                        {data.diff.sections.map((section) => {
                            const visible = section.entries.filter((e) =>
                                showUnchanged ? true : e.kind !== "unchanged",
                            );
                            return (
                                <section key={section.section}>
                                    <h2
                                        className="font-mono text-[13px] uppercase tracking-[0.18em] pb-3"
                                        style={{ borderBottom: "1px solid #0A0A0A" }}
                                    >
                                        {section.section}
                                    </h2>
                                    {visible.length === 0 ? (
                                        <p className={eyebrow + " py-4"}>
                                            — no {showUnchanged ? "" : "changed "}entries
                                        </p>
                                    ) : (
                                        <ul>
                                            {visible.map((entry, i) => (
                                                <DiffRow key={`${section.section}-${i}`} entry={entry} />
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                ) : (
                    !error && <p className={eyebrow + " mt-8"}>Loading diff…</p>
                )}
            </main>
        </div>
    );
}

function DiffRow({ entry }: { entry: DesignDocFieldDiff }) {
    const gutterMap: Record<DesignDocFieldDiff["kind"], string> = {
        added: "+",
        removed: "−",
        changed: "·",
        unchanged: " ",
    };
    const isAccent = entry.kind === "changed" || entry.kind === "added" || entry.kind === "removed";
    return (
        <li
            className="grid grid-cols-[24px_minmax(160px,_220px)_1fr_120px] items-baseline gap-4 py-3"
            style={{ borderBottom: "1px solid rgba(10,10,10,0.25)" }}
        >
            <span
                className="font-mono text-[14px]"
                style={{ color: isAccent ? "var(--accent)" : "var(--muted, rgba(10,10,10,0.45))" }}
            >
                {gutterMap[entry.kind]}
            </span>
            <span className={monoCell + " break-words"}>{entry.key}</span>
            <span className={monoCell + " break-words"} style={{ color: "var(--muted, rgba(10,10,10,0.6))" }}>
                {entry.kind === "changed" ? (
                    <>
                        {entry.from} <span style={{ color: "var(--accent)" }}>→</span> {entry.to}
                    </>
                ) : entry.kind === "unchanged" ? (
                    entry.value
                ) : (
                    entry.value
                )}
            </span>
            <span
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-right"
                style={{ color: isAccent ? "var(--accent)" : "rgba(10,10,10,0.35)" }}
            >
                {entry.kind === "unchanged" ? "·" : entry.kind}
            </span>
        </li>
    );
}
