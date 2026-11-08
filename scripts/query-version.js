const https = require('https');

async function main() {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'query',
    params: {
      request_type: 'call_function',
      account_id: 'guard2.sergeo-guard.testnet',
      method_name: 'get_version',
      args_base64: '',
      finality: 'optimistic',
    },
  });

  const req = https.request('https://test.rpc.fastnear.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Connection': 'close',
    },
    rejectUnauthorized: false,
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.result && json.result.result) {
          const str = Buffer.from(json.result.result).toString('utf8');
          console.log('LIVE VERSION ON CHAIN:', JSON.parse(str));
        } else {
          console.log('Result payload:', json);
        }
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    });
  });

  req.on('error', (err) => console.error('Request error:', err.message));
  req.write(payload);
  req.end();
}

main();
