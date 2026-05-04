# Multi-Instance / Multi-Frigate Setup

You can use one card per camera and stack them freely. Cameras from different Frigate instances are handled by giving each card the correct `frigate_slug` matching the HA integration for that instance.

## Pattern

- One HA sensor per camera (or per-camera group)
- One card per sensor
- Group cards with `vertical-stack` (or a grid layout)

## Worked Example: Two Frigate Instances, Three Cameras

### Wrapper Scripts

Create one wrapper script per Frigate instance (the JWT and base URL are hardcoded in the script because HA's `command_line` platform does **not** expand `!secret` tags inside command strings).

**`/config/scripts/fetch_frigate_events_1.sh`** (instance 1 — two cameras):
```bash
#!/bin/sh
FRIGATE_BASE_URL="https://YOUR_FRIGATE_HOST_1:8971"
FRIGATE_JWT="eyJ...token_for_instance_1..."
CAMERA="${1:-camera_front_door}"
curl -sk \
  -H "Authorization: Bearer $FRIGATE_JWT" \
  "$FRIGATE_BASE_URL/api/events?limit=20&has_clip=1&camera=$CAMERA" \
| FRIGATE_BASE_URL="$FRIGATE_BASE_URL" FRIGATE_JWT="$FRIGATE_JWT" \
  python3 /config/scripts/frigate_events.py
```

**`/config/scripts/fetch_frigate_events_2.sh`** (instance 2):
```bash
#!/bin/sh
FRIGATE_BASE_URL="https://YOUR_FRIGATE_HOST_2:8971"
FRIGATE_JWT="eyJ...token_for_instance_2..."
curl -sk \
  -H "Authorization: Bearer $FRIGATE_JWT" \
  "$FRIGATE_BASE_URL/api/events?limit=20&has_clip=1&camera=camera_gate" \
| FRIGATE_BASE_URL="$FRIGATE_BASE_URL" FRIGATE_JWT="$FRIGATE_JWT" \
  python3 /config/scripts/frigate_events.py
```

Make both executable:
```bash
chmod +x /config/scripts/fetch_frigate_events_1.sh /config/scripts/fetch_frigate_events_2.sh
```

### Sensors

```yaml
# configuration.yaml (or frigate_sensors.yaml)

command_line:
  # --- Frigate primary (instance 1) ---
  - sensor:
      name: "Frigate Camera Front Door Events"
      unique_id: frigate_camera_front_door_events
      scan_interval: 30
      command: "/bin/sh /config/scripts/fetch_frigate_events_1.sh camera_front_door"
      value_template: "{{ value_json.count }}"
      json_attributes:
        - count
        - events

  - sensor:
      name: "Frigate Camera Driveway Events"
      unique_id: frigate_camera_driveway_events
      scan_interval: 30
      command: "/bin/sh /config/scripts/fetch_frigate_events_1.sh camera_driveway"
      value_template: "{{ value_json.count }}"
      json_attributes:
        - count
        - events

  # --- Frigate GPU (instance 2) ---
  - sensor:
      name: "Frigate GPU Camera Gate Events"
      unique_id: frigate_gpu_camera_gate_events
      scan_interval: 30
      command: "/bin/sh /config/scripts/fetch_frigate_events_2.sh"
      value_template: "{{ value_json.count }}"
      json_attributes:
        - count
        - events
```

### Dashboard Card

```yaml
type: vertical-stack
cards:
  - type: custom:frigate-ai-event-card
    entity: sensor.frigate_camera_front_door_events
    title: Front Door
    limit: 8
    frigate_slug: frigate          # matches HA Frigate integration for instance 1

  - type: custom:frigate-ai-event-card
    entity: sensor.frigate_camera_driveway_events
    title: Driveway
    limit: 8
    frigate_slug: frigate          # same instance 1 slug

  - type: custom:frigate-ai-event-card
    entity: sensor.frigate_gpu_camera_gate_events
    title: Gate (GPU)
    limit: 8
    frigate_slug: frigate-gpu      # matches HA Frigate integration for instance 2
    provider_label: "Powered by Qwen3-VL"
```

## Finding the `frigate_slug`

The slug is the integration's client ID registered in HA. It appears in:

- **Settings → Integrations → Frigate (your instance) → three-dot menu → System information** — look for `client_id`
- The HA Frigate VOD proxy path: `/api/frigate/{slug}/vod/...`

The slug is set when the integration is added. It defaults to `frigate` for the first instance; a second instance may use `frigate-2`, `frigate-gpu`, or another value — check your integration config.

## Tips

- Each Frigate instance needs its own JWT and `FRIGATE_BASE_URL` in its wrapper script
- Snapshot caches from different instances all go to the same `/config/www/frigate_thumbnails/` directory, which is fine (event IDs are unique UUIDs)
- You can mix `time_window` and `limit` settings across cards in the same stack
