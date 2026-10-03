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
  const { data, error } = await supabase.from('messages').insert({
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    conversation_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    sender_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    type: 'audio',
    content: "test_url"
  });
  console.log("Error:", error);
}
run();
