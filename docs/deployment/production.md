# Production Server Setup Instructions

## Server Details
- **Host:** 47.91.123.78
- **User:** root
- **SSH Key:** kosmos-key

## Prerequisites Completed
- [x] Server wiped and rebooted
- [x] Docker installed (v29.1.3)
- [x] Repo cloned to /opt/kosmos
- [ ] Environment configured
- [ ] Containers started
- [ ] Firewall configured

---

## Step 1: Create Production Environment File

SSH into server and run:

```bash
ssh root@47.91.123.78
```

Then execute:

```bash
cd /opt/kosmos

# Generate secrets
PG_PASS=$(openssl rand -hex 16)
SEC_KEY=$(openssl rand -hex 32)
JWT_SEC=$(openssl rand -hex 32)

# Create .env file
cat > .env << EOF
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://47.91.123.78:8000
NEXT_PUBLIC_WS_URL=ws://47.91.123.78:8000/ws
NEXT_PUBLIC_APP_URL=http://47.91.123.78
DATABASE_URL=postgresql://kosmos:${PG_PASS}@postgres:5432/kosmos
POSTGRES_PASSWORD=${PG_PASS}
REDIS_URL=redis://redis:6379/0
SECRET_KEY=${SEC_KEY}
JWT_SECRET=${JWT_SEC}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
LOG_LEVEL=INFO
DOMAIN=47.91.123.78
EOF

# Verify
cat .env
```

---

## Step 2: Build and Start Frontend Container

```bash
cd /opt/kosmos

# Build frontend image
docker build -t kosmos-frontend:latest -f docker/Dockerfile.frontend ./implementation/frontend

# Start with docker compose (frontend only for now)
docker compose -f docker-compose.prod.yml up -d frontend

# Verify container is running
docker ps

# Check logs
docker logs kosmos-frontend -f
```

---

## Step 3: Configure Firewall

```bash
# Allow HTTP (port 80)
ufw allow 80/tcp

# Allow HTTPS (port 443) 
ufw allow 443/tcp

# Allow SSH (already open, but ensure)
ufw allow 22/tcp

# Enable firewall if not already
ufw --force enable

# Verify
ufw status
```

---

## Step 4: Verify Deployment

```bash
# Check container status
docker ps

# Check frontend logs
docker logs kosmos-frontend

# Test locally
curl -I http://localhost:80
```

From your local machine, open browser:
- http://47.91.123.78

---

## Step 5: Set Up Auto-Restart

```bash
# Ensure containers restart on reboot
cd /opt/kosmos
docker compose -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

### Container won't start
```bash
docker logs kosmos-frontend
docker compose -f docker-compose.prod.yml logs
```

### Port already in use
```bash
netstat -tlnp | grep :80
# Kill conflicting process or change port
```

### Pull latest code
```bash
cd /opt/kosmos
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Quick Reference Commands

```bash
# SSH into server
ssh -i kosmos-key root@47.91.123.78

# View running containers
docker ps

# View all containers
docker ps -a

# Restart frontend
docker restart kosmos-frontend

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build frontend

# View logs
docker logs -f kosmos-frontend

# Stop everything
docker compose -f docker-compose.prod.yml down

# Clean up unused images
docker system prune -af
```

---

**Last Updated:** January 2026  
**Version:** 2.0
