"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // useEffect ensures this only runs on the client to prevent hydration mismatch errors
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            title="Toggle theme"
        >
            {resolvedTheme === "dark" ? (
                <Sun className="h-[1.2rem] w-[1.2rem] text-primary" />
            ) : (
                <Moon className="h-[1.2rem] w-[1.2rem] text-primary" />
            )}
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}