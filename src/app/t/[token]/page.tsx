import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/track/AutoRefresh";
import { addDays, formatTime, todayInSingapore } from "@/lib/dates";
import { mealLabel } from "@/lib/meals";
import { trackStatus, type Lang, type NextMeal, type TrackView } from "@/lib/track/status";
import { ContactTouch } from "./ContactTouch";

// A recipient's private link (sent by SMS). No login: the random token is the key.
export const metadata: Metadata = {
  title: "Your meal · TOUCH",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const T = {
  en: {
    coming: "Your meal is coming.",
    away: (n: number, m: number) =>
      n === 0
        ? `The volunteer is coming to you next, about ${m} minutes.`
        : `The volunteer is ${n} ${n === 1 ? "stop" : "stops"} away, about ${m} minutes.`,
    started: "The volunteer has started the round.",
    delivered: "Delivered",
    enjoy: "Enjoy your meal!",
    missed: "We came but could not reach you.",
    willCall: "TOUCH will call you soon.",
    preparing: "Your meal is being prepared.",
    startsAt: (t: string) => `Delivery starts at ${t}.`,
    none: "No meal today.",
    invalid: "This link does not work any more.",
    callTouch: "Please call TOUCH.",
    updates: "This page updates by itself.",
    nextMeal: "Next meal:",
    slot: { lunch: "Lunch", dinner: "Dinner" },
    tomorrow: "tomorrow",
    when: (slot: string, day: string | null) => (day ? `${slot} ${day}` : slot),
    dateTime: (date: string, time: string) => `${date}, from ${time}`,
    meal: (code: string) => `Meal: ${mealLabel(code)}`,
  },
  zh: {
    coming: "您的餐点正在路上。",
    away: (n: number, m: number) => (n === 0 ? `下一站就是您家，大约${m}分钟。` : `义工还有${n}站，大约${m}分钟。`),
    started: "义工已经出发。",
    delivered: "已送达",
    enjoy: "请慢用！",
    missed: "义工来过，但联系不到您。",
    willCall: "TOUCH会尽快打电话给您。",
    preparing: "您的餐点正在准备中。",
    startsAt: (t: string) => `${t} 开始派送。`,
    none: "今天没有餐点。",
    invalid: "这个链接已经失效。",
    callTouch: "请打电话给TOUCH。",
    updates: "此页面会自动更新。",
    nextMeal: "下一餐：",
    slot: { lunch: "午餐", dinner: "晚餐" },
    tomorrow: "明天",
    when: (slot: string, day: string | null) => (day ? `${day}${slot}` : slot),
    dateTime: (date: string, time: string) => `${date}，${time}开始`,
    meal: (code: string) => `餐类：${mealLabel(code).replace(" (normal)", "（普通）").replace(" (minced)", "（碎食）")}`,
  },
};

// "Thu, 12 Nov" or "11月12日星期四", and the time as "8:30 am" or "上午8:30".
function nextMealLines(next: NextMeal, lang: Lang, t: (typeof T)[Lang]): string[] {
  const [y, m, d] = next.date.split("-").map(Number);
  const date = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-SG", {
    weekday: lang === "zh" ? "long" : "short",
    day: "numeric",
    month: lang === "zh" ? "long" : "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  const [h, min] = next.startTime.split(":").map(Number);
  const time =
    lang === "zh" ? `${h < 12 ? "上午" : "下午"}${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")}` : formatTime(next.startTime);
  const isTomorrow = next.date === addDays(todayInSingapore(), 1);
  return [t.when(t.slot[next.slot], isTomorrow ? t.tomorrow : null), t.dateTime(date, time), t.meal(next.mealType)];
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang: langParam } = await searchParams;
  const status = await trackStatus(token);
  const lang: Lang = langParam === "zh" || langParam === "en" ? langParam : status.lang;
  const t = T[lang];

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-white p-4" lang={lang === "zh" ? "zh" : "en"}>
      <AutoRefresh seconds={30} />
      <div className="flex items-center justify-between">
        <p className="text-xl font-bold text-ink">TOUCH</p>
        <div className="flex overflow-hidden rounded-full border-2 border-ink text-xl font-bold">
          {(["en", "zh"] as const).map((l) => (
            <Link
              key={l}
              href={`?lang=${l}`}
              replace
              className={`px-5 py-2 ${lang === l ? "bg-brand text-white" : "text-ink"}`}
            >
              {l === "en" ? "EN" : "中文"}
            </Link>
          ))}
        </div>
      </div>

      <section className="flex flex-1 py-4">
        <StatusCard view={status.view} t={t} lang={lang} />
      </section>

      {status.view.kind !== "invalid" && (
        <ContactTouch token={token} phone={process.env.TOUCH_PHONE?.trim() || null} lang={lang} />
      )}

      <p className="pb-2 text-center text-xl text-slate-700">{t.updates}</p>
    </main>
  );
}

function StatusCard({ view, t, lang }: { view: TrackView; t: (typeof T)[Lang]; lang: Lang }) {
  if (view.kind === "delivered") {
    return (
      <div className="flex w-full flex-col items-center justify-center rounded-3xl bg-ink p-6 text-center text-white" aria-live="polite">
        <p className="text-9xl font-black" aria-hidden>
          ✓
        </p>
        <p className="text-6xl font-black">{t.delivered}</p>
        <p className="mt-4 text-4xl font-semibold">{t.enjoy}</p>
      </div>
    );
  }

  const [big, small] =
    view.kind === "coming"
      ? [t.coming, view.minutes != null ? t.away(view.stopsAway ?? 0, view.minutes) : t.started]
      : view.kind === "missed"
        ? [t.missed, t.willCall]
        : view.kind === "preparing"
          ? [t.preparing, t.startsAt(formatTime(view.startTime))]
          : view.kind === "invalid"
            ? [t.invalid, t.callTouch]
            : [t.none, ""];

  return (
    <div className="flex w-full flex-col justify-center rounded-3xl bg-brand p-6 text-white" aria-live="polite">
      <p className="text-6xl" aria-hidden>
        🍱
      </p>
      <p className="mt-4 text-5xl font-bold leading-tight">{big}</p>
      {small && <p className="mt-6 text-4xl font-semibold leading-snug text-white">{small}</p>}
      {view.kind === "none" && view.next && (
        <div className="mt-8 rounded-2xl bg-white p-5 text-ink">
          <p className="text-3xl font-semibold">{t.nextMeal}</p>
          {nextMealLines(view.next, lang, t).map((line, i) => (
            <p key={i} className={i === 0 ? "mt-2 text-4xl font-black" : "mt-2 text-3xl font-semibold leading-snug"}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
