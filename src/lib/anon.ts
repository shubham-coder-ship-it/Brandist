// Anonymous kit ownership token stored in localStorage.
// Lets a non-logged-in user keep working with their kit across reloads.
const KEY = "branddna.anon_token";
const HISTORY_KEY = "branddna.anon_token_history";

export function getAnonToken(): string {
    if (typeof window === "undefined") return "";
    let t = localStorage.getItem(KEY);
    if (!t) {
        t = crypto.randomUUID();
        localStorage.setItem(KEY, t);
    }
    // Always make sure the active token is recorded in history.
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(t)) {
            arr.push(t);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-20)));
        }
    } catch {
        localStorage.setItem(HISTORY_KEY, JSON.stringify([t]));
    }
    return t;
}

// Returns every anon token this browser has ever used (most recent last),
// including the active one. Useful for listing kits that may have been
// created under a previous token before localStorage rotated.
export function getAnonTokenHistory(): string[] {
    if (typeof window === "undefined") return [];
    const active = getAnonToken();
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(active)) arr.push(active);
        return Array.from(new Set(arr));
    } catch {
        return [active];
    }
}

