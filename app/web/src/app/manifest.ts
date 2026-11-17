import type { MetadataRoute } from "next";

/** ホーム画面に追加したときの名前とアイコン */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CraftFlow — つくる人のネットショップ",
    short_name: "CraftFlow",
    description: "つくって、売って、届けるまでを、ひとつの流れで。",
    lang: "ja",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#141413",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
