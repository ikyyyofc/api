// plugins/contoh-plugin.js
import axios from 'axios';

export default {
  id: 'cek-ip',
  name: 'Cek IP Global',
  description: 'Mengecek IP yang digunakan oleh server saat menembak API luar',
  method: 'get',
  path: '/api/tools/cek-ip',
  tags: ['Network'],
  handler: async (req, res) => {
    try {
      // Developer HANYA menulis kode normal ini:
      const response = await axios.get('https://api.ipify.org?format=json');
      
      // Di belakang layar, Axios Interceptor sudah mengganti IP-nya!
      return res.json({ success: true, ip_terdeteksi: response.data.ip });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};