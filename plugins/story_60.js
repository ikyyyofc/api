const axios = require("axios");
const crypto = require("crypto");

const REQUEST_DELAY_MS = 1000;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1000;

// --- Simple in-memory task store (Replace with a database like Redis or MongoDB in production) ---
const taskStore = {};

// --- Helper Functions ---
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateTaskId() {
    return crypto.randomBytes(16).toString('hex');
}

// --- Core Video Generation Logic (txt2vid & txt2vidWithRetry remain largely the same) ---
async function txt2vid(prompt, { model = "veo-3", auto_sound = false, auto_speech = false } = {}) {
    try {
        const _model = ["veo-3-fast", "veo-3"];
        if (!prompt) throw new Error("Prompt is required");
        if (!_model.includes(model))
            throw new Error(`Available models: ${_model.join(", ")}`);
        if (typeof auto_sound !== "boolean")
            throw new Error("Auto sound must be a boolean");
        if (typeof auto_speech !== "boolean")
            throw new Error("Auto speech must be a boolean");

        // --- Attempt 1 ---
        try {
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
                if (data.data.state === "failed") {
                     throw new Error(`API Task failed: ${data.data.message || 'Unknown API error'}`);
                }
                await delay(2000); // Check every 2 seconds
            }
        } catch (primaryError) {
            console.warn("Primary API failed, trying secondary API:", primaryError.message);

            // --- Attempt 2 (Fallback) ---
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
                if (data.data.state === "failed") {
                     throw new Error(`API Task failed: ${data.data.message || 'Unknown API error'}`);
                }
                await delay(2000); // Check every 2 seconds
            }
        }
    } catch (error) {
        console.error("Error in txt2vid:", error.message);
        throw new Error(`Video generation failed: ${error.message}`);
    }
}

async function txt2vidWithRetry(prompt, ratio = "16:9", maxRetries = MAX_RETRIES) {
    // Note: Ratio is not used in txt2vid, but kept for compatibility
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await txt2vid(prompt, { model: "veo-3" }); // Use default model
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

// --- Asynchronous Task Processing (MODIFIED for sequential execution) ---
async function processTask(taskId, storyData) {
     try {
        console.log(`[INFO] Starting processing for task ${taskId}`);
        taskStore[taskId].status = 'processing';

        const videoResults = []; // Array to store results sequentially

        // --- Execute video generation sequentially ---
        for (let i = 0; i < storyData.result.length; i++) {
            const item = storyData.result[i];

            // Add delay before each request (except the first one)
            if (i > 0 && REQUEST_DELAY_MS > 0) {
                console.log(`[INFO] Waiting ${REQUEST_DELAY_MS}ms before next request...`);
                await delay(REQUEST_DELAY_MS);
            }

            console.log(`[INFO] Processing part ${item.part}: ${item.prompt.substring(0, 50)}...`);
            const result = await txt2vidWithRetry(item.prompt, "9:16", MAX_RETRIES);
            videoResults.push(result);
            console.log(`[INFO] Completed part ${item.part}`);
        }
        // --- End of sequential execution ---

        const combinedAndSortedResults = storyData.result
            .map((item, index) => ({
                part: item.part,
                prompt: item.prompt,
                url: videoResults[index].data.result_urls[0] // Assuming the first URL is the video
            }))
            .sort((a, b) => a.part - b.part);

        taskStore[taskId].status = 'completed';
        taskStore[taskId].result = combinedAndSortedResults;
        console.log(`[INFO] Task ${taskId} completed successfully.`);

    } catch (error) {
        console.error(`[ERROR] Task ${taskId} failed:`, error.message);
        taskStore[taskId].status = 'failed';
        taskStore[taskId].error = error.message || "An error occurred during processing.";
    }
}


// --- Router Definition ---
function router(app, routes = [], pluginName) {
    // Registering routes metadata (optional)
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "POST",
                path: "/create-story-task",
                description: "Create a story generation task and return task ID"
            },
            {
                method: "GET",
                path: "/check-story-task/:taskId",
                description: "Check the status of a story generation task by ID"
            }
        ]
    });

    // --- Route 1: Create Story Task ---
    app.post("/create-story-task", async (req, res) => {
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

            // Generate a unique task ID
            const taskId = generateTaskId();

            // Store initial task state
            taskStore[taskId] = {
                id: taskId,
                status: 'pending', // Initially pending
                createdAt: new Date().toISOString(),
                data: get_json, // Store the input data
                result: null, // Will hold the final result
                error: null  // Will hold error message if failed
            };

            // Start the asynchronous processing in the background
             setImmediate(() => {
                 processTask(taskId, get_json).catch(err => console.error("Unhandled error in processTask:", err));
             });

            // Respond immediately with the task ID
            res.status(202).json({
                status: true,
                message: "Task created successfully. Use the task ID to check status.",
                taskId: taskId
            });

        } catch (error) {
            console.error("Error processing /create-story-task request:", error);
            const errorMessage =
                error.message || "An error occurred while creating the story task.";
            res.status(500).json({ status: false, error: errorMessage });
        }
    });

    // --- Route 2: Check Story Task Status ---
    app.get("/check-story-task/:taskId", async (req, res) => {
         try {
             const { taskId } = req.params;

             if (!taskId) {
                 return res.status(400).json({
                     status: false,
                     error: "Task ID is required."
                 });
             }

             const task = taskStore[taskId];

             if (!task) {
                 return res.status(404).json({
                     status: false,
                     error: "Task not found."
                 });
             }

             // Return task status and details
             res.json({
                 status: true,
                 taskId: task.id,
                 status: task.status, // 'pending', 'processing', 'completed', 'failed'
                 createdAt: task.createdAt,
                 // Include result or error based on status
                 ...(task.status === 'completed' && { result: task.result }),
                 ...(task.status === 'failed' && { error: task.error })
             });

         } catch (error) {
             console.error("Error processing /check-story-task request:", error);
             const errorMessage =
                 error.message || "An error occurred while checking the task status.";
             res.status(500).json({ status: false, error: errorMessage });
         }
    });
}

module.exports = router;