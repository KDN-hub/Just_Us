import AuthGate from "@/components/AuthGate";

export default function CallLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
