import AuthGate from "@/components/AuthGate";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
