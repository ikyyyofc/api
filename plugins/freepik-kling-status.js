import axios from 'axios';

export default {
  id: 'freepik-kling-status',
  name: 'Freepik Kling Check Status',
  description: 'Mengecek status task video (Polling manual)',
  method: 'post',
  path: '/api/freepik/status',
  tags: ['Freepik Kling'],
  parameters: [
    { in: 'body', name: 'task_id', type: 'string', required: true, description: 'ID Task dari endpoint generate' },
    { in: 'body', name: 'api_key', type: 'string', required: true, description: 'API Key yang digunakan saat generate (used_api_key)' }
  ],
  handler: async (req, res) => {
    try {
      const { task_id, api_key } = req.body;
      if (!task_id || !api_key) {
        return res.status(400).json({ success: false, message: 'task_id dan api_key wajib diisi' });
      }

      const checkRes = await axios.get(
        `https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro/${task_id}`,
        {
          headers: {
            "x-freepik-api-key": api_key
          }
        }
      );

      const status = checkRes.data.data.status;
      
      let message = '⏳ Task sedang diproses...';
      if (status === 'COMPLETED') message = '✅ Task selesai! Video siap diunduh.';
      else if (status !== 'CREATED' && status !== 'IN_PROGRESS') message = `❌ Task gagal dengan status: ${status}`;

      return res.json({
        success: true,
        message,
        data: checkRes.data.data,
        raw_response: checkRes.data
      });

    } catch (error) {
      return res.status(error.response?.status || 500).json({
        success: false,
        message: 'Gagal mengecek status ke Freepik',
        error: error.response?.data || error.message
      });
    }
  }
};