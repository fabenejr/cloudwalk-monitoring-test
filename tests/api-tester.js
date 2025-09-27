const axios = require('axios');

async function run() {
  try {
    const base = 'http://localhost:3000';
    console.log('GET /health');
    const health = await axios.get(`${base}/health`);
    console.log('health:', health.data);

    console.log('GET /api/stats?hours=24');
    const stats = await axios.get(`${base}/api/stats`, { params: { hours: 24 } });
    console.log('stats sample:', stats.data.slice(0, 3));

    console.log('GET /api/timeseries?hours=6');
    const ts = await axios.get(`${base}/api/timeseries`, { params: { hours: 6 } });
    console.log('timeseries sample:', ts.data.slice(0, 3));

    console.log('GET /api/alerts?limit=5');
    const alerts = await axios.get(`${base}/api/alerts`, { params: { limit: 5 } });
    console.log('alerts:', alerts.data);

    console.log('GET /api/checkout-analysis');
    const chk = await axios.get(`${base}/api/checkout-analysis`);
    console.log('checkout-analysis sample:', chk.data.slice(0, 3));

    console.log('POST /api/transaction');
    const now = new Date().toISOString();
    const tx = await axios.post(`${base}/api/transaction`, {
      timestamp: now,
      status: 'approved',
      count: 5,
    });
    console.log('transaction response:', tx.data);
  } catch (err) {
    console.error('api-tester error:', err.response?.data || err.message);
    process.exitCode = 1;
  }
}

run();
