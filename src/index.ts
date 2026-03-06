#!/usr/bin/env node

import { startServer } from './mcp/server.js';

startServer().catch((err) => {
  console.error('Failed to start API Convert Plugin:', err);
  process.exit(1);
});
