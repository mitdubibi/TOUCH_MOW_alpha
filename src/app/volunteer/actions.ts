"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

// "Got it" on a reminder card: hides the reminders for that session.
export async function dismissReminder(formData: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("dismiss_reminders", { p_session_id: String(formData.get("sessionId")) });
  if (error) throw new Error(error.message);
  revalidatePath("/volunteer");
}
