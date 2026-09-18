# AGENTS.md

## Local dev servers run through pm2 — don't start them manually

This client (`snake-phaser`) and its sibling game server (`snake-colyseus`) both run as
pm2-managed processes:

- `snake-phaser` → `npm run dev -- --host 0.0.0.0` (Vite, port 5173)
- `snake-colyseus` → `npm start` (`tsx watch src/index.ts`, port 4002)

**Never run `npm start` / `npm run dev` directly in a terminal for either project while pm2
also manages them.** Doing so causes both processes to race for the same port; if pm2's
process ever restarts, the manually-started one can grab the port first, and pm2 keeps
reporting `online` while the browser is silently talking to a stale, unmanaged process
running old code. This already happened once and cost a debugging session to track down.

If you need a one-off terminal instance for debugging, stop the pm2 copy first:
```
pm2 stop snake-colyseus
```

### After editing server or client code

```
pm2 restart snake-colyseus snake-phaser
```
`watch & reload` is disabled in pm2 for both, so pm2 itself won't notice file changes —
`tsx watch` and Vite's dev server do their own hot-reload underneath, so this is usually
automatic. Use `pm2 restart` as the reliable fallback whenever something seems stuck,
instead of starting a second process.

### Checking health

```
pm2 status
pm2 logs snake-colyseus --lines 50
pm2 logs snake-phaser --lines 50
```
A climbing restart count in `pm2 status` is the tell that something is crash-looping —
usually a port conflict with a stray process.

### If you suspect a stray/duplicate process

Don't trust pm2's `online` status alone — confirm the PID actually holding the port matches
the PID pm2 thinks it's running:
```
ss -ltnp | grep -E "4002|5173"
pm2 jlist | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')).forEach(p => console.log(p.name, p.pid, p.pm2_env.status, p.pm2_env.restart_time))"
```
If the port owner's PID doesn't match pm2's reported PID (or its child process tree), a
manually-started duplicate is holding the port — kill it, then `pm2 restart` the real one.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `alexisNorthcoders/snake-phaser`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
