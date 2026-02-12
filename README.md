<div align="center">
  <img alt="Discolink" src="assets/music-album.png" width="120" />
  
  [Icon by juicy_fish](https://www.flaticon.com/authors/juicy-fish)
  <br/>
  [API Reference](https://execaman.github.io/discolink) | [Coverage](http://app.codecov.io/gh/execaman/discolink)

![NPM Version](https://img.shields.io/npm/v/discolink?style=flat&logo=npm)
![Codecov Coverage](https://img.shields.io/codecov/c/github/execaman/discolink?label=codecov&logo=codecov)

</div>

## 🎯 Purpose

The goal of this library is to abstract away obvious steps involved in the process of acting as an intermediary between [Lavalink](https://lavalink.dev/api) and [Discord](https://discord.com/developers/docs/events/gateway) to give developers a cleaner yet intuitive interface to work with.

## ⚙️ Requirements

- **Runtime** - one of the following:
  - [Node.js](https://nodejs.org) v22+
  - [Bun](https://bun.com) v1+
  - [Deno](https://deno.com) v2+
- **Library** - any gateway client that supports:
  - sending raw payloads over the connection
  - receiving raw payloads from the connection
- **Lavalink** - at least with the following configuration:
  - disabled local tracks - for unique track identifiers
  - disabled built-in youtube source utilising their [plugin](https://github.com/lavalink-devs/youtube-source#plugin) instead (recommended)

## 🕓 Configuration

Any gateway client library meeting the requirements above is supported, you can apply the following pseudocode (this is the basic approach):

```js
import { Client } from "main-lib";
import { Player } from "discolink";

const client = new Client(...);

const player = new Player({
  nodes: [], // add your nodes
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

## 📝 Implementation

- Handle track end reasons other than `cleanup` and `finished`
- Handle voice states with care, e.g. `reconnecting`, `changingNode`, etc.
- Handle queue destruction/relocation, e.g. guild/channel delete, node close/disconnect, etc.
