// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Plugin Manager
class PluginManager {
  constructor() {
    this.endpoints = [];
    this.pluginsDir = path.join(__dirname, 'plugins');
  }

  // Scan folder plugins secara recursive
  async scanDirectory(dir, basePath = '') {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('📁 Folder plugins dibuat');
      return;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursive untuk subfolder
        await this.scanDirectory(fullPath, path.join(basePath, item));
      } else if (item.endsWith('.js')) {
        // Load file plugin
        await this.loadPlugin(fullPath, basePath, item);
      }
    }
  }

  // Load single plugin file
  async loadPlugin(filePath, basePath, fileName) {
    try {
      // Dynamic import dengan timestamp untuk hot reload
      const fileUrl = `file://${filePath}?t=${Date.now()}`;
      const plugin = await import(fileUrl);
      const pluginExport = plugin.default || plugin;

      // Generate endpoint path dari struktur folder
      const pluginName = fileName.replace('.js', '');
      const apiPath = `/api/${basePath}/${pluginName}`.replace(/\/+/g, '/');

      // Support berbagai format export
      if (typeof pluginExport === 'function') {
        // Export function langsung - support GET & POST
        this.registerEndpoint('POST', apiPath, pluginExport, filePath);
        this.registerEndpoint('GET', apiPath, pluginExport, filePath);
      } else if (pluginExport.handler) {
        // Export object dengan handler - support GET & POST juga!
        const metadata = {
          params: pluginExport.params,
          description: pluginExport.description
        };
        
        // Daftar method yang mau di-support (default GET & POST)
        const methods = pluginExport.method 
          ? [pluginExport.method] 
          : pluginExport.methods || ['GET', 'POST'];
        
        methods.forEach(method => {
          this.registerEndpoint(method.toUpperCase(), apiPath, pluginExport.handler, filePath, metadata);
        });
      } else if (pluginExport.get || pluginExport.post) {
        // Export object dengan method specific
        if (pluginExport.get) {
          const metadata = {
            params: pluginExport.get.params || pluginExport.params,
            description: pluginExport.get.description || pluginExport.description
          };
          this.registerEndpoint('GET', apiPath, pluginExport.get.handler || pluginExport.get, filePath, metadata);
        }
        if (pluginExport.post) {
          const metadata = {
            params: pluginExport.post.params || pluginExport.params,
            description: pluginExport.post.description || pluginExport.description
          };
          this.registerEndpoint('POST', apiPath, pluginExport.post.handler || pluginExport.post, filePath, metadata);
        }
        if (pluginExport.put) {
          const metadata = {
            params: pluginExport.put.params || pluginExport.params,
            description: pluginExport.put.description || pluginExport.description
          };
          this.registerEndpoint('PUT', apiPath, pluginExport.put.handler || pluginExport.put, filePath, metadata);
        }
        if (pluginExport.delete) {
          const metadata = {
            params: pluginExport.delete.params || pluginExport.params,
            description: pluginExport.delete.description || pluginExport.description
          };
          this.registerEndpoint('DELETE', apiPath, pluginExport.delete.handler || pluginExport.delete, filePath, metadata);
        }
        if (pluginExport.patch) {
          const metadata = {
            params: pluginExport.patch.params || pluginExport.params,
            description: pluginExport.patch.description || pluginExport.description
          };
          this.registerEndpoint('PATCH', apiPath, pluginExport.patch.handler || pluginExport.patch, filePath, metadata);
        }
      }

    } catch (err) {
      console.error(`❌ Error loading ${filePath}:`, err.message);
    }
  }

  // Register single endpoint
  registerEndpoint(method, apiPath, handler, filePath, metadata = {}) {
    this.endpoints.push({
      method,
      path: apiPath,
      handler,
      file: filePath,
      params: metadata.params || [],
      description: metadata.description || ''
    });
    console.log(`✅ ${method.padEnd(6)} ${apiPath}`);
  }

  // Load semua plugins
  async loadPlugins() {
    this.endpoints = [];
    console.log('\n🔄 Loading plugins...\n');
    await this.scanDirectory(this.pluginsDir);
    console.log(`\n📦 Total endpoints loaded: ${this.endpoints.length}\n`);
  }

  // Register semua endpoints ke Express
  registerRoutes(app) {
    this.endpoints.forEach(({ method, path, handler }) => {
      app[method.toLowerCase()](path, async (req, res) => {
        try {
          const result = await handler(req, res);
          
          // Jika handler sudah send response, skip
          if (!res.headersSent) {
            res.json({
              success: true,
              data: result
            });
          }
        } catch (err) {
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: err.message
            });
          }
        }
      });
    });
  }
}

