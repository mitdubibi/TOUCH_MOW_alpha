import { AppHeader } from "@/components/ui/AppHeader";
import { requireOrganiser } from "@/lib/auth";

export default async function OrganiserLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireOrganiser();
  return (
    <>
      <AppHeader
        name={profile.display_name}
        links={[
          { href: "/organiser", label: "Sessions" },
          { href: "/organiser/upload", label: "Upload list" },
          { href: "/organiser/blocks", label: "Blocks" },
        ]}
      />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
