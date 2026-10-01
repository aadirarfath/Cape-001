import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getMessages } from "@/i18n";

export default function NotFound() {
  const m = getMessages();
  return (
    <div className="space-y-4 pt-8 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{m.errors.notFoundTitle}</h1>
      <p className="text-muted-foreground">{m.errors.notFoundBody}</p>
      <Link href="/" className={buttonVariants()}>
        {m.errors.goHome}
      </Link>
    </div>
  );
}
