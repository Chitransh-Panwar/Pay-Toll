import dns from "dns/promises"
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
const BROWSER_HEADERS=[
  "accept-language",
  "accept-encoding",
  "sec-fetch-site",
  "sec-ch-ua",
]

export function headerScore(headers) {
  let score=0;
  const missing =BROWSER_HEADERS.filter((h)=>!headers[h])
  score+=missing.length*12
  if (!headers["accept"]) score+= 20
  if (headers["accept"]=== "*/*") score+=15
  if (headers["connection"]) score+=10
  if (headers["sec-fetch-mode"] === "cors") score += 20;
  return score
}

//REVERSE DNS VERIFICATION
const dnsCache=new LRUCache({max:2000,ttl:100*60*60})
const LEGITIMATE_BOT_HOSTNAME=[
  /googlebot\.com$/,
  /google\.com$/,
  /crawl\.yahoo\.net$/,
  /search\.msn\.com$/,
  /anthropic\.com$/,
  /openai\.com$/,
]

export async function reversednsloopup(ip) {
  if(dnsCache.has(ip)) return dnsCache.get(ip);
  try {
    const hostname=await dns.reverse(ip);
    const result=hostname[0]?? null
    dnsCache.set(ip,result)
    return result
  } catch {
    dnsCache.set(ip,null)
    return null
  }
}

export async function isverifiedLegitBot(ip,uaName) {
  if(!uaName) return false;
  const hostname=await reversednsloopup(ip)
  if(!hostname) return false ;
  return LEGITIMATE_BOT_HOSTNAME.some((pattern)=>pattern.test(hostname));
}

export async function aiDetector(req,res,next){
  const ua=req.headers["user-agent"] ?? ""
  const ip=
    req.headers["x-forwarded-for"]?.split(",")[0].trim()??
    req.socket?.remoteAddress ??
    "";

  let totalscore=0;
  let detectedname=null;
  const signals=[];

  const uaMatch=BOT_UA_PATTERNS.find(({pattern})=>pattern.test(ua));
  if (uaMatch) {
    totalscore+=uaMatch.score;
    detectedname=uaMatch.name;
    signals.push(`ua:${uaMatch.name}(${uaMatch.score})`);
  } else if (!ua) {
    totalscore+=60;
    signals.push("ua:missing(60)");
  }

  const hscore=headerScore(req.headers);
  if(hscore>0) {
    totalscore+=hscore;
    signals.push(`headers:suspicious(${hscore})`);
  }

  if (ip&&isDatacenterIP(ip)) {
    totalscore+=30
    signals.push("ip:datacenter(30)");
  }

  let isVerifiedBot=false;
  if (uaMatch && uaMatch.score >= 70) {
    isVerifiedBot=await isverifiedLegitBot(ip,detectedname);
    if (isVerifiedBot) signals.push("rdns:verified")
  }

  const accepthtml=req.headers["accept"]?.includes("text/html");
  if (!accepthtml && req.method === "GET") {
    totalscore+=15;
    signals.push("accept:no-html(15)")
  }

  req.botDetection={
    isBot:totalscore>=70,
    isSuspicious:totalscore>=40 && totalscore<70,
    isverifiedLegitBot:isVerifiedBot,
    score:totalscore,
    botname:detectedname,
    signals,
    ip,
  };

  req.isAI=req.botDetection.isBot;
  req.botname=req.botDetection.botname;

  next();
}