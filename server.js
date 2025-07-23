// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

class PluginManager {
  constructor(app) {
    this.app = app;
    this.plugins = new Map();
    this.pluginsDir = '/app/plugins';
  }

  // Load semua plugin dari folder plugins
  async loadPlugins() {
    try {
      // Buat folder plugins jika belum ada
      if (!fs.existsSync(this.pluginsDir)) {
        fs.mkdirSync(this.pluginsDir);
        console.log('📁 Folder plugins dibuat');
      }

      const files = fs.readdirSync(this.pluginsDir);
      const pluginFiles = files.filter(file => file.endsWith('.js'));

      for (const file of pluginFiles) {
        await this.loadPlugin(file);
      }

      console.log(`✅ Berhasil memuat ${this.plugins.size} plugin(s)`);
    } catch (error) {
      console.error('❌ Error loading plugins:', error.message);
    }
  }

  // Load plugin individual
  async loadPlugin(filename) {
    try {
      const pluginPath = path.join(this.pluginsDir, filename);
      
      // Hapus cache untuk hot reload
      delete require.cache[require.resolve(pluginPath)];
      
      const plugin = require(pluginPath);
      
      // Validasi plugin
      if (!plugin.name) {
        throw new Error(`Plugin ${filename} harus memiliki properti 'name'`);
      }

      if (!plugin.routes || !Array.isArray(plugin.routes)) {
        throw new Error(`Plugin ${filename} harus memiliki properti 'routes' berupa array`);
      }

      // Register routes
      plugin.routes.forEach(route => {
        this.registerRoute(route, plugin.name);
      });

      this.plugins.set(plugin.name, {
        ...plugin,
        filename,
        loadedAt: new Date()
      });

      console.log(`🔌 Plugin "${plugin.name}" dimuat dari ${filename}`);
    } catch (error) {
      console.error(`❌ Error loading plugin ${filename}:`, error.message);
    }
  }

  // Register route ke Express
  registerRoute(route, pluginName) {
    const { method, path: routePath, handler, middleware = [] } = route;

    if (!method || !routePath || !handler) {
      throw new Error(`Route tidak valid di plugin ${pluginName}`);
    }

    // Pastikan method adalah lowercase
    const httpMethod = method.toLowerCase();

    // Validasi HTTP method
    const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    if (!validMethods.includes(httpMethod)) {
      throw new Error(`HTTP method "${method}" tidak valid di plugin ${pluginName}`);
    }

    // Register route dengan middleware
    this.app[httpMethod](routePath, ...middleware, (req, res, next) => {
      try {
        handler(req, res, next);
      } catch (error) {
        console.error(`❌ Error di route ${routePath}:`, error.message);
        res.status(500).json({ 
          error: 'Internal server error',
          plugin: pluginName 
        });
      }
    });

    console.log(`📍 Route ${method.toUpperCase()} ${routePath} didaftarkan oleh plugin ${pluginName}`);
  }

  // Reload plugin tertentu
  async reloadPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      await this.loadPlugin(plugin.filename);
      console.log(`🔄 Plugin "${pluginName}" direload`);
    } else {
      console.log(`❌ Plugin "${pluginName}" tidak ditemukan`);
    }
  }

  // Unload plugin
  unloadPlugin(pluginName) {
    if (this.plugins.has(pluginName)) {
      this.plugins.delete(pluginName);
      console.log(`🗑️ Plugin "${pluginName}" dihapus`);
      // Note: Routes yang sudah diregister tetap aktif sampai server restart
    }
  }

  // Get info semua plugin
  getPluginsInfo() {
    const info = [];
    this.plugins.forEach((plugin, name) => {
      info.push({
        name: name,
        description: plugin.description || 'No description',
        version: plugin.version || '1.0.0',
        filename: plugin.filename,
        loadedAt: plugin.loadedAt,
        routes: plugin.routes.map(r => ({
          method: r.method,
          path: r.path
        }))
      });
    });
    return info;
  }
}

// Inisialisasi Express
const app = express();
const PORT = process.env.PORT || 7680;

// Middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files untuk UI
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Inisialisasi Plugin Manager
const pluginManager = new PluginManager(app);

// Route untuk manajemen plugin
app.get('/plugins', (req, res) => {
  res.json({
    message: 'Plugin information',
    plugins: pluginManager.getPluginsInfo()
  });
});

app.post('/plugins/:name/reload', async (req, res) => {
  const { name } = req.params;
  await pluginManager.reloadPlugin(name);
  res.json({ message: `Plugin ${name} direload` });
});

// Route default
app.get('/', (req, res) => {
  res.json({
    message: 'Plugin-based REST API',
    version: '1.0.0',
    endpoints: {
      plugins: 'GET /plugins - Lihat info semua plugin',
      reload: 'POST /plugins/:name/reload - Reload plugin tertentu'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server
async function startServer() {
  try {
    // Load semua plugin
    await pluginManager.loadPlugins();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Server berjalan di http://localhost:${PORT}`);
      console.log(`🎨 Web Interface: http://localhost:${PORT}`);
      console.log(`📁 Plugin directory: ${pluginManager.pluginsDir}`);
      console.log('📖 API Endpoint untuk melihat plugin: GET /plugins\n');
    });
  } catch (error) {
    console.error('❌ Gagal start server:', error.message);
  }
}

startServer();

// Export untuk testing
module.exports = { app, pluginManager };