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
    app.post("/covertiktok", async (req, res) => {
    // 1. Validasi input dasar
    if (!req.body || !Array.isArray(req.body.data) || req.body.data.length === 0) {
        return res.status(400).json({
            status: false,
            error: "data parameter is required, must be a non-empty array"
        });
    }

    const dataArray = req.body.data;
    const results = []; // Array untuk menyimpan semua hasil

    // 2. Buat array promise untuk setiap item
    const promises = dataArray.map(async (item, index) => {
        // 3. Validasi item individual
        if (!item || !item.cover) {
             // Simpan error untuk item ini dalam results
             results[index] = { error: "Item missing 'cover' property" };
             return; // Resolve promise ini
        }

        try {
            // 4. Lakukan permintaan ke describeimage
            // Encode URI untuk keamanan
            const describeUrl = `https://api.fasturl.link/aiexperience/describeimage?url=${encodeURIComponent(item.cover)}`;
            const describeResponse = await axios.get(describeUrl);

            // 5. Bangun URL gemini berdasarkan hasil describe
            const geminiUrl = `https://api.fasturl.link/aiimage/gemini?prompt=${encodeURIComponent(describeResponse.data.result)}&imageUrl=${encodeURIComponent(item.cover)}`;

            // 6. Simpan hasil sukses ke index yang sesuai
            results[index] = { url: geminiUrl };

        } catch (error) {
            // 7. Tangkap error untuk item ini dan simpan di results
            console.error(`Error processing item at index ${index}:`, error.message);
            results[index] = { error: error.message || "Failed to process item" };
            // Promise ini tetap resolve, hanya hasilnya yang menunjukkan error
        }
    });

    try {
        // 8. Tunggu semua promise selesai (resolve)
        // Promise.allSettled akan menunggu semua, baik fulfilled/rejected
        // Tapi karena kita bungkus error di dalam map, kita bisa pakai Promise.all biasa
        // atau lebih aman gunakan allSettled
        await Promise.allSettled(promises); // Tunggu semua promise selesai

        // 9. Setelah semua selesai, kirimkan hasil penuh
        res.json({ status: true, result: results }); // results sekarang berisi semua data/error

    } catch (unexpectedError) {
        // Ini seharusnya tidak terjadi karena error ditangkap di map
        // Tapi tetap baik untuk berjaga-jaga
        console.error("Unexpected error in Promise.all:", unexpectedError);
        res.status(500).json({ status: false, error: "Internal server error" });
    }
});

}

module.exports = router;

const delay = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
