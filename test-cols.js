const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envLocal.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length > 0) envVars[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
});

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function run() {
  const { data: msg, error } = await supabase.from('messages').select('*').limit(1);
  if (msg && msg.length > 0) {
    console.log('Columns in messages:', Object.keys(msg[0]));
  } else {
    console.log('Error or no messages:', error);
  }
}
run();
