import { Suspense, type ReactNode } from "react";
import { Loading } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";

// Admin pages render only for the owner or an enabled delegate.
// Each server action still checks on its own.
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
