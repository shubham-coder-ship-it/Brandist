// Server-side helpers — calls Lovable AI Gateway and Firecrawl.
// Never imported from client code.
import { isBlockedSourceUrl } from "./url-guard.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Transient HTTP statuses that warrant a retry. 429 (rate limit) and 5xx
// (gateway / upstream provider hiccups like 502/503/504) are retried with
// exponential backoff + jitter. 402 (out of credits) and 4xx auth errors
// are NOT retried — they need user action.
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);
const MAX_ATTEMPTS = 2;
const AI_TIMEOUT_MS = 10000;
const SCRAPE_TIMEOUT_MS = 8000;
const DIRECT_SCRAPE_TIMEOUT_MS = 5000;
const MAP_TIMEOUT_MS = 2500;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number) {
    // 600ms, 1.2s, 2.4s, 4.8s (+/- 30% jitter)
    const base = 600 * Math.pow(2, attempt - 1);
    const jitter = base * (Math.random() * 0.6 - 0.3);
    return Math.min(15000, Math.round(base + jitter));
}

function timeoutSignal(ms: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function attr(tag: string, name: string) {
    return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function absolutize(raw: string | undefined, baseUrl: string) {
    if (!raw || raw.startsWith("data:")) return undefined;
    try { return new URL(raw, baseUrl).toString(); } catch { return undefined; }
}

function metaContent(html: string, key: string) {
    const re = /<meta\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
        const tag = m[0];
        const prop = attr(tag, "property") ?? attr(tag, "name");
        if (prop?.toLowerCase() === key.toLowerCase()) return attr(tag, "content");
    }
    return undefined;
}

function htmlToMarkdown(html: string, url: string) {
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const description = metaContent(html, "description") ?? metaContent(html, "og:description");
    const text = html
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
    return [`# ${title || url}`, description, text.slice(0, 60000)].filter(Boolean).join("\n\n");
}

async function directScrape(url: string) {
    if (isBlockedSourceUrl(url)) throw new Error("Source URL is not allowed");
    const timeout = timeoutSignal(DIRECT_SCRAPE_TIMEOUT_MS);
    const res = await fetch(url, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 (compatible; BrandKitBot/1.0; +https://get-brand-kit.lovable.app)",
        },
        redirect: "follow",
        signal: timeout.signal,
    }).finally(timeout.clear);
    if (!res.ok) throw new Error(`Direct scrape failed [${res.status}]`);
    const contentType = res.headers.get("content-type") ?? "";
    const html = await res.text();
    if (!contentType.includes("html") && !/<html|<title|<body/i.test(html)) {
        throw new Error("Source did not return HTML");
    }
    const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)]
        .map((m) => absolutize(m[1], url))
        .filter((v): v is string => !!v)
        .slice(0, 120);
    const iconTag = html.match(/<link\b[^>]*rel\s*=\s*["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/i)?.[0];
    const logoTag = html.match(/<img\b[^>]*(?:logo|wordmark|brand)[^>]*>/i)?.[0];
    const ogImage = absolutize(metaContent(html, "og:image") ?? metaContent(html, "twitter:image"), url);
    const favicon = absolutize(attr(iconTag ?? "", "href"), url);
    const logo = absolutize(attr(logoTag ?? "", "src") ?? attr(logoTag ?? "", "data-src"), url);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const description = metaContent(html, "description") ?? metaContent(html, "og:description");
    return {
        data: {
            markdown: htmlToMarkdown(html, url),
            rawHtml: html.slice(0, 250000),
            html: html.slice(0, 250000),
            links,
            branding: {
                name: title,
                summary: description,
                images: { logo, favicon, ogImage },
            },
        },
    };
}

export async function callAI(opts: {
    model?: string;
    system?: string;
    messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
    tools?: any[];
    tool_choice?: any;
    temperature?: number;
}) {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const messages = opts.system
        ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
        : opts.messages;

    const body: any = {
        model: opts.model ?? "google/gemini-3-flash-preview",
        messages,
    };
    if (opts.tools) body.tools = opts.tools;
    if (opts.tool_choice) body.tool_choice = opts.tool_choice;
    if (opts.temperature != null) body.temperature = opts.temperature;

    const payload = JSON.stringify(body);
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let res: Response;
        const timeout = timeoutSignal(AI_TIMEOUT_MS);
        try {
            res = await fetch(GATEWAY, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                body: payload,
                signal: timeout.signal,
            });
        } catch (err) {
            // Network-level failure (DNS, socket reset, abort). Retry.
            lastErr = err;
            if (attempt < MAX_ATTEMPTS) {
                await sleep(backoffMs(attempt));
                continue;
            }
            const name = (err as Error)?.name;
            throw new Error(name === "AbortError" ? "AI gateway timeout" : `AI gateway unreachable: ${(err as Error)?.message ?? "network error"}`);
        } finally {
            timeout.clear();
        }

        if (res.ok) return res.json();

        // Read body once for error context.
        const text = await res.text().catch(() => "");

        // Non-retryable terminal failures.
        if (res.status === 402) {
            throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
        }
        if (res.status === 401 || res.status === 403) {
            throw new Error(`AI gateway auth error ${res.status}: ${text.slice(0, 200)}`);
        }

        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
            // Honor Retry-After if present, else exponential backoff.
            const retryAfter = Number(res.headers.get("retry-after"));
            const wait = Number.isFinite(retryAfter) && retryAfter > 0
                ? Math.min(15000, retryAfter * 1000)
                : backoffMs(attempt);
            console.warn(
                `[ai] gateway ${res.status} on attempt ${attempt}/${MAX_ATTEMPTS}, retrying in ${wait}ms`,
            );
            await sleep(wait);
            lastErr = new Error(`AI gateway error ${res.status}`);
            continue;
        }

        if (res.status === 429) {
            throw new Error("AI is busy right now. Please retry in a moment.");
        }
        throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 300)}`);
    }

    throw lastErr instanceof Error
        ? lastErr
        : new Error("AI gateway failed after multiple retries");
}

export async function callAIStructured<T>(opts: {
    system: string;
    user: string | any[];
    toolName: string;
    toolDescription: string;
    parameters: any;
    model?: string;
}): Promise<T> {
    const data = await callAI({
        model: opts.model,
        system: opts.system,
        messages: [{ role: "user", content: opts.user as any }],
        tools: [
            {
                type: "function",
                function: {
                    name: opts.toolName,
                    description: opts.toolDescription,
                    parameters: opts.parameters,
                },
            },
        ],
        tool_choice: { type: "function", function: { name: opts.toolName } },
    });
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI did not return structured output");
    return JSON.parse(call.function.arguments) as T;
}

const FIRECRAWL_API = "https://api.firecrawl.dev";

export async function firecrawlScrape(url: string) {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return directScrape(url);

    async function apiScrape() {
        const timeout = timeoutSignal(SCRAPE_TIMEOUT_MS);
        try {
            const res = await fetch(`${FIRECRAWL_API}/v2/scrape`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url,
                    formats: ["markdown", "rawHtml", "links", "branding", "summary"],
                    onlyMainContent: false,
                    timeout: 7000,
                }),
                signal: timeout.signal,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Firecrawl scrape failed [${res.status}]: ${text.slice(0, 300)}`);
            }
            return res.json();
        } finally {
            timeout.clear();
        }
    }

    try {
        return await Promise.any([directScrape(url), apiScrape()]);
    } catch (e: any) {
        const errors = Array.isArray(e?.errors) ? e.errors : [];
        const best = errors.find((err: any) => err?.message && err.name !== "AbortError") ?? errors[0] ?? e;
        throw best;
    }
}

// Map a site to discover URLs. Returns up to `limit` links.
export async function firecrawlMap(url: string, limit = 50): Promise<string[]> {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return [];
    try {
        const timeout = timeoutSignal(MAP_TIMEOUT_MS);
        const res = await fetch(`${FIRECRAWL_API}/v2/map`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ url, limit, includeSubdomains: false }),
            signal: timeout.signal,
        }).finally(timeout.clear);
        if (!res.ok) return [];
        const json: any = await res.json();
        const links: string[] = json.links ?? json.data?.links ?? [];
        return Array.isArray(links) ? links : [];
    } catch {
        return [];
    }
}
