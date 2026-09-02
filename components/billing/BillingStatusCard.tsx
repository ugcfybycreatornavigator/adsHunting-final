import { Card } from "@/components/ui";
import { WorkspaceEntitlement } from "@/lib/billing/subscription-state";
import { formatBillingDate } from "@/lib/format/date";

export function BillingStatusCard({
  entitlement
}: {
  entitlement: WorkspaceEntitlement;
}) {
  return (
    <Card className="p-6 border-border/50 shadow-sm flex flex-col justify-center">
      <h4 className="text-sm font-medium text-muted-foreground">Billing status</h4>
      <p className="mt-2 text-lg font-medium text-foreground capitalize">
        {entitlement.billingStatus.replace("_", " ")}
      </p>
      {entitlement.nextChargeAt && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <h4 className="text-sm font-medium text-muted-foreground">Next payment</h4>
          <p className="mt-1 text-base text-foreground">
            ₹499 on {formatBillingDate(entitlement.nextChargeAt)}
          </p>
        </div>
      )}
    </Card>
  );
}
