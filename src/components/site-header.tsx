import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { StartHereButton } from "@/components/start-here-button";

const navLinkClass =
    "inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors";

const ctaClass =
    "font-mono text-[12px] uppercase tracking-[0.1em] bg-foreground text-background px-5 py-2 rounded-full hover:opacity-90 transition-opacity";

export function SiteHeader() {
    return (
        <header
            className="sticky top-0 z-30 bg-background"
            style={{ borderBottom: "1px solid #0A0A0A" }}
        >
            <div className="relative mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
                <Link
                    to="/"
                    className="truncate font-mono text-[12px] uppercase tracking-[0.2em] text-foreground sm:text-[13px]"
                >
                    Brand Kit
                </Link>
                <div className="absolute left-1/2 -translate-x-1/2">
                    <StartHereButton />
                </div>
                <nav className="flex shrink-0 items-center gap-4 sm:gap-8">
                    <Link to="/library" className={navLinkClass}>
                        <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                        Library
                    </Link>
                    <Link to="/" className={`${ctaClass} whitespace-nowrap`}>
                        New kit
                    </Link>
                </nav>
            </div>
        </header>
    );
}
