import { Link } from "@tanstack/react-router";

const links = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/people", label: "People" },
  { to: "/admin/children", label: "Children" },
  { to: "/admin/fleet", label: "Fleet" },
  { to: "/admin/routes", label: "Routes" },
] as const;

export function AdminNav() {
  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          activeOptions={{ exact: l.to === "/admin" }}
          className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground [&.active]:border-primary [&.active]:bg-primary [&.active]:text-primary-foreground"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
