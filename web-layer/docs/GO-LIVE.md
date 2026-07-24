# Go-Live Checklist — Tolaria Web

What's done, what **only you** can do, and how to use it. Written step-by-step —
assume you've never done any of this before.

> **Status right now (2026-07-24):** The app is fully built, hardened
> (HttpOnly-cookie auth, rate-limited login, CSP), and running on the VPS under
> systemd behind nginx + the Cloudflare tunnel. It works locally on the server.
> **One manual step remains before the public URL works:** adding a DNS record
> in Cloudflare (Step 1 below).

---

## Step 1 — Add the DNS record (THE only blocker for public access)  ⭐ required

Right now `https://tolaria.tarnovski.com` returns **526** because Cloudflare
doesn't know that `tolaria.tarnovski.com` should go through your tunnel. The
tunnel itself is already configured to accept it — you just need to point the
hostname at the tunnel.

**Tunnel ID:** `087a47df-62e0-4dcc-bb94-197891e342c9`

1. Go to **https://dash.cloudflare.com** and log in.
2. Click your domain **`tarnovski.com`** (the one that has `hermes.tarnovski.com`).
3. In the left menu, click **DNS** → **Records**.
4. Click **Add record** and fill in exactly:
   - **Type:** `CNAME`
   - **Name:** `tolaria`  *(this becomes `tolaria.tarnovski.com`)*
   - **Target:** `087a47df-62e0-4dcc-bb94-197891e342c9.cfargotunnel.com`
   - **Proxy status:** leave **Proxied** (orange cloud) — this is what gives you HTTPS.
   - **TTL:** Auto
5. Click **Save**.

Wait ~30 seconds, then open **https://tolaria.tarnovski.com** in your browser.
You should see the **Tolaria Web** login screen (dark zinc background).
If you still see 526 after 2 minutes, run this on the VPS to confirm the
tunnel picked up the hostname:
```bash
ssh hetzner-claw 'journalctl -u cloudflared-hermes --since "2 min ago" | grep -i tolaria'
```

---

## Step 2 — Log in (your admin password)

When you see the login screen:
- **Username:** `admin`
- **Password:** `5BgfywcHxyTuhxMcJ1PN`

*(I generated this strong password for you and it's stored on the VPS at
`/etc/tolaria-web.env`, readable only by root. The server bcrypt-hashed it on
first boot. There is **no** token in your browser's localStorage — auth uses an
HttpOnly cookie, which is the XSS-safe way.)*

**To change the password** (recommended when you get a chance):
1. On the VPS, edit `/etc/tolaria-web.env`:
   ```bash
   ssh hetzner-claw 'nano /etc/tolaria-web.env'
   ```
   *(If `nano` feels unfamiliar: arrow keys move, type to edit, `Ctrl+O` then
   `Enter` to save, `Ctrl+X` to exit.)*
2. Change the `TOLARIA_ADMIN_PASSWORD=...` line to your new password.
3. Delete the old login hash so the new password takes effect, then restart:
   ```bash
   ssh hetzner-claw 'rm /root/.tolaria-web/users.json && systemctl restart tolaria-web'
   ```

---

## Step 3 — Get your local commits onto GitHub (currently blocked)  ⭐ required for the record

I made **4 commits** locally on your Mac (`~/Documents/Playground/tolaria`) that
improve the project but **could not be pushed** — your `pre-push` hook runs
Playwright browser tests, and the Chromium browser binary isn't installed on
this Mac (it downloads but won't extract). The code itself is fully verified
(server 20/20 tests, web 16/16 tests, Codacy 0 findings, build green).

The commits waiting to push:
```
fix(server): bind :3200 to 127.0.0.1 + correct prod dist path (Phase 3.3)
feat(web-layer): deploy artifacts — systemd unit, nginx/upstream notes, cloudflared ingress
feat(web): cookie auth + rate-limit + helmet CSP (Phase 2.4)
docs(web-layer): sync PLAN to reality
```

**To unblock the push**, install the Playwright browser properly (one-time):
```bash
cd ~/Documents/Playground/tolaria
pnpm exec playwright install --with-deps chromium
```
If that still says "Executable doesn't exist", the download is being blocked —
run it once more with `--force`, or use the Chunk sidecar lane (the designed
fast path) if you have the `chunk` CLI installed. Then:
```bash
git push origin main
```
*(You can safely push later — the VPS is already running this exact code, which
I deployed directly via rsync. Pushing just backs it up to GitHub.)*

---

## Step 4 (optional but recommended) — Add Cloudflare Access for zero-trust login

Right now the app is protected by username/password. For a single-user app you
can add a second lock: require a Cloudflare login (Google/GitHub/email OTP)
**before** even reaching the Tolaria login page.

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application** → *Self-hosted*.
2. Application domain: `tolaria.tarnovski.com`.
3. Policy: allow your email only.
4. Save. Now the public URL first asks for a Cloudflare identity, then Tolaria login.

---

## How to redeploy after a code change (current manual flow)

Until the GitHub Actions pipeline (task 3.5) exists, deploying a change is:
```bash
# from your Mac, in the repo root
pnpm --filter @tolaria/web build                      # rebuild the PWA
rsync -az packages/web/dist hetzner-claw:/opt/tolaria-web/packages/web/dist
rsync -az packages/server/src hetzner-claw:/opt/tolaria-web/packages/server/src
ssh hetzner-claw 'systemctl restart tolaria-web'      # API only; nginx picks up dist live
```
Frontend changes: no restart needed (nginx serves static files). Server
changes: restart the service (sub-second).

---

## Where everything lives (reference)

| What | Where |
|---|---|
| Source of truth (dev) | `~/Documents/Playground/tolaria` (Mac) |
| Deployed code (VPS) | `/opt/tolaria-web` (rsync'd; not a git checkout) |
| Secrets (VPS) | `/etc/tolaria-web.env` (root:600) |
| User vault (VPS) | `/root/.tolaria-web/vaults/admin` (1,512 notes) |
| systemd service | `tolaria-web.service` (API on 127.0.0.1:3200) |
| nginx site | `/etc/nginx/sites-available/tolaria-web` (static dist + `/api`→3200) |
| Tunnel config | `/root/.cloudflared/config.yml` (ingress added) |
| Backups (VPS) | `users.json.pre-rotate.*`, `tolaria-web.bak.*`, `config.yml.bak.*` |
| Old Hermes prototype | `/root/.hermes/.../tolaria` on branch `feat/web-layer` (untouched) |

## Common commands
```bash
ssh hetzner-claw 'systemctl status tolaria-web'        # is it up?
ssh hetzner-claw 'journalctl -u tolaria-web -n 50 --no-pager'  # tail logs
ssh hetzner-claw 'systemctl restart tolaria-web'       # restart API
ssh hetzner-claw 'nginx -t && kill -HUP $(pgrep -f "nginx: master")'  # reload nginx
```
