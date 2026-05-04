# Card Configuration Reference

Full option reference for `frigate-ai-event-card`.

## Required

| Option | Type | Description |
|---|---|---|
| `entity` | string | HA sensor entity ID exposing `state.attributes.events`. Alias: `sensor` (accepted for compatibility) |

## Display Options

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | — | Header text rendered above the filmstrip. Omit entirely for no header |
| `thumbnail_height` | integer | `80` | Thumbnail height in pixels. Width is determined by the image's natural aspect ratio |
| `limit` | `auto` \| integer | `auto` | Number of thumbnails to display. `auto` uses a `ResizeObserver` to fill the available card width. Ignored when `scrollable: true` |
| `scrollable` | boolean | `false` | When `true`, the filmstrip wraps in a horizontally scrollable container and shows all filtered events (ignores `limit`) |
| `time_window` | string | `all` | Only show events whose `start_time` falls within this window. Values: `all`, `24h`, `7d`, `30d`, or a custom duration like `2h`, `15m`, `3d` |
| `filter_no_description` | boolean | `true` | When `true`, events with an empty `description` field are hidden. Set to `false` to show all events with a `_No description yet._` placeholder |
| `show_details` | boolean | `true` | When `true`, renders an expandable `<details>` list below the filmstrip with full thumbnails, descriptions, and clip buttons |
| `show_metadata` | boolean | `true` | When `true`, shows label, sub_label, plate, date, and zones in dialogs and the details list |
| `provider_label` | string | — | Small attribution badge displayed below the filmstrip, e.g. `Powered by Qwen3-VL`. Styled with `font-size: 11px; opacity: 0.7` |

## Clip Playback Options

| Option | Type | Default | Description |
|---|---|---|---|
| `frigate_slug` | string | — | HA Frigate integration client ID (the `slug` used in the VOD proxy path). When set, enables the clip player: clicking the snapshot in the dialog opens an HLS video. When absent, the clip button and play overlay are hidden |
| `clip_button_text` | string | `▶ Watch clip` | Text for the clip button in the details list |

## Validation Rules

`setConfig` throws on:
- Neither `entity` nor `sensor` provided
- `time_window` does not match `/^(all|24h|7d|30d|\d+[mhd])$/`
- `limit` is not `'auto'` and not a positive integer
- `thumbnail_height` is not a positive integer

## Full Example

```yaml
type: custom:frigate-ai-event-card
entity: sensor.frigate_camera_front_events
title: Front Door
limit: 10
scrollable: false
thumbnail_height: 100
time_window: 7d
filter_no_description: true
show_details: true
show_metadata: true
frigate_slug: frigate
clip_button_text: "▶ Watch clip"
provider_label: "Powered by Qwen3-VL"
```
