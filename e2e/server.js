/* E2E용 정적 파일 서버. 의존성 없이 Node http 모듈만 쓴다.
   사용법: node e2e/server.js [port]  (기본 4173, 환경변수 PORT도 가능) */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** 요청 경로를 ROOT 안의 파일 경로로 바꾼다. ROOT 밖이나 숨김·의존성 폴더는 거부한다. */
function resolvePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(urlPath, 'http://localhost').pathname);
  } catch (e) {
    return null;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.resolve(ROOT, `.${pathname}`);
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (rel.split(path.sep).some((part) => part.startsWith('.') || part === 'node_modules')) return null;
  return file;
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    const file = resolvePath(req.url);
    if (!file) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`Kanban E2E server: http://localhost:${PORT}`);
  });
}

module.exports = { createServer, resolvePath };
