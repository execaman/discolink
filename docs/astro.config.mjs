// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://execaman.github.io/discolink",
  outDir: "../site",
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
            { label: "Introduction", link: "/discolink/setup/introduction.html" },
            { label: "Installation", link: "/discolink/setup/installation.html" },
            { label: "Quick start", link: "/discolink/setup/quick-start.html" },
          ],
        },
        {
          label: "Basics",
          items: [
            { label: "Player", link: "/discolink/basics/player.html" },
            { label: "Nodes", link: "/discolink/basics/nodes.html" },
            { label: "Voice", link: "/discolink/basics/voice.html" },
            { label: "Queues", link: "/discolink/basics/queues.html" },
          ],
        },
        {
          label: "Advanced",
          items: [
            { label: "Playback", link: "/discolink/advanced/playback.html" },
            { label: "Filters & augmentation", link: "/discolink/advanced/filters.html" },
            { label: "Plugins", link: "/discolink/advanced/plugins.html" },
            { label: "Session resumption", link: "/discolink/advanced/session-resumption.html" },
          ],
        },
        {
          label: "Miscellaneous",
          items: [
            { label: "Changelog", link: "/discolink/misc/changelog.html" },
            { label: "API reference", link: "/discolink/api/classes/Main.Player.html" },
          ],
        },
      ],
    }),
  ],
});
