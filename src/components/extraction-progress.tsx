import { useEffect, useState } from "react";

const STAGES = [
    { label: "Reading the source", detail: "Fetching markup, branding metadata, screenshots" },
    { label: "Sampling the palette", detail: "Identifying primary, accent, surface, text" },
    { label: "Reading the type", detail: "Extracting families, weights, scale" },
    { label: "Listening for voice", detail: "Tone, vocabulary, do's and don'ts" },
    { label: "Collecting marks", detail: "Logos, favicons, social images" },
    { label: "Inferring tokens", detail: "Spacing, radius, motion, shadow" },
    { label: "Composing the kit", detail: "Sorting, naming, scoring contrast" },
];

// Shared ticker so every <ExtractionProgress /> instance shows the same stage.
let sharedIndex = 0;
const listeners = new Set<(n: number) => void>();
let tickerStarted = false;
function ensureTicker() {
    if (tickerStarted || typeof window === "undefined") return;
    tickerStarted = true;
    setInterval(() => {
        sharedIndex = (sharedIndex + 1) % STAGES.length;
        listeners.forEach((fn) => fn(sharedIndex));
    }, 2200);
}

export function ExtractionProgress({
    variant = "panel",
    hint,
}: {
    variant?: "panel" | "inline";
    hint?: string;
}) {
    const [i, setI] = useState(sharedIndex);
    useEffect(() => {
        ensureTicker();
        setI(sharedIndex);
        listeners.add(setI);
        return () => {
            listeners.delete(setI);
        };
    }, []);
    const stage = STAGES[i];

    if (variant === "inline") {
        return (
            <span className="font-mono text-[12px] tracking-[0.18em] uppercase">
                [ {stage.label}… ]
            </span>
        );
    }

    return (
        <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-raised)] p-12">
            <div className="mx-auto max-w-md text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          // 02 — extraction in progress
                </div>
                <h2
                    key={stage.label}
                    className="mt-6 text-3xl italic [font-family:'Cormorant_Garamond',serif] animate-in fade-in duration-700"
                >
                    {stage.label}.
                </h2>
                <p
                    key={stage.detail}
                    className="mt-3 text-sm text-muted-foreground [font-family:'Libre_Baskerville',serif] animate-in fade-in duration-700"
                >
                    {stage.detail}
                </p>

                <div className="mt-10 flex items-center justify-center gap-2">
                    {STAGES.map((_, idx) => (
                        <span
                            key={idx}
                            className="h-[3px] w-8 rounded-full transition-colors duration-500"
                            style={{
                                background:
                                    idx === i
                                        ? "var(--foreground)"
                                        : idx < i
                                            ? "rgba(10,10,10,0.45)"
                                            : "rgba(10,10,10,0.12)",
                            }}
                        />
                    ))}
                </div>

                {hint && (
                    <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        {hint}
                    </p>
                )}
            </div>
        </div>
    );
}
