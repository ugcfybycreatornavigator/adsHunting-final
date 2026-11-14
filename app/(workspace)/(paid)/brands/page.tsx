import { redirect } from "next/navigation";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  redirect("/competitors");
}
