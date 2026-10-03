import type { Database } from "@cape001/db";
import { Badge } from "@/components/ui/badge";
import type { Messages } from "@/i18n";

type Status = Database["public"]["Enums"]["booking_status"];

export function StatusBadge({ status, m }: { status: Status; m: Messages }) {
  const variant = status === "confirmed" || status === "completed" ? "secondary" : status === "pending" ? "outline" : "destructive";
  return <Badge variant={variant}>{m.status[status]}</Badge>;
}
