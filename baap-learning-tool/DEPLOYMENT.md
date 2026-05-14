# AWS Amplify Deployment Guide

## 📋 Overview
This file configures AWS Amplify for deploying the Credit Portal Angular application.

## 🚀 Deployment Configuration

### Current Setup: Static Site Deployment
- **Framework**: Angular 20
- **Build Output**: `dist/credit_portal/browser`
- **Deployment Type**: Static Site (SPA)

### Build Process
1. **Pre-build**: Install dependencies with npm cache optimization
2. **Build**: Run `npm run build` to generate production build
3. **Artifacts**: Deploy files from `dist/credit_portal/browser`

## 🔧 Available Build Scripts

```bash
# Development server
npm start

# Production build (static)
npm run build

# Production build (SSR) - if enabled
npm run build:ssr

# Serve SSR locally
npm run serve:ssr:credit_portal
```

## 🌐 SSR (Server-Side Rendering) Support

To enable SSR deployment:

1. Uncomment the `backend` section in `amplify.yml`
2. Change deployment type from Static to Server-Side Rendered
3. Configure proper Node.js runtime in Amplify console

### SSR Configuration
```yaml
backend:
  phases:
    preBuild:
      commands:
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        - npm run build:ssr
  artifacts:
    baseDirectory: dist/credit_portal
    files:
      - server/**/*
      - browser/**/*
```

## 📁 Project Structure
```
dist/
└── credit_portal/
    ├── browser/          # Static files (current deployment)
    └── server/           # SSR server files (if enabled)
```

## 🔍 Troubleshooting

### Common Issues:
1. **Build fails**: Check Node.js version compatibility
2. **Assets not found**: Verify baseDirectory path
3. **SSR issues**: Ensure server files are properly built

### Environment Requirements:
- **Node.js**: v18+ recommended
- **NPM**: v8+ recommended
- **Angular CLI**: v20+

## 📝 Notes
- Cache is configured for `.npm` and `node_modules` to speed up builds
- Build logs include version information for debugging
- Static deployment is currently active (fastest and most reliable)
