import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getMessages } from "@/i18n";

export default function NotFound() {
  const m = getMessages();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 pb-24 pt-32 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{m.errors.notFoundTitle}</h1>
      <p className="text-muted-foreground">{m.errors.notFoundBody}</p>
      <Link href="/" className={buttonVariants()}>
        {m.errors.goHome}
      </Link>
    </main>
  );
}
