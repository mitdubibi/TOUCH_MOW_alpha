import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOUCH MOW",
  applicationName: "TOUCH MOW",
  description: "Delivery checklists, routes and live meal updates for Meals-on-Wheels volunteers.",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  // iPhone: "Add to Home Screen" opens it full screen, without Safari's bars.
  appleWebApp: { capable: true, title: "TOUCH MOW", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12263f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
