# Multi-Instance / Multi-Frigate Setup

You can use one card per camera and stack them freely. Cameras from different Frigate instances are handled by giving each card the correct `frigate_slug` matching the HA integration for that instance.

## Pattern

- One HA sensor per camera (or per-camera group)
- One card per sensor
- Group cards with `vertical-stack` (or a grid layout)

## Worked Example: Two Frigate Instances, Three Cameras

### Sensors

```yaml
# configuration.yaml (or frigate_sensors.yaml)

rest:
  # --- Frigate primary (instance 1) ---
  - scan_interval: 30
    resource: "https://YOUR_FRIGATE_HOST_1:8971/api/events?limit=20&has_clip=1&camera=camera_front_door"
    headers:
      Authorization: "Bearer !secret frigate_jwt_token_1"
    verify_ssl: false
    sensor:
      - name: "Frigate Camera Front Door Events"
        unique_id: frigate_camera_front_door_events
        value_template: "{{ value_json | length }}"
        command: >
          FRIGATE_BASE_URL=https://YOUR_FRIGATE_HOST_1:8971
          FRIGATE_JWT=!secret frigate_jwt_token_1
          python3 /config/scripts/frigate_events.py
        json_attributes_path: "$"
        json_attributes: [count, events]

  - scan_interval: 30
    resource: "https://YOUR_FRIGATE_HOST_1:8971/api/events?limit=20&has_clip=1&camera=camera_driveway"
    headers:
      Authorization: "Bearer !secret frigate_jwt_token_1"
    verify_ssl: false
    sensor:
      - name: "Frigate Camera Driveway Events"
        unique_id: frigate_camera_driveway_events
        value_template: "{{ value_json | length }}"
        command: >
          FRIGATE_BASE_URL=https://YOUR_FRIGATE_HOST_1:8971
          FRIGATE_JWT=!secret frigate_jwt_token_1
          python3 /config/scripts/frigate_events.py
        json_attributes_path: "$"
        json_attributes: [count, events]

  # --- Frigate GPU (instance 2) ---
  - scan_interval: 30
    resource: "https://YOUR_FRIGATE_HOST_2:8971/api/events?limit=20&has_clip=1&camera=camera_gate"
    headers:
      Authorization: "Bearer !secret frigate_jwt_token_2"
    verify_ssl: false
    sensor:
      - name: "Frigate GPU Camera Gate Events"
        unique_id: frigate_gpu_camera_gate_events
        value_template: "{{ value_json | length }}"
        command: >
          FRIGATE_BASE_URL=https://YOUR_FRIGATE_HOST_2:8971
          FRIGATE_JWT=!secret frigate_jwt_token_2
          python3 /config/scripts/frigate_events.py
        json_attributes_path: "$"
        json_attributes: [count, events]
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

- Each Frigate instance needs its own JWT and `FRIGATE_BASE_URL` in the sensor command
- Snapshot caches from different instances all go to the same `/config/www/frigate_thumbnails/` directory, which is fine (event IDs are unique UUIDs)
- You can mix `time_window` and `limit` settings across cards in the same stack
