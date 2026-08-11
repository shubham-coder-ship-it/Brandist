// Server-only SSRF guard — blocks private IP ranges, loopback, link-local,
// and non-http(s) schemes. Use before any server-side fetch of a
// client-supplied or client-influenced URL.
export function isBlockedSourceUrl(url: string): boolean {
    try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") return true;
        const host = u.hostname.toLowerCase();
        if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
        if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return true;
        const private172 = host.match(/^172\.(\d+)\./);
        if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
        if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;
        return false;
    } catch {
        return true;
    }
}