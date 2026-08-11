import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { SmoothScroll } from "@/components/smooth-scroll";
import appCss from "../styles.css?url";

function NotFoundComponent() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="max-w-md text-center">
                <h1 className="text-7xl font-display">404</h1>
                <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    The page you're looking for doesn't exist.
                </p>
                <div className="mt-6">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        Go home
                    </Link>
                </div>
            </div>
        </div>
    );
}

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: "Brand Kit" },
            {
                name: "description",
                content:
                    "Colors. Typography. Voice. Tokens. Extracted, structured, exported. Brand DNA turns any URL into a complete brand kit.",
            },
            {
                name: "keywords",
                content: "brand kit, design system, color extraction, typography, brand voice, design tokens",
            },
            { property: "og:title", content: "Brand Kit" },
            {
                property: "og:description",
                content: "Colors. Typography. Voice. Tokens. Extracted, structured, exported.",
            },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:title", content: "Brand Kit" },
            { name: "description", content: "Get any site's full brand guide with logos, typography and voice just by entering a URL." },
            { property: "og:description", content: "Get any site's full brand guide with logos, typography and voice just by entering a URL." },
            { name: "twitter:description", content: "Get any site's full brand guide with logos, typography and voice just by entering a URL." },
            { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b8fc70cb-7407-42ec-9f6b-76fa2169acf7/id-preview-820a7c05--51ec8462-5cd2-41c8-8fbc-3bd742256758.lovable.app-1778711854484.png" },
            { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b8fc70cb-7407-42ec-9f6b-76fa2169acf7/id-preview-820a7c05--51ec8462-5cd2-41c8-8fbc-3bd742256758.lovable.app-1778711854484.png" },
        ],
        links: [
            { rel: "stylesheet", href: appCss },
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap",
            },
        ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                {children}
                <Scripts />
            </body>
        </html>
    );
}

function RootComponent() {
    return (
        <AuthProvider>
            <SmoothScroll />
            <Outlet />
            <Toaster />
        </AuthProvider>
    );
}
