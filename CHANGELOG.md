# Changelog

## [4.0.0](https://github.com/execaman/discolink/compare/v3.0.0...v4.0.0) (2026-02-19)


### ⚠ BREAKING CHANGES

* **Plugins:** improve event system ([#32](https://github.com/execaman/discolink/issues/32))

### Features

* **Plugins:** improve event system ([#32](https://github.com/execaman/discolink/issues/32)) ([3bdbd90](https://github.com/execaman/discolink/commit/3bdbd90dc896ea4f09b0afbcbfcd44b8ce90bb00))
* **types:** add commonly used augmentable types ([#31](https://github.com/execaman/discolink/issues/31)) ([f211709](https://github.com/execaman/discolink/commit/f211709f55ca39f157fe034b378b7cab7b518f86))


### Bug Fixes

* **isArray:** no implicit non-empty check when check is a predicate ([#29](https://github.com/execaman/discolink/issues/29)) ([547006a](https://github.com/execaman/discolink/commit/547006a4ac5389b108ad9d3964f6867fc7d36c5f))

## [3.0.0](https://github.com/execaman/discolink/compare/v2.1.0...v3.0.0) (2026-02-15)


### ⚠ BREAKING CHANGES

* typings and queue sync ([#27](https://github.com/execaman/discolink/issues/27))

### Bug Fixes

* typings and queue sync ([#27](https://github.com/execaman/discolink/issues/27)) ([2821059](https://github.com/execaman/discolink/commit/28210592f38ee2acdbeb4bdb1b04e602f67bbcba))

## [2.1.0](https://github.com/execaman/discolink/compare/v2.0.1...v2.1.0) (2026-02-15)


### Features

* **Player:** add options to toggle queue sync and relocation ([ef33034](https://github.com/execaman/discolink/commit/ef3303489c7971a4b248996d672afb85d2850e18))
* queue sync and relocation options ([#26](https://github.com/execaman/discolink/issues/26)) ([ef33034](https://github.com/execaman/discolink/commit/ef3303489c7971a4b248996d672afb85d2850e18))
* **Queue:** implement sync method ([ef33034](https://github.com/execaman/discolink/commit/ef3303489c7971a4b248996d672afb85d2850e18))
* **QueueManager:** implement sync and relocate methods ([ef33034](https://github.com/execaman/discolink/commit/ef3303489c7971a4b248996d672afb85d2850e18))
* **VoiceState:** new property for 'disconnected' state ([#25](https://github.com/execaman/discolink/issues/25)) ([4fb06a0](https://github.com/execaman/discolink/commit/4fb06a04badd8019a02c242e1b7b8842d6d0c911))


### Bug Fixes

* **Node:** prevent immediate connect on initial failure ([#23](https://github.com/execaman/discolink/issues/23)) ([3d5bd22](https://github.com/execaman/discolink/commit/3d5bd227f4c87753bb5e0977089284614dc16cb1))

## [2.0.1](https://github.com/execaman/discolink/compare/v2.0.0...v2.0.1) (2026-02-04)


### Bug Fixes

* **Queue:** do not construct if one already exists ([5eb1036](https://github.com/execaman/discolink/commit/5eb10361e1b3a7928cfb5b8cebdbab32de02b096))

## [2.0.0](https://github.com/execaman/discolink/compare/v1.3.0...v2.0.0) (2026-02-03)


### ⚠ BREAKING CHANGES

* **Plugins:** better plugin system ([#11](https://github.com/execaman/discolink/issues/11))
* **Player:** removed `relocateQueues` option ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **Player:** removed `nodes` and `plugins` from instance options ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **Player:** renamed `initialized` property to `ready` ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **REST:** removed `retryLimit` option ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **REST:** removed request queue and `dropSessionRequests()` ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **Node:** removed `handshakeTimeout` property ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **FilterManager:** removed `data` property ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **QueueManager:** removed `cache` and `relocate()` ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **VoiceManager:** removed `cache` property ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **VoiceManager:** removed queue auto-destroy feature on guild/channel delete ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **NodeManager:** removed queue auto-relocation feature on close/disconnect ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **VoiceRegion:** removed `nodes` property ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **VoiceRegion:** `getAveragePing()` now returns `null` for insufficient data ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **VoiceState:** removed `valid`, `sessionId`, `token`, `endpoint`, `muted`, `deafened`, and `reconnect()` ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))

### Features

* **Plugins:** better plugin system ([#11](https://github.com/execaman/discolink/issues/11)) ([e0a791e](https://github.com/execaman/discolink/commit/e0a791e54adae982cbc97a921231801b5b28c888))
* **Player:** `autoInit` option to control initialization ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **REST:** directly usable common http methods ([#16](https://github.com/execaman/discolink/issues/16)) ([0415148](https://github.com/execaman/discolink/commit/04151484d41d808f408d079eee39bc08db7e3c81))
* **Node:** `reconnectLimit` can now be an integer, 0 for none, positive for limit, negative for no limit ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **Node:** exposed `reconnectLimit` property ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **NodeManager:** exposed `metrics` and `supports()` ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **REST:** exposed `baseUrl` and `userAgent` properties ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **FilterManager:** included `pluginFilters` as a valid filter key ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **FilterManager:** added clear filter types `native` and `plugin` for `clear()` ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))


### Bug Fixes

* **Node:** record timestamp before sending ping ([#15](https://github.com/execaman/discolink/issues/15)) ([b510b3c](https://github.com/execaman/discolink/commit/b510b3cc75caee2de0b4c69cccfdfc00ede5b5df))
* **Node:** persist `sessionId` when reconnecting ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))
* **Playlist:** mandate track(s) in raw api data ([e5077c2](https://github.com/execaman/discolink/commit/e5077c2f8a49fe258bb1aefe9b7047b4eb320e73))

## [1.3.0](https://github.com/execaman/discolink/compare/v1.2.1...v1.3.0) (2025-11-14)


### Features

* **Node:** immediate connect attempt before reconnect cycle ([#8](https://github.com/execaman/discolink/issues/8)) ([d5ee6b5](https://github.com/execaman/discolink/commit/d5ee6b5677d69f1e52368c6c1e158a521b694a0a))


### Bug Fixes

* **VoiceRegionIdRegex:** redos vulnerability ([#10](https://github.com/execaman/discolink/issues/10)) ([4188355](https://github.com/execaman/discolink/commit/418835559863d588414ae82ce3cd29a73e347e9f))

## [1.2.1](https://github.com/execaman/discolink/compare/v1.2.0...v1.2.1) (2025-10-19)


### Bug Fixes

* **FilterManager:** do not allow getting pluginFilters ([#6](https://github.com/execaman/discolink/issues/6)) ([446538c](https://github.com/execaman/discolink/commit/446538c4027946c05ef9bf817dc53bf4d040c121))
* **voice:** do not destroy on arbitrary close codes ([#4](https://github.com/execaman/discolink/issues/4)) ([d11225e](https://github.com/execaman/discolink/commit/d11225eebb015ef1082705cecdbf6f4365e5d560))

## [1.2.0](https://github.com/execaman/discolink/compare/1.1.0...v1.2.0) (2025-10-09)

### Features

- auto-destroy player on guild or channel delete ([#2](https://github.com/execaman/discolink/issues/2)) ([20398ad](https://github.com/execaman/discolink/commit/20398adc78a436267a51065214f3bc5c6efe71d5))
