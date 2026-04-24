<div align="center">
  <img alt="Discolink" src="assets/music-album.png" width="120" />
  
  [Icon by juicy_fish](https://www.flaticon.com/authors/juicy-fish)
  <br/>
  [API Reference](https://execaman.github.io/discolink) | [Coverage](http://app.codecov.io/gh/execaman/discolink)

![NPM Version](https://img.shields.io/npm/v/discolink?style=flat&logo=npm)
![Codecov Coverage](https://img.shields.io/codecov/c/github/execaman/discolink?label=codecov&logo=codecov)

</div>

## ℹ️ Introduction

> **This project follows [SemVer](https://semver.org/) and an [Agile SDLC](https://www.geeksforgeeks.org/software-engineering/agile-sdlc-software-development-life-cycle/)**.

The goal of this library is to abstract away obvious steps involved in the process of acting as an intermediary between a [Lavalink](https://lavalink.dev/api) server and a [Discord](https://discord.com/developers/docs/events/gateway) bot to provide a simple and intuitive interface to work with.

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
> [`replaced`](https://execaman.github.io/discolink/enums/Typings.TrackEndReason.html#replaced) is an edge case where we cannot reliably determine the exact track object in queue that ended. The queue implements a workaround for this and provides a [`inQueue`](https://execaman.github.io/discolink/interfaces/Typings.PlayerEventMap.html#trackstart) (think cache hit/miss) boolean in track events

### Session Resumption

Resuming a node's session after your bot restarts requires careful planning, depending on scale. As such, the lib has no plans to provide built-in support for it. Disable either or both of [`autoSync`](https://execaman.github.io/discolink/interfaces/Typings.PlayerOptions.html#autosync) and [`relocateQueues`](https://execaman.github.io/discolink/interfaces/Typings.PlayerOptions.html#relocatequeues) options for predictable behavior if you're implementing this feature.
