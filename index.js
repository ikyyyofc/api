// index.js
const PluginBasedAPI = require('./server');

// Inisialisasi API
const api = new PluginBasedAPI();

// Secara otomatis memuat semua plugin dari folder plugins
api.loadPlugins();

// Menjalankan server
const PORT = process.env.PORT || 3000;
api.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log('Plugins yang aktif:', api.plugins);
});