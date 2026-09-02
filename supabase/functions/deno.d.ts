declare const Deno: { env: { get(key: string): string | undefined } };
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
declare module "npm:@supabase/supabase-js" {
  export * from "@supabase/supabase-js";
}
