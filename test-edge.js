const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envLocal.split('\n')) {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    env[key] = rest.join('=');
  }
}

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function run() {
  const { data, error } = await supabase.functions.invoke('billing-create-subscription', { method: 'POST' });
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
