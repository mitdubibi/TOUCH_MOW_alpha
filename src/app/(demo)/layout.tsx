import { DemoProvider } from "@/components/demo/DemoProvider";

// Session dates are relative to today, so render per request rather than at build time.
export const dynamic = "force-dynamic";

// The home screen and every /demo screen share one in-memory state, so ticking a unit as a
// volunteer shows up when you switch to Organiser or Elderly. On a laptop the app sits in a
// phone-sized frame for presenting.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <div className="min-h-dvh bg-navy sm:py-6">
        <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-white sm:min-h-[820px] sm:overflow-clip sm:rounded-[2rem] sm:shadow-2xl">
          {children}
        </div>
      </div>
    </DemoProvider>
  );
}
