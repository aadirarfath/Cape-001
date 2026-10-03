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
    <div className="space-y-4 pt-8 text-center">
      <h1 className="text-xl font-semibold">{m.errors.generic}</h1>
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>{m.errors.tryAgain}</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {m.errors.goHome}
        </Link>
      </div>
    </div>
  );
}
