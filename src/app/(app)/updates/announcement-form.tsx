"use client";

import { useActionState, useRef } from "react";
import { btn, btnGhost, field } from "@/components/ui";
import { postAnnouncement } from "../admin/actions";

export function AnnouncementForm({ reminder }: { reminder: string }) {
  const [state, action, pending] = useActionState(postAnnouncement, undefined);
  const body = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={action} className="space-y-3">
      <textarea
        ref={body}
        name="body"
        rows={4}
        maxLength={2000}
        required
        placeholder="Write an update for everyone…"
        className={field}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Posting…" : "Post update"}
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            if (body.current) body.current.value = reminder;
          }}
        >
          Use deadline reminder
        </button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
