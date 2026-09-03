const filters = {
  formats: ["video"],
  statuses: ["active"],
  runtime: { minDays: 1, maxDays: 3 }
};
fetch("http://localhost:3000/api/ads/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(filters)
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
