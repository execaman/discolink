// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://execaman.github.io/",
  base: "discolink",
  outDir: "./dist",
  trailingSlash: "ignore",
  build: { format: "directory" },
  integrations: [
    starlight({
      title: "Discolink",
      description: "A Lavalink client for Discord bots in TypeScript",
      favicon: "/favicon.png",
      customCss: ["./src/styles/custom.css"],
      logo: {
        src: "./src/assets/logo.png",
        replacesTitle: false,
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/execaman/discolink" },
        { icon: "npm", label: "npm", href: "https://www.npmjs.com/package/discolink" },
      ],
      sidebar: [
        {
          label: "Setup",
          items: [
            { label: "Introduction", link: "/setup/introduction" },
            { label: "Installation", link: "/setup/installation" },
            { label: "Quick start", link: "/setup/quick-start" },
          ],
        },
        {
          label: "Basics",
          items: [
            { label: "Player", link: "/basics/player" },
            { label: "Nodes", link: "/basics/nodes" },
            { label: "Voice", link: "/basics/voice" },
            { label: "Queues", link: "/basics/queues" },
          ],
        },
        {
          label: "Advanced",
          items: [
            { label: "Playback", link: "/advanced/playback" },
            { label: "Filters & augmentation", link: "/advanced/filters" },
            { label: "Plugins", link: "/advanced/plugins" },
            { label: "Session resumption", link: "/advanced/session-resumption" },
          ],
        },
        {
          label: "Miscellaneous",
          items: [
            { label: "Changelog", link: "/misc/changelog" },
            { label: "API reference", link: "/api/classes/Main.Player.html" },
          ],
        },
      ],
    }),
  ],
});
