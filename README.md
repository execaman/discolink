<div align="center">
  <img alt="Discolink" src="assets/music-album.png" width="120" />
  
  [Icon by juicy_fish](https://www.flaticon.com/authors/juicy-fish)
  <br/>
  [API Reference](https://execaman.github.io/discolink) | [Coverage](http://app.codecov.io/gh/execaman/discolink)

![NPM Version](https://img.shields.io/npm/v/discolink?style=flat&logo=npm)
![Codecov Coverage](https://img.shields.io/codecov/c/github/execaman/discolink?label=codecov&logo=codecov)

</div>

## 🎯 Purpose

The goal of this library is to abstract away obvious steps involved in the process of acting as an intermediary between [Lavalink](https://lavalink.dev/api) and [Discord](https://discord.com/developers/docs/events/gateway) to give developers a cleaner and intuitive interface to work with.

## 🙌 Motivation

It's the JS ecosystem, how can we not have 30 libs for the same thing. My friends were monkey-patching, applying hotfixes, despite their clients being open-source; and I wanted to do a project professionally while exploring more of GitHub. **This project follows [SemVer](https://semver.org/) and an [Agile SDLC](https://www.geeksforgeeks.org/software-engineering/agile-sdlc-software-development-life-cycle/)**.

## ⚙️ Requirements

- **Runtime** - one of the following:
  - [Node.js](https://nodejs.org) v22+
  - [Bun](https://bun.com) v1+
  - [Deno](https://deno.com) v2+
- **Library** - any [gateway client](https://docs.discord.com/developers/events/gateway) that supports:
  - sending raw payloads over the connection
  - receiving raw payloads from the connection

## 📝 Implementation

### Examples

<details>
<summary>Basic Setup - JavaScript (ESM)</summary>

```js
import { Client } from "main-lib";
import { Player } from "discolink";

const client = new Client(...);

const player = new Player({
  nodes: [ // add your nodes
    {
      name: "local",
      origin: "http://localhost:2333",
      password: "youshallnotpass"
    }
  ],
  async forwardVoiceUpdate(guildId, payload) {
    // send the given payload to your gateway connection
    client.guilds.cache.get(guildId).shard.send(payload);
  }
});

client.on("raw", (payload) => {
  // call the handler on gateway dispatch
  player.voices.handleDispatch(payload);
});

client.login();
```

</details>

<details>
<summary>Module Augmentation - TypeScript</summary>

```ts
/**
 * fields defined here appear wherever they're concerned
 */
declare module "discolink" {
  // appears on queue, related options, etc
  interface QueueContext {
    textId: string;
  }

  // appears on track, related options, etc
  interface CommonUserData {
    id: string;
    username: string;
    displayName: string;
  }

  // appears on track, playlist, etc
  interface CommonPluginInfo {
    save_uri?: string;
  }

  // appears throughout filter management
  interface CommonPluginFilters {
    custom: string;
  }
}
```

</details>

<details>
<summary>Custom Plugin (with events) - TypeScript</summary>

```ts
import { PlayerPlugin, type Player } from "discolink";

export class CustomPlugin extends PlayerPlugin<{
  // define events you want to emit on player
  eventName: [s: number, d: object];
}> {
  readonly name = "custom"; // 'readonly' is mandatory
  #player!: Player; // optional, just for convenience

  init(player: Player) {
    this.#player = player;
    player.on("nodeDispatch", this.#onDispatch);
  }

  transform(...args: unknown[]): [s: number, d: object] {}

  #onDispatch(this: Player, ...args: unknown[]) {
    // work with data
    // e.g. transform -> rename event -> dispatch
    const transformed = this.transform(...args);
    this.emit("eventName", ...transformed);
  }
}
```

</details>

### Additional Notes

- Destroy queues when necessary, e.g. events like guild/channel delete, etc.

- Check voice states like [`reconnecting`](https://execaman.github.io/discolink/classes/Voice.VoiceState.html#reconnecting) and [`changingNode`](https://execaman.github.io/discolink/classes/Voice.VoiceState.html#changingnode) before taking action

- Handle track end reasons other than [`cleanup`](https://execaman.github.io/discolink/enums/Typings.TrackEndReason.html#cleanup) and [`finished`](https://execaman.github.io/discolink/enums/Typings.TrackEndReason.html#finished) - especially [`replaced`](https://execaman.github.io/discolink/enums/Typings.TrackEndReason.html#replaced)

> [!NOTE]
> [`replaced`](https://execaman.github.io/discolink/enums/Typings.TrackEndReason.html#replaced) is an edge case where we cannot reliably determine the exact track object in queue that ended. The queue implements a workaround for this and provides a [`inQueue`](http://localhost:3000/docs/interfaces/Typings.PlayerEventMap.html#trackstart) (think cache hit/miss) boolean in track events

### Session Resumption

Resuming a node's session after your bot restarts requires careful planning, depending on scale. As such, the lib has no plans to provide built-in support for it. Disable either or both of [`autoSync`](https://execaman.github.io/discolink/interfaces/Typings.PlayerOptions.html#autosync) and [`relocateQueues`](https://execaman.github.io/discolink/interfaces/Typings.PlayerOptions.html#relocatequeues) options for predictable behavior if you're implementing this feature.

## 🤖 Bots in Production

| Name                                                                          | Since         | Owner                                                            |
| ----------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| [`Mesuic`](https://discord.com/discovery/applications/1157589891287367730)    | 18th Feb 2026 | [`@knifecodez`](https://discord.com/users/1053918356375351386)   |
| [`Fuego`](https://discord.com/discovery/applications/1050423676689985606)     | 19th Feb 2026 | [`@painfuego`](https://discord.com/users/692617937512562729)     |
| [`Flame`](https://discord.com/discovery/applications/1476630661996613755)     | 28th Feb 2026 | [`@aiosqlite.db`](https://discord.com/users/1243212619825942568) |
| [`Bumblebee`](https://discord.com/discovery/applications/1232384723188449283) | 2nd Apr 2026  | [`@freycikkk`](https://discord.com/users/1156173961034465333)    |

## 🤝 Acknowledgements

Key aspects of this lib were inspired from the following projects:

- [`distube`](https://github.com/skick1234/DisTube) player-queue design
- [`discord.js`](https://github.com/discordjs/discord.js) manager-cache concept
- [`Hoshimi`](https://github.com/Ganyu-Studios/Hoshimi) module augmentation (typings)
