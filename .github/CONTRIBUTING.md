# Contributing

Thank you for showing interest in contributing to this project. There are multiple ways for you to contribute explained below, please read them thoroughly as we must strictly follow a few things.

## Issues

These are only meant for bug reports and feature requests, blank issues have been disabled for the same. If you just have a thing or two to ask, consider joining our [Discord server](https://discord.com/invite/1sT-952570101784281139).

## Pull Requests

> [!WARNING]
> This guide assumes you're familiar with [basics of git](https://git-scm.com/cheat-sheet)

### General workflow

1. Clone this repository
2. Install dependencies via lockfile (e.g. `npm ci`)
3. Never work on the `main` branch, [create a feature branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging)
4. Follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) spec for commit messages
5. Your branch name must follow the `{type}/{short-name}` format

### Testing Changes

Only the following components need to be tested if your changes cover any:

- [`utility`](/src/Functions/utility.ts)
- [`validation`](/src/Functions/validation.ts)
- [`REST`](/src/Node/REST.ts)
- [`Node`](/src/Node/Node.ts)
- [`Track`](/src/Queue/Track.ts)
- [`Playlist`](/src/Queue/Playlist.ts)

Do NOT chase metrics (e.g. 100% coverage) focus on valid branch and line coverage, avoid ranges that simply cannot be covered (e.g. guards, v8 specific quirks).

> [!NOTE]
> Tests are not run automatically like code formatting and linting do everytime you commit or push to avoid unnecessary distraction, as such, if you do forget to test your code the CI will report them for you in your branch for that commit anyway.

### Managing Dependencies

**Check for updates**

```sh
npm run deps <type>
```

**Types** `prod` `dev` `peer` `optional`

**Update all**

```sh
npm run upgrade
```

### Code Ownership

If you make certain additions that you will continue to maintain in the future for the most part (e.g. adding a plugin), you might want to edit the `CODEOWNERS` file.
