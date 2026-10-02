import { redirect } from "next/navigation";

// The old "Who are you?" picker let anyone claim either account, so it was removed.
// Identity now comes from the Supabase Auth account you sign in with.
export default function ProfileSetup() {
  redirect("/signin");
}
