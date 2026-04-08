import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chatAI from './utils/ai-engine.js'; // Mengimpor engine AI

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Setup direktori statis untuk Frontend Chatbot
app.use(express.static(path.join(__dirname, 'public')));

app.use(helmet({
  // Menonaktifkan CSP agar CDN UI Chatbot (Tailwind/Markedjs) bisa dimuat
  contentSecurityPolicy: false, 
}));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const swaggerDocument = {
  openapi: '3.0.0',
  info: { title: 'Modular Tools API', version: '1.0.0', description: 'Auto-loaded Plugins API' },
  paths: {}
};

// ==========================================
// 1. AUTO-LOADER PLUGIN
// ==========================================
async function loadPlugins() {
  const pluginsDir = path.join(__dirname, 'plugins');
  try {
    // Buat folder jika belum ada
    await fs.mkdir(pluginsDir, { recursive: true });
    const files = await fs.readdir(pluginsDir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const pluginPath = `file://${path.join(pluginsDir, file)}`;
        const module = await import(pluginPath);
        const plugin = module.default;

        if (plugin && plugin.path && plugin.method && plugin.handler) {
          app[plugin.method](plugin.path, plugin.handler);
          
          const pathDoc = {
            summary: plugin.name, description: plugin.description, tags: plugin.tags,
            responses: { '200': { description: 'Berhasil' } }
          };

          if (plugin.parameters && plugin.parameters.length > 0) {
            const queryParams = plugin.parameters.filter(p => p.in === 'query');
            const bodyParams = plugin.parameters.filter(p => p.in === 'body');

            if (queryParams.length > 0) {
              pathDoc.parameters = queryParams.map(p => ({ ...p, schema: { type: p.type } }));
            }
            if (bodyParams.length > 0) {
              const properties = {}; const required = [];
              bodyParams.forEach(p => { properties[p.name] = { type: p.type, description: p.description }; if (p.required) required.push(p.name); });
              pathDoc.requestBody = { required: true, content: { 'application/json': { schema: { type: 'object', properties, required } } } };
            }
          }
          if (!swaggerDocument.paths[plugin.path]) swaggerDocument.paths[plugin.path] = {};
          swaggerDocument.paths[plugin.path][plugin.method] = pathDoc;
        }
      }
    }
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (error) { console.error('Error memuat plugin:', error); }
}

// ==========================================
// 2. ENDPOINT CHATBOT DEVELOPER
// ==========================================

// Membaca source code untuk konteks AI System
async function getRepoContext() {
  try {
    const serverCode = await fs.readFile(path.join(__dirname, 'server.js'), 'utf-8');
    const pkgCode = await fs.readFile(path.join(__dirname, 'package.json'), 'utf-8');
    return `
=== Arsitektur server.js ===
${serverCode}

=== package.json ===
${pkgCode}
    `;
  } catch (err) {
    return "Gagal membaca konteks repositori.";
  }
}

// Endpoint pemrosesan pesan Chat
app.post('/api/dev/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Format pesan tidak valid" });

  try {
    const repoContext = await getRepoContext();
    const systemPrompt = `
Anda adalah AI Asisten Khusus Developer (DevBot) untuk proyek Modular REST API.
Tugas utama Anda adalah membantu developer membuat plugin baru.

Konteks Repositori Saat Ini (Tanpa isi folder plugins):
${repoContext}

=== CONTOH BASE PLUGIN (Format Wajib) ===
export default {
  id: 'contoh-plugin',
  name: 'Nama Fitur',
  description: 'Deskripsi fitur API',
  method: 'post', // get, post, put, delete
  path: '/api/tools/contoh',
  tags: ['Kategori Tools'],
  parameters: [
    { in: 'body', name: 'prompt', type: 'string', required: true, description: 'Contoh input' }
  ],
  handler: async (req, res) => {
    // Logika fitur
    return res.json({ success: true, data: "Hello World" });
  }
};
========================================

Gunakan informasi di atas untuk memandu developer, menuliskan kode plugin secara utuh sesuai arsitektur, dan memecahkan masalah.
    `.trim();

    // Pastikan prompt sistem selalu berada di urutan pertama
    const aiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    
    // Kirim ke engine AI
    const replyText = await chatAI(aiMessages);
    
    res.json({ reply: replyText });
  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: error.message || "Gagal menghubungi AI." });
  }
});


// ==========================================
// 3. JALANKAN SERVER
// ==========================================
app.get('/', (req, res) => res.redirect('/dev-chat.html'));

loadPlugins().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📚 Buka UI Swagger di http://localhost:${PORT}/docs`);
    console.log(`🤖 Buka Developer Chatbot di http://localhost:${PORT}/dev-chat.html`);
  });
});