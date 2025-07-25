const axios = require("axios");
const crypto = require("crypto");

// --- Konfigurasi ---
const REQUEST_DELAY_MS = 1000; // Delay antar permintaan awal (milidetik)
const MAX_RETRIES = 10;        // Jumlah maksimum percobaan ulang untuk setiap permintaan txt2vid
const RETRY_DELAY_MS = 1000;  // Delay antar percobaan ulang (milidetik)
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
                    url: videoResults[index] // Ambil URL dari hasil txt2vid
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

class VertexAI {
    constructor() {
        this.api_url = "https://firebasevertexai.googleapis.com/v1beta";
        this.model_url =
            "projects/gemmy-ai-bdc03/locations/us-central1/publishers/google/models";
        this.headers = {
            "content-type": "application/json",
            "x-goog-api-client": "gl-kotlin/2.1.0-ai fire/16.5.0",
            "x-goog-api-key": "AIzaSyD6QwvrvnjU7j-R6fkOghfIVKwtvc7SmLk"
        };
        this.ratio = ["1:1", "3:4", "4:3", "9:16", "16:9"];
        this.model = {
            search: [
                "gemini-2.0-flash",
                "gemini-2.0-flash-001",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite-preview-06-17",
                "gemini-2.5-pro"
            ],
            chat: [
                "gemini-1.5-flash",
                "gemini-1.5-flash-002",
                "gemini-1.5-pro",
                "gemini-1.5-pro-002",
                "gemini-2.0-flash",
                "gemini-2.0-flash-001",
                "gemini-2.0-flash-lite",
                "gemini-2.0-flash-lite-001",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite-preview-06-17",
                "gemini-2.5-pro"
            ],
            image: [
                "imagen-3.0-generate-002",
                "imagen-3.0-generate-001",
                "imagen-3.0-fast-generate-001",
                "imagen-3.0-capability-001",
                "imagen-4.0-generate-preview-06-06",
                "imagen-4.0-fast-generate-preview-06-06",
                "imagen-4.0-ultra-generate-preview-06-06"
            ]
        };
    }

    // Method lama tetap ada untuk backward compatibility
    async chat(
        question,
        {
            model = "gemini-1.5-flash",
            system_instruction = null,
            file_buffer = null,
            search = false
        } = {}
    ) {
        if (!question) throw new Error("Question is required");
        if (!this.model.chat.includes(model))
            throw new Error(`Available models: ${this.model.chat.join(", ")}`);
        if (search && !this.model.search.includes(model))
            throw new Error(
                `Available search models: ${this.model.search.join(", ")}`
            );

        const parts = [{ text: question }];
        if (file_buffer) {
            const { mime } = await fileTypeFromBuffer(file_buffer);
            parts.unshift({
                inlineData: {
                    mimeType: mime,
                    data: file_buffer.toString("base64")
                }
            });
        }

        const r = await axios.post(
            `${this.api_url}/${this.model_url}/${model}:generateContent`,
            {
                model: `${this.model_url}/${model}`,
                contents: [
                    ...(system_instruction
                        ? [
                              {
                                  role: "model",
                                  parts: [{ text: system_instruction }]
                              }
                          ]
                        : []),
                    {
                        role: "user",
                        parts: parts
                    }
                ],
                ...(search
                    ? {
                          tools: [
                              {
                                  googleSearch: {}
                              }
                          ]
                      }
                    : {})
            },
            {
                headers: this.headers
            }
        );

        if (r.status !== 200) throw new Error("No result found");
        return r.data.candidates;
    }

