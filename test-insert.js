const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('messages').insert({
    id: "temp-nudge-id",
    conversation_id: "c0000000-0000-0000-0000-000000000003",
    sender_id: "u0000000-0000-0000-0000-000000000001",
    type: 'nudge',
    content: "💖"
  });
  console.log("Error:", error);
}

test();
