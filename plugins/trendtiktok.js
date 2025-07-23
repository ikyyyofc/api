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

    app.get("/trendtiktok", async (req, res) => {
        if (!req.query.region) {
            return res.status(400).json({
                status: false,
                error: "region parameter is required"
            });
        }

        const trend = await axios.post(
            "https://tikwm.com/api/feed/list",
            "region=" + req.query.region
        );

        res.json(trend.data.data);
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
                results.push({
                    error: `Item at index ${i} is missing 'cover' property`
                });
                // Jangan return/error di sini, lanjutkan ke item berikutnya
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
                // 7. Tangkap error untuk item ini dan simpan
                console.error(
                    `Error processing item at index ${i} (${item.cover}):`,
                    error.message
                );
                results.push({
                    error:
                        error.message || `Failed to process item at index ${i}`
                });
                // Lanjutkan ke item berikutnya setelah menangkap error
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
