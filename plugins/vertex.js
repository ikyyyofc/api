const vertexAIInstance = require("../lib/vertexAI");

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            { method: "POST", path: "/vertex/chat", description: "vertex ai" }
        ]
    });

    // POST /api/chat
    app.post("/vertex/chat", async (req, res) => {
        try {
            const { system, message, history, fileBuffer } = req.body;

            if (!message && !fileBuffer) {
                return res
                    .status(400)
                    .json({ error: "Message or file is required" });
            }

            // Selalu pake reasoning mode
            const selectedModel = "gemini-2.5-pro";

            // Search selalu aktif
            const enableSearch = true;

            const result = await vertexAIInstance.chat(message, {
                model: selectedModel,
                system_instruction: system,
                history: history,
                file_buffer_base64: fileBuffer,
                search: enableSearch
            });

            return res.status(200).json(result);
        } catch (error) {
            console.error("Error di API route /api/chat:", error);
            return res
                .status(500)
                .json({ error: error.message || "Internal Server Error" });
        }
    });
}

module.exports = router;