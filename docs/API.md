# Floppy API inspection

Inspected `dannyvfilms/Floppy`, default branch `latest`, commit
`928bc403bf62d234134a5efd9424dcb5220f178f` on 2026-11-01.

Sources:
- `src/api/contracts/openapi.yaml`: verified consumer OpenAPI 3.0.3 subset.
- `/api/schema/`: full diagnostic schema exposed by a running Floppy instance.
- `src/api/serializers.py`: CompleteMediaSerializer, MediaSerializer, EpisodeSerializer.
- `src/api/views.py`: media list, show detail, season detail.
- `src/api/fork_views_tracking.py`: MediaEpisodeWatchView.
- `src/api/authentication.py`, `scopes.py`, `app/media_list_filters.py`.
- `docs/integrations/nuvio-client-guide.md`: token creation and header support.

## Requests

All paths below have prefix `/api/v1`, relative to FLOPPY_URL:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/media/tv/?limit=100&offset=N` | All pages of tracked TV |
| GET | `/media/tv/{source}/{media_id}/` | Show metadata, related seasons |
| GET | `/media/tv/{source}/{media_id}/{season}/` | Season metadata, related episodes |
| POST | `/media/tv/{source}/{media_id}/{season}/episodes/{episode}/watch/` | Record a watch now |

Authentication: `Authorization: Bearer <app token>`. Read operations require
`watchlist:read`; the watch endpoint uses the tracking write permission
`watchlist:write`. The default tracking token preset includes both. POST body
supplies `external_id` (unique UUID) for backend idempotency. Automatic mutation
retries are disabled. Floppy defaults `end_date` to now.

## Differences from the proposed model

- `next_episode` is explicitly the next **released** unwatched episode, not an
  upcoming schedule. `episodes_left` is released maximum progress minus progress,
  clamped to zero; use this server value rather than provider episode totals.
- Caught-up rows require show + season metadata to find a future unwatched
  episode. This extra work is cached and globally limited to three requests.
  Known undated episodes produce Upcoming; an explicit next-season hint also
  preserves Upcoming when dates are unavailable. No invented renewal inference.
- Status codes: Planning=0, In progress=1, Paused=2, Completed=3, Dropped=4.
  Only In progress shows enter Up Next. Dropped seasons are excluded from
  upcoming discovery; paused/planned seasons follow the available metadata. Specials (season zero) remain available in detail but
  do not determine the upcoming home schedule, matching backend next-episode
  treatment. Anime is a separate library and is outside this TV-only MVP.
- A related episode's `tracked` field means a watch play exists. Episode title,
  coordinates, and release timestamp are nested in `item`; dates may be null.
  Unknown dates are not actionable. No unwatch action is exposed by this app.
- OpenAPI leaves `item`, `details`, and `related` as arbitrary objects. The
  consumer interfaces refine these from the actual serializers instead of `any`.
  Only top-level pagination is runtime validated; these types target this API
  version, not arbitrary incompatible Floppy forks.

## CORS finding

No CORS middleware, CORS origin configuration, or Access-Control headers were
found in `src/config/settings.py`, `pyproject.toml`, or bundled `nginx.conf`.
There is no verified Floppy environment variable enabling allowed origins.
Separate-origin browser requests therefore need CORS headers and OPTIONS
handling on the deployment's Floppy-facing reverse proxy. See README.
No live Floppy account was supplied, so authenticated live verification remains
a deployment check. Inspection of the current source is not a live CORS test.

## Up Next alignment update

Home now follows the native Up Next filter (`status=1`, In progress only),
with ended/cancelled/other terminal shows retained only while released episodes
remain. Upcoming requires an actual undated unwatched episode or explicit next-season hint. Default ascending
queue order mirrors `_episode_feed_sort_values`: smallest released backlog,
soonest future date, most recent last air date, then unknown. Title breaks ties.
Planning and Completed tracker rows do not enter this queue.

REST `/home/` does not expose row type, queue projection, or row sort settings,
and clamps `limit` to 50 without pagination. We therefore derive the default
queue from the fully paginated TV library and show/season metadata. Custom
Floppy row sorts/directions and calendar-only episode data unavailable in those
responses cannot be reproduced exactly by this REST consumer. We do not silently
truncate to 50 cards or identify rows using translated/custom display titles.

Season default expansion uses `total_episodes_left` (includes future episodes),
falling back to Completed status when totals are unavailable. Zero released
remaining alone is not completion. Manual toggles remain under user control.

## Container feed cache (current production architecture)

The user approved replacing the static-only architecture with a small Node
server. Floppy endpoints and types above remain unchanged. Production requests
are now authenticated by the container, not the browser. Only show detail,
season detail and episode watch routes are forwarded; this is not an arbitrary
URL proxy. The browser config exposes no Floppy token or upstream URL.

New **Floopy Grid local** endpoint: `GET /api/grid/feed` returns
`{ready, entries:[{row,next,lastAirDate}], updatedAt, refreshing, error}`.
`?refresh=1` starts/coalesces a background refresh and returns immediately.
The endpoint is not a Floppy API route. Only verified queue entries enter the
snapshot. Metadata is memoized for a minute; full snapshots refresh every five
minutes by default. Writes revalidate their affected show and persist the change.

Atomic JSON snapshots in /data bind to a SHA-256 identity of URL and token. Raw
credentials are never saved there. Failed refreshes preserve the prior snapshot;
files from another server/token are ignored. Changing a token causes a cold build.
CORS findings earlier in this document apply only to direct-browser dev mode.
Production no longer needs Floppy CORS or a browser-reachable upstream address.
