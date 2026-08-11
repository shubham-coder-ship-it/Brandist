import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSharedKit } from "@/lib/shared-kit.functions";
import { TokensSection, VoiceSection } from "@/routes/kit.$kitId";

export const Route = createFileRoute("/share/$shareToken")({
    component: SharedKitPage,
});

function SharedKitPage() {
    const { shareToken } = Route.useParams();
    const fetchKit = useServerFn(getSharedKit);
    const [data, setData] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        fetchKit({ data: { shareToken } })
            .then(setData)
            .catch((e: any) => setErr(e?.message ?? "Failed to load"));
    }, [shareToken, fetchKit]);

    if (err) {
        return (
            <div className="min-h-screen bg-background">
                <SiteHeader />
                <div className="mx-auto max-w-3xl px-6 py-20 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                    <h1 className="mt-4 text-2xl font-semibold">{err}</h1>
                    <Link to="/" className="mt-6 inline-block">
                        <Button>Go home</Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-background">
                <SiteHeader />
                <div className="mx-auto max-w-3xl px-6 py-20 text-center">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    const kit = data.kit;
    return (
        <div className="min-h-screen bg-background">
            <SiteHeader />
            <main className="mx-auto max-w-7xl px-6 py-12">
                <div className="mb-8">
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs uppercase tracking-wider text-accent">
                        Shared kit · read-only
                    </span>
                    <h1 className="mt-3 text-4xl font-semibold tracking-tight">{kit.name}</h1>
                    {kit.source_url && (
                        <a
                            href={kit.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block font-mono text-sm text-muted-foreground hover:text-foreground"
                        >
                            {kit.source_url}
                        </a>
                    )}
                </div>

                {/* Colors */}
                <section className="mb-12">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Colors
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {data.colors.map((c: any) => (
                            <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-card">
                                <div className="h-28" style={{ background: c.hex }} />
                                <div className="p-4">
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.role}</div>
                                    <div className="font-medium">{c.name}</div>
                                    <div className="font-mono text-sm">{c.hex}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Fonts */}
                {data.fonts.length > 0 && (
                    <section className="mb-12">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Typography
                        </h2>
                        <div className="grid gap-4">
                            {data.fonts.map((f: any) => (
                                <div key={f.id} className="rounded-xl border border-border bg-card p-6">
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{f.role}</div>
                                    <div className="text-2xl font-semibold">{f.family}</div>
                                    <div
                                        className="mt-3 text-3xl"
                                        style={{ fontFamily: `"${f.family}", ${f.role === "mono" ? "monospace" : "sans-serif"}` }}
                                    >
                                        The quick brown fox jumps over the lazy dog
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Assets */}
                {data.assets.length > 0 && (
                    <section className="mb-12">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Logos & Assets
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {data.assets.map((a: any) => (
                                <div key={a.id} className="overflow-hidden rounded-xl border border-border bg-card">
                                    <div className="flex h-40 items-center justify-center bg-surface p-6">
                                        <img src={a.url} alt={a.kind} className="max-h-full max-w-full object-contain" />
                                    </div>
                                    <div className="border-t border-border p-3 text-xs uppercase tracking-wider text-muted-foreground">
                                        {a.kind}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {data.tokens.length > 0 && (
                    <section className="mb-12">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Tokens
                        </h2>
                        <TokensSection tokens={data.tokens} />
                    </section>
                )}

                {data.voice && (
                    <section className="mb-12">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Voice
                        </h2>
                        <VoiceSection voice={data.voice} kitId={data.kit.id} />
                    </section>
                )}

                <div className="mt-16 rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">Build your own brand kit in seconds.</p>
                    <Link to="/" className="mt-3 inline-block">
                        <Button>Try Brand DNA</Button>
                    </Link>
                </div>
            </main>
        </div>
    );
}
