const https = require('https');
const fs = require('fs');
const path = require('path');

// Load from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');

const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
  }
});

const keyId = envVars['RAZORPAY_KEY_ID'];
const keySecret = envVars['RAZORPAY_KEY_SECRET'];
const planId = envVars['RAZORPAY_PLAN_ID'];

console.log('LOCAL CONFIG');
console.log(`.env.local parsed: YES`);
console.log(`RAZORPAY_KEY_ID detected: ${keyId ? 'YES' : 'NO'}`);
console.log(`RAZORPAY_KEY_SECRET detected: ${keySecret ? 'YES' : 'NO'}`);
console.log(`RAZORPAY_PLAN_ID detected: ${planId ? 'YES' : 'NO'}`);
console.log('\nRAZORPAY VERIFICATION');

if (!keyId || !keySecret || !planId) {
  console.log('Missing credentials in .env.local. Please add them and run this script again.');
  process.exit(1);
}

const mode = keyId.startsWith('rzp_test_') ? 'TEST' : (keyId.startsWith('rzp_live_') ? 'LIVE' : 'UNKNOWN');
console.log(`Mode: ${mode}`);

const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

const options = {
  hostname: 'api.razorpay.com',
  port: 443,
  path: `/v1/plans/${planId}`,
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);

      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`Credentials valid: PASS`);
        console.log(`Plan fetch: PASS`);
        console.log(`Plan belongs to configured credentials/account: PASS`);
        
        console.log(`Plan amount: ${response.item.amount}`);
        console.log(`Plan currency: ${response.item.currency}`);
        console.log(`Plan period: ${response.period}`);
        console.log(`Plan interval: ${response.interval}`);
        
        const isScout = response.item.amount === 49900 && response.item.currency === 'INR' && response.period === 'monthly' && response.interval === 1;
        console.log(`\nDoes this match Scout config? ${isScout ? 'YES' : 'NO'}`);
      } else {
        console.log(`Credentials valid / Plan fetch: FAIL`);
        console.log(`HTTP Status: ${res.statusCode}`);
        if (response.error) {
          console.log(`Razorpay safe error code: ${response.error.code}`);
          console.log(`Razorpay safe description: ${response.error.description}`);
        } else {
          console.log(`Response: ${data}`);
        }
      }
    } catch (e) {
      console.log(`Failed to parse Razorpay response:`, e);
      console.log(`Raw response: ${data}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request failed: ${e.message}`);
});

req.end();
