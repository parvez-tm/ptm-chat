# PTM Chat — Merged Nginx Configuration

> Merges PTM Chat into your **existing** server block that already runs Next.js at `/` and a static `/computer` page. Nothing breaks — PTM Chat lives under its own prefixed paths.

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
   Internet ──────► │           Nginx :443 (SSL)               │
                    ├──────────────────────────────────────────┤
                    │                                          │
  EXISTING:         │  /               → Next.js :3000         │
                    │  /computer       → static HTML           │
                    │                                          │
  NEW (PTM Chat):   │  /chat/*         → static dist/          │
                    │  /ptm-chat-api/* → Backend :4400          │
                    │  /ptm-chat-socket.io/* → Backend :4400   │
                    │  /uploads/*      → static files           │
                    └──────────────────────────────────────────┘
```

---

## Full Merged Config

**File**: `/etc/nginx/sites-available/ptm.software`

```nginx
#############################################
# PTM Chat — Backend upstream
#############################################
upstream ptm_backend {
    server 127.0.0.1:4400;
    keepalive 64;
}

#############################################
# HTTP → HTTPS
#############################################
server {
    listen 80;
    listen [::]:80;

    server_name ptm.software www.ptm.software;

    return 301 https://$host$request_uri;
}

#############################################
# HTTPS — MERGED SERVER BLOCK
#############################################
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name ptm.software www.ptm.software;

    #########################################
    # SSL
    #########################################
    ssl_certificate     /etc/letsencrypt/live/ptm.software/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ptm.software/privkey.pem;

    #########################################
    # SECURITY HEADERS
    #########################################
    add_header X-Frame-Options        SAMEORIGIN                          always;
    add_header X-Content-Type-Options nosniff                             always;
    add_header X-XSS-Protection       "1; mode=block"                    always;
    add_header Referrer-Policy        "no-referrer-when-downgrade"        always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    #########################################
    # GZIP
    #########################################
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 256;

    # File upload limit
    client_max_body_size 10M;

    # ═══════════════════════════════════════
    #  PTM CHAT — NEW ROUTES
    # ═══════════════════════════════════════

    # ── Frontend (React/Vite static build) ──
    location /chat/ {
        alias /home/ubuntu/ptm-chat/frontend/dist/;
        index index.html;
        try_files $uri $uri/ /chat/index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location = /chat {
        return 301 /chat/;
    }

    # ── Backend API ──
    location /ptm-chat-api/ {
        proxy_pass http://ptm_backend/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        proxy_buffering off;
    }

    # ── Socket.IO (WebSocket + long-polling) ──
    location /ptm-chat-socket.io/ {
        proxy_pass http://ptm_backend/socket.io/;
        proxy_http_version 1.1;

        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ── Uploaded files (avatars, etc.) ──
    location /uploads/ {
        alias /home/ubuntu/ptm-chat/backend/public/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # ═══════════════════════════════════════
    #  EXISTING SITES — UNCHANGED
    # ═══════════════════════════════════════

    # ── Static page ──
    location = /computer {
        root /home/ubuntu;
        try_files /computer.html =404;
    }

    # ── Next.js (PM2 on port 3000) — CATCH-ALL ──
    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Why This Works

Nginx matches locations using a **longest prefix first** rule:

| Request | Matched Block | Destination |
|---------|--------------|-------------|
| `/chat/login` | `/chat/` | Static `dist/index.html` |
| `/ptm-chat-api/auth/login` | `/ptm-chat-api/` | Backend `:4400` → `/auth/login` |
| `/ptm-chat-socket.io/?EIO=4` | `/ptm-chat-socket.io/` | Backend `:4400` → `/socket.io/` |
| `/uploads/avatar.png` | `/uploads/` | Static file from `backend/public/` |
| `/computer` | `= /computer` | Static `computer.html` |
| `/anything-else` | `/` | Next.js `:3000` |

The PTM Chat routes (`/chat/`, `/ptm-chat-api/`, `/ptm-chat-socket.io/`, `/uploads/`) are matched **before** the catch-all `/` because they are more specific. Everything else still falls through to Next.js.

---

## Deployment Steps

```bash
# 1. Edit the config
sudo nano /etc/nginx/sites-available/ptm.software

# 2. Paste the merged config above

# 3. Test syntax
sudo nginx -t

# 4. Reload (zero downtime)
sudo systemctl reload nginx

# 5. Verify both sites work
curl -I https://ptm.software/              # → Next.js (200)
curl -I https://ptm.software/chat/         # → PTM Chat frontend (200)
curl -I https://ptm.software/computer      # → Static page (200)
curl    https://ptm.software/ptm-chat-api/health  # → {"status":"ok"}
```
