import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const KEY_FILE = path.join(process.cwd(), 'freepik_apikeys.txt');

export default {
  id: 'freepik-kling-generate',
  name: 'Freepik Kling Generate Task',
  description: 'Membuat task video motion control dengan API Key acak (Auto-remove limit key)',
  method: 'post',
  path: '/api/freepik/generate',
  tags: ['Freepik Kling'],
  parameters: [
    { in: 'body', name: 'image_url', type: 'string', required: true, description: 'URL Gambar publik' },
    { in: 'body', name: 'video_url', type: 'string', required: true, description: 'URL Video publik' },
    { in: 'body', name: 'prompt', type: 'string', required: false, description: 'Prompt opsional' },
    { in: 'body', name: 'character_orientation', type: 'string', required: false, description: 'image atau video (default: video)' }
  ],
  handler: async (req, res) => {
    try {
      const { image_url, video_url, prompt, character_orientation } = req.body;
      if (!image_url || !video_url) {
        return res.status(400).json({ success: false, message: 'image_url dan video_url wajib diisi' });
      }

      let keys = [];
      try {
        const data = await fs.readFile(KEY_FILE, 'utf-8');
        keys = data.split('\n').map(k => k.trim()).filter(k => k);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'File API Key tidak ditemukan. Silakan tambahkan key terlebih dahulu via endpoint /api/freepik/keys.' });
      }

      if (keys.length === 0) {
        return res.status(400).json({ success: false, message: 'Daftar API Key kosong. Silakan tambahkan key baru.' });
      }

      let createRes = null;
      let usedKey = null;
      let removedKeys = [];

      // Coba API Key secara acak
      while (keys.length > 0) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        usedKey = keys[randomIndex];

        try {
          createRes = await axios.post(
            "https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro",
            {
              image_url,
              video_url,
              prompt: prompt || "follow the subject's movements and camera movements with precision. sometimes body parts that should be touching each other become spaced apart due to differences in body size, so try to follow the movements in the video, don't leave any space.",
              cfg_scale: 1,
              character_orientation: character_orientation || "video"
            },
            {
              headers: {
                "Content-Type": "application/json",
                "x-freepik-api-key": usedKey
              }
            }
          );
          break; // Berhasil, keluar dari loop
        } catch (error) {
          const status = error.response?.status;
          // Jika limit (429) atau invalid/unauthorized (401, 403)
          if (status === 401 || status === 403 || status === 429) {
            removedKeys.push({ 
              key: usedKey, 
              reason: status === 429 ? 'Limit API tercapai' : 'API Key tidak valid/diblokir' 
            });
            keys.splice(randomIndex, 1); // Hapus dari array
            await fs.writeFile(KEY_FILE, keys.join('\n')); // Simpan pembaruan ke file
          } else {
            // Error lain (misal 400 Bad Request karena URL gambar salah)
            return res.status(status || 500).json({
              success: false,
              message: 'Gagal melakukan request ke Freepik API',
              error: error.response?.data || error.message,
              feedback_keys_dihapus: removedKeys
            });
          }
        }
      }

      // Jika semua key di file sudah dicoba dan habis
      if (!createRes) {
        return res.status(400).json({
          success: false,
          message: '❌ Semua API Key yang tersimpan telah habis limit atau tidak valid.',
          feedback_keys_dihapus: removedKeys
        });
      }

      // Berhasil membuat task, kembalikan response detail
      return res.json({
        success: true,
        message: '✅ Task berhasil dibuat. Gunakan task_id dan used_api_key untuk melakukan polling status.',
        data: {
          task_id: createRes.data.data.task_id,
          status: createRes.data.data.status,
          used_api_key: usedKey, // Penting: dikembalikan agar user bisa cek status
          freepik_raw_response: createRes.data
        },
        feedback: {
          keys_dihapus_karena_limit: removedKeys,
          sisa_keys_tersedia: keys.length
        }
      });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};