import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanza",
    short_name: "Finanza",
    description: "Gestione delle finanze personali",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#0f766e",
    lang: "it",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
