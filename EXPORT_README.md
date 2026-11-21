# Veil — complete project export

This archive contains the current project source, including:
- The Continuum/Veil browser app, interactive 3D models, news page and video player.
- The API server and shared workspace packages.
- The existing design/mockup sandbox, project configuration and automated tests.
- All original uploaded reference images and video in attached_assets/.
- The three application media files in generated-artifacts/, at the paths expected by the media seed script.

## Using this export
Extract the ZIP first. This is a pnpm workspace, not a standalone prebuilt installer.
Use Node.js 24 and pnpm, then run `pnpm install` from the extracted project root.
The development commands for each application are in its package.json.

This is a source-and-assets backup. Replit Secrets, cloud credentials, deployment
state, and any live cloud/database records are not included. The existing media
server uses Replit App Storage authentication. Running outside Replit requires
configuring equivalent storage and service routing; the bundled media preserves
the actual video and image bytes without embedding cloud credentials.

For safety and size, the archive omits Git history, node_modules, compiled build
outputs, test recordings/reports, caches, temporary platform tooling, and secret
or credential files. Dependencies can be restored using pnpm-lock.yaml.

EXPORT_MANIFEST.sha256 lists the SHA-256 checksum of each exported source/asset file.
