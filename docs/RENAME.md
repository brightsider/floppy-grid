# Rename to Floppy Grid

Repository: https://github.com/brightsider/floppy-grid

The application, npm package, page title, PWA manifest/Apple label, wordmark,
Docker image/container examples and repository links use Floppy Grid / floppy-grid.
The icons are abstract grids and need no asset replacement. Environment variables
FLOPPY_URL, FLOPPY_TOKEN, PORT, CACHE_DIR and CACHE_REFRESH_SECONDS are unchanged.

The primary runtime global is `window.__FLOPPY_GRID_CONFIG__`. The old
`window.__FLOOPY_CONFIG__` alias is intentionally accepted/emitted so previously
installed PWA shells keep working while their assets update. Production config
still contains only SERVER_CACHE; the token remains on the server. Feed file
format, account identity and /data location are unchanged.

## Synology migration for the existing bind-mounted installation

Use these steps only when the current folder/container still uses the former
spelling and the destination folder does not already exist. Existing .env.runtime
and cache move together. Do not delete or recreate the cache directory.

```sh
cd /volume3/docker
docker stop floopy-grid
mv /volume3/docker/floopy-grid /volume3/docker/floppy-grid
cd /volume3/docker/floppy-grid
curl -fL https://github.com/brightsider/floppy-grid/archive/refs/heads/feat/initial-pwa.tar.gz -o /tmp/floppy-grid.tar.gz
tar -xzf /tmp/floppy-grid.tar.gz --strip-components=1
docker build --pull -f Dockerfile.synology -t floppy-grid .
```

Only after a successful build:

```sh
docker rm floopy-grid
docker run -d --name floppy-grid --restart unless-stopped --env-file /volume3/docker/floppy-grid/.env.runtime -p 8004:8080 -v /volume3/docker/floppy-grid/cache:/data floppy-grid
curl -f http://127.0.0.1:8004/health
```

Keep the existing cache directory ownership (UID 1000). Port 8004 and the browser
origin stay the same. If you used a named Docker volume instead of a bind mount,
reuse the existing volume name in `-v` so you keep its data. Naming a new empty
volume would start a cold cache.

If building fails, move the directory back to its previous path before starting
the stopped old container, since its bind mount still refers to that old path.

Existing Git checkouts can update their remote with:

```sh
git remote set-url origin https://github.com/brightsider/floppy-grid.git
```

The installed iOS Home Screen label may retain its old user-selected name. Rename
the shortcut or reinstall it if the new manifest name is not picked up by iOS.
