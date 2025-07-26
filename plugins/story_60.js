const axios = require("axios");
const crypto = require("crypto");

const REQUEST_DELAY_MS = 1000;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1000;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function txt2vidWithRetry(
    prompt,
    ratio = "16:9",
    maxRetries = MAX_RETRIES
) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await txt2vid(prompt, ratio);
            return result;
        } catch (error) {
            console.error(
                `[ERROR] txt2vid GAGAL (Percobaan ${attempt}/${maxRetries}) untuk prompt: ${prompt.substring(
                    0,
                    30
                )}... - Error:`,
                error.message || error
            );
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
            if (RETRY_DELAY_MS > 0) {
                await delay(RETRY_DELAY_MS);
            }
        }
    }
    throw new Error(
        "txt2vidWithRetry: Proses retry tidak selesai dengan benar."
    );
}

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
                get_json = JSON.parse(q.data);
                if (!Array.isArray(get_json.result)) {
                    return res.status(400).json({
                        status: false,
                        error: "Invalid data format: 'result' should be an array"
                    });
                }
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

            const videoPromisesWithDelay = [];

            for (let i = 0; i < get_json.result.length; i++) {
                const item = get_json.result[i];

                const delayedPromise = (async () => {
                    if (i > 0) {
                        await delay(REQUEST_DELAY_MS);
                    }
                    return await txt2vidWithRetry(
                        item.prompt,
                        "9:16",
                        MAX_RETRIES
                    );
                })();

                videoPromisesWithDelay.push(delayedPromise);
            }

            const videoResults = await Promise.all(videoPromisesWithDelay);

            const combinedAndSortedResults = get_json.result
                .map((item, index) => ({
                    part: item.part,
                    prompt: item.prompt,
                    url: videoResults[index].data.result_urls[0]
                }))
                .sort((a, b) => a.part - b.part);
            res.json({ status: true, result: combinedAndSortedResults });
        } catch (error) {
            console.error("Error processing /create-story request:", error);
            const errorMessage =
                error.message || "An error occurred while creating the story.";
            res.status(500).json({ status: false, error: errorMessage });
        }
    });
}

module.exports = router;

async function txt2vid(
    prompt,
    { model = "veo-3", auto_sound = false, auto_speech = false } = {}
) {
    try {
        const _model = ["veo-3-fast", "veo-3"];

        if (!prompt) throw new Error("Prompt is required");
        if (!_model.includes(model))
            throw new Error(`Available models: ${_model.join(", ")}`);
        if (typeof auto_sound !== "boolean")
            throw new Error("Auto sound must be a boolean");
        if (typeof auto_speech !== "boolean")
            throw new Error("Auto speech must be a boolean");

        const { data: cf } = await axios.get(
            "https://api.nekorinn.my.id/tools/rynn-stuff",
            {
                params: {
                    mode: "turnstile-min",
                    siteKey: "0x4AAAAAAANuFg_hYO9YJZqo",
                    url: "https://aivideogenerator.me/features/g-ai-video-generator",
                    accessKey:
                        "e2ddc8d3ce8a8fceb9943e60e722018cb23523499b9ac14a8823242e689eefed"
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
                quality: "720p",
                duration: 8,
                autoSoundFlag: auto_sound,
                soundPrompt: "",
                autoSpeechFlag: auto_speech,
                speechPrompt: "",
                speakerId: "Auto",
                aspectRatio: "16:9",
                secondaryPageId: 1811,
                channel: "VEO3",
                source: "aivideogenerator.me",
                type: "features",
                watermarkFlag: true,
                privateFlag: true,
                isTemp: true,
                vipFlag: true,
                model: model
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
    } catch {
        try {
            const _model = ["veo-3-fast", "veo-3"];

            if (!prompt) throw new Error("Prompt is required");
            if (!_model.includes(model))
                throw new Error(`Available models: ${_model.join(", ")}`);
            if (typeof auto_sound !== "boolean")
                throw new Error("Auto sound must be a boolean");
            if (typeof auto_speech !== "boolean")
                throw new Error("Auto speech must be a boolean");

            const { data: cf } = await axios.get(
                "https://api.nekorinn.my.id/tools/rynn-stuff",
                {
                    params: {
                        mode: "turnstile-min",
                        siteKey: "0x4AAAAAAAdJZmNxW54o-Gvd",
                        url: "https://lunaai.video/features/v3-fast",
                        accessKey:
                            "5238b8ad01dd627169d9ac2a6c843613d6225e6d77a6753c75dc5d3f23813653"
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
                    quality: "720p",
                    duration: 8,
                    autoSoundFlag: auto_sound,
                    soundPrompt: "",
                    autoSpeechFlag: auto_speech,
                    speechPrompt: "",
                    speakerId: "Auto",
                    aspectRatio: "16:9",
                    secondaryPageId: 1811,
                    channel: "VEO3",
                    source: "lunaai.video",
                    type: "features",
                    watermarkFlag: true,
                    privateFlag: true,
                    isTemp: true,
                    vipFlag: true,
                    model: model
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
}

function generateRandomPngFilename(length = 50) {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0987654321";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    return result + ".png";
}
