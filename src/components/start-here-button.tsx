import { Link } from "@tanstack/react-router";

export function StartHereButton() {
    return (
        <Link
            to="/start-here"
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-opacity hover:opacity-90"
            style={{
                background: "#C2562A",
                color: "#FFF8F1",
                fontFamily: "'Courier Prime', monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                border: "1px solid rgba(10,10,10,0.18)",
            }}
        >
            <span style={{ opacity: 0.75 }}></span> START HERE
        </Link>
    );
}