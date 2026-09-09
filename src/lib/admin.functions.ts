import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  const isAdmin = (data ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Forbidden");
}

/** Admin creates a parent, driver or admin account. */
export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        fullName: z.string().min(1).max(120),
        phone: z.string().max(40).optional(),
        role: z.enum(["parent", "driver", "admin"]),
        licenseNo: z.string().max(60).optional(),
        licenseExpiry: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone ?? null, role: data.role },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account");
    const newUserId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: newUserId, full_name: data.fullName, phone: data.phone ?? null },
        { onConflict: "user_id" },
      );

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });

    if (data.role === "driver") {
      await supabaseAdmin.from("drivers").upsert(
        {
          user_id: newUserId,
          license_no: data.licenseNo ?? null,
          license_expiry: data.licenseExpiry ? data.licenseExpiry : null,
          active: true,
        },
        { onConflict: "user_id" },
      );
    }

    await ctx.supabase.from("audit_logs").insert({
      actor: ctx.userId,
      action: "CREATE_USER",
      entity: "auth.users",
      entity_id: newUserId,
      meta: { role: data.role, email: data.email },
    });

    return { ok: true, userId: newUserId };
  });

/** Admin directory of every account with its role. */
export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, full_name, phone");

    const roleBy = new Map<string, string>();
    for (const r of roles ?? []) roleBy.set(r.user_id, r.role as string);
    const profileBy = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    return (users.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      role: roleBy.get(u.id) ?? "parent",
      fullName: profileBy.get(u.id)?.full_name ?? "",
      phone: profileBy.get(u.id)?.phone ?? "",
      createdAt: u.created_at,
    }));
  });
