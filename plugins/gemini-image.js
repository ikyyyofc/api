import axios from 'axios';
import { fileTypeFromBuffer } from 'file-type';

const CONFIG = {
    GEMINI: {
        URL: "https://us-central1-gemmy-ai-bdc03.cloudfunctions.net/gemini",
        MODEL: "gemini-3.1-flash-image-preview",
        HEADERS: {
            "User-Agent": "okhttp/5.3.2",
            "Accept-Encoding": "gzip",
            "content-type": "application/json; charset=UTF-8"
        }
    }
};

// Fungsi untuk mendapatkan token autentikasi
async function getNewToken() {
    try {
        const response = await axios.post(
            "https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ",
            { clientType: "CLIENT_TYPE_ANDROID" },
            {
                headers: {
                    "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-S9280 Build/AP3A.240905.015.A2)",
                    "Content-Type": "application/json",
                    "X-Android-Package": "com.jetkite.gemmy",
                    "X-Android-Cert": "037CD2976D308B4EFD63EC63C48DC6E7AB7E5AF2",
                    "X-Firebase-GMPID": "1:652803432695:android:c4341db6033e62814f33f2"
                }
            }
        );
        return response.data.idToken;
    } catch {
        return null;
    }
}

// Fungsi utama untuk generate/edit image
async function generateImage(prompt, fileBuffer = null) {
    const token = await getNewToken();
    if (!token) throw new Error("Gagal mendapatkan token autentikasi Gemmy");

    const parts = [{ text: prompt }];

    if (fileBuffer) {
        const detected = await fileTypeFromBuffer(fileBuffer);
        const mimeType = detected?.mime ?? "image/jpeg";
        parts.push({
            inlineData: {
                mimeType,
                data: fileBuffer.toString("base64")
            }
        });
    }

    const payload = {
        model: CONFIG.GEMINI.MODEL,
        request: {
            contents: [{ role: "user", parts }],
            generationConfig: {
                responseModalities: ["IMAGE"]
            }
        },
        stream: false
    };

    const headers = {
        ...CONFIG.GEMINI.HEADERS,
        authorization: `Bearer ${token}`
    };

    const { data } = await axios.post(CONFIG.GEMINI.URL, payload, { headers });

    if (!data?.candidates?.length) {
        throw new Error("No candidates in response");
    }

    const responseParts = data.candidates[0].content.parts;

    const imagePart = responseParts.find(p => p.inlineData?.data);
    if (imagePart) {
        return {
            buffer: Buffer.from(imagePart.inlineData.data, "base64"),
            mimeType: imagePart.inlineData.mimeType ?? "image/png"
        };
    }

    const textPart = responseParts.find(p => p.text);
    throw new Error(textPart?.text ?? "No image in response");
}

// ==========================================
// EXPORT PLUGIN SESUAI ARSITEKTUR
// ==========================================
export default {
  id: 'gemini-image-generator',
  name: 'Gemini Image Generator',
  description: 'Generate atau edit gambar menggunakan Gemini 3.1 Flash Image Preview. Dilengkapi dengan auto-retry jika terjadi kegagalan.',
  method: 'post',
  path: '/api/tools/generate-image',
  tags: ['Image Tools'],
  parameters: [
    { in: 'body', name: 'prompt', type: 'string', required: true, description: 'Deskripsi gambar yang ingin dibuat' },
    { in: 'body', name: 'imageBase64', type: 'string', required: false, description: 'Opsional: Base64 gambar untuk diedit (bisa dengan atau tanpa prefix data:image/...)' }
  ],
  handler: async (req, res) => {
    const { prompt, imageBase64 } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Parameter "prompt" wajib diisi.' });
    }

    let fileBuffer = null;
    if (imageBase64) {
      try {
        // Menghapus prefix "data:image/png;base64," jika dikirim dari frontend
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        fileBuffer = Buffer.from(base64Data, 'base64');
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Format imageBase64 tidak valid.' });
      }
    }

    // Konfigurasi Auto-Retry
    const maxRetries = 5; // Maksimal percobaan ulang
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await generateImage(prompt, fileBuffer);
        
        // Jika berhasil, langsung kembalikan response
        return res.json({
          success: true,
          data: {
            mimeType: result.mimeType,
            base64: result.buffer.toString('base64'),
            imageUrl: `data:${result.mimeType};base64,${result.buffer.toString('base64')}` // Siap pakai di tag <img> HTML
          }
        });
      } catch (error) {
        console.error(`[Generate Image] Attempt ${attempt} failed:`, error.message);
        lastError = error.message;
        
        // Jika belum percobaan terakhir, tunggu 1.5 detik sebelum mencoba lagi
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    // Jika semua percobaan gagal
    return res.status(500).json({ 
      success: false, 
      error: `Gagal menghasilkan gambar setelah ${maxRetries} percobaan.`,
      details: lastError 
    });
  }
};