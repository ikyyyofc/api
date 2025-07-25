const axios = require("axios");
const crypto = require("crypto");

// --- Konfigurasi ---
const REQUEST_DELAY_MS = 5000; // Delay antar permintaan awal (milidetik)
const MAX_RETRIES = 5;        // Jumlah maksimum percobaan ulang untuk setiap permintaan txt2vid
const RETRY_DELAY_MS = 2500;  // Delay antar percobaan ulang (milidetik)
// --- Akhir Konfigurasi ---

// Fungsi utilitas untuk membuat delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fungsi pembungkus txt2vid dengan mekanisme retry
async function txt2vidWithRetry(prompt, ratio = "16:9", maxRetries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // console.log(`[DEBUG] Mencoba txt2vid (Percobaan ${attempt}/${maxRetries}) untuk prompt: ${prompt.substring(0, 30)}...`);
            const result = await txt2vid(prompt, ratio); // Panggil fungsi txt2vid asli
            // console.log(`[DEBUG] txt2vid BERHASIL (Percobaan ${attempt}/${maxRetries})`);
            return result; // Jika berhasil, kembalikan hasil
        } catch (error) {
            console.error(`[ERROR] txt2vid GAGAL (Percobaan ${attempt}/${maxRetries}) untuk prompt: ${prompt.substring(0, 30)}... - Error:`, error.message || error);
            // Jika ini adalah percobaan terakhir, lempar error
            if (attempt === maxRetries) {
                console.error(`[ERROR] Semua percobaan untuk prompt '${prompt.substring(0, 30)}...' telah gagal.`);
                throw new Error(`Gagal setelah ${maxRetries} percobaan: ${error.message || error}`);
            }
            // Jika bukan percobaan terakhir, tunggu sejenak sebelum mencoba lagi
            if (RETRY_DELAY_MS > 0) {
                // console.log(`[DEBUG] Menunggu ${RETRY_DELAY_MS}ms sebelum mencoba lagi...`);
                await delay(RETRY_DELAY_MS);
            }
        }
    }
    // Baris ini seharusnya tidak tercapai karena throw di atas, tapi sebagai jaga-jaga
    throw new Error("txt2vidWithRetry: Proses retry tidak selesai dengan benar.");
}

// Asumsikan fungsi txt2vid didefinisikan di sini atau diimpor
// async function txt2vid(prompt, ratio = "16:9") { ... }

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "POST",
                path: "/create-story",
                description: "create story"
            }
        ]
    });

    app.post("/create-story", async (req, res) => {
        try {
            let q = req.body;
            // Validasi awal
            if (!q || !q.data) {
                return res.status(400).json({ status: false, error: "Missing data in request body" });
            }

            let get_json;
            try {
                // Parsing JSON
                get_json = JSON.parse(q.data);
                // Validasi struktur data
                if (!Array.isArray(get_json.result)) {
                    return res.status(400).json({ status: false, error: "Invalid data format: 'result' should be an array" });
                }
                // Validasi bahwa setiap item memiliki 'part' dan 'prompt'
                const isValidFormat = get_json.result.every(item => typeof item.part === 'number' && typeof item.prompt === 'string');
                if (!isValidFormat) {
                    return res.status(400).json({ status: false, error: "Invalid item format in 'result' array. Each item must have 'part' (number) and 'prompt' (string)." });
                }
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError);
                return res.status(400).json({ status: false, error: "Invalid JSON data provided" });
            }

            // Array untuk menyimpan promise-promise dengan delay dan retry
            const videoPromisesWithDelay = [];

            // Buat promise untuk setiap item, dengan delay sebelum memulai
            for (let i = 0; i < get_json.result.length; i++) {
                const item = get_json.result[i];

                // Buat sebuah fungsi async yang mengembalikan promise
                const delayedPromise = (async () => {
                    // Tunggu delay sebelum memulai permintaan untuk item ini (kecuali item pertama)
                    if (i > 0) {
                        await delay(REQUEST_DELAY_MS);
                    }
                    // Panggil txt2vidWithRetry (bukan txt2vid langsung) untuk item ini
                    // Ini akan mencoba ulang secara otomatis jika terjadi error
                    return await txt2vidWithRetry(item.prompt, "9:16", MAX_RETRIES);
                })();

                // Tambahkan promise yang telah 'dijadwalkan' ke array
                videoPromisesWithDelay.push(delayedPromise);
            }

            // Tunggu semua promise selesai (termasuk delay dan retry-nya)
            // Jika suatu promise gagal setelah semua retry, Promise.all akan menolak
            const videoResults = await Promise.all(videoPromisesWithDelay);

            // Gabungkan hasil dengan data input berdasarkan index untuk menjaga urutan relatif
            // Lalu urutkan berdasarkan properti 'part'
            const combinedAndSortedResults = get_json.result
                .map((item, index) => ({
                    part: item.part,
                    prompt: item.prompt,
                    url: videoResults[index].data.video_url // Ambil URL dari hasil txt2vid
                }))
                .sort((a, b) => a.part - b.part); // Urutkan berdasarkan 'part'

            // Kirim respons dengan hasil yang sudah diurutkan
            res.json({ status: true, result: combinedAndSortedResults });

        } catch (error) {
            // Error ini bisa berasal dari:
            // - Validasi awal
            // - Parsing JSON
            // - Salah satu dari txt2vidWithRetry yang gagal setelah semua percobaan
            console.error("Error processing /create-story request:", error);
            // Kirim pesan error yang lebih informatif jika memungkinkan
            const errorMessage = error.message || "An error occurred while creating the story.";
            res.status(500).json({ status: false, error: errorMessage });
        }
    });
}

