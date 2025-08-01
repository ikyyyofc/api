const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

app.post("/vertex/chat", upload.single("file"), async (req, res) => {
    const { system, message, history } = req.body;
    const file = req.file;

    const fileBufferBase64 = file ? file.buffer.toString("base64") : null;

    const result = await vertexAIInstance.chat(message, {
        model: "gemini-2.5-pro",
        system_instruction: system,
        history: history ? JSON.parse(history) : undefined,
        file_buffer_base64: fileBufferBase64,
        search: true
    });

    return res.status(200).json(result);
});

module.exports = router;