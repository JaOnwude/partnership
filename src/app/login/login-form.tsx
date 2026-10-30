"use client";

import { useActionState } from "react";
import { login } from "./actions";

const field =
  "w-full rounded-xl border border-brand/20 bg-white px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder="0803 000 0000"
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="pin" className="mb-1 block text-sm font-medium">
          6-digit PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="current-password"
          required
          className={field}
        />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
