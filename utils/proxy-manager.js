import axios from "axios";

// 1. Menghapus data duplikat di proxyPool
const proxyPool = [
    { name: "caliph", host: "https://cors.caliph.my.id/" },
    { name: "eu", host: "https://cors.eu.org/" },
    { name: "prox", host: "https://prox.26bruunjorl.workers.dev/" },
    { name: "wave", host: "https://plain-wave-6f5f.apis1.workers.dev/" },
    { name: "hill", host: "https://young-hill-815e.apis3.workers.dev/" },
    { name: "icy", host: "https://icy-morning-72e2.apis2.workers.dev/" },
    { name: "fazri", host: "https://cors.fazri.workers.dev/" },
    { name: "spring", host: "https://spring-night-57a1.3540746063.workers.dev/" },
    { name: "sizable", host: "https://cors.sizable.workers.dev/" },
    { name: "jiashu", host: "https://jiashu.1win.eu.org/" },
    { name: "artemisandros", host: "https://cors.artemisandros.workers.dev/?" },
    { name: "supershadowcube", host: "https://cloudflare-cors-anywhere.supershadowcube.workers.dev/?url=" }
];

const userAgents = [
    // ... (daftar user-agent kamu biarkan sama)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

const failedProxies = new Map();
const COOLDOWN_TIME = 15 * 60 * 1000;

function getRandomProxy() {
    const now = Date.now();

    for (const [name, failedAt] of failedProxies.entries()) {
        if (now - failedAt > COOLDOWN_TIME) {
            failedProxies.delete(name);
            console.log(`[Global Proxy] 🔓 ${name} telah dibuka kembali`);
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
            // Hindari infinite loop pada saat auto-retry
            if (config._isProxied) return config;

            const url = config.url || "";
            const isInternal = url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("/");

            if (isInternal) return config;

            const alreadyProxied = proxyPool.some(p => url.startsWith(p.host));
            if (alreadyProxied) return config;

            const proxy = getRandomProxy();
            const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            // 2. Perbaikan URL Encoding berdasarkan format proxy
            if (proxy.host.endsWith("=") || proxy.host.endsWith("?")) {
                config.url = `${proxy.host}${encodeURIComponent(url)}`;
            } else {
                config.url = `${proxy.host}${url}`;
            }

            config.proxy = false;
            config.headers = config.headers || {};
            
            // Catatan: Ini akan diabaikan oleh browser, tapi berguna di Node.js
            config.headers["User-Agent"] = randomUA;

            config.metadata = { proxyName: proxy.name, proxyHost: proxy.host, originalUrl: url };
            config._isProxied = true; // Flag untuk retry

            console.log(`[Global Proxy] 🔄 ${proxy.name} → ${url}`);

            return config;
        },
        error => Promise.reject(error)
    );

    axios.interceptors.response.use(
        response => response,
        async error => {
            const config = error.config;
            const meta = config?.metadata;
            
            if (meta?.proxyName && !config._retryAttempted) {
                // Tandai proxy gagal
                failedProxies.set(meta.proxyName, Date.now());
                console.warn(`[Global Proxy] ❌ Proxy "${meta.proxyName}" gagal, diblokir sementara.`);

                // 3. Mekanisme Auto-Retry (Mencoba 1x lagi dengan proxy berbeda)
                config._retryAttempted = true;
                config._isProxied = false; // Reset agar dicegat ulang oleh request interceptor
                config.url = meta.originalUrl; // Kembalikan ke URL asli

                console.log(`[Global Proxy] 🔄 Mencoba ulang request ke ${meta.originalUrl}...`);
                return axios(config); // Coba request ulang
            }
            
            return Promise.reject(error);
        }
    );

    console.log("🛡️ Global Proxy Manager diaktifkan!");
}
