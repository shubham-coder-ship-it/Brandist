import { cn } from "@/lib/utils";

export function QuietLoader({ label = "Loading", className }: { label?: string; className?: string }) {
    return (
        <div className={cn("flex min-h-[40vh] items-center justify-center", className)}>
            <div className="flex flex-col items-center gap-5 animate-fade-in">
                <div className="quiet-loader-dots">
                    <span />
                    <span />
                    <span />
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          // {label}
                </div>
            </div>
            <style>{`
        .quiet-loader-dots {
          display: inline-flex;
          gap: 8px;
        }
        .quiet-loader-dots span {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
          color: rgba(10,10,10,0.55);
          opacity: 0.25;
          animation: quietPulse 1.2s ease-in-out infinite;
        }
        .quiet-loader-dots span:nth-child(2) { animation-delay: 0.15s; }
        .quiet-loader-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes quietPulse {
          0%, 100% { opacity: 0.18; transform: translateY(0); }
          50% { opacity: 0.9; transform: translateY(-2px); }
        }
      `}</style>
        </div>
    );
}