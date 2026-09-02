"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Database, Globe2, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { Button, Card } from "@/components/ui";

type Configured = { supabase:boolean;searchApi:boolean;meta:boolean;foreplay:boolean;googleSearch:boolean;mediaArchival:boolean };
type State = { configured:boolean;connected:boolean|null;status?:string;error?:string };
type Status = { supabase:State;storage?:State;clerk?:State;searchApi:State;meta:State;foreplay:State;googleSearch:State;mediaArchival:State;activeAdsProvider?:string };

export function SettingsIntegrations({configured}:{configured:Configured}){
  const initial:Status={supabase:base(configured.supabase),storage:base(configured.supabase),clerk:{configured:true,connected:true,status:"CONNECTED"},searchApi:base(configured.searchApi),meta:base(configured.meta),foreplay:base(configured.foreplay),googleSearch:base(configured.googleSearch),mediaArchival:{configured:configured.mediaArchival,connected:configured.mediaArchival}};
  const[status,setStatus]=useState<Status>(initial);
  const[testing,setTesting]=useState(false);
  const[testError,setTestError]=useState("");

  useEffect(()=>{apiFetch("/api/integrations/status").then(response=>response.json()).then(setStatus).catch(()=>undefined)},[]);
  
  async function testConnections(){
    setTesting(true);
    setTestError("");
    try{
      const response=await apiFetch("/api/integrations/status",{method:"POST"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Connection test failed.");
      setStatus(data);
    }catch(error){
      setTestError(error instanceof Error?error.message:"Connection test failed.");
    }finally{
      setTesting(false);
    }
  }

  return <div className="space-y-8 max-w-3xl">
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Infrastructure & Auth</h3>
          <p className="mt-1 text-sm text-muted">Core database, storage, and authentication systems.</p>
        </div>
        <Button variant="secondary" onClick={testConnections} disabled={testing}>
          {testing?<Loader2 className="mr-2 animate-spin" size={15}/>:<RefreshCw className="mr-2" size={15}/>}
          Test connections
        </Button>
      </div>
      {testError&&<p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-signal">{testError}</p>}
      
      <Card className="divide-y divide-line shadow-sm overflow-hidden">
        <Connection icon={<ShieldCheck/>} name="Clerk Authentication" body="User identity, sign in, sign up, and JWT sessions" state={status.clerk || {configured:true,connected:true,status:"CONNECTED"}} />
        <Connection icon={<Database/>} name="Supabase Database" body="PostgreSQL, RLS policies, and data persistence" state={status.supabase}/>
        <Connection icon={<Database/>} name="Supabase Storage" body="Private, signed creative archive storage" state={status.storage || status.supabase}/>
      </Card>
    </div>

    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold">Intelligence Providers</h3>
        <p className="mt-1 text-sm text-muted">Data sources for ad discovery and brand enrichment.</p>
      </div>
      <Card className="divide-y divide-line shadow-sm overflow-hidden">
        <Connection icon={<Search/>} name="SearchAPI Meta Ads" body="Multi-key pool with automatic rotation and failover" state={status.searchApi}/>
        <Connection icon={<Search/>} name="Foreplay" body="Discovery and creative metadata through the server-side Public API" state={status.foreplay}/>
        <Connection icon={<KeyRound/>} name="Direct Meta API" body="Official Graph API ads_archive provider when separately authorized" state={status.meta}/>
        <Connection icon={<Globe2/>} name="Google Search" body="Optional brand and landing-page web enrichment" state={status.googleSearch}/>
        <Connection icon={<ShieldCheck/>} name="Creative archival" body="Rights-aware permanent media copying" state={status.mediaArchival} optional/>
      </Card>
    </div>
  </div>;
}

function base(configured:boolean):State{return{configured,connected:null}}

function Connection({icon,name,body,state,optional}:{icon:React.ReactNode;name:string;body:string;state:State;optional?:boolean}){
  const isTokenExpired = state.status === "TOKEN_EXPIRED";
  const isDegraded = state.status === "DEGRADED";
  const label = !state.configured
    ? (optional ? "Opt-in off" : "Not configured")
    : isTokenExpired
    ? "Token Expired"
    : isDegraded
    ? "Connected · Limited"
    : state.connected === true
    ? "Connected"
    : state.connected === false
    ? "Connection failed"
    : "Configured";

  const Icon = !state.configured || state.connected === null ? CircleDashed : state.connected ? CheckCircle2 : XCircle;
  const labelColor = isDegraded ? "text-amber-700" : state.connected === true ? "text-emerald-700" : isTokenExpired ? "text-amber-600 font-bold" : state.connected === false ? "text-signal" : "text-zinc-400";

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-5 hover:bg-slate-50/50 transition-colors">
      <div className="flex gap-4 min-w-0">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted [&>svg]:size-5 border border-line">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="mt-1 text-[13px] text-muted">{body}</p>
          {isTokenExpired ? (
            <p className="mt-2 text-[12px] font-medium text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-200">
              A new Meta access token is required. Fallback provider SearchAPI is active.
            </p>
          ) : state.error ? (
            <p className={`mt-2 text-[12px] ${isDegraded ? "text-amber-700" : "text-signal"}`}>{state.error}</p>
          ) : null}
        </div>
      </div>
      <div className={`flex shrink-0 items-center gap-1.5 text-[13px] font-semibold sm:mt-1 ${labelColor}`}>
        <Icon size={16}/>
        {label}
      </div>
    </div>
  );
}
