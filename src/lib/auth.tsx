import type { ReactNode } from "react";

// Auth removed — this is a personal app. Stubbed so existing call sites
// keep compiling without changes.
type AuthState = {
    user: { id: string } | null;
    session: null;
    loading: boolean;
    signOut: () => Promise<void>;
};

const STATE: AuthState = {
    user: null,
    session: null,
    loading: false,
    signOut: async () => { },
};

export function AuthProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export const useAuth = () => STATE;
