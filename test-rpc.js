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

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  const { data, error } = await supabase.rpc('activate_session_if_newer', {
    p_user_id: 'test_user',
    p_session_id: 'test_session',
    p_session_created_at: new Date().toISOString()
  });
  console.log("Data:", data);
  console.log("Error:", JSON.stringify(error, null, 2));
}

run();
