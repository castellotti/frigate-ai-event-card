# Sensor Setup

The card reads `state.attributes.events` from a Home Assistant sensor. This guide walks through setting up that sensor using the provided REST sensor template and `frigate_events.py` preprocessor.

## Step 1: Generate a Frigate JWT

Frigate's API requires JWT authentication. Generate a long-lived token:

```bash
curl -sk -X POST "https://YOUR_FRIGATE_HOST:8971/api/login" \
  -H "Content-Type: application/json" \
  -d '{"user": "YOUR_FRIGATE_USER", "password": "YOUR_FRIGATE_PASSWORD"}' \
  -c - | grep frigate_token | awk '{print $NF}'
```

The token is valid for approximately 56 years and survives Frigate container restarts (unless you regenerate the signing key by re-generating certs).

## Step 2: Add the JWT to `secrets.yaml`

```yaml
# /config/secrets.yaml
frigate_jwt_token: eyJ...your_token_here...
```

## Step 3: Install `frigate_events.py` and the wrapper script

Copy [`examples/frigate_events.py`](../examples/frigate_events.py) to `/config/scripts/frigate_events.py` on your HA host.

Create a wrapper script at `/config/scripts/fetch_frigate_events.sh` that calls curl and pipes the output through the preprocessor. HA's `command_line` platform does **not** expand `!secret` tags inside command strings, so the JWT must live in the script directly or in a file readable by HA:

```bash
#!/bin/sh
FRIGATE_BASE_URL="https://YOUR_FRIGATE_HOST:8971"
FRIGATE_JWT="eyJ...your_token_here..."
curl -sk \
  -H "Authorization: Bearer $FRIGATE_JWT" \
  "$FRIGATE_BASE_URL/api/events?limit=20&has_clip=1&camera=YOUR_CAMERA_NAME" \
| FRIGATE_BASE_URL="$FRIGATE_BASE_URL" FRIGATE_JWT="$FRIGATE_JWT" \
  python3 /config/scripts/frigate_events.py
```

Make both files executable:

```bash
chmod +x /config/scripts/frigate_events.py /config/scripts/fetch_frigate_events.sh
```

The preprocessor:
1. Reads the raw Frigate events JSON array from stdin
2. Downloads and caches full-frame snapshots (no detection bbox) to `/config/www/frigate_thumbnails/`
3. Outputs a reshaped JSON object with `count` and `events` keys for the HA sensor

## Step 4: Add the `command_line` Sensor

Add to `configuration.yaml` (or a file included by it):

```yaml
command_line:
  - sensor:
      name: "Frigate Camera Front Events"
      unique_id: frigate_camera_front_events
      scan_interval: 30
      command: "/bin/sh /config/scripts/fetch_frigate_events.sh"
      value_template: "{{ value_json.count }}"
      json_attributes:
        - count
        - events
```

See [`examples/sensor-command-line.yaml`](../examples/sensor-command-line.yaml) for the full annotated template.

## Step 5: Restart Home Assistant

REST sensors require a full HA restart (not just a config reload):

```bash
ha core restart
```

## Step 6: Verify the Sensor

In HA **Developer Tools → States**, search for your sensor entity (e.g. `sensor.frigate_camera_front_events`). The state should be a number (event count). Click the sensor to inspect its attributes - you should see an `events` array containing event objects.

If the sensor state is `unavailable`:
- Check HA logs for REST sensor errors
- Verify Frigate is reachable from the HA host: `curl -sk "https://YOUR_FRIGATE_HOST:8971/api/events" -H "Authorization: Bearer YOUR_TOKEN"`
- Confirm `verify_ssl: false` is set if Frigate uses a self-signed certificate

## Thumbnail URL Strategies

The card renders thumbnails via `<img>` tags in a Shadow DOM context. Because of browser cross-origin cookie restrictions, the recommended approach is caching:

### Strategy 1: Cache to `/config/www/` (recommended)

This is what `frigate_events.py` does automatically. Snapshots are downloaded server-side (where the JWT is available) and stored as `/config/www/frigate_thumbnails/{id}_snap.jpg`. HA serves these at `/local/frigate_thumbnails/{id}_snap.jpg` - same-origin to HA, no browser auth needed.

### Strategy 2: HA Frigate proxy

The HA Frigate integration proxies event snapshots via HA itself:

```
/api/frigate/{config_entry_id}/notifications/{event_id}/snapshot.jpg
```

This is same-origin and HA-authenticated. Find your `config_entry_id` in **Settings → Integrations → Frigate → device page URL**.

### Strategy 3: Direct Frigate URL (not recommended)

Direct `https://your-frigate:8971/api/events/{id}/snapshot.jpg` URLs only work if the browser already holds a valid `frigate_token` cookie (i.e. the user is logged into Frigate in the same browser session). This is fragile and should be avoided in production dashboards.
