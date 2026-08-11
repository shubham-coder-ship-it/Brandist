import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { getAnonToken, getAnonTokenHistory } from "@/lib/anon";
import { readKitsCache, writeKitsCache } from "@/lib/kits-cache";
import { useAutoImportFonts, renderFamilyFor } from "@/lib/font-loader";
import {
    renameKit,
    deleteKit,
    duplicateKit,
    bulkDeleteKits,
    listKitsByOwner,
} from "@/lib/kits.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/library")({
    component: LibraryPage,
});

type Kit = {
    id: string;
    name: string;
    source_url: string | null;
    status: string;
    created_at: string;
    primaryHex: string | null;
    palette?: string[];
    displayFont?: {
        family: string;
        google: boolean;
        source_family?: string | null;
        weights?: string[] | null;
        file_urls?: Array<{ url: string; weight?: string; style?: string; format?: string }> | null;
    } | null;
    logoUrl?: string | null;
};

const eyebrow =
    "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground";
const mono = "font-mono text-[11px] uppercase tracking-[0.16em]";

function LibraryPage() {
    const ownerToken = typeof window !== "undefined" ? getAnonToken() : "";
    const navigate = useNavigate();
    const list = useServerFn(listKitsByOwner);
    const renameFn = useServerFn(renameKit);
    const deleteFn = useServerFn(deleteKit);
    const duplicateFn = useServerFn(duplicateKit);
    const bulkDelete = useServerFn(bulkDeleteKits);

    const [kits, setKits] = useState<Kit[]>([]);
    const [busy, setBusy] = useState(true);
    const [hydrated, setHydrated] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [selectMode, setSelectMode] = useState(false);

    useEffect(() => {
        if (!ownerToken) return;
        // Hydrate from cache immediately so the page never flashes empty.
        const cached = readKitsCache();
        if (cached && cached.length > 0) {
            setKits(cached as Kit[]);
            setBusy(false);
            setHydrated(true);
        }
        (async () => {
            try {
                const res = await list({
                    data: { ownerToken, ownerTokens: getAnonTokenHistory() },
                });
                const next = (res.kits as Kit[]) ?? [];
                // Avoid wiping a populated cache if the server returns empty
                // (e.g. transient auth/token blip).
                if (next.length > 0 || (cached?.length ?? 0) === 0) {
                    setKits(next);
                    writeKitsCache(next);
                }
            } catch (e: any) {
                // Keep any cached kits visible — only surface error if we have nothing.
                if (!hydrated) toast.error(e?.message ?? "Failed to load kits");
            } finally {
                setBusy(false);
            }
        })();
    }, [ownerToken, list]);

    // Auto-import each kit's display font (Google + self-hosted via @font-face).
    useAutoImportFonts(
        kits
            .map((k) => k.displayFont)
            .filter(Boolean)
            .map((d: any) => ({
                family: d.family,
                source_family: d.source_family,
                google_font: d.google,
                weights: d.weights,
                file_urls: d.file_urls,
            })),
    );

    const allSelected = useMemo(
        () => kits.length > 0 && selected.size === kits.length,
        [kits, selected],
    );

    function toggle(id: string) {
        setSelected((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleAll() {
        setSelected((s) =>
            s.size === kits.length ? new Set() : new Set(kits.map((k) => k.id)),
        );
    }

    async function commitRename(k: Kit) {
        const next = draftName.trim();
        setEditingId(null);
        if (!next || next === k.name) return;
        try {
            await renameFn({ data: { kitId: k.id, ownerToken, name: next } });
            setKits((rows) => rows.map((r) => (r.id === k.id ? { ...r, name: next } : r)));
        } catch (e: any) {
            toast.error(e?.message ?? "Rename failed");
        }
    }

    async function onDuplicate(k: Kit) {
        try {
            const res: any = await duplicateFn({ data: { kitId: k.id, ownerToken } });
            const newKit = res?.kit;
            if (newKit) {
                setKits((rows) => [{ ...newKit, primaryHex: k.primaryHex ?? null }, ...rows]);
                toast.success("Duplicated");
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Duplicate failed");
        }
    }

    async function onDelete(k: Kit) {
        if (!confirm(`Delete "${k.name}"? This cannot be undone.`)) return;
        try {
            await deleteFn({ data: { kitId: k.id, ownerToken } });
            setKits((rows) => rows.filter((r) => r.id !== k.id));
        } catch (e: any) {
            toast.error(e?.message ?? "Delete failed");
        }
    }

    async function onBulkDelete() {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} kit${selected.size > 1 ? "s" : ""}? This cannot be undone.`))
            return;
        const ids = Array.from(selected);
        try {
            await bulkDelete({ data: { kitIds: ids, ownerToken } });
            setKits((rows) => rows.filter((r) => !selected.has(r.id)));
            setSelected(new Set());
            setSelectMode(false);
            toast.success(`Deleted ${ids.length} kit${ids.length > 1 ? "s" : ""}`);
        } catch (e: any) {
            toast.error(e?.message ?? "Bulk delete failed");
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-6 py-16">
                <div className="mb-12">
                    <p className={eyebrow}>// library</p>
                    <h1
                        className="mt-4"
                        style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontWeight: 300,
                            fontSize: "clamp(48px, 7vw, 80px)",
                            lineHeight: 0.95,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Brandist kits.
                    </h1>
                </div>

                {kits.length > 0 && (
                    <div
                        className="mb-6 flex items-center justify-between border-y py-3"
                        style={{ borderColor: "rgba(10,10,10,0.20)" }}
                    >
                        <div className="flex items-center gap-5">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectMode((v) => {
                                        const n = !v;
                                        if (!n) setSelected(new Set());
                                        return n;
                                    });
                                }}
                                className={`${mono} hover:opacity-70 transition-opacity`}
                            >
                                {selectMode ? "[ Done ]" : "[ Select ]"}
                            </button>
                            {selectMode && (
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    className={`${mono} text-muted-foreground hover:text-foreground transition-colors`}
                                >
                                    {allSelected ? "Clear all" : "Select all"}
                                </button>
                            )}
                            <span className={`${mono} text-muted-foreground`}>
                                {kits.length} {kits.length === 1 ? "kit" : "kits"}
                                {selectMode && selected.size > 0 ? ` · ${selected.size} selected` : ""}
                            </span>
                        </div>
                        {selectMode && selected.size > 0 && (
                            <button
                                type="button"
                                onClick={onBulkDelete}
                                className={`${mono} text-[#8B1A1A] hover:opacity-70 transition-opacity`}
                            >
                                [ Delete {selected.size} ]
                            </button>
                        )}
                    </div>
                )}

                {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : kits.length === 0 ? (
                    <div
                        className="border border-dashed p-20 text-center"
                        style={{ borderColor: "rgba(10,10,10,0.20)" }}
                    >
                        <p className={`${eyebrow}`}>EMPTY</p>
                        <p
                            className="mt-6"
                            style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontStyle: "italic",
                                fontSize: 28,
                                color: "rgba(10,10,10,0.7)",
                            }}
                        >
                            No kits yet.
                        </p>
                        <Link
                            to="/"
                            className={`${mono} mt-8 inline-block bg-foreground text-background px-5 py-2 hover:opacity-90 transition-opacity`}
                        >
                            [ Create your first kit ]
                        </Link>
                    </div>
                ) : (
                    <ul className="divide-y" style={{ borderColor: "rgba(10,10,10,0.20)" }}>
                        {kits.map((k) => {
                            const isEditing = editingId === k.id;
                            const isSelected = selected.has(k.id);
                            return (
                                <li
                                    key={k.id}
                                    className="group flex items-center gap-6 py-7 transition-colors cursor-pointer"
                                    style={{
                                        borderBottom: "1px solid rgba(10,10,10,0.08)",
                                        background: isSelected ? "rgba(10,10,10,0.03)" : undefined,
                                    }}
                                    onClick={(e) => {
                                        if (isEditing) return;
                                        if (selectMode) {
                                            toggle(k.id);
                                            return;
                                        }
                                        const t = e.target as HTMLElement;
                                        if (t.closest("a,button,input,textarea,select")) return;
                                        navigate({ to: "/kit/$kitId", params: { kitId: k.id } });
                                    }}
                                >
                                    {selectMode && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggle(k.id);
                                            }}
                                            aria-label={isSelected ? "Deselect" : "Select"}
                                            className="relative z-10 -m-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center p-3"
                                            style={{ pointerEvents: "auto" }}
                                        >
                                            <span
                                                aria-hidden
                                                className="flex h-5 w-5 items-center justify-center border transition-colors"
                                                style={{
                                                    borderColor: isSelected ? "#0A0A0A" : "rgba(10,10,10,0.30)",
                                                    background: isSelected ? "#0A0A0A" : "transparent",
                                                    color: "#F4EFE6",
                                                    fontSize: 12,
                                                }}
                                            >
                                                {isSelected ? "×" : ""}
                                            </span>
                                        </button>
                                    )}

                                    {/* Logo / mark thumbnail */}
                                    <Link
                                        to="/kit/$kitId"
                                        params={{ kitId: k.id }}
                                        aria-label={`Open ${k.name}`}
                                        className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
                                        style={{
                                            background: k.primaryHex
                                                ? `color-mix(in oklab, ${k.primaryHex} 8%, #F4EFE6)`
                                                : "rgba(10,10,10,0.04)",
                                            border: "1px solid rgba(10,10,10,0.12)",
                                            borderLeft: `3px solid ${k.primaryHex ?? "#0A0A0A"}`,
                                        }}
                                    >
                                        {k.logoUrl ? (
                                            <img
                                                src={k.logoUrl}
                                                alt=""
                                                className="max-h-12 max-w-12 object-contain"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span
                                                aria-hidden
                                                style={{
                                                    fontFamily: "'Cormorant Garamond', serif",
                                                    fontSize: 28,
                                                    fontWeight: 500,
                                                    color: k.primaryHex ?? "#0A0A0A",
                                                    lineHeight: 1,
                                                }}
                                            >
                                                {(k.name?.[0] ?? "?").toUpperCase()}
                                            </span>
                                        )}
                                    </Link>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline gap-3">
                                            {isEditing ? (
                                                <Input
                                                    autoFocus
                                                    value={draftName}
                                                    onChange={(e) => setDraftName(e.target.value)}
                                                    onBlur={() => commitRename(k)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            commitRename(k);
                                                        } else if (e.key === "Escape") {
                                                            setEditingId(null);
                                                        }
                                                    }}
                                                    className="h-auto border-0 px-0 py-0 text-2xl shadow-none focus-visible:ring-0"
                                                    style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}
                                                />
                                            ) : (
                                                <Link
                                                    to="/kit/$kitId"
                                                    params={{ kitId: k.id }}
                                                    className="truncate hover:opacity-70 transition-opacity"
                                                    style={{
                                                        fontFamily: (() => {
                                                            const fam = renderFamilyFor({
                                                                family: k.displayFont?.family ?? null,
                                                                source_family: k.displayFont?.source_family ?? null,
                                                                file_urls: k.displayFont?.file_urls ?? null,
                                                                google_font: k.displayFont?.google ?? null,
                                                            });
                                                            return fam
                                                                ? `'${fam}', 'Cormorant Garamond', serif`
                                                                : "'Cormorant Garamond', serif";
                                                        })(),
                                                        fontWeight: 500,
                                                        fontSize: 28,
                                                        lineHeight: 1.1,
                                                    }}
                                                    title={
                                                        k.displayFont?.source_family || k.displayFont?.family
                                                            ? `Set in ${k.displayFont?.source_family ?? k.displayFont?.family}`
                                                            : undefined
                                                    }
                                                >
                                                    {k.name}
                                                </Link>
                                            )}
                                            <span className={`${mono} text-muted-foreground shrink-0`}>
                                                {k.status}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-4">
                                            {/* Palette swatches */}
                                            {k.palette && k.palette.length > 0 && (
                                                <div className="flex shrink-0 items-center gap-[3px]">
                                                    {k.palette.map((hex, i) => (
                                                        <span
                                                            key={`${hex}-${i}`}
                                                            aria-hidden
                                                            className="h-3.5 w-3.5"
                                                            style={{
                                                                background: hex,
                                                                border: "1px solid rgba(10,10,10,0.12)",
                                                            }}
                                                            title={hex}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {k.source_url && (
                                                <span className={`${mono} truncate text-muted-foreground`}>
                                                    {k.source_url.replace(/^https?:\/\//, "")}
                                                </span>
                                            )}
                                            {k.displayFont?.family && (
                                                <span
                                                    className={`${mono} shrink-0 text-muted-foreground hidden md:inline`}
                                                >
                                                    — {k.displayFont.family}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {!selectMode && (
                                        <div
                                            className={`${mono} flex shrink-0 items-center gap-4 opacity-0 transition-opacity group-hover:opacity-100`}
                                        >
                                            <button
                                                type="button"
                                                className="hover:opacity-70 transition-opacity"
                                                onClick={() => {
                                                    setDraftName(k.name);
                                                    setEditingId(k.id);
                                                }}
                                            >
                                                Rename
                                            </button>
                                            <button
                                                type="button"
                                                className="hover:opacity-70 transition-opacity"
                                                onClick={() => onDuplicate(k)}
                                            >
                                                Duplicate
                                            </button>
                                            <button
                                                type="button"
                                                className="text-[#8B1A1A] hover:opacity-70 transition-opacity"
                                                onClick={() => onDelete(k)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </main>
        </div>
    );
}