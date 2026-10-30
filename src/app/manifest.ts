import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Partnership",
    short_name: "Partnership",
    description: "Monthly contributions, made clear.",
    start_url: "/board",
    scope: "/",
    display: "standalone",
    background_color: "#fff5fa",
    theme_color: "#5b2a86",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
