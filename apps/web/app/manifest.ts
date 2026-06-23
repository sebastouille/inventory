import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventory Workspace",
    short_name: "Inventory",
    description: "Application web d inventaire et operations terrain",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8fc",
    theme_color: "#0b2a45",
    lang: "fr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
