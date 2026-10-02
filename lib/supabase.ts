import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ vars are inlined at BUILD time and must be referenced literally
// (no dynamic process.env[name] lookups) or Next.js won't substitute them.
const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables: " +
      [!supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL", !supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
        .filter(Boolean)
        .join(", ") +
      ". Add them in .env.local (local) or Vercel → Project → Settings → Environment Variables, then redeploy.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
