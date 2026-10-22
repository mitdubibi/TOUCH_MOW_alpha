import { BlockPhotoUpload } from "@/components/blocks/BlockPhotoUpload";
import { requireOrganiser } from "@/lib/auth";
import { blockPhotoUrl } from "@/lib/blocks";
import { compareBlockNumbers } from "@/lib/units";

type BlockRow = { postal_code: string; block_no: string; street: string | null; photo_path: string | null };

// One photo per HDB block, so volunteers recognise it. Every block from an uploaded list is here.
export default async function BlocksPage() {
  const { supabase } = await requireOrganiser();
  const { data } = await supabase
    .from("blocks")
    .select("postal_code, block_no, street, photo_path")
    .returns<BlockRow[]>();

  // Blocks still missing a photo first, then by block number.
  const blocks = (data ?? []).sort(
    (a, b) => Number(Boolean(a.photo_path)) - Number(Boolean(b.photo_path)) || compareBlockNumbers(a.block_no, b.block_no),
  );
  const withPhoto = blocks.filter((b) => b.photo_path).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Blocks</h1>
        <p className="text-slate-700">
          {withPhoto} of {blocks.length} blocks have a photo. Volunteers see it on their checklist and route.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Photograph the outside of the block from the road, showing the block number. No people, doors or unit
          numbers.
        </p>
      </div>
      {!blocks.length && <p className="text-slate-600">No blocks yet. Upload a delivery list first.</p>}
      <ul className="space-y-3">
        {blocks.map((b) => (
          <li key={b.postal_code} className="flex gap-3 rounded-xl border border-slate-200 p-3">
            {b.photo_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={blockPhotoUrl(b.photo_path)}
                alt={`Blk ${b.block_no}`}
                loading="lazy"
                className="h-24 w-24 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-center text-xs text-slate-500">
                No photo
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-lg font-bold">Blk {b.block_no}</p>
                <p className="text-sm text-slate-600">
                  {b.street ? `${b.street} · ` : ""}S{b.postal_code}
                </p>
              </div>
              <BlockPhotoUpload postalCode={b.postal_code} blockNo={b.block_no} photoPath={b.photo_path} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
