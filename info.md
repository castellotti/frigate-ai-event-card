# Frigate AI Event Card

A Lovelace card that displays a filmstrip of recent Frigate detection events with AI-generated descriptions and inline clip playback.

![Filmstrip screenshot](docs/screenshot-filmstrip.png)

## Features

- **Filmstrip** — scrollable or auto-sized row of event thumbnails
- **AI descriptions** — rendered via `<ha-markdown>` in a click-to-open dialog
- **HLS clip playback** — inline video dialog via HA's Frigate VOD proxy; no extra credentials needed
- **Vision-provider agnostic** — works with Ollama, OpenAI, Anthropic, Gemini, or any provider Frigate supports
- **No build step** — single vanilla JS file, drop-in install

## Usage

```yaml
type: custom:frigate-ai-event-card
entity: sensor.frigate_camera_front_events
title: Front Door
frigate_slug: frigate
```

See the [README](https://github.com/castellotti/frigate-ai-event-card) for full configuration options and sensor setup instructions.
