import fs from 'fs/promises';
import path from 'path';

const KEY_FILE = path.join(process.cwd(), 'freepik_apikeys.txt');

export default {
  id: 'freepik-key-manager',
  name: 'Freepik API Key Manager',
  description: 'Menambahkan banyak API Key Freepik sekaligus ke dalam sistem',
  method: 'post',
  path: '/api/freepik/keys',
  tags: ['Freepik Kling'],
  parameters: [
    { in: 'body', name: 'keys', type: 'string', required: true, description: 'Masukkan API Key (pisahkan dengan koma jika lebih dari satu)' }
  ],
  handler: async (req, res) => {
    try {
      let { keys } = req.body;
      if (!keys) return res.status(400).json({ success: false, message: 'Parameter keys wajib diisi' });

      // Pisahkan berdasarkan koma, spasi, atau baris baru
      const newKeys = keys.split(/[,|\n\s]+/).map(k => k.trim()).filter(k => k);

      if (newKeys.length === 0) {
        return res.status(400).json({ success: false, message: 'Format keys tidak valid' });
      }

      let existingKeys = [];
      try {
        const data = await fs.readFile(KEY_FILE, 'utf-8');
        existingKeys = data.split('\n').map(k => k.trim()).filter(k => k);
      } catch (err) {
        // File belum ada, abaikan (akan dibuat baru)
      }

      // Gabungkan dan hapus duplikat
      const mergedKeys = [...new Set([...existingKeys, ...newKeys])];
      await fs.writeFile(KEY_FILE, mergedKeys.join('\n'));

      return res.json({
        success: true,
        message: `✅ ${newKeys.length} API Key berhasil ditambahkan.`,
        total_keys_tersimpan: mergedKeys.length
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};