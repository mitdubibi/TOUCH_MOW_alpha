import { AppHeader } from "@/components/ui/AppHeader";
import { requireUser } from "@/lib/auth";

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return (
    <>
      <AppHeader name={profile.display_name} links={[{ href: "/volunteer", label: "My sessions" }]} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
