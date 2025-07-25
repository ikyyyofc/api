const axios = require("axios");

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "GET",
                path: "/trendtiktok",
                description: "Get Tiktok Viral"
            }
        ]
    });
    async function get_trend(region) {
        try {
            const trend = await axios.post(
                "https://tikwm.com/api/feed/list",
                "region=" + region
            );
            if (trend.data.length) {
                return trend.data;
            } else {
                return get_trend(region);
            }
        } catch {
            return get_trend(region);
        }
    }
    app.get("/trendtiktok", async (req, res) => {
        if (!req.query.region) {
            return res.status(400).json({
                status: false,
                error: "region parameter is required"
            });
        }

        let trend_data = await get_trend(req.query.region);
        res.json(trend_data);
    });
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    app.post("/covertiktok", async (req, res) => {
        // 1. Validasi input dasar
        if (
            !req.body ||
            !Array.isArray(req.body.data) ||
            req.body.data.length === 0
        ) {
            return res.status(400).json({
                status: false,
                error: "data parameter is required, must be a non-empty array"
            });
        }

        const dataArray = req.body.data;
        const results = []; // Array untuk menyimpan semua hasil
        const delayMs = 10000; // 10 detik delay

        // 2. Iterasi item satu per satu secara sequential
        for (let i = 0; i < dataArray.length; i++) {
            const item = dataArray[i];

            // 3. Validasi item individual
            if (!item || !item.cover) {
                // Jika tidak ada cover, Anda bisa memutuskan:
                // - Melewatkan item ini: continue;
                // - Menyimpan error khusus:
                // results.push({ error: `Item at index ${i} is missing 'cover' property` });
                // - Menyimpan string kosong atau null:
                // results.push({ url: null });
                // Untuk sekarang, kita lewati item yang tidak valid
                console.warn(
                    `Item at index ${i} is missing 'cover' property, skipping.`
                );
                results.push({ url: null }); // Atau url: '' jika lebih disukai
                continue;
            }

            try {
                // 4. Lakukan permintaan ke describeimage
                const describeUrl = `https://api.fasturl.link/aiexperience/describeimage?url=${encodeURIComponent(
                    item.cover
                )}`;
                console.log(
                    `Processing item ${i + 1}/${dataArray.length}: ${
                        item.cover
                    }`
                ); // Log untuk debugging
                const describeResponse = await axios.get(describeUrl);

                // 5. Bangun URL gemini berdasarkan hasil describe
                const geminiUrl = `https://api.fasturl.link/aiimage/gemini?prompt=${encodeURIComponent(
                    describeResponse.data.result
                )}&imageUrl=${encodeURIComponent(item.cover)}`;

                // 6. Simpan hasil sukses
                results.push({ url: geminiUrl });
            } catch (error) {
                // 7. Tangkap error untuk item ini dan ganti dengan URL cover asli
                console.error(
                    `Error processing item at index ${i} (${item.cover}):`,
                    error.message
                );
                // Ganti dengan URL cover asli
                results.push({ url: item.cover });
                // Jika Anda ingin log error tetap ada tapi tidak dikirim ke client:
                // Anda bisa menyimpannya di log saja, atau menambahkan properti tambahan:
                // results.push({ url: item.cover, _processingError: error.message });
            }

            // 8. Terapkan delay SETELAH permintaan (sukses atau gagal)
            // Jangan delay setelah item terakhir
            if (i < dataArray.length - 1) {
                console.log(
                    `Waiting for ${
                        delayMs / 1000
                    } seconds before next request...`
                );
                await delay(delayMs);
            }
        }

        // 9. Semua item telah diproses, kirimkan hasil lengkap
        console.log("All items processed. Sending response.");
        res.json({ status: true, result: results });
    });
}

module.exports = router;
