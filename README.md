# Ads 30Nice

Internal dashboard for researching, planning, monitoring, and optimizing Meta Ads across many ad accounts under one verified Meta Business.

## Features

- Internal login with signed HTTP-only session cookie.
- Reads owned/client ad accounts from one Meta Business.
- Reads campaign performance from Meta Marketing API.
- Shows spend, impressions, clicks, CTR, CPC, CPA, frequency, and results.
- Generates optimization notes from campaign metrics.
- Creates and stores draft campaign plans before publishing anything to Meta.
- Runs with sample data when Meta credentials are not configured.
- No external npm dependencies.

## Local Run

```bash
cp .env.example .env
npm run secret
npm run dev
```

Open:

```text
http://localhost:3010
```

## Production Environment

Create `/opt/ads-30nice/.env`:

```bash
PORT=3010
PUBLIC_BASE_URL=https://ads.30nice.vn

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_strong_password
SESSION_SECRET=replace_with_output_from_npm_run_secret

META_API_VERSION=v25.0
META_BUSINESS_ID=your_meta_business_id
META_ACCESS_TOKEN=your_long_lived_meta_access_token

ADMIN_KEY=
```

Recommended Meta permissions:

- `ads_read`
- `ads_management`
- `business_management`
- `pages_read_engagement`
- `pages_show_list`

Validate before starting:

```bash
npm run check
npm run check:env
```

## Deploy To VPS With systemd

Assumption: DNS `ads.30nice.vn` points to the VPS public IP.

Install Node.js 20+ or 24 LTS, Nginx, and Certbot on the VPS.

```bash
sudo mkdir -p /opt/ads-30nice
sudo chown -R $USER:$USER /opt/ads-30nice
git clone <github-repo-url> /opt/ads-30nice
cd /opt/ads-30nice
cp .env.example .env
npm run secret
nano .env
npm run check
npm run check:env
```

Prepare data directory:

```bash
sudo mkdir -p /opt/ads-30nice/data
sudo chown -R www-data:www-data /opt/ads-30nice/data
sudo chown root:www-data /opt/ads-30nice/.env
sudo chmod 660 /opt/ads-30nice/.env
```

Install service:

```bash
sudo cp deploy/ads-30nice.service /etc/systemd/system/ads-30nice.service
sudo systemctl daemon-reload
sudo systemctl enable ads-30nice
sudo systemctl start ads-30nice
sudo systemctl status ads-30nice
```

Install Nginx:

```bash
sudo cp deploy/nginx-ads.30nice.vn.conf /etc/nginx/sites-available/ads.30nice.vn
sudo ln -s /etc/nginx/sites-available/ads.30nice.vn /etc/nginx/sites-enabled/ads.30nice.vn
sudo nginx -t
sudo systemctl reload nginx
```

Enable HTTPS:

```bash
sudo certbot --nginx -d ads.30nice.vn
```

Smoke tests:

```bash
curl -I https://ads.30nice.vn
curl https://ads.30nice.vn/api/health
```

## Optional Docker Compose

```bash
cp .env.example .env
npm run secret
nano .env
docker compose up -d --build
```

The container binds to `127.0.0.1:3010`; keep Nginx in front for HTTPS.

## Update Deployment

```bash
cd /opt/ads-30nice
git pull
npm run check
sudo systemctl restart ads-30nice
sudo systemctl status ads-30nice
```

## Roadmap

1. Add historical daily sync and trend charts.
2. Add ad set/ad/creative drilldown.
3. Add Meta OAuth token refresh flow.
4. Add draft campaign publishing to Meta as `PAUSED`.
5. Add approval workflow and industry template library.
