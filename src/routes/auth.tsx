import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { homeForRole, useRole, useSession, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SafeRide school transport tracking" },
      {
        name: "description",
        content:
          "Sign in to SafeRide to follow your child's school van in real time, or open driver and school admin mode.",
      },
      { property: "og:title", content: "Sign in — SafeRide" },
      {
        property: "og:description",
        content: "Parent, driver and school sign-in for SafeRide live school transport tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("parent");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const navigate = useNavigate();
  const { session, userId } = useSession();
  const { data: actualRole } = useRole(userId);

  useEffect(() => {
    if (session && actualRole) navigate({ to: homeForRole(actualRole), replace: true });
  }, [session, actualRole, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (showForgot) {
    return (
      <Centered>
        {forgotSent ? (
          <>
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <p className="mt-2 text-muted-foreground">
              If an account exists for {email}, we've sent a link to reset your password.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-2 text-muted-foreground">
              Enter your account email and we'll send you a reset link.
            </p>
            <form onSubmit={sendReset} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setShowForgot(false);
            setForgotSent(false);
          }}
          className="mt-4 w-full text-center text-sm font-medium text-primary"
        >
          Back to sign in
        </button>
      </Centered>
    );
  }

  if (checkEmail) {
    return (
      <Centered>
        <button
          type="button"
          onClick={() => {
            setCheckEmail(false);
            setMode("signin");
          }}
          aria-label="Back to sign in"
          className="mb-2 -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-muted-foreground">
          We sent a confirmation link to {email}. Open it to finish creating your account.
        </p>
        <Button
          type="button"
          className="mt-5 h-12 w-full text-base"
          onClick={() => {
            setCheckEmail(false);
            setMode("signin");
          }}
        >
          Back to sign in
        </Button>
      </Centered>
    );
  }

  return (
    <Centered>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-xl text-primary-foreground">
          🚌
        </span>
        <div>
          <h1 className="text-xl font-semibold leading-tight">SafeRide</h1>
          <p className="text-sm text-muted-foreground">School transport, followed live.</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === m ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>I am a</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["parent", "driver", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-2 py-2 text-sm capitalize transition-colors ${
                      role === r
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border"
                    }`}
                  >
                    {r === "admin" ? "School" : r}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs font-medium text-primary"
              >
                Forgot password?
              </button>
            ) : null}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-muted-foreground"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm surface-card p-6">{children}</div>
    </div>
  );
}
