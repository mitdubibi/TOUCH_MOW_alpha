"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { ElderlyScreen } from "@/components/demo/ElderlyScreen";

// A household's private link. The token is random, never the unit number.
// DEMO ONLY: tokens are read with open access. With real security, look the token up on the server.
export default function ElderlyLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { state, dispatch } = useDemo();
  const unitId = Object.keys(state.tokens).find((id) => state.tokens[id] === token);

  // Remember which household this tab shows, for the role picker.
  useEffect(() => {
    if (unitId && unitId !== state.elderlyUnitId) dispatch({ type: "setElderlyUnit", unitId });
  }, [unitId, state.elderlyUnitId, dispatch]);

  if (!unitId) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-4xl font-bold text-navy">This link does not work.</p>
        <p className="text-2xl text-navy">Please call TOUCH.</p>
        <Link href="/demo" className="text-slate-500 underline">
          ‹ Roles
        </Link>
      </main>
    );
  }
  return <ElderlyScreen key={unitId} unitId={unitId} />;
}