// Initialize Plugin Manager
const pluginManager = new PluginManager();
await pluginManager.loadPlugins();
pluginManager.registerRoutes(app);

// Endpoint untuk list semua endpoints
app.get('/api', (req, res) => {
  const grouped = {};
  
  pluginManager.endpoints.forEach(({ method, path, file, params, description }) => {
    const category = path.split('/')[2] || 'root';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({
      method,
      path,
      file: file.replace(pluginManager.pluginsDir, 'plugins'),
      params: params || [],
      description: description || ''
    });
  });

  res.json({
    success: true,
    total: pluginManager.endpoints.length,
    endpoints: grouped
  });
});

// Serve static files untuk UI
app.use(express.static('public'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    hint: 'Check GET /api for available endpoints'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API Documentation: http://localhost:${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api\n`);
});

// ============================================
// CONTOH STRUKTUR PLUGIN (ES MODULES)
// ============================================

// 📁 plugins/ai/chat.js
// Format PALING SIMPEL - Auto support GET & POST!
/*
export default {
  description: 'Chat with AI assistant',
  params: [
    { name: 'message', type: 'string', required: true, description: 'Your message to AI' },
    { name: 'userId', type: 'string', required: false, description: 'Optional user ID' }
  ],
  handler: async (req, res) => {
    const { message, userId } = req.body || req.query;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'message is required'
      });
    }
    
    return {
      response: `You said: ${message}`,
      model: 'gpt-3.5-turbo',
      userId: userId || 'anonymous'
    };
  }
};
*/

// 📁 plugins/test/example.js
// Contoh persis kayak yang lu minta!
/*
export default {
  description: "jemput",
  params: [
    { name: "ah", type: "string", required: true, description: "kontol" }
  ],
  handler: async (req, res) => {
    return {
      dancok: "make it harder to see underneath did we ever know?"
    };
  }
};
*/

// ============================================
// OPSI LAIN: Kalo mau spesifik method aja
// ============================================

// Kalo mau POST aja
/*
export default {
  method: 'POST',  // atau methods: ['POST']
  description: 'Only POST',
  params: [...],
  handler: async (req, res) => { }
};
*/

// Kalo mau multiple specific methods
/*
export default {
  methods: ['POST', 'PUT', 'PATCH'],  // support 3 method ini
  description: 'Multiple methods',
  params: [...],
  handler: async (req, res) => { }
};
*/

// ============================================
// FORMAT LAMA MASIH TETEP WORK
// ============================================

// 📁 plugins/ai/image.js  
// Export dengan method specific tetep bisa
/*
export const post = {
  description: 'Generate AI image',
  params: [
    { name: 'prompt', type: 'string', required: true, description: 'Image prompt' }
  ],
  handler: async (req, res) => {
    const { prompt } = req.body;
    return {
      image_url: 'https://example.com/generated.jpg',
      prompt
    };
  }
};
*/

// 📁 plugins/downloader/youtube.js
// Function langsung juga masih bisa (auto GET & POST)
/*
export default async (req, res) => {
  const { url } = req.body || req.query;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL required'
    });
  }
  
  return {
    title: 'Video Title',
    download_url: 'https://example.com/video.mp4',
    quality: '720p'
  };
};
*/

// 📁 plugins/sticker/create.js
// Multiple method dengan shared params
/*
export const description = 'Create WhatsApp sticker';
export const params = [
  { name: 'image_url', type: 'string', required: true, description: 'Image URL' }
];

export const get = {
  handler: async (req, res) => {
    return {
      info: 'Send POST with image_url',
      formats: ['jpg', 'png', 'webp']
    };
  }
};

export const post = {
  handler: async (req, res) => {
    const { image_url } = req.body;
    return {
      sticker_url: 'https://example.com/sticker.webp',
      size: '512x512'
    };
  }
};
*/

// 📁 plugins/tools/qrcode.js
// Super simpel - default GET & POST
/*
export default {
  description: 'Generate QR code',
  params: [
    { name: 'text', type: 'string', required: true, description: 'Text to encode' },
    { name: 'size', type: 'number', required: false, description: 'QR size in pixels' }
  ],
  handler: async (req, res) => {
    const { text, size = 300 } = req.body || req.query;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }
    
    return {
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(text)}&size=${size}x${size}`,
      text,
      size
    };
  }
};
*/