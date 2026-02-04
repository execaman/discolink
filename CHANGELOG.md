# Changelog

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
