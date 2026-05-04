#!/usr/bin/env python3
"""
Frigate event preprocessor for the Frigate AI Event Card.

Reads a Frigate events JSON array from stdin, reshapes it for an HA sensor,
and caches full-frame snapshots (bbox=0, no detection overlay) to
/config/www/frigate_thumbnails/{event_id}_snap.jpg so they are served by HA
at /local/frigate_thumbnails/{event_id}_snap.jpg (same-origin, no auth).

Cross-origin auth rationale
---------------------------
Direct Frigate snapshot URLs require the frigate_token JWT cookie. That cookie
is SameSite=Lax, so browsers will NOT send it on cross-origin subresource
requests (e.g. an <img> tag in a Lovelace card loaded from your-ha-instance:8123
requesting an image from your-frigate-host:8971). Caching snapshots locally
via this script produces /local/... URLs that HA serves directly - no JWT
needed in the browser.

Environment variables
---------------------
FRIGATE_BASE_URL  Base URL of your Frigate instance, e.g. https://192.0.2.1:8971
FRIGATE_JWT       Frigate API JWT token (from POST /api/login)

Usage
-----
  curl -sk -H "Authorization: Bearer $FRIGATE_JWT" \
    "$FRIGATE_BASE_URL/api/events?limit=20&has_clip=1" \
  | FRIGATE_BASE_URL=$FRIGATE_BASE_URL FRIGATE_JWT=$FRIGATE_JWT \
    python3 /config/scripts/frigate_events.py
"""

import sys
import json
import os
import ssl
import urllib.request

BASE = os.environ.get("FRIGATE_BASE_URL", "")
JWT = os.environ.get("FRIGATE_JWT", "")
CACHE_DIR = "/config/www/frigate_thumbnails"


def _ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def cache_snapshot(event_id):
    """Download a full-frame snapshot (no bbox) to the local cache.

    Returns the /local/... URL on success, or None if the download fails or
    JWT is not set.
    """
    local_path = os.path.join(CACHE_DIR, f"{event_id}_snap.jpg")
    if not os.path.exists(local_path) and JWT:
        try:
            req = urllib.request.Request(
                f"{BASE}/api/events/{event_id}/snapshot.jpg?bbox=0",
                headers={"Authorization": f"Bearer {JWT}"},
            )
            with urllib.request.urlopen(req, context=_ssl_ctx(), timeout=5) as resp:
                with open(local_path, "wb") as f:
                    f.write(resp.read())
        except Exception:
            return None
    return (
        f"/local/frigate_thumbnails/{event_id}_snap.jpg"
        if os.path.exists(local_path)
        else None
    )


def main():
    if not BASE:
        print(json.dumps({"count": 0, "events": [], "error": "FRIGATE_BASE_URL not set"}))
        sys.exit(0)

    os.makedirs(CACHE_DIR, exist_ok=True)

    try:
        data = json.load(sys.stdin)
        events = []
        for e in data:
            snap = cache_snapshot(e["id"])
            events.append({
                "id":            e["id"],
                "label":         e.get("label", ""),
                "sub_label":     e.get("sub_label") or "",
                "camera":        e.get("camera", ""),
                "start_time":    e["start_time"],
                "end_time":      e.get("end_time") or "",
                "zones":         e.get("entered_zones") or [],
                "description":   (e.get("data") or {}).get("description") or "",
                "plate":         (e.get("data") or {}).get("recognized_license_plate") or "",
                "thumbnail_url": snap or f"{BASE}/api/events/{e['id']}/snapshot.jpg?bbox=0",
                "snapshot_url":  f"{BASE}/api/events/{e['id']}/snapshot.jpg",
            })
        print(json.dumps({"count": len(events), "events": events}))
    except Exception as ex:
        print(json.dumps({"count": 0, "events": [], "error": str(ex)}))


if __name__ == "__main__":
    main()
