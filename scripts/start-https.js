#!/usr/bin/env node
//
// start-https.js
// Serves the RomPatcher.js site over HTTPS using the project's self-signed
// certificate/key (key.pem + cert.pem). No external dependencies required.
//
// Usage:
//   node scripts/start-https.js
//   PORT=9443 node scripts/start-https.js
//   CERT_KEY=./my-key.pem CERT_CERT=./my-cert.pem node scripts/start-https.js
//

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT || '8443', 10);
const KEY_FILE = process.env.CERT_KEY || path.join(ROOT_DIR, 'key.pem');
const CERT_FILE = process.env.CERT_CERT || path.join(ROOT_DIR, 'cert.pem');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain',
};

function mimeFor(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

const options = {
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE),
};

const server = https.createServer(options, (req, res) => {
    // Resolve the requested path relative to the project root.
    const requestedPath = req.url === '/' ? '/index.html' : req.url;
    // Strip query string if present.
    const cleanPath = requestedPath.split('?')[0].split('#')[0];
    let filePath = path.join(ROOT_DIR, cleanPath);

    // Prevent directory traversal outside ROOT_DIR.
    const resolvedRoot = path.resolve(ROOT_DIR);
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(resolvedRoot + path.sep) && resolvedFile !== resolvedRoot) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            // Fall back to index.html for SPA-style routing / missing files.
            if (cleanPath !== '/index.html') {
                fs.readFile(path.join(ROOT_DIR, 'index.html'), (err2, indexContent) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('Not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(indexContent);
                    }
                });
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }

        res.writeHead(200, { 'Content-Type': mimeFor(filePath) });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`RomPatcher.js HTTPS server running:`);
    console.log(`  https://localhost:${PORT}/`);
    console.log(`  Certificate: ${CERT_FILE}`);
    console.log(`  Key:         ${KEY_FILE}`);
    console.log('');
    console.log('Note: This uses a self-signed certificate. Accept the browser warning to continue.');
});

server.on('error', (err) => {
    console.error('Failed to start HTTPS server:', err.message);
    process.exit(1);
});
