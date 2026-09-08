const fs = require('fs');
const file = 'supabase/functions/billing-create-early-access/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { corsHeaders } from "../_shared/cors.ts";',
  'import { corsHeaders, handleCors } from "../_shared/cors.ts";'
);

content = content.replace(
  '  if (req.method === "OPTIONS") {\n    return new Response(null, { status: 204, headers: corsHeaders });\n  }\n\n  const requestId = crypto.randomUUID();',
  '  const corsResponse = handleCors(req);\n  if (corsResponse) return corsResponse;\n\n  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();\n  console.log(`[early-access:create:${requestId}] request_received`);'
);

fs.writeFileSync(file, content);
