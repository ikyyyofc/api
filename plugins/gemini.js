const axios = require("axios");

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            { method: "POST", path: "/gemini/post", description: "Gemini AI" },
            {
                method: "POST",
                path: "/gemini/prompt",
                description: "Gemini With Prompt"
            }
        ]
    });

    app.post("/gemini/post", async (req, res) => {
        if (!req.body || !req.body.messages) {
            return res.status(400).json({
                status: false,
                error: "body is required"
            });
        }
        let gemini = await chatWithGemini(req.body.messages);

        res.json({ status: true, result: gemini });
    });
    app.post("/gemini/prompt", async (req, res) => {
        if (!req.body || !req.body.user || !req.body.system) {
            return res.status(400).json({
                status: false,
                error: "body system and user is required"
            });
        }
        let gemini = await chatWithGemini([
            { role: "system", content: req.body.system },
            { role: "user", content: req.body.user }
        ]);

        res.json({ status: true, result: gemini });
    });
}

module.exports = router;

class VertexAI {
    constructor() {
        this.api_url = "https://firebasevertexai.googleapis.com/v1beta";
        this.model_url =
            "projects/gemmy-ai-bdc03/locations/us-central1/publishers/google/models";
        this.headers = {
            "content-type": "application/json",
            "x-goog-api-client": "gl-kotlin/2.1.0-ai fire/16.5.0",
            "x-goog-api-key": "AIzaSyD6QwvrvnjU7j-R6fkOghfIVKwtvc7SmLk"
        };
        this.ratio = ["1:1", "3:4", "4:3", "9:16", "16:9"];
        this.model = {
            search: [
                "gemini-2.0-flash",
                "gemini-2.0-flash-001",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite-preview-06-17",
                "gemini-2.5-pro"
            ],
            chat: [
                "gemini-1.5-flash",
                "gemini-1.5-flash-002",
                "gemini-1.5-pro",
                "gemini-1.5-pro-002",
                "gemini-2.0-flash",
                "gemini-2.0-flash-001",
                "gemini-2.0-flash-lite",
                "gemini-2.0-flash-lite-001",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite-preview-06-17",
                "gemini-2.5-pro"
            ],
            image: [
                "imagen-3.0-generate-002",
                "imagen-3.0-generate-001",
                "imagen-3.0-fast-generate-001",
                "imagen-3.0-capability-001",
                "imagen-4.0-generate-preview-06-06",
                "imagen-4.0-fast-generate-preview-06-06",
                "imagen-4.0-ultra-generate-preview-06-06"
            ]
        };
    }

    // Method lama tetap ada untuk backward compatibility
    async chat(
        question,
        {
            model = "gemini-1.5-flash",
            system_instruction = null,
            file_buffer = null,
            search = false
        } = {}
    ) {
        if (!question) throw new Error("Question is required");
        if (!this.model.chat.includes(model))
            throw new Error(`Available models: ${this.model.chat.join(", ")}`);
        if (search && !this.model.search.includes(model))
            throw new Error(
                `Available search models: ${this.model.search.join(", ")}`
            );

        const parts = [{ text: question }];
        if (file_buffer) {
            const { mime } = await fileTypeFromBuffer(file_buffer);
            parts.unshift({
                inlineData: {
                    mimeType: mime,
                    data: file_buffer.toString("base64")
                }
            });
        }

        const r = await axios.post(
            `${this.api_url}/${this.model_url}/${model}:generateContent`,
            {
                model: `${this.model_url}/${model}`,
                contents: [
                    ...(system_instruction
                        ? [
                              {
                                  role: "model",
                                  parts: [{ text: system_instruction }]
                              }
                          ]
                        : []),
                    {
                        role: "user",
                        parts: parts
                    }
                ],
                ...(search
                    ? {
                          tools: [
                              {
                                  googleSearch: {}
                              }
                          ]
                      }
                    : {})
            },
            {
                headers: this.headers
            }
        );

        if (r.status !== 200) throw new Error("No result found");
        return r.data.candidates;
    }

    // Method baru dengan format messages OpenAI-style
    async chatWithMessages(
        messages,
        { model = "gemini-1.5-flash", search = false } = {}
    ) {
        if (!messages || !Array.isArray(messages))
            throw new Error("Messages must be an array");
        if (messages.length === 0)
            throw new Error("Messages array cannot be empty");
        if (!this.model.chat.includes(model))
            throw new Error(`Available models: ${this.model.chat.join(", ")}`);
        if (search && !this.model.search.includes(model))
            throw new Error(
                `Available search models: ${this.model.search.join(", ")}`
            );

        const contents = [];

        for (const message of messages) {
            let geminiRole;
            switch (message.role) {
                case "system":
                    // System message akan dimasukkan sebagai model response pertama
                    geminiRole = "model";
                    break;
                case "user":
                    geminiRole = "user";
                    break;
                case "assistant":
                    geminiRole = "model";
                    break;
                default:
                    throw new Error(
                        `Unsupported role: ${message.role}. Use 'system', 'user', or 'assistant'`
                    );
            }

            // Handle file buffer jika ada di content
            let parts = [];
            if (typeof message.content === "string") {
                parts = [{ text: message.content }];
            } else if (Array.isArray(message.content)) {
                // Support untuk multi-modal content
                for (const content of message.content) {
                    if (content.type === "text") {
                        parts.push({ text: content.text });
                    } else if (content.type === "image_url") {
                        // Jika ada base64 image
                        const base64Data = content.image_url.url.split(",")[1];
                        parts.push({
                            inlineData: {
                                mimeType:
                                    content.image_url.mime || "image/jpeg",
                                data: base64Data
                            }
                        });
                    }
                }
            } else {
                parts = [{ text: String(message.content) }];
            }

            contents.push({
                role: geminiRole,
                parts: parts
            });
        }

        const r = await axios.post(
            `${this.api_url}/${this.model_url}/${model}:generateContent`,
            {
                model: `${this.model_url}/${model}`,
                contents: contents,
                ...(search
                    ? {
                          tools: [
                              {
                                  googleSearch: {}
                              }
                          ]
                      }
                    : {})
            },
            {
                headers: this.headers
            }
        );

        if (r.status !== 200) throw new Error("No result found");
        return r.data.candidates;
    }

    async image(
        prompt,
        { model = "imagen-3.0-generate-002", aspect_ratio = "1:1" } = {}
    ) {
        if (!prompt) throw new Error("Prompt is required");
        if (!this.model.image.includes(model))
            throw new Error(`Available models: ${this.model.image.join(", ")}`);
        if (!this.ratio.includes(aspect_ratio))
            throw new Error(`Available ratios: ${this.ratio.join(", ")}`);

        const r = await axios.post(
            `${this.api_url}/${this.model_url}/${model}:predict`,
            {
                instances: [
                    {
                        prompt: prompt
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    includeRaiReason: true,
                    aspectRatio: aspect_ratio,
                    safetySetting: "block_only_high",
                    personGeneration: "allow_adult",
                    addWatermark: false,
                    imageOutputOptions: {
                        mimeType: "image/jpeg",
                        compressionQuality: 100
                    }
                }
            },
            {
                headers: this.headers
            }
        );

        if (r.status !== 200) throw new Error("No result found");
        return r.data.predictions;
    }
}

let chatWithGemini = async (data_msg, newMsg) => {
    try {
        const v = new VertexAI();
        const resp = await v.chatWithMessages(data_msg, {
            model: "gemini-2.5-pro",
            search: true
        });
        return resp[0].content.parts[resp[0].content.parts.length - 1].text;
    } catch (er) {
        console.error(er);
        return chatWithGPT(data_msg);
    }
};
