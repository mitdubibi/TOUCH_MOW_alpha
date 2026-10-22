"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { nowLabel, useDemo } from "./DemoProvider";
import { RECIPIENT_PRESETS, SESSIONS, UNITS } from "@/data/mockData";
import { formatTime } from "@/lib/dates";
import { elderlyView, unitById, unitLabel, type ElderlyView } from "@/lib/demo/model";

type Lang = "en" | "zh";

const T = {
  en: {
    coming: "Your meal is coming.",
    away: (n: number, m: number) =>
      n === 0 ? `Your volunteer is coming to you next, about ${m} minutes.` : `Volunteer is ${n} stop${n === 1 ? "" : "s"} away, about ${m} minutes.`,
    delivered: "Delivered",
    enjoy: "Enjoy your meal!",
    missed: "We came but could not reach you.",
    willCall: "TOUCH will call you soon.",
    preparing: "Your meal is being prepared.",
    startsAt: (t: string) => `Delivery starts at ${t}.`,
    none: "No meal today.",
    call: "Call TOUCH",
    message: "Message TOUCH",
    calling: "Calling TOUCH...",
    demoCall: "Demo only. No real call is made.",
    endCall: "End call",
    pick: "What do you want to tell TOUCH?",
    sent: "Sent. TOUCH will reply soon.",
    close: "Close",
  },
  zh: {
    coming: "您的餐点正在路上。",
    away: (n: number, m: number) => (n === 0 ? `下一站就是您家，大约${m}分钟。` : `义工还有${n}站，大约${m}分钟。`),
    delivered: "已送达",
    enjoy: "请慢用！",
    missed: "义工来过，但联系不到您。",
    willCall: "TOUCH会尽快打电话给您。",
    preparing: "您的餐点正在准备中。",
    startsAt: (t: string) => `${t} 开始派送。`,
    none: "今天没有餐点。",
    call: "打电话给TOUCH",
    message: "发信息给TOUCH",
    calling: "正在打给TOUCH...",
    demoCall: "演示：不会真的拨打。",
    endCall: "挂断",
    pick: "您想告诉TOUCH什么？",
    sent: "已发送。TOUCH会尽快回复。",
    close: "关闭",
  },
};

// The elderly recipient's phone: opened from their private link /demo/elderly/<token>, no login.
// Updates live as the volunteer ticks units and moves.
export function ElderlyScreen({ unitId }: { unitId: string }) {
  const { state, dispatch } = useDemo();
  const router = useRouter();
  const unit = unitById(unitId);
  const [lang, setLang] = useState<Lang>(unit.lang);
  const [overlay, setOverlay] = useState<null | "call" | "message" | "sent">(null);
  const t = T[lang];
  const view = elderlyView(state, unit.id);

  const todayUnits = UNITS.filter((u) => SESSIONS.some((s) => s.dayOffset === 0 && s.unitIds.includes(u.id)));

  return (
    <main className="flex flex-1 flex-col bg-white">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link href="/demo" className="text-sm text-slate-500 underline">
          ‹ Roles
        </Link>
        <div className="flex overflow-hidden rounded-full border-2 border-navy text-lg font-bold">
          {(["en", "zh"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-4 py-1 ${lang === l ? "bg-navy text-sun" : "text-navy"}`}
            >
              {l === "en" ? "EN" : "中文"}
            </button>
          ))}
        </div>
      </div>

      <section className="flex-1 p-4">
        <StatusCard view={view} t={t} />
      </section>

      <section className="space-y-3 px-4 pb-4">
        <button
          type="button"
          onClick={() => setOverlay("call")}
          className="flex min-h-20 w-full items-center justify-center gap-3 rounded-3xl bg-navy text-3xl font-bold text-sun"
        >
          <span aria-hidden>📞</span> {t.call}
        </button>
        <button
          type="button"
          onClick={() => setOverlay("message")}
          className="flex min-h-20 w-full items-center justify-center gap-3 rounded-3xl border-4 border-navy text-3xl font-bold text-navy"
        >
          <span aria-hidden>💬</span> {t.message}
        </button>
      </section>

      <label className="flex items-center justify-center gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        Demo: this phone belongs to
        <select
          value={unit.id}
          onChange={(e) => {
            dispatch({ type: "setElderlyUnit", unitId: e.target.value });
            setLang(unitById(e.target.value).lang);
            router.push(`/demo/elderly/${state.tokens[e.target.value]}`);
          }}
          className="rounded border border-slate-300 bg-white px-1 py-0.5"
        >
          {todayUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {unitLabel(u)}
            </option>
          ))}
        </select>
      </label>

      {overlay && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-navy p-6 text-center text-white">
          <div className="w-full max-w-[380px] space-y-5">
            {overlay === "call" && (
              <>
                <p className="text-7xl">📞</p>
                <p className="text-4xl font-bold">{t.calling}</p>
                <p className="text-lg text-white/70">{t.demoCall}</p>
                <button type="button" onClick={() => setOverlay(null)} className="w-full rounded-3xl bg-red-600 py-5 text-3xl font-bold">
                  {t.endCall}
                </button>
              </>
            )}
            {overlay === "message" && (
              <>
                <p className="text-3xl font-bold">{t.pick}</p>
                {RECIPIENT_PRESETS[lang].map((body) => (
                  <button
                    key={body}
                    type="button"
                    onClick={() => {
                      dispatch({ type: "send", message: { thread: "recipients", from: "recipient", unitId: unit.id, body, time: nowLabel() } });
                      setOverlay("sent");
                    }}
                    className="w-full rounded-3xl bg-sun py-5 text-2xl font-bold text-navy"
                  >
                    {body}
                  </button>
                ))}
                <button type="button" onClick={() => setOverlay(null)} className="text-xl underline">
                  {t.close}
                </button>
              </>
            )}
            {overlay === "sent" && (
              <>
                <p className="text-7xl">✅</p>
                <p className="text-4xl font-bold">{t.sent}</p>
                <button type="button" onClick={() => setOverlay(null)} className="w-full rounded-3xl bg-sun py-5 text-3xl font-bold text-navy">
                  {t.close}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function StatusCard({ view, t }: { view: ElderlyView; t: (typeof T)["en"] | (typeof T)["zh"] }) {
  if (view.kind === "delivered") {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-3xl bg-sun p-6 text-center text-navy">
        <p className="text-8xl" aria-hidden>
          ✓
        </p>
        <p className="text-6xl font-black">{t.delivered}</p>
        <p className="mt-3 text-3xl font-semibold">{t.enjoy}</p>
      </div>
    );
  }
  const [big, small] =
    view.kind === "coming"
      ? [t.coming, t.away(view.stopsAway, view.minutes)]
      : view.kind === "missed"
        ? [t.missed, t.willCall]
        : view.kind === "preparing"
          ? [t.preparing, t.startsAt(formatTime(view.startTime))]
          : [t.none, ""];
  return (
    <div className="flex h-full flex-col justify-center rounded-3xl bg-navy p-6 text-white" aria-live="polite">
      <p className="text-5xl" aria-hidden>
        🍱
      </p>
      <p className="mt-4 text-4xl font-bold leading-tight">{big}</p>
      {small && <p className="mt-4 text-3xl font-semibold leading-snug text-sun">{small}</p>}
    </div>
  );
}
