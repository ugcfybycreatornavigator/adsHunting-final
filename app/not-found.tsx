import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
export default function NotFound(){return <main className="grid min-h-screen place-items-center bg-white p-6 text-center"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-brand">404</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1><p className="mt-2 text-sm text-muted">This intelligence view doesn’t exist or has moved.</p><Link href="/dashboard"><Button className="mt-6"><ArrowLeft size={15}/>Back to Home</Button></Link></div></main>}
