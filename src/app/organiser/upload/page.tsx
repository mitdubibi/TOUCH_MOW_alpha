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
        Upload a CSV file or take a photo of the printed list. Uploading again for the same date and session updates
        the list and keeps units already ticked.
      </p>
      <p className="text-sm text-slate-600">
        Made-up sample in TOUCH&apos;s layout to try it:{" "}
        <a href="/samples/sample-touch-list.png" target="_blank" className="underline">
          picture
        </a>{" "}
        or{" "}
        <a href="/samples/sample-touch-list.csv" download className="underline">
          CSV
        </a>
        .
      </p>
      <UploadForm centres={centres ?? []} />
    </div>
  );
}
