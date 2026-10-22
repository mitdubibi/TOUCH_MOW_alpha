"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BugReportForm } from "@/components/demo/BugReportForm";
import { useDemo } from "@/components/demo/DemoProvider";
import { SESSIONS } from "@/data/mockData";
import { initialDemoState, routeFor, unitLabel, volunteerById } from "@/lib/demo/model";

// Three households on today's lunch run, picked from the starting route so they stay the same
// even if an organiser reassigns blocks: 1 and 3 stops from Volunteer 1, and 1 stop from Volunteer 2.
const start = initialDemoState();
const lunch = SESSIONS[0];
const route = (vid: string) => routeFor(start, lunch.id, vid).flatMap((s) => s.units);
const ELDERLY = [
  { name: "Elderly A", unit: route("v1")[4], hint: "On Volunteer 1's route" },
  { name: "Elderly B", unit: route("v1")[6], hint: "On Volunteer 1's route" },
  { name: "Elderly C", unit: route("v2")[4], hint: "On Volunteer 2's route" },
];

const TASKS = [
  "Volunteer 1: open Today Lunch and tick 3 units. Then check the Organiser screen: the delivered count went up by 3.",
  `Open Elderly A on one phone and Volunteer 1 on another. Volunteer 1 taps Simulate walking and ticks units as the walk reaches each stop. Elderly A counts down stops and minutes, then shows Delivered.`,
  "Organiser: open Live map. Volunteer 2 taps Simulate walking. The Valerie pin moves on the map.",
  "Organiser: Messages, then Vince, and send a message. Volunteer 1 replies from My sessions. Both phones show both messages.",
  `Volunteer 2: tap Report a problem on ${unitLabel(ELDERLY[2].unit)} and choose No answer. Check the Organiser problem reports and the Elderly C screen.`,
];

export default function TestersPage() {
  const { state, dispatch } = useDemo();
  const router = useRouter();

  const asVolunteer = (vid: string) => {
    dispatch({ type: "setVolunteer", volunteerId: vid });
    router.push("/demo/volunteer");
  };

  return (
    <main className="flex-1 bg-white">
      <section className="bg-navy px-5 pb-6 pt-8 text-white">
        <p className="font-semibold tracking-wide text-sun">TOUCH MOW</p>
        <h1 className="mt-1 text-3xl font-bold">Testers start here</h1>
        <p className="mt-2 text-white/85">
          Thank you for testing! Pick a role below. Use two phones (or a phone and a laptop) so you can see changes
          appear on the other screen. All names and units are made up.
        </p>
      </section>

      <section className="space-y-3 p-5">
        <h2 className="text-xl font-bold text-navy">1. Pick a role</h2>
        <Link href="/demo/organiser" className="block rounded-2xl bg-navy px-5 py-4 text-2xl font-bold text-sun">
          📋 Organiser
        </Link>
        {["v1", "v2"].map((vid, i) => (
          <button
            key={vid}
            type="button"
            onClick={() => asVolunteer(vid)}
            className="block w-full rounded-2xl border-4 border-navy px-5 py-4 text-left text-2xl font-bold text-navy"
          >
            🚶 Volunteer {i + 1}
            <span className="block text-base font-medium text-slate-600">{volunteerById(vid).name}</span>
          </button>
        ))}
        {ELDERLY.map((e) => {
          const token = state.tokens[e.unit.id];
          return token ? (
            <Link
              key={e.name}
              href={`/demo/elderly/${token}`}
              className="block rounded-2xl bg-sun px-5 py-4 text-2xl font-bold text-navy"
            >
              🏠 {e.name}
              <span className="block text-base font-medium">
                {unitLabel(e.unit)} · {e.hint}
              </span>
            </Link>
          ) : (
            <p key={e.name} className="rounded-2xl bg-slate-100 px-5 py-4 text-slate-600">
              {e.name}: link not ready. Ask the organiser to press Reset demo data.
            </p>
          );
        })}
      </section>

      <section className="space-y-3 px-5 pb-5">
        <h2 className="text-xl font-bold text-navy">2. Try these</h2>
        <ol className="space-y-3">
          {TASKS.map((task, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-bold text-sun">
                {i + 1}
              </span>
              <span className="text-navy">{task}</span>
            </li>
          ))}
        </ol>
        <p className="rounded-xl bg-navy/5 p-3 text-sm text-slate-700">
          Everyone shares the same data. If things get messy, the organiser can press Reset demo data at the bottom of
          the Today screen (it resets it for everyone).
        </p>
      </section>

      <section className="space-y-2 px-5 pb-5">
        <h2 className="text-xl font-bold text-navy">Put it on your home screen</h2>
        <p className="text-slate-700">
          <strong>iPhone (Safari):</strong> tap Share, then Add to Home Screen.
          <br />
          <strong>Android (Chrome):</strong> tap ⋮, then Install app or Add to Home screen.
        </p>
        <p className="text-slate-700">It then opens like an app, without the browser bars.</p>
      </section>

      <section className="space-y-3 border-t-4 border-sun px-5 py-6">
        <h2 className="text-xl font-bold text-navy">3. Report a bug</h2>
        <BugReportForm />
      </section>
    </main>
  );
}
