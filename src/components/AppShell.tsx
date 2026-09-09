import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/auth";

export function AppShell({
  title,
  subtitle,
  children,
  nav,
  back,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  nav?: ReactNode;
  back?: { to: string; label: string };
}) {
  const signOut = useSignOut();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground">
              🚌
            </span>
            <span className="hidden font-[family-name:var(--font-display)] sm:inline">SafeRide</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {nav}
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">
        {back ? (
          <Link to={back.to} className="mb-3 inline-flex text-sm text-muted-foreground hover:text-foreground">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold text-balance-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
