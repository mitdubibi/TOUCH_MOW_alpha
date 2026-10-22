import type { MetadataRoute } from "next";

// Installable app ("Add to Home Screen"). Opens without browser bars, starting at the login page, which offers
// anyone already logged in a button to carry on.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TOUCH MOW",
    short_name: "TOUCH MOW",
    description: "Meals-on-Wheels deliveries: checklists, routes and live meal updates.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12263f",
    theme_color: "#12263f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
