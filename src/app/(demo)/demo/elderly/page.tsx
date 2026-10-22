"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDemo } from "@/components/demo/DemoProvider";

// From the role picker: open the private link of the household this tab is showing.
export default function ElderlyDemo() {
  const { state } = useDemo();
  const router = useRouter();
  const token = state.tokens[state.elderlyUnitId];

  useEffect(() => {
    if (token) router.replace(`/demo/elderly/${token}`);
  }, [router, token]);

  return (
    <main className="flex flex-1 items-center justify-center p-6 text-center text-2xl font-semibold text-navy">
      {token ? "Opening..." : "No link for this household yet. Reset demo data on the organiser screen."}
    </main>
  );
}
