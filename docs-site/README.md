# KOSMOS V2.0 Documentation

AI-Native Enterprise Operating System - Documentation Site

Built with [Docusaurus 3](https://docusaurus.io/) and deployed to [Cloudflare Pages](https://pages.cloudflare.com/).

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Serve production build locally
npm run serve
```

## Project Structure

```
docs-site/
├── docs/                    # Documentation content
│   ├── intro.md            # Landing page
│   ├── 01-getting-started/ # Getting started guides
│   ├── 02-architecture/    # System architecture
│   ├── 03-agents/          # 11 KOSMOS agents
│   ├── 04-api/             # API reference
│   ├── 05-mcp-servers/     # 88 MCP servers
│   ├── 06-frontend/        # Frontend components
│   ├── 07-database/        # Database schema
│   ├── 08-configuration/   # Configuration reference
│   └── 09-governance/      # Project governance
├── blog/                    # Release notes & updates
├── src/
│   ├── css/custom.css      # KOSMOS theme
│   └── pages/              # Custom pages
├── static/                  # Static assets
├── docusaurus.config.ts    # Site configuration
└── sidebars.ts             # Sidebar configuration
```

## Deployment

### Automatic (GitHub Actions)

Documentation is automatically deployed on every push to `main`:

1. **Push to main** → GitHub Actions triggers
2. **Generate docs** → Scripts extract docs from code (Phase 2)
3. **Build site** → Docusaurus builds static files
4. **Deploy** → Cloudflare Pages serves at docs.nuvanta-holding.com

### Manual Deployment

```bash
# Build the site
npm run build

# Deploy using Wrangler CLI
npx wrangler pages deploy build/ --project-name=kosmos-docs
```

## Configuration

### GitHub Secrets Required

Add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

### Creating Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Add permissions: `Cloudflare Pages: Edit`
5. Copy the token to GitHub Secrets

## Auto-Generation (Phase 2)

Documentation is auto-generated from code:

```bash
# Extract API docs from FastAPI
python scripts/docs/extract-api.py

# Extract agent docs from Python source
python scripts/docs/extract-agents.py

# Extract MCP server docs from configs
python scripts/docs/extract-mcp.py
```

## Features

- **Mermaid diagrams** - Architecture visualizations
- **Dark mode** - Automatic theme switching
- **Search** - Typesense AI search (Phase 4)
- **Versioning** - Documentation versions (planned)
- **i18n** - Internationalization ready

## URLs

| Environment | URL |
|-------------|-----|
| Production | https://docs.nuvanta-holding.com |
| Preview | https://*.kosmos-docs.pages.dev |
| Local | http://localhost:3000 |

## Contributing

1. Create a feature branch
2. Make changes to `docs/` files
3. Test locally with `npm start`
4. Create PR → Preview URL auto-generated
5. Merge to main → Auto-deploy to production

## License

Proprietary - Nuvanta Holding
