// server.js
const express = require('express');
const path = require('path');

class PluginBasedAPI {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public'))); // Menyajikan file statis
    this.plugins = [];
    this.routes = []; // Menyimpan informasi route
  }

  // Method untuk menambahkan plugin
  addPlugin(plugin) {
    if (typeof plugin === 'function') {
      plugin(this.app, this.routes); // Melewatkan routes array ke plugin
      this.plugins.push(plugin.name || 'Anonymous Plugin');
      console.log(`Plugin added: ${plugin.name || 'Anonymous Plugin'}`);
    } else {
      console.error('Invalid plugin: Plugin must be a function');
    }
  }

  // Method untuk menjalankan server
  listen(port, callback) {
    // Endpoint untuk mendapatkan informasi plugin dan route
    this.app.get('/api/plugins', (req, res) => {
      res.json({
        plugins: this.plugins,
        routes: this.routes
      });
    });

    // Route default untuk mengarahkan ke UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    this.app.listen(port, callback);
  }
}

module.exports = PluginBasedAPI;