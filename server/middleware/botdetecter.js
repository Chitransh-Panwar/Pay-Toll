import dns from "dns/promise"
import {LRUCache} from "lru-cache"
import fetch from "node-fetch";

const BOT_UA_PATTERNS=[
    // AI/LLM Crawlers
    {pattern:/GPTBot/i,name:"GPTBot",score:90},
    {pattern:/ClaudeBot/i,name:"ClaudeBot",score:90},
    {pattern:/PerplexityBot/i,name:"PerplexityBot",score:90},
    {pattern:/ChatGPT-User/i,name:"ChatGPT-User",score:90},
    {pattern:/OAI-SearchBot/i,name:"OAI-SearchBot",score:90},
    {pattern:/Anthropic/i,name:"Anthropic",score:85},
    {pattern:/CCBot/i,name:"CCBot",score:85},
    {pattern:/Bytespider/i,name:"Bytespider",score:85},
    {pattern:/Applebot/i,name:"Applebot",score:85},
    {pattern:/cohera-ai/i,name:"cohera-ai",score:85},
    {pattern:/meta-externalagent/i,name:"meta-externalagent",score:85},
    {pattern:/Diffbot/i,name:"Diffbot",score:80},
    {pattern:/Omgilibot/i,name:"Omgilibot",score:80},
    {pattern:/DataForSeoBot/i,name:"DataForSeo",score:75},

    //search crawlers
    {pattern:/Googlebot/i,name:"Googlebot",score:70},
    {pattern:/bingbot/i,name:"Bingbot",score:70},
    {pattern:/Slurp/i,name:"Yahoo",score:70},
    {pattern:/DuckDuckBot/i,name:"DuckDuckBot",score:70},
    {pattern:/BaiduSpider/i,name:"Baidu",score:70},
    //headless crawler
    {pattern:/HeadlessChrome/i,name:"Headless",score:75},
    {pattern:/PhantomJS/i,name:"PhantomJS",score:80},
    {pattern:/Selenium/i,name:"Selenium",score:80},
    {pattern:/Playwright/i,name:"Playwright",score:80},
    {pattern:/Puppeteer/i,name:"Puppeteer",score:80},
    //basic scrapers
    {pattern:/python-requests/i,name:"PythonRequests",score:70},
    {pattern:/axios/i,name:"Axios",score:55},
    {pattern:/curl/i,name:"curl",score:55},
    {pattern:/wget/i,name:"wget",score:60},
    {pattern:/go-http-client/i,name:"GoHTTP",score:55},
    {pattern:/libwww-perl/i,name:"Perl",score:55},
    {pattern:/java\//i,name:"JavaHTTP",score:60},
    {pattern:/scrapy/i,name:"Scrapy",score:60},
  
]

const DATACENTER_IPS_SOURCES = {
  aws: "https://ip-ranges.amazonaws.com/ip-ranges.json",
  gcp: "https://www.gstatic.com/ipranges/cloud.json",
  cloudflare_v4: "https://www.cloudflare.com/ips-v4",
};

// Group CIDRs by mask for fast O(1) mathematical lookup
let cidrGroupsByMask = {}; 

function ipToInt(ip) {
  return ip
    .split(".")
    .reduce((acc, oct) => ((acc << 8) + Number(oct)) >>> 0, 0);
}

function parseCIDR(cidr, provider) {
  const [ip, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);

  // Safe unsigned bitwise mask generation (Avoids negative shift bugs)
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const base = (ipToInt(ip) & mask) >>> 0;

  return { provider, base, mask };
}

async function fetchAWS() {
  const data = await fetch(DATACENTER_IPS_SOURCES.aws).then(r => r.json());
  return data.prefixes
    .filter(x => x.ip_prefix)
    .map(x => ({ cidr: x.ip_prefix, provider: "aws" }));
}

async function fetchGCP() {
  const data = await fetch(DATACENTER_IPS_SOURCES.gcp).then(r => r.json());
  return data.prefixes
    .filter(x => x.ipv4Prefix)
    .map(x => ({ cidr: x.ipv4Prefix, provider: "gcp" }));
}

async function fetchCloudflare() {
  const text = await fetch(DATACENTER_IPS_SOURCES.cloudflare_v4).then(r => r.text());
  // Split securely across both Unix (\n) and Windows (\r\n) line endings
  return text
    .split(/[\r\n]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(cidr => ({ cidr, provider: "cloudflare" }));
}

let intervalStarted = false;

export async function initializeDatacenterRanges() {
  try {
    const [aws, gcp, cloudflare] = await Promise.all([
      fetchAWS(),
      fetchGCP(),
      fetchCloudflare(),
    ]);

    const allRanges = [...aws, ...gcp, ...cloudflare];
    const temporaryGroups = {};
    let count = 0;

    for (const item of allRanges) {
      const parsed = parseCIDR(item.cidr, item.provider);
      if (!temporaryGroups[parsed.mask]) {
        temporaryGroups[parsed.mask] = new Map();
      }
      temporaryGroups[parsed.mask].set(parsed.base, parsed.provider);
      count++;
    }

    cidrGroupsByMask = temporaryGroups;
    console.log(`Loaded ${count} cloud CIDRs into optimized layout.`);

    // Start refresh loop only once, after first successful load
    if (!intervalStarted) {
      intervalStarted = true;
      setInterval(initializeDatacenterRanges, 24 * 60 * 60 * 1000);
    }

  } catch (error) {
    console.error("Failed to initialize datacenter IP pools:", error);
  }
}

export function getDatacenterProvider(ip) {
  // Guard against missing strings or IPv6 addresses
  if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return null; 
  }

  try {
    const ipNum = ipToInt(ip);

    // Iterates only over unique subnet masks (usually ~10-15 masks maximum)
    for (const maskStr in cidrGroupsByMask) {
      const mask = Number(maskStr);
      const base = (ipNum & mask) >>> 0;
      
      const provider = cidrGroupsByMask[mask].get(base);
      if (provider) {
        return provider; // O(1) direct map match found
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function isDatacenterIP(ip) {
  return getDatacenterProvider(ip) !== null;
}

// HEADER FINGERPRINTS 