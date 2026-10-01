"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const m = useMessages();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut aria-hidden />
      {m.auth.logout}
    </Button>
  );
}
