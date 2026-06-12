---
name: cube-cobra
description: Explores and normalizes Cube Cobra cube/card data, especially cubeJSON responses and app-facing printable card schemas. Use when working with Cube Cobra APIs, cube data, card boards, tags, color identity, type lines, print selections, or when live API shape must be compared with documentation.
---

# Cube Cobra Data

## Truth order

When Cube Cobra docs and live responses disagree, treat **live API responses as truth**. Public docs are useful for endpoint discovery and intent, but field casing/nesting can lag production.

1. Live `GET /cube/api/cubeJSON/:id` response from a representative cube.
2. Existing app boundary code that already handles production data.
3. Cube Cobra API docs/examples.

## Quick start

Fetch one cube and inspect shape before changing parsing logic:

```bash
python - <<'PY'
import json, urllib.request
cube_id = 'modovintage'
req = urllib.request.Request(
  f'https://cubecobra.com/cube/api/cubeJSON/{cube_id}',
  headers={'User-Agent': 'agent-schema-check/1.0'}
)
data = json.load(urllib.request.urlopen(req, timeout=20))
print(data.keys())
print(type(data.get('cards')), list(data.get('cards', {}).keys())[:5])
card = next(iter(data['cards']['mainboard']))
print(card.keys())
print(card.get('details', {}).keys())
PY
```

## Core endpoint

Primary structured cube endpoint:

```txt
GET https://cubecobra.com/cube/api/cubeJSON/:id
```

- `:id` accepts UUIDs and short/custom Cube IDs.
- Optional `date=<unix-ms>` asks for a historical cube at/near that changelog date.
- CORS-enabled according to docs, but apps may still keep a server proxy fallback.
- Rate-limited in docs at 100 req/min/IP; cache and avoid bulk crawling live endpoints.

## Working rules

- Normalize external Cube Cobra data at the app boundary. Do not spread raw API objects through UI/layout code.
- Prefer a small internal schema named for the domain, such as `PrintableCard`, over raw `CubeCard` fields.
- Preserve board labels from Cube Cobra, but compare selected boards case-insensitively.
- Read tags from top-level cube card records, not from nested details.
- Read printable images, type line, and color identity from nested `details` when live responses show them there.
- Skip or explicitly handle cards without usable image URLs; do not assume every cube entry is printable.
- If supporting double-faced/custom-image cards, inspect both top-level image fields and nested detail image fields in live data.

## Schemas

See [SCHEMAS.md](SCHEMAS.md) for the compact schemas and raw-to-normalized mapping.

## Validation checklist

Before committing Cube Cobra data changes:

- [ ] Crawled at least one live `cubeJSON` response.
- [ ] Documented any doc-vs-live mismatch in code comments or project docs.
- [ ] Kept parsing defensive for missing/null fields.
- [ ] Added/updated normalization tests if the project has tests.
- [ ] Verified app behavior with boards, tags, type lines, color identity, and cards missing images.
