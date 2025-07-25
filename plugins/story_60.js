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
                 // Anda bisa menambahkan validasi lebih lanjut jika diperlukan
                 const isValidFormat = get_json.result.every(item => typeof item.part === 'number' && typeof item.prompt === 'string');
                 if (!isValidFormat) {
                      return res.status(400).json({ status: false, error: "Invalid item format in 'result' array. Each item must have 'part' (number) and 'prompt' (string)." });
                 }
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError); // Log kesalahan parsing
                return res.status(400).json({ status: false, error: "Invalid JSON data provided" });
            }

            // Gunakan Promise.all untuk menjalankan semua txt2vid secara paralel
            // Map setiap item ke sebuah Promise yang memanggil txt2vid
            const videoPromises = get_json.result.map(item => txt2vid(item.prompt, "9:16"));

             // Tunggu semua promise selesai
            const videoResults = await Promise.all(videoPromises);

            // Gabungkan hasil dengan data input berdasarkan index untuk menjaga urutan relatif
            // Lalu urutkan berdasarkan properti 'part'
            const combinedAndSortedResults = get_json.result
                .map((item, index) => ({
                    part: item.part,
                    prompt: item.prompt, // Opsional: sertakan prompt jika diperlukan di output
                    url: videoResults[index].data.video_url // Ambil URL dari hasil txt2vid
                }))
                .sort((a, b) => a.part - b.part); // Urutkan berdasarkan 'part'

            // Kirim respons dengan hasil yang sudah diurutkan
            res.json({ status: true, result: combinedAndSortedResults });

        } catch (error) {
             // Tangkap kesalahan apa pun yang terjadi selama pemrosesan
            console.error("Error processing /create-story request:", error); // Log kesalahan server
             // Kirim respons kesalahan umum ke klien
            res.status(500).json({ status: false, error: "An error occurred while creating the story." });
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
async function txt2vid(prompt, ratio = "16:9") {
    try {
        const _ratio = ["16:9", "9:16", "1:1", "4:3", "3:4"];

        if (!prompt) throw new Error("Prompt is required");
        if (!_ratio.includes(ratio))
            throw new Error(`Available ratios: ${_ratio.join(", ")}`);

        const { data: cf } = await axios.get(
            "https://api.nekorinn.my.id/tools/rynn-stuff",
            {
                params: {
                    mode: "turnstile-min",
                    siteKey: "0x4AAAAAAATOXAtQtziH-Rwq",
                    url: "https://www.yeschat.ai/features/text-to-video-generator",
                    accessKey:
                        "a40fc14224e8a999aaf0c26739b686abfa4f0b1934cda7fa3b34522b0ed5125d"
                }
            }
        );

        const uid = crypto
            .createHash("md5")
            .update(Date.now().toString())
            .digest("hex");
        const { data: task } = await axios.post(
            "https://aiarticle.erweima.ai/api/v1/secondary-page/api/create",
            {
                prompt: prompt,
                imgUrls: [],
                quality: "540p",
                duration: 5,
                autoSoundFlag: false,
                soundPrompt: "",
                autoSpeechFlag: false,
                speechPrompt: "",
                speakerId: "Auto",
                aspectRatio: ratio,
                secondaryPageId: 388,
                channel: "PIXVERSE",
                source: "yeschat.ai",
                type: "features",
                watermarkFlag: false,
                privateFlag: false,
                isTemp: true,
                vipFlag: false
            },
            {
                headers: {
                    uniqueid: uid,
                    verify: cf.result.token
                }
            }
        );

        while (true) {
            const { data } = await axios.get(
                `https://aiarticle.erweima.ai/api/v1/secondary-page/api/${task.data.recordId}`,
                {
                    headers: {
                        uniqueid: uid,
                        verify: cf.result.token
                    }
                }
            );

            if (data.data.state === "success")
                return JSON.parse(data.data.completeData);
            await new Promise(res => setTimeout(res, 1000));
        }
    } catch (error) {
        throw new Error(error.message);
    }
}
