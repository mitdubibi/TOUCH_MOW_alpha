import { BottomNav } from "@/components/demo/ui";

export default function OrganiserDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav
        items={[
          { href: "/demo/organiser", label: "Today", icon: "📊", exact: true },
          { href: "/demo/organiser/upload", label: "Upload", icon: "📄" },
          { href: "/demo/organiser/assign", label: "Assign", icon: "🧩" },
          { href: "/demo/organiser/map", label: "Live map", icon: "🗺️" },
          { href: "/demo/organiser/messages", label: "Messages", icon: "💬" },
        ]}
      />
    </>
  );
}
