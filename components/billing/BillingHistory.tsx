import { Card } from "@/components/ui";
import { formatBillingDate } from "@/lib/format/date";

type Payment = {
  id: string;
  created_at: string;
  amount_paise: number;
  status: string;
};

export function BillingHistory({ payments }: { payments: Payment[] }) {
  if (!payments || payments.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-sm text-muted-foreground">No billing history yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Your payments and subscription charges will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/50 bg-background">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                {formatBillingDate(payment.created_at)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                AdsHunting Pro Subscription
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                ₹{(payment.amount_paise / 100).toFixed(2)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  payment.status === 'paid' || payment.status === 'captured' ? 'bg-green-50 text-green-700' :
                  payment.status === 'failed' ? 'bg-red-50 text-red-700' :
                  'bg-gray-50 text-gray-700'
                }`}>
                  {payment.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
