import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/dashboard";
export const metadata = { title: "Home" };
export default async function DashboardPage() { return <DashboardView data={await getDashboardData()} />; }
