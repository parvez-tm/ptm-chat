# PTM Chat — Production Deployment Guide

> **Domain**: `ptm.software`
> **Frontend**: `https://ptm.software/chat`
> **API**: `https://ptm.software/ptm-chat-api`
> **Socket.IO**: `https://ptm.software/ptm-chat-socket.io`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Server Setup](#3-server-setup)
4. [Project Deployment](#4-project-deployment)
5. [Nginx Configuration](#5-nginx-configuration)
6. [SSL Certificate](#6-ssl-certificate)
7. [Management & Operations](#7-management--operations)
8. [Backup Strategy](#8-backup-strategy)
9. [Monitoring & Health Checks](#9-monitoring--health-checks)
10. [Troubleshooting](#10-troubleshooting)
11. [Update & Redeployment](#11-update--redeployment)

---

## 1. Architecture Overview

```
                           ┌─────────────────────────────┐
    Internet               │       Nginx (port 80/443)    │
   ─────────────────────►  │                               │
                           │  /chat/*          → static    │
                           │  /ptm-chat-api/*  → :4400     │
                           │  /ptm-chat-socket.io/* → :4400│
                           │  /uploads/*       → static    │
                           └──────────┬──────────┬─────────┘
                                      │          │
                              ┌───────▼──┐  ┌────▼──────┐
                              │ Frontend │  │  Backend   │
                              │ (static) │  │ Node.js    │
                              │ /dist    │  │ PM2 :4400  │
                              └──────────┘  └──┬─────┬──┘
                                               │     │
                                         ┌─────▼─┐ ┌─▼─────┐
                                         │MongoDB│ │ Redis  │
                                         │Docker │ │ Docker │
                                         │:27017 │ │:6379   │
                                         └───────┘ └────────┘
                                         (localhost only)
```

**Key points:**
- Nginx handles SSL termination and routes traffic
- Backend runs via PM2 on port 4400 (localhost only)
- MongoDB & Redis run in Docker, bound to localhost only
- Frontend is a pre-built static bundle served directly by Nginx

---

## 2. Prerequisites

| Requirement | Version |
|-------------|---------|
| Ubuntu | 22.04+ LTS |
| Node.js | 20.x LTS |
| Docker + Compose | Latest |
| Nginx | Latest |
| Domain DNS | A record pointing to server IP |

---

## 3. Server Setup

### 3.1 System Update & Essentials

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw
```

### 3.2 Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # verify
npm -v    # verify
```

### 3.3 Install PM2

```bash
sudo npm install -g pm2
```

### 3.4 Install Docker & Docker Compose

```bash
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

> ⚠️ **Log out and back in** after `usermod` for the group change to take effect.

### 3.5 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3.6 Install Certbot (for SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 3.7 Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Expected output:
```
Status: active
To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
```

---

## 4. Project Deployment

### 4.1 Create Project Directory

```bash
sudo mkdir -p /var/www/ptm-chat
sudo chown $USER:$USER /var/www/ptm-chat
```

### 4.2 Clone Repository

```bash
cd /var/www/ptm-chat
git clone <your-repo-url> .
```

Or upload manually:
```bash
# From your local machine:
scp -r ./backend ./frontend user@your-server-ip:/var/www/ptm-chat/
```

### 4.3 Configure Backend Environment

```bash
cd /var/www/ptm-chat/backend

# Copy the production template
cp .env.production .env

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "MONGO_PASSWORD=$(openssl rand -hex 16)"
echo "REDIS_PASSWORD=$(openssl rand -hex 16)"

# Edit .env with the generated values
nano .env
```

**Your `.env` should look like this** (with real values):

```env
# MongoDB
MONGODB_URI=mongodb://ptmadmin:YOUR_MONGO_PASSWORD@localhost:27017/ptm-chat?authSource=admin

# JWT
JWT_SECRET=your_generated_64_char_hex
JWT_REFRESH_SECRET=your_generated_64_char_hex

# Redis
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@localhost:6379

# Server
PORT=4400
NODE_ENV=production

# Client URL (for CORS)
CLIENT_URL=https://ptm.software

# Docker MongoDB
MONGO_INITDB_ROOT_USERNAME=ptmadmin
MONGO_INITDB_ROOT_PASSWORD=YOUR_MONGO_PASSWORD
MONGO_DB=ptm-chat
MONGO_PORT=27017

# Redis
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
```

### 4.4 Start Docker Services (MongoDB + Redis)

```bash
cd /var/www/ptm-chat/backend

# Start containers in background
docker compose up -d

# Verify containers are running
docker ps
```

Expected output:
```
CONTAINER ID   IMAGE            STATUS          PORTS                        NAMES
xxxxxxxxxxxx   mongo:7          Up 10 seconds   127.0.0.1:27017->27017/tcp   ptm-mongo
xxxxxxxxxxxx   redis:7-alpine   Up 10 seconds   127.0.0.1:6379->6379/tcp     ptm-redis
```

```bash
# Check logs for errors
docker compose logs mongodb
docker compose logs redis
```

### 4.5 Install & Start Backend

```bash
cd /var/www/ptm-chat/backend

# Install production dependencies
npm install --production

# Start with PM2
pm2 start src/app.js --name "ptm-chat-api" --node-args="--env-file=.env"

# Verify it's running
pm2 list
curl http://localhost:4400/health
# Should return: {"status":"ok","timestamp":"..."}

# Save PM2 process list for auto-restart on reboot
pm2 save

# Generate startup script (run the command PM2 outputs)
pm2 startup
# Example output: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Copy and run that command
```

### 4.6 Configure Frontend Environment

```bash
cd /var/www/ptm-chat/frontend

# The .env.production file is already configured:
cat .env.production
# VITE_API_URL=/ptm-chat-api
# VITE_SOCKET_URL=https://ptm.software
```

### 4.7 Build Frontend

```bash
cd /var/www/ptm-chat/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Verify the dist folder was created
ls -la dist/
```

The `dist/` folder contains the static files that Nginx will serve.

---

## 5. Nginx Configuration

### 5.1 Create Site Configuration

```bash
sudo nano /etc/nginx/sites-available/ptm.software
```

Paste the following configuration:

```nginx
# =============================================
# PTM Chat — Nginx Configuration
# =============================================

upstream ptm_backend {
    server 127.0.0.1:4400;
    keepalive 64;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name ptm.software www.ptm.software;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name ptm.software www.ptm.software;

    # SSL certificates (Certbot will fill these)
    ssl_certificate     /etc/letsencrypt/live/ptm.software/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ptm.software/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ── Security Headers ──
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ── Gzip Compression ──
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 256;

    # ── Client body size (for file uploads) ──
    client_max_body_size 10M;

    # ─────────────────────────────────────────
    # Frontend — React static files at /chat
    # ─────────────────────────────────────────
    location /chat/ {
        alias /var/www/ptm-chat/frontend/dist/;
        index index.html;
        try_files $uri $uri/ /chat/index.html;

        # Aggressive caching for hashed assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Redirect /chat (no trailing slash) to /chat/
    location = /chat {
        return 301 /chat/;
    }

    # ─────────────────────────────────────────
    # Backend API — /ptm-chat-api → Node.js
    # ─────────────────────────────────────────
    location /ptm-chat-api/ {
        proxy_pass http://ptm_backend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        proxy_buffering off;
    }

    # ─────────────────────────────────────────
    # Socket.IO — WebSocket + long-polling
    # ─────────────────────────────────────────
    location /ptm-chat-socket.io/ {
        proxy_pass http://ptm_backend/socket.io/;
        proxy_http_version 1.1;

        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeout for WebSocket connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ─────────────────────────────────────────
    # Uploaded files (profile images etc.)
    # ─────────────────────────────────────────
    location /uploads/ {
        alias /var/www/ptm-chat/backend/public/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # ─────────────────────────────────────────
    # Root → redirect to /chat
    # ─────────────────────────────────────────
    location = / {
        return 302 /chat/;
    }
}
```

### 5.2 Enable the Site

```bash
# Create symlink to enable
sudo ln -s /etc/nginx/sites-available/ptm.software /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration syntax
sudo nginx -t
```

Expected output:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

```bash
# Reload Nginx
sudo systemctl reload nginx
```

---

## 6. SSL Certificate

### 6.1 Get Certificate (First Time)

> ⚠️ Before running Certbot, temporarily use only the HTTP server block (comment out the HTTPS block and SSL lines). Certbot will configure SSL automatically.

**Simpler approach** — let Certbot handle everything:

```bash
# Temporarily simplify nginx config to just HTTP
sudo nano /etc/nginx/sites-available/ptm.software
```

Replace the entire file temporarily with:
```nginx
server {
    listen 80;
    server_name ptm.software www.ptm.software;

    location / {
        root /var/www/html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx

# Run Certbot
sudo certbot --nginx -d ptm.software -d www.ptm.software
```

After Certbot succeeds, **replace the Nginx config back** with the full configuration from Section 5.1, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 6.2 Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
```

Certbot auto-renews via a systemd timer. Verify it's active:
```bash
sudo systemctl list-timers | grep certbot
```

---

## 7. Management & Operations

### 7.1 PM2 Commands

| Command | Purpose |
|---------|---------|
| `pm2 list` | Show all running processes |
| `pm2 logs ptm-chat-api` | View real-time logs |
| `pm2 logs ptm-chat-api --lines 100` | View last 100 log lines |
| `pm2 restart ptm-chat-api` | Restart the backend |
| `pm2 stop ptm-chat-api` | Stop the backend |
| `pm2 delete ptm-chat-api` | Remove from PM2 |
| `pm2 monit` | Live CPU/Memory dashboard |
| `pm2 info ptm-chat-api` | Detailed process info |

### 7.2 Docker Commands

| Command | Purpose |
|---------|---------|
| `docker compose ps` | View container status |
| `docker compose logs -f mongodb` | MongoDB live logs |
| `docker compose logs -f redis` | Redis live logs |
| `docker compose restart mongodb` | Restart MongoDB |
| `docker compose restart redis` | Restart Redis |
| `docker compose down` | Stop all containers |
| `docker compose up -d` | Start all containers |

> Always run Docker commands from `/var/www/ptm-chat/backend/`

### 7.3 Nginx Commands

| Command | Purpose |
|---------|---------|
| `sudo nginx -t` | Test config syntax |
| `sudo systemctl reload nginx` | Reload config (no downtime) |
| `sudo systemctl restart nginx` | Full restart |
| `sudo systemctl status nginx` | Check status |
| `sudo tail -f /var/log/nginx/access.log` | Live access log |
| `sudo tail -f /var/log/nginx/error.log` | Live error log |

### 7.4 Log Rotation (PM2)

```bash
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
```

---

## 8. Backup Strategy

### 8.1 MongoDB Backup Script

Create the backup script:

```bash
sudo mkdir -p /var/backups/ptm-chat

cat > /var/www/ptm-chat/backup.sh << 'SCRIPT'
#!/bin/bash
# PTM Chat — MongoDB Backup Script

BACKUP_DIR="/var/backups/ptm-chat"
DATE=$(date +%Y-%m-%d_%H%M)
RETENTION_DAYS=7

# Create backup
docker exec ptm-mongo mongodump \
  --username=ptmadmin \
  --password="${MONGO_PASSWORD}" \
  --authenticationDatabase=admin \
  --db=ptm-chat \
  --archive="/data/backup-${DATE}.archive" \
  --gzip

# Copy from container to host
docker cp "ptm-mongo:/data/backup-${DATE}.archive" "${BACKUP_DIR}/backup-${DATE}.archive"

# Clean up inside container
docker exec ptm-mongo rm "/data/backup-${DATE}.archive"

# Delete backups older than retention period
find "${BACKUP_DIR}" -name "backup-*.archive" -mtime +${RETENTION_DAYS} -delete

echo "$(date) - Backup completed: backup-${DATE}.archive" >> /var/log/ptm-backup.log
SCRIPT

chmod +x /var/www/ptm-chat/backup.sh
```

### 8.2 Automate with Cron (Daily at 2 AM)

```bash
crontab -e
```

Add this line (replace `YOUR_MONGO_PASSWORD`):

```
0 2 * * * MONGO_PASSWORD=YOUR_MONGO_PASSWORD /var/www/ptm-chat/backup.sh
```

### 8.3 Restore from Backup

```bash
# Copy backup into container
docker cp /var/backups/ptm-chat/backup-2026-03-07_0200.archive ptm-mongo:/data/

# Restore
docker exec ptm-mongo mongorestore \
  --username=ptmadmin \
  --password=YOUR_MONGO_PASSWORD \
  --authenticationDatabase=admin \
  --archive="/data/backup-2026-03-07_0200.archive" \
  --gzip \
  --drop
```

---

## 9. Monitoring & Health Checks

### 9.1 Health Check Script

```bash
cat > /var/www/ptm-chat/healthcheck.sh << 'SCRIPT'
#!/bin/bash
# PTM Chat — Health Check

LOG="/var/log/ptm-health.log"

# Check backend API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4400/health)
if [ "$API_STATUS" != "200" ]; then
    echo "$(date) - ❌ API DOWN (HTTP $API_STATUS) — Restarting..." >> $LOG
    pm2 restart ptm-chat-api
fi

# Check MongoDB
MONGO_STATUS=$(docker inspect --format='{{.State.Running}}' ptm-mongo 2>/dev/null)
if [ "$MONGO_STATUS" != "true" ]; then
    echo "$(date) - ❌ MongoDB DOWN — Restarting..." >> $LOG
    cd /var/www/ptm-chat/backend && docker compose up -d mongodb
fi

# Check Redis
REDIS_STATUS=$(docker inspect --format='{{.State.Running}}' ptm-redis 2>/dev/null)
if [ "$REDIS_STATUS" != "true" ]; then
    echo "$(date) - ❌ Redis DOWN — Restarting..." >> $LOG
    cd /var/www/ptm-chat/backend && docker compose up -d redis
fi
SCRIPT

chmod +x /var/www/ptm-chat/healthcheck.sh
```

### 9.2 Run Every 5 Minutes via Cron

```bash
crontab -e
```

Add:
```
*/5 * * * * /var/www/ptm-chat/healthcheck.sh
```

### 9.3 Quick Status Check

```bash
# All-in-one status check
echo "=== PM2 ===" && pm2 list && \
echo "=== Docker ===" && docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" && \
echo "=== Nginx ===" && sudo systemctl is-active nginx && \
echo "=== API Health ===" && curl -s http://localhost:4400/health
```

---

## 10. Troubleshooting

### Frontend shows blank page at /chat

```bash
# Check if dist folder exists and has files
ls -la /var/www/ptm-chat/frontend/dist/

# Check Nginx error log
sudo tail -20 /var/log/nginx/error.log

# Rebuild if needed
cd /var/www/ptm-chat/frontend && npm run build
```

### API returns 502 Bad Gateway

```bash
# Check if backend is running
pm2 list
curl http://localhost:4400/health

# If not running, check logs and restart
pm2 logs ptm-chat-api --lines 50
pm2 restart ptm-chat-api
```

### Socket.IO connection fails

```bash
# Test socket endpoint
curl -v https://ptm.software/ptm-chat-socket.io/?EIO=4&transport=polling

# Check Nginx is proxying correctly
sudo tail -20 /var/log/nginx/error.log

# Check backend logs for socket errors
pm2 logs ptm-chat-api --lines 50 | grep -i socket
```

### MongoDB connection refused

```bash
# Check container status
docker ps -a | grep ptm-mongo
docker logs ptm-mongo --tail 20

# Restart
cd /var/www/ptm-chat/backend && docker compose restart mongodb
```

### Redis connection error

```bash
# Check container
docker ps -a | grep ptm-redis
docker logs ptm-redis --tail 20

# Test connection
docker exec ptm-redis redis-cli -a YOUR_REDIS_PASSWORD ping
# Should return: PONG
```

### CORS errors in browser

```bash
# Verify CLIENT_URL in backend .env matches your domain exactly
grep CLIENT_URL /var/www/ptm-chat/backend/.env
# Should be: CLIENT_URL=https://ptm.software

# Restart backend after .env changes
pm2 restart ptm-chat-api
```

### SSL certificate issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Reload Nginx after renewal
sudo systemctl reload nginx
```

---

## 11. Update & Redeployment

### Full Update Procedure

```bash
cd /var/www/ptm-chat

# 1. Pull latest code
git pull origin main

# 2. Update backend
cd backend
npm install --production
pm2 restart ptm-chat-api

# 3. Update frontend
cd ../frontend
npm install
npm run build
# (Nginx serves static files — no restart needed)

# 4. Verify
curl http://localhost:4400/health
pm2 logs ptm-chat-api --lines 5
```

### Zero-Downtime Deploy (optional)

```bash
# PM2 supports graceful reload
pm2 reload ptm-chat-api
```

### Rollback

```bash
cd /var/www/ptm-chat

# Revert to previous commit
git log --oneline -5          # find the commit to revert to
git checkout <commit-hash> .  # revert files

# Rebuild & restart
cd backend && npm install --production && pm2 restart ptm-chat-api
cd ../frontend && npm install && npm run build
```

---

## Server Directory Structure

```
/var/www/ptm-chat/
├── backend/
│   ├── .env                    ← production secrets (NOT in git)
│   ├── .env.production         ← template (in git)
│   ├── docker-compose.yml
│   ├── data/                   ← MongoDB data volume
│   ├── node_modules/
│   ├── public/profileImage/    ← uploaded profile pictures
│   ├── package.json
│   └── src/
├── frontend/
│   ├── .env.production
│   ├── dist/                   ← built static files (Nginx serves this)
│   ├── node_modules/
│   ├── package.json
│   └── src/
├── backup.sh                   ← MongoDB backup script
├── healthcheck.sh              ← Health monitoring script
└── backups/                    ← MongoDB backup archives

/etc/nginx/sites-available/
└── ptm.software                ← Nginx config

/etc/letsencrypt/live/ptm.software/
├── fullchain.pem               ← SSL certificate
└── privkey.pem                 ← SSL private key

/var/backups/ptm-chat/          ← MongoDB backup archives
/var/log/ptm-backup.log         ← Backup log
/var/log/ptm-health.log         ← Health check log
```
