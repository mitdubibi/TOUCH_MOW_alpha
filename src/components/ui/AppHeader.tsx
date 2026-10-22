import Link from "next/link";

type Props = {
  name: string;
  links: { href: string; label: string }[];
};

export function AppHeader({ name, links }: Props) {
  return (
    <header className="border-b border-slate-200 bg-teal-700 text-white">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <Link href="/me" className="font-bold">
          Meals on Wheels
        </Link>
        <nav className="flex flex-1 gap-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="text-sm">
          <span className="mr-2 hidden sm:inline">{name}</span>
          <button className="rounded border border-white/60 px-2 py-1">Log out</button>
        </form>
      </div>
    </header>
  );
}
