import axios from "axios";

// 1. Daftar Proxy Pool (Bisa diganti dengan proxy berbayar Anda)
const proxyPool = [
    {
        name: "caliph",
        host: "https://cors.caliph.my.id/"
    },
    {
        name: "eu",
        host: "https://cors.eu.org/"
    },
    {
        name: "rpoxy",
        host: "https://rpoxy.apis6.workers.dev/"
    },
    {
        name: "prox",
        host: "https://prox.26bruunjorl.workers.dev/"
    },
    {
        name: "aged",
        host: "https://aged-hill-ab3a.apis4.workers.dev/"
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

// 2. Daftar User-Agent untuk menyamarkan identitas server
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
];

export function setupGlobalProxy() {
    // Mencegat semua request yang menggunakan Axios
    axios.interceptors.request.use(
        config => {
            // Opsional: Jangan gunakan proxy jika request ke localhost atau internal API Anda sendiri
            if (
                config.url &&
                (config.url.includes("localhost") ||
                    config.url.includes("127.0.0.1"))
            ) {
                return config;
            }

            // Pilih Proxy dan User-Agent secara acak
            const randomProxy =
                proxyPool[Math.floor(Math.random() * proxyPool.length)];
            const randomUA =
                userAgents[Math.floor(Math.random() * userAgents.length)];

            // Sisipkan konfigurasi proxy ke dalam request
            config.proxy = {
                protocol: "https",
                host: randomProxy.host
                // auth: { username: 'user', password: 'pwd' } // Buka komentar ini jika pakai proxy berbayar
            };

            // Sisipkan User-Agent palsu
            config.headers["User-Agent"] = randomUA;

            // Log untuk memantau di terminal (Bisa dihapus jika tidak perlu)
            console.log(
                `[Global Proxy] 🔄 Merotasi IP ke ${randomProxy.host} untuk tujuan: ${config.url}`
            );

            return config;
        },
        error => {
            return Promise.reject(error);
        }
    );

    console.log("🛡️ Global Proxy Manager diaktifkan!");
}
