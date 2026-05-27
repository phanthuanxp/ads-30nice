# Ads 30Nice

Internal Meta Ads planning, monitoring, and optimization dashboard for one verified Meta Business with multiple ad accounts.

## Current Scope

- Read all owned/client ad accounts from one Meta Business.
- Read campaign performance from Meta Marketing API.
- Show spend, clicks, CTR, CPC, CPA, frequency, and results.
- Generate optimization notes from campaign metrics.
- Create draft campaign plans before publishing anything to Meta.
- Run without external npm dependencies.

When Meta credentials are missing, the app runs with sample data so the UI can be reviewed immediately.

## Requirements

- Node.js 20+
- Meta Business ID
- Meta access token with the needed Marketing API permissions

Recommended Meta permissions:

- `ads_read`
- `ads_management`
- `business_management`
- `pages_read_engagement`
- `pages_show_list`

## Local Run

```bash
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3010
```

## Environment

```bash
PORT=3010
PUBLIC_BASE_URL=https://ads.30nice.vn
META_API_VERSION=v25.0
META_BUSINESS_ID=your_business_id
META_ACCESS_TOKEN=your_long_lived_access_token
ADMIN_KEY=optional_internal_write_key
```

If `ADMIN_KEY` is set, POST mutation endpoints require:

```text
x-admin-key: your_key
```

## VPS Deploy With systemd

Example target path:

```bash
/opt/ads-30nice
```

Install:

```bash
git clone <github-repo-url> /opt/ads-30nice
cd /opt/ads-30nice
cp .env.example .env
nano .env
npm run check
```

Create `/etc/systemd/system/ads-30nice.service`:

```ini
[Unit]
Description=Ads 30Nice
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/ads-30nice
EnvironmentFile=/opt/ads-30nice/.env
ExecStart=/usr/bin/node /opt/ads-30nice/server.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ads-30nice
sudo systemctl start ads-30nice
sudo systemctl status ads-30nice
```

## Nginx For ads.30nice.vn

```nginx
server {
    server_name ads.30nice.vn;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable TLS:

```bash
sudo certbot --nginx -d ads.30nice.vn
```

## Next Milestones

1. Add OAuth/token management for Meta instead of manual token env.
2. Add persistent database, user login, and role-based access.
3. Add ad set/ad/creative breakdowns.
4. Add campaign draft publishing to Meta as `PAUSED`.
5. Add scheduled sync and historical trend charts.
6. Add industry templates and approval workflow.
