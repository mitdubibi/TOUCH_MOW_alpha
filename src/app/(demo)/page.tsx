"use client";

import Link from "next/link";
import { useDemo } from "@/components/demo/DemoProvider";

const ROLES = [
  { href: "/demo/volunteer", icon: "🚶", label: "Volunteer", hint: "Deliver meals and tick off units" },
  { href: "/demo/organiser", icon: "📋", label: "Organiser", hint: "Plan sessions and track progress" },
  { href: "/demo/elderly", icon: "🏠", label: "Elderly", hint: "See when your meal arrives" },
];

export default function Home() {
  const { dispatch } = useDemo();
  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-navy px-6 pb-10 pt-12 text-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sun text-3xl" aria-hidden>
          🍱
        </div>
        <h1 className="mt-5 text-3xl font-bold leading-tight">
          TOUCH <span className="text-sun">Meals on Wheels</span>
        </h1>
        <p className="mt-2 text-white/80">Hot meals for seniors in Jurong West, delivered by volunteers.</p>
      </section>

      <section className="-mt-6 flex-1 space-y-4 rounded-t-3xl bg-white px-5 pt-7">
        <h2 className="text-lg font-semibold text-navy">Who are you?</h2>
        {ROLES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex min-h-24 items-center gap-4 rounded-2xl border-2 border-navy bg-white p-4 shadow-sm active:bg-sun-light"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sun text-4xl" aria-hidden>
              {r.icon}
            </span>
            <span>
              <span className="block text-2xl font-bold text-navy">{r.label}</span>
              <span className="block text-slate-600">{r.hint}</span>
            </span>
          </Link>
        ))}
      </section>

      <footer className="space-y-2 px-5 py-6 text-center text-sm text-slate-500">
        <p>Prototype with made-up data.</p>
        <div className="flex justify-center gap-4">
          <button type="button" onClick={() => dispatch({ type: "reset" })} className="font-medium text-navy underline">
            Reset demo
          </button>
          <Link href="/login" className="font-medium text-navy underline">
            Staff login (live version)
          </Link>
        </div>
      </footer>
    </main>
  );
}
