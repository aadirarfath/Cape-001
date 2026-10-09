"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const m = useMessages();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 pb-24 pt-32 text-center">
      <h1 className="text-xl font-semibold">{m.errors.generic}</h1>
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>{m.errors.tryAgain}</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {m.errors.goHome}
        </Link>
      </div>
    </main>
  );
}
