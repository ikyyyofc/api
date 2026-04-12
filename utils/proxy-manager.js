import axios from 'axios';

// 1. Daftar Proxy Pool (Bisa diganti dengan proxy berbayar Anda)
const proxyPool = [
  { host: '103.152.118.162', port: 80 },
  { host: '198.49.68.80', port: 80 },
  { host: '8.210.83.33', port: 80 },
  // Tambahkan daftar proxy lainnya di sini...
];

// 2. Daftar User-Agent untuk menyamarkan identitas server
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
];

export function setupGlobalProxy() {
  // Mencegat semua request yang menggunakan Axios
  axios.interceptors.request.use(
    (config) => {
      // Opsional: Jangan gunakan proxy jika request ke localhost atau internal API Anda sendiri
      if (config.url && (config.url.includes('localhost') || config.url.includes('127.0.0.1'))) {
        return config;
      }

      // Pilih Proxy dan User-Agent secara acak
      const randomProxy = proxyPool[Math.floor(Math.random() * proxyPool.length)];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

      // Sisipkan konfigurasi proxy ke dalam request
      config.proxy = {
        protocol: 'http',
        host: randomProxy.host,
        port: randomProxy.port,
        // auth: { username: 'user', password: 'pwd' } // Buka komentar ini jika pakai proxy berbayar
      };

      // Sisipkan User-Agent palsu
      config.headers['User-Agent'] = randomUA;

      // Log untuk memantau di terminal (Bisa dihapus jika tidak perlu)
      console.log(`[Global Proxy] 🔄 Merotasi IP ke ${randomProxy.host}:${randomProxy.port} untuk tujuan: ${config.url}`);

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  
  console.log('🛡️ Global Proxy Manager diaktifkan!');
}