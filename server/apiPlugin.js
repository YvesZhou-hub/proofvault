// Local backend: mounts the Provenance Map and upload-analysis endpoints on the Vite dev and preview servers.
import { handleTaxonomyMatch } from './taxonomyMatch.js';
import { handleRecordAnalyze } from './recordAnalyze.js';
import { handleSeal, handleVerify, handleLedger } from './ledger.js';
import { handleCheckSources } from './sourceCheck.js';
import { handleReceipt } from './receipt.js';

const ROUTES = {
  '/api/taxonomy-match': handleTaxonomyMatch,
  '/api/record-analyze': handleRecordAnalyze,
  '/api/seal': handleSeal,
  '/api/verify': handleVerify,
  '/api/ledger': handleLedger,
  '/api/check-sources': handleCheckSources,
  '/api/receipt': handleReceipt,
};

const MAX_BODY_BYTES = 1024 * 1024;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request too large (max 1 MB)'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function middleware() {
  return async (req, res, next) => {
    const handler = ROUTES[req.url];
    if (!handler) return next();
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return send(405, { error: 'Use POST' });
    try {
      const { status, body } = await handler(await readJson(req));
      send(status, body);
    } catch (err) {
      send(err.status ?? 500, { error: err.message });
    }
  };
}

export default function apiPlugin() {
  return {
    name: 'proofvault-api',
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
