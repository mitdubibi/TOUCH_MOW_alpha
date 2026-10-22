import { redirect } from "next/navigation";

// The real app starts at the login page.
// The no-login demo role picker lives at /demo.
export default function Home() {
  redirect("/login");
}
