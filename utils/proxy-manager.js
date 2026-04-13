import axios from "axios";

const proxyPool = [
    { name: "caliph", host: "https://cors.caliph.my.id/" },
    { name: "eu", host: "https://cors.eu.org/" },
    { name: "prox", host: "https://prox.26bruunjorl.workers.dev/" },
    { name: "wave", host: "https://plain-wave-6f5f.apis1.workers.dev/" },
    { name: "hill", host: "https://young-hill-815e.apis3.workers.dev/" },
    { name: "icy", host: "https://icy-morning-72e2.apis2.workers.dev/" },
    { name: "fazri", host: "https://cors.fazri.workers.dev/" },
    {
        name: "spring",
        host: "https://spring-night-57a1.3540746063.workers.dev/"
    },
    { name: "sizable", host: "https://cors.sizable.workers.dev/" },
    { name: "jiashu", host: "https://jiashu.1win.eu.org/" },
    {
        name: "artemisandros",
        host: "https://cors.artemisandros.workers.dev/?"
    },
    {
        name: "supershadowcube",
        host: "https://cloudflare-cors-anywhere.supershadowcube.workers.dev/?url="
    },
    {
        name: "prox",
        host: "https://prox.26bruunjorl.workers.dev/"
    },
    {
        name: "wave",
        host: "https://plain-wave-6f5f.apis1.workers.dev/"
    },
    {
        name: "hill",
        host: "https://young-hill-815e.apis3.workers.dev/"
    },
    {
        name: "icy",
        host: "https://icy-morning-72e2.apis2.workers.dev/"
    },
    {
        name: "fazri",
        host: "https://cors.fazri.workers.dev/"
    },
    {
        name: "spring",
        host: "https://spring-night-57a1.3540746063.workers.dev/"
    },
    {
        name: "sizable",
        host: "https://cors.sizable.workers.dev/"
    },
    {
        name: "jiashu",
        host: "https://jiashu.1win.eu.org/"
    }
];

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:56.0) Gecko/20100101 Firefox/56.0",
    "Mozilla/5.0 (Windows NT 6.1; rv:40.0) Gecko/20100101 Firefox/40.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:60.0) Gecko/20100101 Firefox/60.0",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 Edge/14.14393",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36 Edge/92.0.902.62",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.3; WOW64; rv:33.0) Gecko/20100101 Firefox/33.0",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; rv:53.0) Gecko/20100101 Firefox/53.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.2; rv:29.0) Gecko/20100101 Firefox/29.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; rv:29.0) Gecko/20100101 Firefox/29.0",
    "Mozilla/5.0 (Windows NT 6.3; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:45.0) Gecko/20100101 Firefox/45.0",
    "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; AS; Windows NT 6.1; en-US) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36 Edge/12.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36"
];

const failedProxies = new Map();
const COOLDOWN_TIME = 15 * 60 * 1000;

function getRandomProxy() {
    const now = Date.now();

  for (const [name, failedAt] of failedProxies.entries()) {
    if (now - failedAt > COOLDOWN_TIME) {
      failedProxies.delete(name);
      console.log(`[Global Proxy] 🔓 ${name} telah dibuka kembali (masa tunggu 15 menit selesai)`);
    }
  }
const available = proxyPool.filter(p => !failedProxies.has(p.name));

  if (available.length === 0) {
    failedProxies.clear();
    console.warn("[Global Proxy] ⚠️ Semua proxy gagal, mereset paksa daftar...");
    return proxyPool[Math.floor(Math.random() * proxyPool.length)];
  }
    return available[Math.floor(Math.random() * available.length)];
}

export function setupGlobalProxy() {
    axios.interceptors.request.use(
        config => {
            const url = config.url || "";


            const isInternal =
                url.includes("localhost") ||
                url.includes("127.0.0.1") ||
                url.startsWith("/");

            if (isInternal) return config;


            const alreadyProxied = proxyPool.some(p => url.startsWith(p.host));
            if (alreadyProxied) return config;

            const proxy = getRandomProxy();
            const randomUA =
                userAgents[Math.floor(Math.random() * userAgents.length)];


            config.url = `${proxy.host}${url}`;


            config.proxy = false;


            config.headers = config.headers || {};
            config.headers["User-Agent"] = randomUA;


            config.metadata = { proxyName: proxy.name, proxyHost: proxy.host };

            console.log(`[Global Proxy] 🔄 ${proxy.name} → ${url}`);

            return config;
        },
        error => Promise.reject(error)
    );

    axios.interceptors.response.use(
        response => response,
        error => {
            const meta = error.config?.metadata;
            if (meta?.proxyName) {
                failedProxies.set(meta.proxyName, Date.now());
                console.warn(
                    `[Global Proxy] ❌ Proxy "${meta.proxyName}" gagal, diblokir sementara`
                );
            }
            return Promise.reject(error);
        }
    );

    console.log("🛡️ Global Proxy Manager diaktifkan!");
}