module.exports = router;

async function txt2vid(prompt, ratio = '16:9') {
    try {
        const _ratio = ['16:9', '9:16', '1:1', '4:3', '3:4'];
        
        if (!prompt) throw new Error('Prompt is required');
        if (!_ratio.includes(ratio)) throw new Error(`Available ratios: ${_ratio.join(', ')}`);
        
        const { data: cf } = await axios.get('https://api.nekorinn.my.id/tools/rynn-stuff', {
            params: {
                mode: 'turnstile-min',
                siteKey: '0x4AAAAAAATOXAtQtziH-Rwq',
                url: 'https://www.yeschat.ai/features/text-to-video-generator',
                accessKey: 'a40fc14224e8a999aaf0c26739b686abfa4f0b1934cda7fa3b34522b0ed5125d'
            }
        });
        
        const uid = crypto.createHash('md5').update(Date.now().toString()).digest('hex');
        const { data: task } = await axios.post('https://aiarticle.erweima.ai/api/v1/secondary-page/api/create', {
            prompt: prompt,
            imgUrls: [],
            quality: '540p',
            duration: 5,
            autoSoundFlag: false,
            soundPrompt: '',
            autoSpeechFlag: false,
            speechPrompt: '',
            speakerId: 'Auto',
            aspectRatio: ratio,
            secondaryPageId: 388,
            channel: 'PIXVERSE',
            source: 'yeschat.ai',
            type: 'features',
            watermarkFlag: false,
            privateFlag: false,
            isTemp: true,
            vipFlag: false
        }, {
            headers: {
                uniqueid: uid,
                verify: cf.result.token
            }
        });
        
        while (true) {
            const { data } = await axios.get(`https://aiarticle.erweima.ai/api/v1/secondary-page/api/${task.data.recordId}`, {
                headers: {
                    uniqueid: uid,
                    verify: cf.result.token
                }
            });
            
            if (data.data.state === 'success') return JSON.parse(data.data.completeData);
            await new Promise(res => setTimeout(res, 1000));
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

// Usage:
const resp = await txt2vid('A handsome 18-year-old Indonesian male villager with a medium, well-proportioned build, healthy warm tan skin, and a modern low fade haircut, wearing a simple fitted plain black cotton t-shirt, plain black jeans, and simple black sneakers, is standing at the edge of a vibrant green rice paddy field, his gaze fixed on the rising sun. The early morning sky is a gradient of soft oranges and purples, with a few wispy clouds. The air is cool and crisp, dew still clinging to the rice stalks. In the distance, traditional Indonesian village houses are silhouetted against the dawn light, and the gentle sounds of the awakening village can be heard. This is a highly detailed, photorealistic render.', "9:16");
return resp