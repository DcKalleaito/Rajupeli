# Rallipeli Beta 1 multiplayer hotfix

Upload all files to the root of your GitHub Pages repository. No folders are required.

Important: `index.html` is now standalone and contains the CSS/JS inline, so the game should still render even if GitHub Pages cache is weird. The extra CSS/JS files are included only for editing/backups.

Supabase: no SQL tables are required for this version. Multiplayer uses Realtime Broadcast + Presence in one shared lobby.

Fixes in this build:
- multiplayer starts in concrete map
- one shared lobby
- stronger Supabase connection fallback
- menu engine/wind audio removed
- longer procedural menu music
- control editor visible and returns to settings after save
- pause/settings scroll fixed
- map change quick button in free drive
- remote player waypoint labels
- settings button pinned to top-right and not editable
- retro controls are the default
- lights button says VALOT/LIGHTS
