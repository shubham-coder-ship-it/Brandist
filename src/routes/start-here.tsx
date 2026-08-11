import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/start-here")({
    head: () => ({
        meta: [
            { title: "How to Use — Brandist" },
            {
                name: "description",
                content:
                    "How to use Brandist: paste a company URL, extract the brand kit, and export colors, fonts, logos, and design tokens.",
            },
        ],
    }),
    component: StartHerePage,
});

function StartHerePage() {
    return (
        <div style={{ background: "#F4EFE6", color: "#0A0A0A", minHeight: "100vh" }}>
            <SiteHeader />
            <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
                <Eyebrow>// How to use</Eyebrow>
                <h1
                    className="mt-4"
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontWeight: 300,
                        fontSize: "clamp(44px, 6vw, 72px)",
                        lineHeight: 1,
                        letterSpacing: "-0.01em",
                    }}
                >
                    How to use <em style={{ fontStyle: "italic", fontWeight: 400 }}>Brandist.</em>
                </h1>

                <Divider />

                <Section number="01." title="What it does">
                    <P>
                        Paste any company URL. Brandist extracts the brand's palette,
                        typography, voice, and design tokens — and packages them as a
                        kit you can browse, share, and export.
                    </P>
                    <P>
                        Recent kits show up on the home page. Open one to see colors,
                        fonts, logos, and a generated <Mono>design.md</Mono>.
                    </P>
                    <P>
                        Drop these files into Lovable or your AI agent to use their
                        brand.
                    </P>
                </Section>

                <Section number="02." title="How to use it">
                    <P>
                        1. Go to the home page and paste a company URL into the input.
                    </P>
                    <P>
                        2. Wait a few seconds while Brandist extracts the brand data.
                    </P>
                    <P>
                        3. Browse the generated kit: colors, fonts, logos, and design tokens.
                    </P>
                    <P>
                        4. Save, share, or export the kit for your projects.
                    </P>
                </Section>

                <Divider />

                <div className="flex items-center justify-between">
                    <Link
                        to="/"
                        style={{
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 11,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            color: "#0A0A0A",
                            textDecoration: "none",
                            borderBottom: "1px solid #0A0A0A",
                            paddingBottom: 2,
                        }}
                    >
                        ← Back to extract
                    </Link>
                    <span
                        style={{
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 10,
                            letterSpacing: "0.24em",
                            textTransform: "uppercase",
                            color: "rgba(10,10,10,0.45)",
                        }}
                    >
                        Brandist / v1.0
                    </span>
                </div>
            </main>
        </div>
    );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 11,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(10,10,10,0.55)",
            }}
        >
            {children}
        </div>
    );
}

function Divider() {
    return (
        <hr
            style={{
                border: 0,
                borderTop: "1px solid rgba(10,10,10,0.2)",
                margin: "56px 0",
            }}
        />
    );
}

function Section({
    number,
    title,
    children,
}: {
    number: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section style={{ marginTop: 48 }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr",
                    gap: 16,
                    alignItems: "baseline",
                }}
            >
                <span
                    style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: 11,
                        letterSpacing: "0.18em",
                        color: "rgba(10,10,10,0.55)",
                    }}
                >
                    {number}
                </span>
                <h2
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontWeight: 400,
                        fontSize: 28,
                        margin: 0,
                        lineHeight: 1.15,
                    }}
                >
                    {title}
                </h2>
            </div>
            <div style={{ marginLeft: 72, marginTop: 16 }}>{children}</div>
        </section>
    );
}

function P({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <p
            style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: 15,
                lineHeight: 1.65,
                color: "rgba(10,10,10,0.82)",
                margin: "12px 0",
                ...style,
            }}
        >
            {children}
        </p>
    );
}

function Mono({ children }: { children: React.ReactNode }) {
    return (
        <code
            style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 13,
                background: "rgba(10,10,10,0.06)",
                padding: "2px 6px",
            }}
        >
            {children}
        </code>
    );
}
