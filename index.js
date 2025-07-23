// index.js
const PluginBasedAPI = require('./server');
const userPlugin = require('./plugins/userPlugin');
const productPlugin = require('./plugins/productPlugin');

// Inisialisasi API
const api = new PluginBasedAPI();

// Menambahkan plugin
api.addPlugin(userPlugin);
api.addPlugin(productPlugin);

// Menjalankan server
const PORT = process.env.PORT || 3000;
api.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log('Plugins yang aktif:', api.plugins);
});