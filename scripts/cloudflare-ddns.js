const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function cloudflareRequest(pathname, options = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    const message = data.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(message);
  }

  return data.result;
}

async function getPublicIp() {
  const response = await fetch("https://api.ipify.org?format=json");
  if (!response.ok) throw new Error(`Cannot get public IP: ${response.statusText}`);
  const data = await response.json();
  return data.ip;
}

async function getZoneId(domain) {
  if (process.env.CLOUDFLARE_ZONE_ID) return process.env.CLOUDFLARE_ZONE_ID;

  const zones = await cloudflareRequest(`/zones?name=${encodeURIComponent(domain)}`);
  const zone = zones.find((item) => item.name === domain);
  if (!zone) throw new Error(`Cloudflare zone not found: ${domain}`);
  return zone.id;
}

async function main() {
  loadEnv();

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const domain = process.env.CLOUDFLARE_DOMAIN || "xlabrnd.com";
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");

  const publicIp = await getPublicIp();
  const zoneId = await getZoneId(domain);
  const records = await cloudflareRequest(`/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(domain)}`);
  const record = records[0];

  if (!record) throw new Error(`A record not found: ${domain}`);
  if (record.content === publicIp && record.proxied === true) {
    console.log(`No change: ${domain} -> ${publicIp}`);
    return;
  }

  await cloudflareRequest(`/zones/${zoneId}/dns_records/${record.id}`, {
    method: "PUT",
    body: JSON.stringify({
      type: "A",
      name: domain,
      content: publicIp,
      ttl: 1,
      proxied: true
    })
  });

  console.log(`Updated: ${domain} ${record.content} -> ${publicIp}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
