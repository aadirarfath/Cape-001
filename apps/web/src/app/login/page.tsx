import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMessages } from "@/i18n";
import { safeNextPath } from "@/lib/redirect";
import { createClient, getUserId } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: getMessages().auth.loginTitle,
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  if (await getUserId(supabase)) redirect(safeNextPath(Array.isArray(next) ? next[0] : next));

  const m = getMessages();
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{m.auth.loginTitle}</h1>
        <p className="text-muted-foreground">{m.auth.loginSubtitle}</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
