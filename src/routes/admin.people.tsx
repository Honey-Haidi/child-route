import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { AdminNav } from "@/components/admin/AdminNav";
import { Field, Panel } from "@/components/admin/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUserAccount, deleteUserAccount, listAccounts } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/people")({
  head: () => ({
    meta: [
      { title: "People — SafeRide admin" },
      {
        name: "description",
        content: "Create and review parent, driver and admin accounts for your school transport.",
      },
      { property: "og:title", content: "People — SafeRide admin" },
      {
        property: "og:description",
        content: "Create parent, driver and admin accounts for your school transport.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="admin">
      <People />
    </RequireRole>
  ),
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function People() {
  const list = useServerFn(listAccounts);
  const create = useServerFn(createUserAccount);
  const removeAccount = useServerFn(deleteUserAccount);
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => list(),
  });

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "parent" as "parent" | "driver" | "admin",
    licenseNo: "",
    licenseExpiry: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          role: form.role,
          licenseNo: form.licenseNo || undefined,
          licenseExpiry: form.licenseExpiry || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Account created");
      setForm({
        ...form,
        fullName: "",
        email: "",
        password: "",
        phone: "",
        licenseNo: "",
        licenseExpiry: "",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeAccount({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account removed");
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-children"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="People" subtitle="Parents, drivers and administrators.">
      <AdminNav />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Panel title="Add an account">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <Field label="Full name">
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Temporary password">
              <Input
                type="text"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                className={selectClass}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
              >
                <option value="parent">Parent</option>
                <option value="driver">Driver</option>
                <option value="admin">Administrator</option>
              </select>
            </Field>
            {form.role === "driver" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Licence no.">
                  <Input
                    value={form.licenseNo}
                    onChange={(e) => setForm({ ...form, licenseNo: e.target.value })}
                  />
                </Field>
                <Field label="Licence expiry">
                  <Input
                    type="date"
                    value={form.licenseExpiry}
                    onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Panel>

        <Panel title="Directory">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <div>
                    <p className="font-medium">{a.fullName || a.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.email}
                      {a.phone ? ` · ${a.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">
                      {a.role}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => {
                        const label = a.fullName || a.email;
                        const extra =
                          a.role === "parent"
                            ? " Their children and alerts will be removed too."
                            : a.role === "driver"
                              ? " Their van and route will be unassigned."
                              : "";
                        if (window.confirm(`Remove ${label}?${extra} This cannot be undone.`)) {
                          remove.mutate(a.id);
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
