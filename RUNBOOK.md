# RUNBOOK — Grid Dungeon A/B demo

The scaffold is committed as a clean baseline. The two games are built by two
different processes (that's the demo); the harness at `web/index.html` judges
both from outside. Everything below runs from the repo root.

> **Branch hygiene:** run each build on its own branch (or worktree) so a bad
> run is one reset away:
>
> ```sh
> git checkout -b build-a        # before the Variant A goal loop
> git checkout main && git checkout -b build-b   # before the Variant B workflow
> # or, isolated worktrees instead:
> git worktree add ../dungeon-build-a build-a
> ```
>
> If a run goes sideways: `git checkout main` (or `git reset --hard main` on
> the build branch) and rerun.

## 1. Variant A — the freeform goal loop

There is no built-in `/goal` command in Claude Code (verified against the
v2.1.x command list). The real unattended invocation is headless mode pointed
at the goal file — `docs/dungeon-demo/goal-a.md` carries the done-condition
(a `node` proof that `shippedLevel(seed)` returns the spec §6 shape) and the
25-turn cap:

```sh
claude -p "Read docs/dungeon-demo/goal-a.md and work toward the goal it describes. Follow its constraints exactly, prove the done condition by running its node command and showing the output, and respect its 25-turn cap." --permission-mode acceptEdits --verbose
```

Interactive alternative (watch it work): start `claude` and paste the same
sentence as your prompt.

**Done when:** `web/dungeon-a/dungeon.js` + `web/dungeon-a/index.html` exist
and the transcript shows the `node` proof (`shape {...}` / `deterministic true`).

## 2. Variant B — the verification workflow

The workflow is registered at `.claude/workflows/dungeon-verify.workflow.js`
(a copy of the repo-root `dungeon-verify.workflow.js`; the root file is the
source of truth — recopy if you edit it). Registered workflows are invoked by
name as a slash command. In an interactive `claude` session:

```
/dungeon-verify
```

Headless:

```sh
claude -p "/dungeon-verify" --permission-mode acceptEdits --verbose
```

It defaults to `SPEC=docs/dungeon-demo/spec.md` (already in place) and writes:

- `web/dungeon-b/dungeon.js` + `web/dungeon-b/index.html` (the gated build)
- `docs/dungeon-demo/runs/run/verification.md` (the skeptic-fleet report)

To label a run, pass args: `/dungeon-verify {"runLabel": "meeting-demo"}`.
Watch progress with `/workflows` in an interactive session.

## 3. Serve and open the harness

ES-module imports don't load over `file://`, so serve `web/`:

```sh
npm run serve            # http-server on http://localhost:8000
# or, no node needed:
python3 -m http.server 8000 --directory web    # (plain `python` on Windows)
```

Open **http://localhost:8000/** — the harness shows "Version 1" / "Version 2"
(unlabeled A/B), a shared **New Level** button, a **seed** input (forces the
same seed on both panes — the safety net for showing a known-broken A level),
and the **Reveal** toggle that runs the harness's own §4 solver on each pane's
`getLevel()` and overlays SOLVABLE/UNSOLVABLE. Panes whose game isn't built
yet show a friendly placeholder.

## 4. Deploy — ai-meeting.nathanruesch.com (docker + nginx on the ubuntu box)

The site is fully static; the container is just nginx serving `web/`.

On the server:

```sh
git clone <this-repo> ai-meeting-demo && cd ai-meeting-demo   # or rsync/scp the folder
docker compose up -d --build
curl -s http://127.0.0.1:8087/ | head -5    # sanity: harness HTML comes back
```

The container binds **127.0.0.1:8087** only; the host nginx publishes it:

```sh
sudo cp deploy/nginx-ai-meeting.conf /etc/nginx/sites-available/ai-meeting.nathanruesch.com
sudo ln -s /etc/nginx/sites-available/ai-meeting.nathanruesch.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ai-meeting.nathanruesch.com   # TLS
```

DNS: add an A (or CNAME) record for `ai-meeting.nathanruesch.com` pointing at
the server before running certbot.

Redeploy after new builds land: `git pull && docker compose up -d --build`.
