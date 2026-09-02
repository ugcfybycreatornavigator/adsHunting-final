import { Card } from "@/components/ui";

export function PaymentMethodCard({ subscription }: { subscription: { provider_status?: string; status?: string } | null }) {
  const isAutoPay = subscription?.provider_status === "active" || subscription?.status === "trialing";

  return (
    <Card className="p-6 border-border/50 shadow-sm flex flex-col justify-center">
      <h4 className="text-sm font-medium text-muted-foreground">Payment method</h4>
      <p className="mt-2 text-base text-foreground flex items-center gap-2">
        AutoPay / Mandate
      </p>
      <div className="mt-4">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${isAutoPay ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
          {isAutoPay ? "Mandate Active" : "Mandate Inactive/Pending"}
        </span>
      </div>
    </Card>
  );
}
