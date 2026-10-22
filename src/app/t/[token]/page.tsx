import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/track/AutoRefresh";
import { formatTime } from "@/lib/dates";
import { trackStatus, type Lang, type TrackView } from "@/lib/track/status";

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
  },
};

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
        <p className="text-xl font-bold text-navy">TOUCH</p>
        <div className="flex overflow-hidden rounded-full border-2 border-navy text-xl font-bold">
          {(["en", "zh"] as const).map((l) => (
            <Link
              key={l}
              href={`?lang=${l}`}
              replace
              className={`px-5 py-2 ${lang === l ? "bg-navy text-sun" : "text-navy"}`}
            >
              {l === "en" ? "EN" : "中文"}
            </Link>
          ))}
        </div>
      </div>

      <section className="flex flex-1 py-4">
        <StatusCard view={status.view} t={t} />
      </section>

      <p className="pb-2 text-center text-xl text-slate-700">{t.updates}</p>
    </main>
  );
}

function StatusCard({ view, t }: { view: TrackView; t: (typeof T)[Lang] }) {
  if (view.kind === "delivered") {
    return (
      <div className="flex w-full flex-col items-center justify-center rounded-3xl bg-sun p-6 text-center text-navy" aria-live="polite">
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
    <div className="flex w-full flex-col justify-center rounded-3xl bg-navy p-6 text-white" aria-live="polite">
      <p className="text-6xl" aria-hidden>
        🍱
      </p>
      <p className="mt-4 text-5xl font-bold leading-tight">{big}</p>
      {small && <p className="mt-6 text-4xl font-semibold leading-snug text-sun">{small}</p>}
    </div>
  );
}
