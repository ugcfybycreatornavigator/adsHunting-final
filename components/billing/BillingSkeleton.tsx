import { Card } from "@/components/ui";

export function BillingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Card className="p-8 space-y-4">
        <div className="h-6 w-1/3 bg-gray-200 rounded"></div>
        <div className="h-4 w-1/4 bg-gray-200 rounded"></div>
        <div className="h-10 w-full bg-gray-200 rounded mt-4"></div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="h-5 w-1/2 bg-gray-200 rounded"></div>
          <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
        </Card>
        <Card className="p-6 space-y-4">
          <div className="h-5 w-1/2 bg-gray-200 rounded"></div>
          <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
        </Card>
      </div>
      <Card className="p-6 space-y-4">
        <div className="h-5 w-1/4 bg-gray-200 rounded"></div>
        <div className="space-y-2 mt-4">
          <div className="h-10 w-full bg-gray-200 rounded"></div>
          <div className="h-10 w-full bg-gray-200 rounded"></div>
          <div className="h-10 w-full bg-gray-200 rounded"></div>
        </div>
      </Card>
    </div>
  );
}
