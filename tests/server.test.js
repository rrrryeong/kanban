/**
 * @jest-environment node
 */
const path = require('path');
const http = require('http');
const { createServer, resolvePath } = require('../e2e/server.js');

const ROOT = path.resolve(__dirname, '..');

describe('resolvePath', () => {
  test('루트는 index.html', () => {
    expect(resolvePath('/')).toBe(path.join(ROOT, 'index.html'));
  });

  test('일반 파일 경로와 쿼리스트링', () => {
    expect(resolvePath('/style.css?v=1')).toBe(path.join(ROOT, 'style.css'));
  });

  test.each([
    ['/../package.json', 'package.json'],
    ['/%2e%2e/%2e%2e/etc/passwd', path.join('etc', 'passwd')],
  ])('%s 는 루트 밖으로 나가지 않는다 (URL 정규화)', (url, inside) => {
    expect(resolvePath(url)).toBe(path.join(ROOT, inside));
  });

  test.each([
    '/node_modules/jest/package.json',
    '/.gitignore',
    '/e2e/../.git/config',
    '/%E0%A4%A',
  ])('%s 는 거부한다', (url) => {
    expect(resolvePath(url)).toBeNull();
  });
});

describe('createServer', () => {
  let server;
  let base;

  beforeAll((done) => {
    server = createServer().listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => { server.close(done); });

  const get = (url, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request(`${base}${url}`, { method }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    });
    req.on('error', reject);
    req.end();
  });

  test('index.html을 text/html로 제공한다', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/text\/html/);
    expect(res.body).toContain('<title>Kanban</title>');
  });

  test('JS·CSS의 Content-Type', async () => {
    expect((await get('/app.js')).type).toMatch(/javascript/);
    expect((await get('/style.css')).type).toMatch(/text\/css/);
  });

  test('없는 파일은 404, 금지 경로는 403, POST는 405', async () => {
    expect((await get('/nope.html')).status).toBe(404);
    expect((await get('/.gitignore')).status).toBe(403);
    expect((await get('/', 'POST')).status).toBe(405);
  });

  test('HEAD는 본문 없이 200', async () => {
    const res = await get('/index.html', 'HEAD');
    expect(res.status).toBe(200);
    expect(res.body).toBe('');
  });
});