    // Method baru dengan format messages OpenAI-style
    async chatWithMessages(
        messages,
        { model = "gemini-1.5-flash", search = false } = {}
    ) {
        if (!messages || !Array.isArray(messages))
            throw new Error("Messages must be an array");
        if (messages.length === 0)
            throw new Error("Messages array cannot be empty");
        if (!this.model.chat.includes(model))
            throw new Error(`Available models: ${this.model.chat.join(", ")}`);
        if (search && !this.model.search.includes(model))
            throw new Error(
                `Available search models: ${this.model.search.join(", ")}`
            );

        const contents = [];

        for (const message of messages) {
            let geminiRole;
            switch (message.role) {
                case "system":
                    // System message akan dimasukkan sebagai model response pertama
                    geminiRole = "model";
                    break;
                case "user":
                    geminiRole = "user";
                    break;
                case "assistant":
                    geminiRole = "model";
                    break;
                default:
                    throw new Error(
                        `Unsupported role: ${message.role}. Use 'system', 'user', or 'assistant'`
                    );
            }

            // Handle file buffer jika ada di content
            let parts = [];
            if (typeof message.content === "string") {
                parts = [{ text: message.content }];
            } else if (Array.isArray(message.content)) {
                // Support untuk multi-modal content
                for (const content of message.content) {
                    if (content.type === "text") {
                        parts.push({ text: content.text });
                    } else if (content.type === "image_url") {
                        // Jika ada base64 image
                        const base64Data = content.image_url.url.split(",")[1];
                        parts.push({
                            inlineData: {
                                mimeType:
                                    content.image_url.mime || "image/jpeg",
                                data: base64Data
                            }
                        });
                    }
                }
            } else {
                parts = [{ text: String(message.content) }];
            }

            contents.push({
                role: geminiRole,
                parts: parts
            });
        }

        const r = await axios.post(
            `${this.api_url}/${this.model_url}/${model}:generateContent`,
            {
                model: `${this.model_url}/${model}`,
                contents: contents,
                ...(search
                    ? {
                          tools: [
                              {
                                  googleSearch: {}
                              }
                          ]
                      }
                    : {})
            },
            {
                headers: this.headers
            }
        );

        if (r.status !== 200) throw new Error("No result found");
        return r.data.candidates;
    }

    async image(
        prompt,
        { model = "imagen-3.0-generate-002", aspect_ratio = "1:1" } = {}
    ) {
        if (!prompt) throw new Error("Prompt is required");
        if (!this.model.image.includes(model))
            throw new Error(`Available models: ${this.model.image.join(", ")}`);
        if (!this.ratio.includes(aspect_ratio))
            throw new Error(`Available ratios: ${this.ratio.join(", ")}`);

        const r = await axios.post(
            `${this.api_url}/${this.model_url}/${model}:predict`,
            {
                instances: [
                    {
                        prompt: prompt
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    includeRaiReason: true,
                    aspectRatio: aspect_ratio,
                    safetySetting: "block_only_high",
                    personGeneration: "allow_adult",
                    addWatermark: false,
                    imageOutputOptions: {
                        mimeType: "image/jpeg",
                        compressionQuality: 100
                    }
                }
            },
            {
                headers: this.headers
            }
        );

        if (r.status !== 200) throw new Error("No result found");
        return r.data.predictions;
    }
}

async function txt2vid(prompt) {
    try {
        const { data: k } = await axios.post('https://soli.aritek.app/txt2videov3', {
            deviceID: Math.random().toString(16).substr(2, 8) + Math.random().toString(16).substr(2, 8),
            prompt: prompt,
            used: [],
            versionCode: 51
        }, {
            headers: {
                authorization: 'eyJzdWIiwsdeOiIyMzQyZmczNHJ0MzR0weMzQiLCJuYW1lIjorwiSm9objMdf0NTM0NT',
                'content-type': 'application/json; charset=utf-8',
                'accept-encoding': 'gzip',
                'user-agent': 'okhttp/4.11.0'
            }
        });
        
        const { data } = await axios.post('https://soli.aritek.app/video', {
            keys: [k.key]
        }, {
            headers: {
                authorization: 'eyJzdWIiwsdeOiIyMzQyZmczNHJ0MzR0weMzQiLCJuYW1lIjorwiSm9objMdf0NTM0NT',
                'content-type': 'application/json; charset=utf-8',
                'accept-encoding': 'gzip',
                'user-agent': 'okhttp/4.11.0'
            }
        });
        
        return data.datas[0].url;
    } catch (error) {
        throw new Error(error.message);
    }
}