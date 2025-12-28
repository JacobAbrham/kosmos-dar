# Cloudflare Pages Deployment Guide

## Prerequisites
- Cloudflare account with domain `nuvanta-holding.com` configured
- GitHub repository for the project

## Step 1: Connect to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account → **Workers & Pages** → **Create**
3. Select **Pages** → **Connect to Git**
4. Authorize GitHub and select the `kosmos-dar` repository

## Step 2: Configure Build Settings

| Setting | Value |
|---------|-------|
| **Project name** | `kosmos-docs` |
| **Production branch** | `main` |
| **Framework preset** | None (Custom) |
| **Build command** | `cd docs-site && npm install && npm run build` |
| **Build output directory** | `docs-site/build` |
| **Root directory** | `/` |

### Environment Variables (Optional)
```
NODE_VERSION=20
```

## Step 3: Deploy

Click **Save and Deploy**. First build will take 2-3 minutes.

## Step 4: Configure Custom Domain

1. After deployment, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `docs.nuvanta-holding.com`
4. Cloudflare will auto-configure DNS (CNAME record)
5. SSL certificate auto-provisioned

## Step 5: Verify Deployment

Visit: https://docs.nuvanta-holding.com

## Automatic Deployments

Every push to `main` branch triggers automatic rebuild and deployment.

## Build Commands Reference

```bash
# Local development
cd docs-site && npm start

# Production build
cd docs-site && npm run build

# Serve production build locally
cd docs-site && npm run serve
```

## Troubleshooting

### Build Fails
- Check Node version (requires 18+)
- Verify `docs-site/package.json` exists
- Check build logs in Cloudflare dashboard

### Custom Domain Not Working
- Verify DNS propagation (can take up to 24h)
- Check Cloudflare DNS settings
- Ensure SSL/TLS is set to "Full (strict)"
