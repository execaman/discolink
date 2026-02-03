# Changelog

## [2.0.0](https://github.com/execaman/discolink/compare/v1.3.0...v2.0.0) (2026-02-03)


### ⚠ BREAKING CHANGES

* better plugin system ([#11](https://github.com/execaman/discolink/issues/11))

### Features

* better plugin system ([#11](https://github.com/execaman/discolink/issues/11)) ([e0a791e](https://github.com/execaman/discolink/commit/e0a791e54adae982cbc97a921231801b5b28c888))
* **REST:** directly usable common http methods ([#16](https://github.com/execaman/discolink/issues/16)) ([0415148](https://github.com/execaman/discolink/commit/04151484d41d808f408d079eee39bc08db7e3c81))


### Bug Fixes

* **isString:** only pass for http strings on url check ([#12](https://github.com/execaman/discolink/issues/12)) ([03c4945](https://github.com/execaman/discolink/commit/03c4945379acf71628284ce358a942cbe7d0e5b8))
* **isString:** strict check url protocol for http ([#17](https://github.com/execaman/discolink/issues/17)) ([7654447](https://github.com/execaman/discolink/commit/765444707ae1de9c37232b789c275a7c18b37d72))
* **Node:** record timestamp before sending ping ([#15](https://github.com/execaman/discolink/issues/15)) ([b510b3c](https://github.com/execaman/discolink/commit/b510b3cc75caee2de0b4c69cccfdfc00ede5b5df))

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
