# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-04

### Added

- Initial release
- Filmstrip of event thumbnails with configurable height and limit
- `limit: auto` - ResizeObserver-driven slot calculation that fills available width
- `scrollable: true` - horizontal scroll filmstrip showing all events
- `time_window` filter (`24h`, `7d`, `30d`, `all`, or custom `<N>m`/`<N>h`/`<N>d`)
- Click thumbnail to open snapshot + AI description dialog
- `<ha-markdown>` rendering for AI descriptions
- Click snapshot (when `frigate_slug` set) to open HLS clip player via HA VOD proxy
- HLS playback via hls.js (lazy-loaded from CDN), custom `SignedLoader` injects `authSig` into segment requests
- `show_metadata`, `filter_no_description` display toggles
- `provider_label` badge for displaying vision model attribution
- `clip_button_text` customization
- `window.customCards` registration for Lovelace card picker
- Console banner on load (HACS convention)
- `getStubConfig` for card picker preview
- Accepts both `entity` and `sensor` config keys for compatibility
- `aria-label` with label and timestamp on thumbnail images
- Fallback plain-text rendering when `<ha-markdown>` is unavailable
- Defensive filtering of malformed events missing required fields
- Console banner includes documentation URL
- Screenshots in `docs/`
