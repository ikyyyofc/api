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
    { name: "jiashu", host: "https://jiashu.1win.eu.org/" }
];

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
];

// Track proxy yang gagal untuk sementara dihindari
const failedProxies = new Set();

function getRandomProxy() {
    // Filter proxy yang belum gagal
    const available = proxyPool.filter(p => !failedProxies.has(p.name));
    // Kalau semua gagal, reset dan coba lagi dari awal
    if (available.length === 0) {
        failedProxies.clear();
        console.warn("[Global Proxy] ⚠️ Semua proxy gagal, mereset daftar...");
        return proxyPool[Math.floor(Math.random() * proxyPool.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
}

export function setupGlobalProxy() {
    // ✅ Interceptor REQUEST — modifikasi URL sebelum dikirim
    axios.interceptors.request.use(
        config => {
            const url = config.url || "";

            // Bypass: jangan proxy kalau request ke internal/localhost
            const isInternal =
                url.includes("localhost") ||
                url.includes("127.0.0.1") ||
                url.startsWith("/");

            if (isInternal) return config;

            // Bypass: jangan double-proxy kalau URL sudah mengandung proxy host
            const alreadyProxied = proxyPool.some(p => url.startsWith(p.host));
            if (alreadyProxied) return config;

            const proxy = getRandomProxy();
            const randomUA =
                userAgents[Math.floor(Math.random() * userAgents.length)];

            // ✅ FIX UTAMA: Wrap URL target ke dalam CORS proxy
            // Sebelum (salah): config.proxy = { host: proxyUrl }
            // Sesudah (benar): config.url = proxyHost + targetUrl
            config.url = `${proxy.host}${url}`;

            // ✅ Matikan proxy native Axios agar tidak konflik
            config.proxy = false;

            // Sisipkan User-Agent palsu
            config.headers = config.headers || {};
            config.headers["User-Agent"] = randomUA;

            // Simpan nama proxy ke config untuk dipakai di response interceptor
            config.metadata = { proxyName: proxy.name, proxyHost: proxy.host };

            console.log(`[Global Proxy] 🔄 ${proxy.name} → ${url}`);

            return config;
        },
        error => Promise.reject(error)
    );

    // ✅ Interceptor RESPONSE — tandai proxy yang gagal
    axios.interceptors.response.use(
        response => response,
        error => {
            const meta = error.config?.metadata;
            if (meta?.proxyName) {
                failedProxies.add(meta.proxyName);
                console.warn(
                    `[Global Proxy] ❌ Proxy "${meta.proxyName}" gagal, diblokir sementara`
                );
            }
            return Promise.reject(error);
        }
    );

    console.log("🛡️ Global Proxy Manager diaktifkan!");
}
