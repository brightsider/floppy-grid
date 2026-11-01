# Floopy Grid

A small, dark, poster-first TV tracking PWA for [Floppy](https://github.com/dannyvfilms/Floppy).
Three posters across on iPhone, released episode counts, upcoming dates, and
one-tap episode watches. Inspired by the compact poster focus of iShows 2;
no iShows assets are used. Floppy remains the source of truth.

## Screenshots

Placeholder: add Home and Show screenshots from your configured installation.

## Architecture and API

React + TypeScript + Vite, React Router, TanStack Query, plain CSS, and
vite-plugin-pwa. Nginx only serves static assets and runtime configuration;
there is no backend, database access, or API proxy. The browser talks to Floppy.
See [the API inspection](docs/API.md) for exact routes, source revision, typed
response assumptions, scopes, and differences from the requested model.

Home includes In progress TV shows, keeps shows with real upcoming episodes (including undated ones),
and omits ended shows once their released backlog is finished. Counts come from
Floppy's `episodes_left`; its `next_episode` is released-only, so upcoming
schedules require season metadata. Details show all seasons, including specials.
Season metadata work for home is bounded to three concurrent requests and
cached for a minute. Large caught-up libraries may take longer to hydrate.

Watches optimistically update episode state, revert on failure, update the home
count after success, and invalidate library, season, show and upcoming queries.
Writes are serialized per show and are not automatically retried. Foreground,
focus, reconnect and midnight trigger refresh; there is no aggressive polling.
Use the Home refresh button whenever needed. API data is held in memory only;
the service worker caches the app shell, never API responses or config.js.

## Requirements and token

Use a recent Floppy version compatible with the inspected API. In Floppy open
**Settings → Integrations → App tokens**, create a token with the default tracking
preset, and copy the secret (shown once). Reads need `watchlist:read`; episode
watches need `watchlist:write`. Supply it as FLOPPY_TOKEN. No login flow is included.

**Runtime tokens are public to anyone who can load this frontend.** The token
is delivered in `/config.js` and sent by the browser as a Bearer header. It is
not a server secret, even when set through Docker. This deployment is intended
for one trusted account; restrict site access to trusted users/devices. Never
commit `.env.local` or tokens. Rotate an exposed token through Floppy.

## Development

Node 22.12+ and npm:

```sh
npm install
cp .env.example .env.local
# Edit FLOPPY_URL and FLOPPY_TOKEN; URL is the base server URL, without /api/v1.
npm run dev
npm run lint
npm run test
npm run build
```

Vite reads local environment values and serves `/config.js` in development.
Restart Vite after changing them. Vite does not proxy API traffic, so development
also requires CORS. `npm run preview` serves a production build whose placeholder
config is empty; use Docker to exercise real production runtime configuration.

## Production and Docker

```sh
npm run build
docker build -t floopy-grid .
docker run -d \
  --name floopy-grid \
  --restart unless-stopped \
  -e PORT=8080 \
  -e FLOPPY_URL=http://192.168.0.2:8001 \
  -e FLOPPY_TOKEN=CHANGE_ME \
  -p 8002:8080 \
  floopy-grid
```

The addresses and ports above are examples only. For token handling you can
instead use a protected, uncommitted env file with `--env-file`.

| Variable | Default | Meaning |
| --- | --- | --- |
| PORT | 8080 | Nginx listening port, evaluated at container startup, valid 1–65535 |
| FLOPPY_URL | required | Browser-reachable HTTP(S) Floppy base URL, optionally with a path prefix |
| FLOPPY_TOKEN | required | Floppy app token, exposed to the browser |

The multi-stage build uses Node only to compile the frontend. Runtime is Nginx
Alpine with jq and envsubst. On each startup, jq JSON-encodes environment values
into `/usr/share/nginx/html/config.js`; envsubst renders the Nginx listening port.
Neither URL, token nor port is baked into the frontend. Changing them requires
recreating the container, not rebuilding. `/config.js` is served with no-store
and excluded from service-worker precache. `/health` returns 200 independently
of Floppy and is used by Docker HEALTHCHECK.

To exercise a different port without a frontend rebuild:

```sh
docker run -d --name floopy-port-test \
  -e PORT=9123 -e FLOPPY_URL=http://example.local -e FLOPPY_TOKEN=test \
  -p 9123:9123 floopy-grid
curl --fail http://localhost:9123/health
curl --fail http://localhost:9123/
docker rm -f floopy-port-test
```

## Synology and PWA installation

Build the image on the NAS or a compatible architecture, then use Container
Manager with the variables and port mapping above. A Docker service name like
`http://floppy:8000` is not reachable from an iPhone: FLOPPY_URL must resolve on
the device (LAN address, LAN hostname or reverse-proxy hostname). Port mappings
must target the chosen PORT. Publish the frontend at the root of its hostname.

For full PWA installation and service-worker behavior, use **trusted HTTPS**
for Floopy Grid. Plain HTTP on a LAN IP does not meet secure-context requirements
(localhost is a special development exception). Use Synology reverse proxy and
a trusted certificate. An HTTPS frontend must also use an HTTPS Floppy URL;
browsers block mixed-content API calls. HTTP examples are connectivity examples,
not a complete secure PWA deployment.

On iPhone, open in Safari → Share → Add to Home Screen → Open as Web App. On
Android, use the browser's Install app option. Icons, standalone manifest,
Apple metadata, safe-area padding and an in-app Back button are included.
Back returns through internal home history, or Home for direct show links.
Offline, the shell may open but fresh tracking and writes require Floppy.

## CORS configuration

Current Floppy source has **no built-in configurable CORS support** (see API
notes). Since Authorization and JSON requests trigger preflight, a separate
origin will fail without deployment changes. Configure the reverse proxy that
already fronts **Floppy**, not a proxy inside Floopy Grid. For example, in its
Nginx API location, preserve the existing upstream routing and add:

```nginx
# Replace this exact origin with your Floopy Grid HTTPS origin, including port
# if nonstandard. Do not reflect arbitrary Origin headers.
add_header Access-Control-Allow-Origin "https://grid.example.com" always;
add_header Vary "Origin" always;
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
if ($request_method = OPTIONS) { return 204; }
```

Nginx header inheritance matters: keep the headers in the location handling both
OPTIONS and actual API responses, including errors; avoid duplicate CORS
headers from multiple proxies. Browser credentials/cookies are not used. This
is an infrastructure requirement because Floppy itself has no verified origin
setting. The app never silently introduces a proxy.

Verify with your deployed origins (no token needed for preflight):

```sh
curl -i -X OPTIONS 'https://floppy.example.com/api/v1/media/tv/' \
  -H 'Origin: https://grid.example.com' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
```

Expect 204 and the matching allow-origin, methods and headers. Repeat for POST
with `authorization,content-type`, then check an authenticated request in the
browser network inspector. No real Floppy endpoint/token was supplied during
implementation; authenticated end-to-end and deployment CORS checks must be
performed against your installation.

## Troubleshooting

- **Configuration screen:** set both required variables and recreate container.
- **401/403:** expired/revoked token or missing scope; recreate with a valid token.
- **Cannot reach Floppy:** check device DNS, LAN access, TLS, mixed content and CORS.
- **No active shows:** check the TV library, paused/dropped states, and provider
  metadata in Floppy. Anime is a separate library, outside this MVP.
- **Upcoming instead of a date:** Floppy has an upcoming episode/season but no date.
- **Date differs by a day:** timestamp dates use the device timezone; civil date
  strings stay local. Floppy may normalize provider dates to timestamps; this
  frontend cannot reconstruct a provider timezone that the API does not expose.
- **Save failed:** optimistic state rolls back; check connectivity and refresh.
  A response lost after a successful server write can be ambiguous; refresh
  before retrying. A new deliberate tap is a new watch event.
- **API outage:** errors remain recoverable; existing in-memory data may still show.
- **No install option:** use trusted HTTPS, check manifest and service-worker
  registration, and confirm your browser supports installation.
- **Container unhealthy:** check PORT and `docker logs floopy-grid`; `/health`
  tests only this frontend, not backend availability.

## Up Next and poster wall update

Home now includes In progress TV only, matching native Up Next eligibility.
Ended shows disappear when caught up; shows with actual upcoming episode metadata remain Upcoming.
Default order: fewest released episodes behind, closest future episode, latest
last-air date, then unknown. This replaces the original broader active filter.
Custom Floppy Home row sort overrides are not exposed by the current REST API;
see the API notes for the exact parity limits.

The mobile grid is a continuous three-column poster wall without gutters or
rounded tile corners. Completed seasons start collapsed; current/future seasons
start open. A caught-up season with unreleased episodes remains open.
