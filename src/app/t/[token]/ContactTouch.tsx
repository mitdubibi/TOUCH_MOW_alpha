"use client";

import { useState } from "react";
import { sendRecipientMessage } from "./actions";

type Lang = "en" | "zh";

const T = {
  en: {
    call: "Call TOUCH",
    noPhone: "TOUCH's phone number is not set up yet.",
    message: "Message TOUCH",
    pick: "What do you want to tell TOUCH?",
    presets: ["I am not home today", "Please call me", "I do not need a meal today"],
    own: "Send your text",
    typeHere: "Type your message",
    send: "Send",
    sending: "Sending...",
    sent: "Sent. TOUCH will reply soon.",
    failed: "Could not send. Please call TOUCH.",
    back: "Back",
    close: "Close",
  },
  zh: {
    call: "打电话给TOUCH",
    noPhone: "TOUCH的电话号码还没有设置。",
    message: "发信息给TOUCH",
    pick: "您想告诉TOUCH什么？",
    presets: ["我今天不在家", "请打电话给我", "我今天不需要餐点"],
    own: "自己写信息",
    typeHere: "请输入信息",
    send: "发送",
    sending: "正在发送...",
    sent: "已发送。TOUCH会尽快回复。",
    failed: "发送失败。请打电话给TOUCH。",
    back: "返回",
    close: "关闭",
  },
};

// Big Call and Message buttons for the recipient page. Message opens a full screen with ready-made
// messages (one tap sends) and a box to type their own.
export function ContactTouch({ token, phone, lang }: { token: string; phone: string | null; lang: Lang }) {
  const t = T[lang];
  const [screen, setScreen] = useState<null | "pick" | "own" | "sent" | "failed" | "nophone">(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: string) {
    setBusy(true);
    const r = await sendRecipientMessage(token, body).catch(() => ({ error: "network" }));
    setBusy(false);
    if ("ok" in r) {
      setText("");
      setScreen("sent");
    } else {
      setScreen("failed");
    }
  }

  const bigButton = "flex min-h-20 w-full items-center justify-center gap-3 rounded-3xl text-3xl font-bold";

  return (
    <>
      <section className="space-y-3 pb-4">
        {phone ? (
          <a href={`tel:${phone}`} className={`${bigButton} bg-ink text-white`}>
            <span aria-hidden>📞</span> {t.call}
          </a>
        ) : (
          <button type="button" onClick={() => setScreen("nophone")} className={`${bigButton} bg-ink text-white`}>
            <span aria-hidden>📞</span> {t.call}
          </button>
        )}
        <button type="button" onClick={() => setScreen("pick")} className={`${bigButton} border-4 border-ink text-ink`}>
          <span aria-hidden>💬</span> {t.message}
        </button>
      </section>

      {screen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-brand p-4 text-white">
          <div className="w-full max-w-[420px] space-y-4 py-4">
            {screen === "pick" && (
              <>
                <p className="text-4xl font-bold leading-tight">{t.pick}</p>
                {t.presets.map((body) => (
                  <button
                    key={body}
                    type="button"
                    disabled={busy}
                    onClick={() => send(body)}
                    className="w-full rounded-3xl bg-white px-4 py-5 text-3xl font-bold text-ink disabled:opacity-60"
                  >
                    {body}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setScreen("own")}
                  className="w-full rounded-3xl border-4 border-white px-4 py-5 text-3xl font-bold"
                >
                  ✏️ {t.own}
                </button>
                <button type="button" onClick={() => setScreen(null)} className="w-full py-3 text-2xl underline">
                  {busy ? t.sending : t.close}
                </button>
              </>
            )}

            {screen === "own" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) send(text);
                }}
                className="space-y-4"
              >
                <label className="block">
                  <span className="text-4xl font-bold">{t.own}</span>
                  <textarea
                    required
                    autoFocus
                    rows={4}
                    maxLength={500}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t.typeHere}
                    className="mt-3 block w-full rounded-3xl bg-white p-4 text-3xl text-ink placeholder:text-slate-500"
                  />
                </label>
                <button
                  disabled={busy || !text.trim()}
                  className="w-full rounded-3xl bg-ink py-5 text-3xl font-bold text-white disabled:opacity-60"
                >
                  {busy ? t.sending : t.send}
                </button>
                <button type="button" onClick={() => setScreen("pick")} className="w-full py-3 text-2xl underline">
                  {t.back}
                </button>
              </form>
            )}

            {(screen === "sent" || screen === "failed" || screen === "nophone") && (
              <>
                <p className="text-center text-7xl" aria-hidden>
                  {screen === "sent" ? "✅" : "⚠️"}
                </p>
                <p role="status" className="text-center text-4xl font-bold leading-tight">
                  {screen === "sent" ? t.sent : screen === "failed" ? t.failed : t.noPhone}
                </p>
                <button
                  type="button"
                  onClick={() => setScreen(null)}
                  className="w-full rounded-3xl bg-ink py-5 text-3xl font-bold text-white"
                >
                  {t.close}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
