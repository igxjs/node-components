#!/usr/bin/env bash
# Install @igxjs/node-components from GitHub Packages.
# The package is published to npm.pkg.github.com and requires a GitHub
# personal access token with `read:packages` scope.

set -euo pipefail

# 1. Configure the registry for the @igxjs scope. Run from the consumer project root.
#    The token can be exported as an env var or hardcoded in ~/.npmrc instead.
cat >> .npmrc <<'EOF'
@igxjs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF

# 2. Install the package and its peer dependency (Express).
npm install @igxjs/node-components express

# 3. Choose how to import based on your consumer project:
#
#    ESM project ("type": "module" in package.json, or .mjs files):
#      import { SessionManager } from '@igxjs/node-components';
#
#    CommonJS project on Node 22.12+:
#      const { SessionManager } = require('@igxjs/node-components');
#      # require() of ESM packages is stable since Node 22.12.
#
#    CommonJS project on Node 18.x – 22.11:
#      const { SessionManager } = await import('@igxjs/node-components');
#      # Synchronous require() throws ERR_REQUIRE_ESM on these versions;
#      # use dynamic import() inside an async function instead.
#
# Verify your Node version before recommending require():
node -v
