# Validation

Completed npm install, lint, all 22 tests and production build. Date/status tests
also passed under America/Los_Angeles and Pacific/Auckland timezones.

The multi-stage Docker image built successfully. The corrected image started
with PORT=9123, FLOPPY_URL=http://example.local, FLOPPY_TOKEN=test and 9123:9123
published. Home, direct show route and runtime config returned HTTP 200;
/health returned ok. Runtime config values matched startup environment.
An initial config file permission failure was fixed and retested.

Vitest was updated to resolve critical audit advisories. The final image build
reported 20 moderate/low advisories in tooling dependency chains, no high/critical.

Not verified: live authenticated Floppy account, deployment CORS, physical
mobile PWA installation, browser interaction automation. No live credentials
were supplied. These remain deployment acceptance checks.

Source is committed and published on the `feat/initial-pwa` feature branch.
