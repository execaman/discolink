# Contributing

Thank you for showing interest in contributing to this project. There are multiple ways to contribute, explained below. Please read them thoroughly as we must strictly follow a few things.

## Issues

These are only meant for bug reports and feature requests, blank issues have been disabled for the same. If you just have a thing or two to ask, consider joining our [Discord server](https://discord.com/invite/1sT-952570101784281139).

## Pull Requests

> [!NOTE]
> We assume familiarity with [basics of git](https://git-scm.com/cheat-sheet) as a prerequisite

### General workflow

1. Clone this repository
2. Install dependencies via lockfile (i.e. `npm ci`)
3. Create a [branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging) named in `{type}/{short-name}` format
4. Make your changes; for code, keep value and type imports separate
5. Follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) specification for commit messages

### Testing changes

You can run `npm run test` at will locally, upon making a PR changes are tested automatically through CI and reported for failures.

### Managing dependencies

The following scripts are also available in the documentation workspace:

```sh
# view latest versions
npm run deps

# update those in range by semver
npm run deps:update
```
