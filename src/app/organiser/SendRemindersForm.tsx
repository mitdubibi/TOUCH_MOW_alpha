"use client";

import { useActionState } from "react";
import { sendRemindersNow, type SendRemindersState } from "./actions";

// allowPretend: only outside production, so both reminder times can be tested at any time of day.
export function SendRemindersForm({ allowPretend }: { allowPretend: boolean }) {
  const [state, action, pending] = useActionState<SendRemindersState, FormData>(sendRemindersNow, {});
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">Volunteer reminders</summary>
      <p className="mt-2 text-sm text-slate-600">
        Volunteers get a reminder at 7 pm the evening before and 1 hour before their session, in the app and by email.
        They are sent automatically every 5 minutes. You can also send any that are due now.
      </p>
      <form action={action} className="mt-3 space-y-2">
        {allowPretend && (
          <label className="block text-sm">
            <span className="font-medium">Pretend the time is (testing only)</span>
            <input
              type="datetime-local"
              name="pretend"
              className="mt-1 block w-full rounded-lg border border-slate-400 px-3 py-2"
            />
          </label>
        )}
        <button
          disabled={pending}
          className="w-full rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send due reminders now"}
        </button>
        {state.message && <p className="text-sm font-medium text-teal-900">{state.message}</p>}
        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
