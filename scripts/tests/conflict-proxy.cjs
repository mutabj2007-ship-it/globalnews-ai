// TEST ONLY: run Next with SERVER_INTERNAL_API_URL=http://127.0.0.1:4319
// and NEXT_PUBLIC_API_URL unset. This exercises Next's actual public rewrite.
const http = require('node:http');
const assert = require('node:assert/strict');
const requests = [];
const server = http.createServer((req, res) => {
  requests.push({ path: req.url, method: req.method, cookie: req.headers.cookie ?? null });
  res.writeHead(200, {
    'content-type': 'application/json',
    'x-conflict-test-upstream': 'retained-only',
  });
  res.end('[]');
});
server.listen(4319, '127.0.0.1', async () => {
  try {
    const response = await fetch('http://127.0.0.1:3107/conflict-data/observations?limit=500');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-conflict-test-upstream'), 'retained-only');
    assert.deepEqual(await response.json(), []);
    assert.deepEqual(requests, [
      { path: '/conflict/observations?limit=500', method: 'GET', cookie: null },
    ]);
    console.log(JSON.stringify({ publicRewrite: 'passed', requests }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
