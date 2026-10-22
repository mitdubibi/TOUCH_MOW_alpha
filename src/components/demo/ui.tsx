"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DemoHeader({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <header className="sticky top-0 z-[1000] bg-navy px-4 pb-3 pt-4 text-white">
      <div className="flex items-center justify-between text-sm">
        {back ? (
          <Link href={back} className="font-medium text-sun">
            ‹ Back
          </Link>
        ) : (
          <span className="font-semibold tracking-wide text-sun">TOUCH Meals on Wheels</span>
        )}
        <Link href="/demo" className="rounded-full border border-white/40 px-3 py-1 text-xs">
          Switch role
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold leading-tight">{title}</h1>
      {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
    </header>
  );
}

export function BottomNav({ items }: { items: { href: string; label: string; icon: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-[1000] grid border-t border-navy/10 bg-white" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((item) => {
        const active = item.exact ? path === item.href : path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              active ? "text-navy" : "text-slate-500"
            }`}
          >
            <span className={`flex h-7 w-12 items-center justify-center rounded-full text-base ${active ? "bg-sun" : ""}`}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ProgressBar({ value, total, colour = "bg-sun" }: { value: number; total: number; colour?: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-navy/10" aria-hidden>
      <div className={`h-full rounded-full ${colour} transition-all duration-500`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  );
}

export function Tabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy/5 p-1">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-lg py-2 text-center font-semibold ${path === t.href ? "bg-navy text-sun" : "text-navy"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
