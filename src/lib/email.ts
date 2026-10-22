// Sends a plain text email with Resend (https://resend.com). Server only.
// Without RESEND_API_KEY the email is printed to the server console instead, so the app works without an account.

type Email = { to: string; subject: string; text: string };

export async function sendEmail({ to, subject, text }: Email): Promise<{ error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[email not sent: RESEND_API_KEY is not set]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return { error: "Email not set up" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM_EMAIL || "TOUCH Meals on Wheels <onboarding@resend.dev>",
        to,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { error: (body?.message as string | undefined) ?? `Email service said ${res.status}` };
    }
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
