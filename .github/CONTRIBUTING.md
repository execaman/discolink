# Contributing

Thank you for showing interest in contributing to this project. There are multiple ways to contribute, explained below. Please read them thoroughly as we must strictly follow a few things.

## Issues

These are only meant for bug reports and feature requests, blank issues have been disabled for the same. If you just have a thing or two to ask, consider joining our [Discord server](https://discord.com/invite/1sT-952570101784281139).

## Pull Requests

> [!NOTE]
> We assume familiarity with [basics of git](https://git-scm.com/cheat-sheet) as a prerequisite

### General workflow

1. Clone this repository
2. Install dependencies via lockfile (e.g. `npm ci`)
3. Create a [branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging) named in `{type}/{short-name}` format
4. Make your changes, if it's code, keep value and type imports separate
5. Follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) spec for commit messages

### Testing Changes

Only the following components need to be tested if your changes cover any:

- [`utility`](/src/functions/utility.ts)
- [`validation`](/src/functions/validation.ts)
- [`REST`](/src/node/rest.ts)
- [`Node`](/src/node/node.ts)
- [`Track`](/src/queue/track.ts)
- [`Playlist`](/src/queue/playlist.ts)

There's no direct need for 100% coverage but remaining close to it is preferable given how much we're testing.

This is deliberate as we want to secure core functionality while leaving the rest of the codebase built upon it flexible and open to new features.

### Check for updates

```sh
npm run deps <type>
```

**Types** `prod` `dev` `peer` `optional`
