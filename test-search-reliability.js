const { execSync } = require('child_process');
async function test() {
  const result = await fetch("http://localhost:3000/api/ads/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "shoes" })
  }).then(res => res.json().then(data => ({ status: res.status, data })));
  console.log("Status:", result.status);
  console.log("Source:", result.data.source);
  console.log("Stale:", result.data.stale);
  console.log("Count:", result.data.ads?.length);
  console.log("RequestId:", result.data.requestId);
  console.log("Error:", result.data.error || result.data.message);
}
test();
