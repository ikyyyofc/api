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
            // --- Ambil data dari FormData (req.body) ---
            const system = req.body.system;
            const message = req.body.message;

            // --- Parsing history dari string JSON ---
            let history = [];
            if (req.body.history) {
                try {
                    history = JSON.parse(req.body.history);
                } catch (parseError) {
                    console.warn(
                        "Gagal mem-parsing history, menggunakan array kosong:",
                        parseError.message
                    );
                    // Bisa return error jika format wajib benar
                    // return res.status(400).json({ error: "Invalid JSON format for history" });
                }
            }

            // --- fileBuffer dari FormData sudah berupa string base64 ---
            const file_buffer_base64 = req.body.fileBuffer;

            if (!message && !file_buffer_base64) {
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
                history: history, // Gunakan history yang sudah diparse
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
