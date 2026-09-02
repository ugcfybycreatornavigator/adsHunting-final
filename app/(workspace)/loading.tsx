import { Skeleton } from "@/components/ui";
export default function Loading(){return <div><Skeleton className="h-3 w-28"/><Skeleton className="mt-4 h-10 w-72"/><Skeleton className="mt-3 h-4 w-[min(100%,540px)]"/><div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-32"/>)}</div></div>}
