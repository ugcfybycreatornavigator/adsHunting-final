"use client";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="grid min-h-screen place-items-center bg-white p-6"><div className="max-w-md text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-signal"><TriangleAlert/></span><h1 className="mt-5 text-2xl font-semibold tracking-tight">Something went wrong</h1><p className="mt-2 text-sm leading-6 text-muted">{error.message||"The workspace couldn’t finish loading."}</p><Button className="mt-6" onClick={reset}>Try again</Button></div></main>}
