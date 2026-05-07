// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://execaman.github.io/",
  base: "discolink",
  outDir: "./dist",
  build: { format: "file" },
  trailingSlash: "never",
  integrations: [
    starlight({
      title: "Discolink",
      description: "A Lavalink client for Discord bots in TypeScript",
      favicon: "/favicon.png",
      logo: {
        src: "./src/assets/logo.png",
        replacesTitle: false,
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/execaman/discolink" },
        { icon: "npm", label: "npm", href: "https://www.npmjs.com/package/discolink" },
      ],
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Setup",
          items: [
            { label: "Introduction", link: "/setup/introduction.html" },
            { label: "Installation", link: "/setup/installation.html" },
            { label: "Quick start", link: "/setup/quick-start.html" },
          ],
        },
        {
          label: "Basics",
          items: [
            { label: "Player", link: "/basics/player.html" },
            { label: "Nodes", link: "/basics/nodes.html" },
            { label: "Voice", link: "/basics/voice.html" },
            { label: "Queues", link: "/basics/queues.html" },
          ],
        },
        {
          label: "Advanced",
          items: [
            { label: "Playback", link: "/advanced/playback.html" },
            { label: "Filters & augmentation", link: "/advanced/filters.html" },
            { label: "Plugins", link: "/advanced/plugins.html" },
            { label: "Session resumption", link: "/advanced/session-resumption.html" },
          ],
        },
        {
          label: "Miscellaneous",
          items: [
            { label: "Changelog", link: "/misc/changelog.html" },
            { label: "API reference", link: "/api/classes/Main.Player.html" },
          ],
        },
      ],
    }),
  ],
});
