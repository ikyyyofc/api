const multer = require("multer");
const vertexAIInstance = require("../lib/vertexAI");

const upload = multer(); // pake memory storage

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            { method: "POST", path: "/vertex/chat", description: "vertex ai" }
        ]
    });

    app.post("/vertex/chat", upload.single("file"), async (req, res) => {
        try {
            const { system, message, history } = req.body;
            const file = req.file;

            // validasi input
            if (!message && !file) {
                return res
                    .status(400)
                    .json({ error: "Message or file is required" });
            }

            // encode file ke base64 kalo ada
            let fileBufferBase64 = null;
            if (file) {
                fileBufferBase64 = file.buffer.toString("base64");
            }

            const selectedModel = "gemini-2.5-pro";
            const enableSearch = true;

            const result = await vertexAIInstance.chat(message, {
                model: selectedModel,
                system_instruction: system,
                history: history ? JSON.parse(history) : undefined,
                file_buffer_base64: fileBufferBase64,
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