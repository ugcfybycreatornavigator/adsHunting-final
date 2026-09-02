// @ts-expect-error Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyClerkToken } from "../_shared/clerk.ts";
import { AdsProviderOrchestrator } from "../_shared/ads/orchestrator.ts";
import { ProviderError } from "../_shared/ads/providers/errors.ts";
import type { AdSearchFilters } from "../_shared/ads/types.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let filters: Record<string, unknown> = {};

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    try {
      await verifyClerkToken(req, token);
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: "Unauthorized", detail: (e as Error).message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      filters = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orchestrator = new AdsProviderOrchestrator();
    const requestId = filters.requestId as string | undefined;
    const result = await orchestrator.search(filters as unknown as AdSearchFilters, { requestId });

    console.log(JSON.stringify({
      event: "ads_provider_request",
      requestId,
      provider: result.providerMeta?.provider,
      fallbackUsed: result.providerMeta?.fallbackUsed,
      fallbackReason: result.providerMeta?.fallbackReason,
      result_count: result.ads.length
    }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const isProviderError = error instanceof ProviderError;
    const code = isProviderError ? error.code : "UNKNOWN";
    const status = isProviderError ? error.status : 502;
    const requestId = filters.requestId as string | undefined;
    
    console.error(JSON.stringify({
      event: "ads_search_function_error",
      requestId,
      code,
      message: (error as Error).message,
      status
    }));
    
    return new Response(JSON.stringify({ 
      success: false, 
      code, 
      message: (error as Error).message,
      requestId,
      retryable: status >= 500 || status === 429 || status === 408
    }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
