# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-05

### Added
- `compact: true` config option — reduces card padding (`4px 8px` vs `12px 16px`) and title
  margin to minimise vertical and horizontal space. Intended for use inside sidebars, stacks,
  or any space-constrained context.

### Fixed
- Detail and video dialogs now render at 100% scale even when the card is inside a zoomed
  container (e.g. `zoom: 0.6` on a `custom:stack-in-card` sidebar). Chrome cascades CSS
  `zoom` into shadow DOM, causing dialogs to appear at the parent zoom level. The card now
  measures its own scale at open time and applies the inverse zoom to the dialog.

## [1.0.1] - 2026-05-05

### Fixed

- Filmstrip thumbnails are now centered horizontally; previously left-aligned when card width exceeded thumbnail content width

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
