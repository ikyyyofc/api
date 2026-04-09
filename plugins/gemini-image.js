import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname untuk ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Generate / edit image dengan Gemini 3 Pro Image (Nano Banana Pro)
 */
async function generateImage(prompt, fileBuffer = null) {
    const token = await getNewToken();
    if (!token) throw new Error("Gagal mendapatkan token autentikasi Gemmy");

    const parts = [{ text: prompt }];

    if (fileBuffer) {
        const { fileTypeFromBuffer } = await import("file-type");
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
    description: 'Generate gambar menggunakan Gemini 3.1 Flash Image Preview dengan sistem auto-retry.',
    method: 'post',
    path: '/api/tools/generate-image',
    tags: ['AI Tools', 'Image'],
    parameters: [
        { in: 'body', name: 'prompt', type: 'string', required: true, description: 'Deskripsi gambar yang ingin dibuat' }
    ],
    handler: async (req, res) => {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, error: "Parameter 'prompt' wajib diisi." });
        }

        let attempt = 0;
        const maxAttempts = 10; // Batas maksimal percobaan agar tidak infinite loop
        let result = null;

        // 1. Sistem Retry (Ulangi sampai berhasil / batas maksimal)
        while (attempt < maxAttempts) {
            try {
                attempt++;
                console.log(`[Gemini Image] Mencoba generate gambar (Percobaan ${attempt})...`);
                result = await generateImage(prompt);
                break; // Jika berhasil, keluar dari loop
            } catch (error) {
                console.error(`[Gemini Image] Percobaan ${attempt} gagal:`, error.message);
                if (attempt >= maxAttempts) {
                    return res.status(500).json({ 
                        success: false, 
                        error: `Gagal menghasilkan gambar setelah ${maxAttempts} kali percobaan.` 
                    });
                }
                // Jeda 1.5 detik sebelum mencoba lagi untuk menghindari rate-limit
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // 2. Simpan gambar dan buat URL
        try {
            // Arahkan ke folder public/images di root project
            const publicDir = path.join(__dirname, '..', 'public', 'images');
            
            // Buat folder jika belum ada
            await fs.mkdir(publicDir, { recursive: true });

            // Tentukan ekstensi file dan nama file unik
            const ext = result.mimeType.split('/')[1] || 'png';
            const filename = `gemini_${Date.now()}.${ext}`;
            const filepath = path.join(publicDir, filename);

            // Tulis buffer ke dalam file
            await fs.writeFile(filepath, result.buffer);

            // Buat URL yang bisa diakses publik
            const imageUrl = `${req.protocol}://${req.get('host')}/images/${filename}`;

            return res.json({
                success: true,
                message: "Gambar berhasil dibuat!",
                data: {
                    prompt: prompt,
                    imageUrl: imageUrl,
                    mimeType: result.mimeType,
                    attempts: attempt
                }
            });
        } catch (err) {
            console.error("[Gemini Image] Error menyimpan gambar:", err);
            return res.status(500).json({ success: false, error: "Gagal menyimpan gambar ke server." });
        }
    }
};