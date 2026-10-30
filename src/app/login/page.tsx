import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

// Signed-in users skip the form. The session read streams in behind Suspense.
async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/dashboard");
  return null;
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl shadow-brand/10">
        <div className="bg-gradient-to-br from-brand to-accent px-6 py-8 text-white">
          <h1 className="text-2xl font-bold">Partnership</h1>
          <p className="mt-1 text-sm text-white/85">Monthly contributions, made clear.</p>
        </div>
        <div className="p-6">
          <LoginForm />
        </div>
      </div>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
    </main>
  );
}
