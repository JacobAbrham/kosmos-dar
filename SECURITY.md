# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

The KOSMOS team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities by emailing:

**security@nuvanta-holding.com**

Please include the following information in your report:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Affected versions** of KOSMOS
4. **Potential impact** of the vulnerability
5. **Any suggested fixes** (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
- **Assessment**: We will assess the vulnerability and determine its severity.
- **Updates**: We will keep you informed of our progress.
- **Resolution**: We aim to resolve critical vulnerabilities within 7 days.
- **Disclosure**: We will coordinate with you on public disclosure timing.

### Security Measures

KOSMOS implements the following security measures:

- **Authentication**: Zitadel (OIDC/OAuth 2.0)
- **Authorization**: Role-Based Access Control (RBAC) with Row-Level Security
- **Encryption**: 
  - TLS 1.3 for data in transit
  - AES-256 for data at rest
- **Secrets Management**: Infisical for centralized secrets
- **Audit Logging**: Comprehensive audit trails
- **Dependency Scanning**: Regular vulnerability scans

### Security Best Practices

When deploying KOSMOS:

1. **Change all default credentials** immediately
2. **Use strong, unique passwords** for all services
3. **Keep all components updated** to the latest versions
4. **Enable TLS/SSL** for all external connections
5. **Review and restrict** network access
6. **Enable audit logging** and review logs regularly
7. **Back up data** regularly and test restoration

## Security Advisories

Security advisories will be published in the GitHub Security Advisories section of this repository.

## Acknowledgments

We thank the following researchers for responsibly disclosing vulnerabilities:

*This section will be updated as researchers report vulnerabilities.*

---

Thank you for helping keep KOSMOS and our users safe!
