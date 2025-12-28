---
sidebar_position: 2
title: Kubernetes Deployment
description: Deploy KOSMOS V2.0 on Kubernetes with Helm and Argo CD
---

# Kubernetes Deployment

Complete guide for deploying KOSMOS V2.0 on Kubernetes.

## Prerequisites

- Kubernetes cluster (1.28+)
- `kubectl` configured
- `helm` 3.x installed
- Argo CD installed (optional, for GitOps)

## Cluster Setup

### Option 1: K3s (Lightweight)

```bash
# Install K3s on first node
curl -sfL https://get.k3s.io | sh -s - --disable traefik

# Get kubeconfig
sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config

# Join worker nodes
curl -sfL https://get.k3s.io | K3S_URL=https://<master-ip>:6443 \
  K3S_TOKEN=<node-token> sh -
```

### Option 2: Managed Kubernetes

| Provider | Service |
|----------|---------|
| Alibaba | ACK (Alibaba Container Service) |
| AWS | EKS |
| GCP | GKE |
| Azure | AKS |

## Namespace Setup

```bash
# Create namespaces
kubectl create namespace kosmos
kubectl create namespace kosmos-data
kubectl create namespace kosmos-monitoring

# Set default namespace
kubectl config set-context --current --namespace=kosmos
```

## Helm Chart Installation

### 1. Add Helm Repositories

```bash
# Add required repos
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jetstack https://charts.jetstack.io
helm repo update
```

### 2. Install Prerequisites

```bash
# Cert-manager for TLS
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# Ingress controller
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

### 3. Deploy Database Layer

```yaml
# postgres-values.yaml
auth:
  postgresPassword: "${POSTGRES_PASSWORD}"
  database: kosmos
primary:
  persistence:
    size: 50Gi
  resources:
    requests:
      memory: 2Gi
      cpu: 1000m
  extendedConfiguration: |
    shared_preload_libraries = 'pg_stat_statements,pgvector'
```

```bash
helm install postgresql bitnami/postgresql \
  --namespace kosmos-data \
  -f postgres-values.yaml
```

### 4. Deploy Cache Layer

```yaml
# dragonfly-values.yaml
resources:
  requests:
    memory: 1Gi
    cpu: 500m
persistence:
  enabled: true
  size: 10Gi
```

```bash
helm install dragonfly oci://ghcr.io/dragonflydb/dragonfly/helm/dragonfly \
  --namespace kosmos-data \
  -f dragonfly-values.yaml
```

### 5. Deploy KOSMOS Application

```yaml
# kosmos-values.yaml
global:
  domain: app.nuvanta-holding.com

backend:
  replicas: 3
  image:
    repository: ghcr.io/nuvanta-holding/kosmos-backend
    tag: latest
  resources:
    requests:
      memory: 2Gi
      cpu: 1000m
  env:
    DATABASE_URL: postgresql://kosmos:${POSTGRES_PASSWORD}@postgresql.kosmos-data:5432/kosmos
    REDIS_URL: redis://dragonfly.kosmos-data:6379

frontend:
  replicas: 2
  image:
    repository: ghcr.io/nuvanta-holding/kosmos-frontend
    tag: latest
  resources:
    requests:
      memory: 512Mi
      cpu: 250m

mcpServers:
  replicas: 2
  image:
    repository: ghcr.io/nuvanta-holding/kosmos-mcp
    tag: latest
  resources:
    requests:
      memory: 1Gi
      cpu: 500m

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: app.nuvanta-holding.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
  tls:
    - secretName: kosmos-tls
      hosts:
        - app.nuvanta-holding.com
```

```bash
helm install kosmos ./charts/kosmos \
  --namespace kosmos \
  -f kosmos-values.yaml
```

## Kubernetes Manifests

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kosmos-backend
  namespace: kosmos
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kosmos-backend
  template:
    metadata:
      labels:
        app: kosmos-backend
    spec:
      containers:
        - name: backend
          image: ghcr.io/nuvanta-holding/kosmos-backend:latest
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: kosmos-secrets
          resources:
            requests:
              memory: "2Gi"
              cpu: "1000m"
            limits:
              memory: "4Gi"
              cpu: "2000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### Secrets Management

```bash
# Create secrets from .env file
kubectl create secret generic kosmos-secrets \
  --from-env-file=.env \
  --namespace kosmos

# Or use external secrets operator with Infisical
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: kosmos-secrets
  namespace: kosmos
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: infisical-store
    kind: ClusterSecretStore
  target:
    name: kosmos-secrets
  dataFrom:
    - extract:
        key: /kosmos/production
EOF
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kosmos-backend-hpa
  namespace: kosmos
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kosmos-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## GitOps with Argo CD

### Install Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

### Create Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kosmos
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/nuvanta-holding/kosmos-dar.git
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: kosmos
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

## Monitoring

### Prometheus + Grafana

```bash
helm install prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace kosmos-monitoring \
  --set grafana.adminPassword="${GRAFANA_PASSWORD}"
```

### ServiceMonitor for KOSMOS

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kosmos-backend
  namespace: kosmos-monitoring
spec:
  selector:
    matchLabels:
      app: kosmos-backend
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Pods pending | Check node resources: `kubectl describe nodes` |
| CrashLoopBackOff | Check logs: `kubectl logs -f <pod>` |
| Database connection | Verify secrets and network policies |
| Ingress not working | Check ingress controller logs |

### Useful Commands

```bash
# View all resources
kubectl get all -n kosmos

# Check pod logs
kubectl logs -f deployment/kosmos-backend -n kosmos

# Enter pod shell
kubectl exec -it deployment/kosmos-backend -n kosmos -- /bin/sh

# Port forward for debugging
kubectl port-forward svc/kosmos-backend 8000:8000 -n kosmos
```
