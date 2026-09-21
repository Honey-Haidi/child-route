import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { homeForRole, useRole, useSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SafeRide — live school transport tracking for parents" },
      {
        name: "description",
        content:
          "Follow your child's school van live: trip start, pickup, vehicle position, arrival time and safe drop-off alerts.",
      },
      { property: "og:title", content: "SafeRide — live school transport tracking" },
      {
        property: "og:description",
        content:
          "Parents see the van move in real time. Drivers tap pickup and drop-off. Schools watch every route.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, userId, loading } = useSession();
  const { data: role } = useRole(userId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session && role) navigate({ to: homeForRole(role), replace: true });
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground">
            🚌
          </span>
          <span className="font-[family-name:var(--font-display)]">SafeRide</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 pb-16 pt-8 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Home → School → Home
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-balance-tight sm:text-5xl">
            Know exactly where your child is on the school run.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            SafeRide shows the van moving on a live map, tells you the moment your child is picked
            up, and confirms a safe drop-off — every morning and every afternoon.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Parents see only their own children. Drivers see only the children on the trip they are
            driving.
          </p>
        </div>

        <ul className="grid gap-3">
          {[
            ["🚌", "Trip started", "The driver begins the route and you are told right away."],
            ["📍", "Vehicle approaching", "An alert when the van is close to your pickup point."],
            ["✅", "Picked up", "Confirmed by the driver, with the time and place recorded."],
            ["🗺️", "Live map", "The van marker moves on its own — no refreshing."],
            [
              "🏠",
              "Dropped off safely",
              "A final confirmation when your child is home or at school.",
            ],
          ].map(([icon, title, body]) => (
            <li key={title} className="surface-card flex gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-lg">
                {icon}
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
