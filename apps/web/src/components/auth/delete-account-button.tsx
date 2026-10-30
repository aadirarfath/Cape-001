"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/browser";
import type { DbErrorCode } from "@cape001/core";

export function DeleteAccountButton() {
  const m = useMessages();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function deleteAccount() {
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error: rpcError } = await supabase.rpc("delete_my_account");
        if (rpcError) {
          const code = rpcError.message as DbErrorCode;
          setError(code in m.errors.codes ? m.errors.codes[code] : m.errors.generic);
          return;
        }

        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      } catch {
        setError(m.errors.generic);
      }
    });
  }

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        {m.auth.deleteAccount}
      </Button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
        <div className="space-y-1">
          <h3 className="font-semibold text-destructive">{m.auth.deleteAccountTitle}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {m.auth.deleteAccountDescription}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
        >
          {m.auth.deleteAccountCancel}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={deleteAccount}
          disabled={pending}
        >
          {pending && <Loader2 className="animate-spin size-4" aria-hidden />}
          {pending ? m.auth.deleteAccountDeleting : m.auth.deleteAccountConfirm}
        </Button>
      </div>
    </div>
  );
}
