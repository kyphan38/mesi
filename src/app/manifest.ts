import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mesi",
    short_name: "Mesi",
    description: "Meal planning - simple.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#0d9488",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
