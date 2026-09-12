import { Badge } from "@/components/ui/badge";
import type { RegistrationStatus } from "@/lib/services/registrations";

const STATUS_CONFIG: Record<
  RegistrationStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline" }
> = {
  RESERVED: { label: "Reserved", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  CHECKED_IN: { label: "Checked In", variant: "success" },
  EXPIRED: { label: "Expired", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  const { label, variant } = STATUS_CONFIG[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}
