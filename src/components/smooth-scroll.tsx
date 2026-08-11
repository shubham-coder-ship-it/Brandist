import { useEffect } from "react";
import Lenis from "lenis";

declare global {
    // eslint-disable-next-line no-var
    var __lenis: Lenis | undefined;
}

export function SmoothScroll() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        const lenis = new Lenis({
            duration: 1.05,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1.4,
        });
        window.__lenis = lenis;

        let raf = 0;
        const loop = (time: number) => {
            lenis.raf(time);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            lenis.destroy();
            if (window.__lenis === lenis) window.__lenis = undefined;
        };
    }, []);
    return null;
}

export function smoothScrollTo(target: string | HTMLElement, offset = -80) {
    const lenis = typeof window !== "undefined" ? window.__lenis : undefined;
    if (lenis) {
        lenis.scrollTo(target, { offset, duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3) });
        return;
    }
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
}