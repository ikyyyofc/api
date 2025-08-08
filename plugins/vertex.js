const vertexAIInstance = require("../lib/vertexAI");
const multer = require("multer");
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fieldSize: 10 * 1024 * 1024 // 10MB, atau sesuaikan
    }
});

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            { method: "POST", path: "/vertex/chat", description: "vertex ai" }
        ]
    });

    app.post("/vertex/chat", upload.none(), async (req, res) => {
        try {
            const system = req.body.system;
            const message = req.body.message;

            let history = [];
            if (req.body.history) {
                try {
                    history = JSON.parse(req.body.history);
                } catch (parseError) {
                    console.warn(
                        "Gagal mem-parsing history, menggunakan array kosong:",
                        parseError.message
                    );
                }
            }

            // --- fileBuffer dari FormData sudah berupa string base64 ---
            const file_buffer_base64 =
                req.body.fileBuffer !== "null" ? req.body.fileBuffer : null;

            if (!message && !file_buffer_base64) {
                return res
                    .status(400)
                    .json({ error: "Message or file is required" });
            }

            const selectedModel = "gemini-2.5-pro";

            const enableSearch = true;

            const result = await vertexAIInstance.chat(message, {
                model: selectedModel,
                system_instruction: system,
                history: history,
                file_buffer_base64: file_buffer_base64, // Gunakan string base64 langsung
                search: enableSearch
            });

            return res.status(200).json(result);
        } catch (error) {
            console.error("Error di API route /vertex/chat:", error);
            return res
                .status(500)
                .json({ error: error.message || "Internal Server Error" });
        }
    });
}

module.exports = router;
