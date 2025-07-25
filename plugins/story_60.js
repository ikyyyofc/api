const axios = require("axios");
const crypto = require("crypto");

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
                // Anda bisa menambahkan validasi lebih lanjut jika diperlukan
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
                console.error("JSON Parse Error:", parseError); // Log kesalahan parsing
                return res.status(400).json({
                    status: false,
                    error: "Invalid JSON data provided"
                });
            }

            // Gunakan Promise.all untuk menjalankan semua txt2vid secara paralel
            // Map setiap item ke sebuah Promise yang memanggil txt2vid
            const videoPromises = get_json.result.map(item =>
                txt2vid(item.prompt, "9:16")
            );

            // Tunggu semua promise selesai
            const videoResults = await Promise.all(videoPromises);

            // Gabungkan hasil dengan data input berdasarkan index untuk menjaga urutan relatif
            // Lalu urutkan berdasarkan properti 'part'
            const combinedAndSortedResults = get_json.result
                .map((item, index) => ({
                    part: item.part,
                    prompt: item.prompt, // Opsional: sertakan prompt jika diperlukan di output
                    url: videoResults[index] // Ambil URL dari hasil txt2vid
                }))
                .sort((a, b) => a.part - b.part); // Urutkan berdasarkan 'part'

            // Kirim respons dengan hasil yang sudah diurutkan
            res.json({ status: true, result: combinedAndSortedResults });
        } catch (error) {
            // Tangkap kesalahan apa pun yang terjadi selama pemrosesan
            console.error("Error processing /create-story request:", error); // Log kesalahan server
            // Kirim respons kesalahan umum ke klien
            res.status(500).json({
                status: false,
                error: "An error occurred while creating the story."
            });
        }
    });
}

module.exports = router;

// Placeholder untuk fungsi txt2vid (diasumsikan sudah ada definisinya)
/*
async function txt2vid(prompt, ratio = "16:9") {
    // ... implementasi txt2vid ...
    // Contoh return untuk simulasi:
    // return { data: { video_url: `http://example.com/video_${prompt.slice(0, 5)}.mp4` } };
}
*/
async function txt2vid(prompt) {
    try {
        const { data: k } = await axios.post(
            "https://soli.aritek.app/txt2videov3",
            {
                deviceID:
                    Math.random().toString(16).substr(2, 8) +
                    Math.random().toString(16).substr(2, 8),
                prompt: prompt,
                used: [],
                versionCode: 51
            },
            {
                headers: {
                    authorization:
                        "eyJzdWIiwsdeOiIyMzQyZmczNHJ0MzR0weMzQiLCJuYW1lIjorwiSm9objMdf0NTM0NT",
                    "content-type": "application/json; charset=utf-8",
                    "accept-encoding": "gzip",
                    "user-agent": "okhttp/4.11.0"
                }
            }
        );

        const { data } = await axios.post(
            "https://soli.aritek.app/video",
            {
                keys: [k.key]
            },
            {
                headers: {
                    authorization:
                        "eyJzdWIiwsdeOiIyMzQyZmczNHJ0MzR0weMzQiLCJuYW1lIjorwiSm9objMdf0NTM0NT",
                    "content-type": "application/json; charset=utf-8",
                    "accept-encoding": "gzip",
                    "user-agent": "okhttp/4.11.0"
                }
            }
        );

        return data.datas[0].url;
    } catch (error) {
        throw new Error(error.message);
    }
}