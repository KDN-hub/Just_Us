import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  // Require standard Bearer token authentication
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];

  // Verify the user token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // User is authenticated. Safely construct the ICE servers payload.
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // TURN is configured exclusively through server-side variables. The
  // NEXT_PUBLIC_* fallbacks were removed: public env vars are inlined into the
  // client bundle at build time, which would leak TURN credentials into every
  // visitor's browser. Set TURN_URL / TURN_USERNAME / TURN_PASSWORD on the
  // server (.env.local locally, Vercel env vars in production) — see
  // .env.example and supabase/migrations/011_call_signalling_v2.sql.
  const turnUrl = process.env.TURN_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnPassword = process.env.TURN_PASSWORD;

  if (turnUrl && turnUsername && turnPassword) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()),
      username: turnUsername,
      credential: turnPassword,
    });
  }

  return NextResponse.json({ iceServers: servers });
}
