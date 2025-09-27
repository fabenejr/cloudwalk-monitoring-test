const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:3000';
    const health = await axios.get(`${base}/health`);
    console.log('health:', health.data);
  } catch (e) {
    console.error('quickTest error:', e.message);
    process.exit(1);
  }
})();
