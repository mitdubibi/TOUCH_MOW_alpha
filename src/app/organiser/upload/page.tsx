import { requireOrganiser } from "@/lib/auth";
import type { Centre } from "@/types/db";
import { UploadForm } from "./UploadForm";

export default async function UploadPage() {
  const { supabase } = await requireOrganiser();
  const { data: centres } = await supabase.from("centres").select("id, name").order("name").returns<Centre[]>();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload delivery list</h1>
      <p className="text-slate-700">
        CSV with columns Date, Session, Block, Unit, Postal Code, Meal Type, Remarks. Uploading again for the same
        date and session updates the list and keeps units already ticked.
      </p>
      <UploadForm centres={centres ?? []} />
    </div>
  );
}
