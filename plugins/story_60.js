const axios = require("axios");
const crypto = require("crypto");

// --- Konfigurasi ---
const REQUEST_DELAY_MS = 1000; // Delay antar permintaan awal (milidetik)
const MAX_RETRIES = 10; // Jumlah maksimum percobaan ulang untuk setiap permintaan txt2vid
const RETRY_DELAY_MS = 1000; // Delay antar percobaan ulang (milidetik)
// --- Akhir Konfigurasi ---

// Fungsi utilitas untuk membuat delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fungsi pembungkus txt2vid dengan mekanisme retry
async function txt2vidWithRetry(
    prompt,
    ratio = "16:9",
    maxRetries = MAX_RETRIES
) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // console.log(`[DEBUG] Mencoba txt2vid (Percobaan ${attempt}/${maxRetries}) untuk prompt: ${prompt.substring(0, 30)}...`);
            const result = await txt2vid(prompt, ratio); // Panggil fungsi txt2vid asli
            // console.log(`[DEBUG] txt2vid BERHASIL (Percobaan ${attempt}/${maxRetries})`);
            return result; // Jika berhasil, kembalikan hasil
        } catch (error) {
            console.error(
                `[ERROR] txt2vid GAGAL (Percobaan ${attempt}/${maxRetries}) untuk prompt: ${prompt.substring(
                    0,
                    30
                )}... - Error:`,
                error.message || error
            );
            // Jika ini adalah percobaan terakhir, lempar error
            if (attempt === maxRetries) {
                console.error(
                    `[ERROR] Semua percobaan untuk prompt '${prompt.substring(
                        0,
                        30
                    )}...' telah gagal.`
                );
                throw new Error(
                    `Gagal setelah ${maxRetries} percobaan: ${
                        error.message || error
                    }`
                );
            }
            // Jika bukan percobaan terakhir, tunggu sejenak sebelum mencoba lagi
            if (RETRY_DELAY_MS > 0) {
                // console.log(`[DEBUG] Menunggu ${RETRY_DELAY_MS}ms sebelum mencoba lagi...`);
                await delay(RETRY_DELAY_MS);
            }
        }
    }
    // Baris ini seharusnya tidak tercapai karena throw di atas, tapi sebagai jaga-jaga
    throw new Error(
        "txt2vidWithRetry: Proses retry tidak selesai dengan benar."
    );
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
                return res.status(400).json({
                    status: false,
                    error: "Missing data in request body"
                });
            }

            let get_json;
            try {
                // Parsing JSON
                get_json = JSON.parse(q.data);
                // Validasi struktur data
                if (!Array.isArray(get_json.result)) {
                    return res.status(400).json({
                        status: false,
                        error: "Invalid data format: 'result' should be an array"
                    });
                }
                // Validasi bahwa setiap item memiliki 'part' dan 'prompt'
                const isValidFormat = get_json.result.every(
                    item =>
                        typeof item.part === "number" &&
                        typeof item.prompt === "string"
                );
                if (!isValidFormat) {
                    return res.status(400).json({
                        status: false,
                        error: "Invalid item format in 'result' array. Each item must have 'part' (number) and 'prompt' (string)."
                    });
                }
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError);
                return res.status(400).json({
                    status: false,
                    error: "Invalid JSON data provided"
                });
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
                    return await txt2vidWithRetry(
                        item.prompt,
                        "9:16",
                        MAX_RETRIES
                    );
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
            const errorMessage =
                error.message || "An error occurred while creating the story.";
            res.status(500).json({ status: false, error: errorMessage });
        }
    });
}

module.exports = router;

async function txt2vid(prompt) {
    try {
        const req = await axios.post(
            `https://ikyy-api.hf.space/aiimage`,
            {
                prompt: prompt
            },
            { responseType: "arraybuffer" }
        );

        return req.data;
    } catch (error) {
        throw new Error(error.message);
    }
}
