# Floopy Grid

A compact, dark TV tracking PWA for [Floppy](https://github.com/dannyvfilms/Floppy).
Three posters across on iPhone, released episode counts, upcoming dates, seasons
and one-tap watches. Inspired by iShows' poster focus; no iShows assets are used.

## Screenshots

Placeholder: Home and Show screenshots from a configured installation.

## Architecture

React, TypeScript, Vite, React Router, TanStack Query and plain CSS. The Docker
container now includes a small Node 24 HTTP server using built-in modules only.
It serves the static PWA, authenticates allowlisted Floppy requests and prepares
an account-specific feed cache in `/data/feed.json`. There is no database.
Floppy remains the source of truth. No React SSR is used: Vite's server build
only bundles the HTTP/cache service.

This replaces the initial static Nginx/direct-browser architecture, following
approval to add a server cache. Production browsers talk to Floopy Grid on the
same origin. FLOPPY_TOKEN and FLOPPY_URL are **not exposed in config.js**. Runtime
config.js contains only `SERVER_CACHE: true`. No rebuild is needed to change
server URL, token, port, cache directory or refresh interval.

The container fetches the fully paginated TV library and prepares upcoming data
with at most three concurrent metadata requests. Successful snapshots are
written atomically. The last good snapshot loads on startup and survives outages
and container recreation when `/data` is mounted. A changed server URL or token
invalidates a saved snapshot, preventing another account's cache from loading.
First startup needs to build the feed; large libraries can take several minutes.
Subsequent visits immediately receive the last saved feed, with an update time.

Background refresh defaults to every five minutes. Manual refresh starts a
coalesced background job. The frontend checks the local cache every minute
and every three seconds while a build is in progress; these checks do not each
fetch Floppy. Focus/reconnect also refetch the local snapshot. Browser query
caches are in memory. The service worker only caches the app shell, not APIs
or config.js.

A successful episode watch clears metadata memoization and recomputes that
show from Floppy before returning. Other cards remain available. A background
build started before the watch cannot overwrite the new watch state. If the
watch succeeds but schedule refresh fails, the known backlog is decremented
and a warning is returned in the feed; periodic refresh retries. Failed watch
requests roll back the frontend optimistic episode state. Network loss after a
server-side watch can still be ambiguous: refresh before deliberately retrying.

## Up Next behavior and Floppy API

Only In progress TV shows enter Home. Default sort is smallest released backlog,
then earliest future episode date, then latest last-air date. Ended shows remain
only while a released backlog exists. A caught-up show needs actual future or
undated unwatched episode metadata, or an explicit next-season hint. Loading
candidates never appear as posters. Specials are available in detail.

The mobile grid has no gutters or rounded corners. Fully watched seasons start
collapsed; seasons with future or other remaining episodes start open.

See [API inspection and parity limits](docs/API.md). Floppy's REST API does not
expose all native Home queue projections/custom sorting settings. Its /home/
endpoint is limited to 50 without pagination, so the grid derives the default
queue from the complete library instead. Anime remains a separate library.

## Token and access

In Floppy: **Settings → Integrations → App tokens**. Create an app token with
the default tracking preset; reads require `watchlist:read`, watches require
`watchlist:write`. Supply the raw secret as FLOPPY_TOKEN, without `Bearer`.
Do not commit tokens or environment files. The token stays in the container.

This is a **single-account trusted-network app**: anyone who can access Grid can
read the cached library and mark that account's episodes watched. There is no
separate Grid login. Put external authentication on your reverse proxy before
exposing it beyond trusted devices. Cache files contain personal library data;
keep the volume private. Cross-origin browser writes are rejected.

## Development and production build

Node 24.x:

```sh
npm install
cp .env.example .env.local
# Set FLOPPY_URL and FLOPPY_TOKEN. Set CACHE_DIR=./cache for local use.
npm run lint
npm run test
npm run build
node --env-file=.env.local server-dist/index.mjs
```

`npm run test:smoke` checks the built server against a local mock Floppy,
including persistence, watch mutations, outages and origin checks. Set SMOKE_PORT
if its default 9123 is already in use.

`npm run dev` still supports the original direct-browser Vite development mode:
it reads the local URL/token into config.js and requires Floppy CORS. This is
for development only. To exercise production behavior use the server command
above. `npm run dev:server` rebuilds just the server bundle; run the full build
first so static assets exist. `npm start` uses the existing process environment.

## Docker and Synology

Standard build:

```sh
docker build --pull -t floopy-grid .
```

For older Synology Docker without BuildKit use the included compatible file:

```sh
docker build --pull -f Dockerfile.synology -t floopy-grid .
```

**Do not run the old sed/chmod Dockerfile modifications.** Nginx and its startup
script have been replaced by the cache server.

Example `.env.runtime` (replace the URL and token):

```dotenv
PORT=8080
FLOPPY_URL=http://192.168.0.2:8001
FLOPPY_TOKEN=CHANGE_ME
CACHE_REFRESH_SECONDS=300
```

FLOPPY_URL must be reachable from the **container**. You may now use the direct
Floppy address or a Docker DNS name if both containers share a network. The
previous CORS reverse-proxy URL also works. Do not append `/api/v1`.

For this Synology deployment:

```sh
cd /volume3/docker/floopy-grid
chmod 600 .env.runtime
mkdir -p cache
chown 1000:1000 cache
chmod 700 cache
docker run -d --name floopy-grid --restart unless-stopped --env-file .env.runtime -p 8004:8080 -v /volume3/docker/floopy-grid/cache:/data floopy-grid
```

The runtime runs as UID/GID 1000. Give only its dedicated cache directory that
ownership; do not recursively change ownership of your other NAS directories.
Alternatively use a Docker named volume (`-v floopy-grid-cache:/data`) which is
initialized with the image's directory ownership.

| Variable | Default | Meaning |
| --- | --- | --- |
| PORT | 8080 | Runtime HTTP listening port, 1–65535 |
| FLOPPY_URL | required | Container-reachable Floppy base URL |
| FLOPPY_TOKEN | required | Server-only app token |
| CACHE_DIR | /data | Persistent cache directory |
| CACHE_REFRESH_SECONDS | 300 | Background refresh interval, minimum 30 seconds |
| STATIC_DIR | image dist directory | Optional static asset override for local development |

Map the host port to PORT. To verify a different container port without a rebuild:

```sh
docker run -d --name floopy-port-test -e PORT=9123 -e FLOPPY_URL=http://example.local -e FLOPPY_TOKEN=test -p 9123:9123 floopy-grid
curl --fail http://localhost:9123/health
docker rm -f floopy-port-test
```

`/health` is independent of Floppy and cache readiness. Docker HEALTHCHECK uses
it. Check the feed state at `/api/grid/feed` and startup logs for readiness.

## Upgrade from the static frontend

Download the feature branch archive and extract over the existing checkout;
`.env.runtime` is not in the archive and remains intact. Build with
Dockerfile.synology, then replace only the Grid container and add the cache mount.
Retain this directory on later upgrades; the build/git ignore it. Changing env
requires recreating the container, not just restarting it.

## PWA installation, networking and CORS

Open `http://NAS_IP:8004` for LAN testing. For installable PWA/service-worker
behavior use trusted HTTPS via your existing reverse proxy. Safari: Share → Add
to Home Screen → Open as Web App. Android: Install app. Safe-area padding,
standalone manifest, app icons and in-app Back navigation are included.

Production API calls now stay on Grid's origin, so **Floppy CORS is no longer
required**. The browser never contacts FLOPPY_URL. An HTTPS Grid may use an HTTP
Floppy upstream over a trusted LAN because that connection is server-to-server.
Configure your public proxy to preserve Host and Origin for same-origin writes.
The service worker does not cache `/api/` responses. Offline app shell use does
not make the container or Floppy available offline.

## Troubleshooting

- **First feed loading:** initial metadata preparation runs in the container.
- **Cache could not be saved:** check cache directory ownership (UID 1000), mount
  path, free disk space and NAS ACLs. The feed can still operate in memory.
- **Showing last saved feed:** upstream refresh failed. Check Floppy availability;
  the old cache is intentionally preserved. The update time is the last complete
  successful refresh, not the last targeted watch update.
- **Token rejected:** check app-token scopes, expiry or revocation and recreate.
- **Cannot reach Floppy:** test URL/DNS/network from the Grid container; browser
  CORS settings are irrelevant in production now.
- **403 on watches:** ensure your public reverse proxy preserves the original
  Host and the browser Origin. Direct LAN access on 8004 works without it.
- **No install option:** use trusted HTTPS and check manifest/service worker.
- **Missing shows:** check In progress state in Floppy and confirmed upcoming
  metadata. See API parity limitations; no hypothetical Upcoming cards are added.
- **Back:** direct show links return Home; internal Home navigation returns back.

No live Floppy credentials were provided during implementation. Physical mobile
installation and live-account acceptance remain deployment checks.

Episode checkmarks use the season's current-pass progress and next-episode target
rather than lifetime episode history alone. During a 7/8 rewatch, the eighth
episode is available to mark watched again. See API notes for the limitation
when a pass contains multiple nonsequential gaps.

Node 24 and npm dependency versions are documented in [dependency update notes](docs/DEPENDENCIES.md), including the TypeScript compatibility constraint.

Opening a show scrolls once to the first unwatched episode in the expanded seasons, including the current rewatch pass and upcoming episodes. When all are watched it scrolls to the end. The move waits for episode loading, is cancelled by user interaction, and does not repeat after watch mutations or background refetches. Back remains available in the sticky show header.
