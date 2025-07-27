const axios = require("axios");

function router(app, routes = [], pluginName) {
    // Menyimpan informasi route
    routes.push({
        plugin: pluginName, // Menggunakan nama file sebagai nama plugin
        endpoints: [
            {
                method: "POST",
                path: "/chatgpt/post",
                description: "Post text data"
            }
        ]
    });

    app.post("/chatgpt/post", async (req, res) => {
        if (!req.body || !req.body.user || !req.body.system) {
            return res.status(400).json({
                status: false,
                error: "body is required"
            });
        }

        const resp = await chatai(req.body.user, {
            system_prompt: req.body.system,
            model: "gpt-4.1"
        });

        res.json({
            status: true,
            result: resp.response
        });
    });
}

module.exports = router;

async function chatai(
    question,
    { system_prompt = null, model = "grok-3-mini" } = {}
) {
    try {
        const _model = [
            "gpt-4.1-nano",
            "gpt-4.1-mini",
            "gpt-4.1",
            "o4-mini",
            "deepseek-r1",
            "deepseek-v3",
            "claude-3.7",
            "gemini-2.0",
            "grok-3-mini",
            "qwen-qwq-32b",
            "gpt-4o",
            "o3",
            "gpt-4o-mini",
            "llama-3.3"
        ];

        if (!question) throw new Error("Question is required");
        if (!_model.includes(model))
            throw new Error(`Available models: ${_model.join(", ")}`);

        const { data } = await axios.post(
            "https://api.appzone.tech/v1/chat/completions",
            {
                messages: [
                    ...(system_prompt
                        ? [
                              {
                                  role: "system",
                                  content: [
                                      {
                                          type: "text",
                                          text: system_prompt
                                      }
                                  ]
                              }
                          ]
                        : []),
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: question
                            }
                        ]
                    }
                ],
                model: model,
                isSubscribed: true
            },
            {
                headers: {
                    authorization: "Bearer az-chatai-key",
                    "content-type": "application/json",
                    "user-agent": "okhttp/4.9.2",
                    "x-app-version": "3.0",
                    "x-requested-with": "XMLHttpRequest",
                    "x-user-id":
                        "$RCAnonymousID:84947a7a4141450385bfd07a66c3b5c4"
                }
            }
        );

        let fullText = "";
        const lines = data.split("\n\n").map(line => line.substring(6));
        for (const line of lines) {
            if (line === "[DONE]") continue;
            try {
                const d = JSON.parse(line);
                fullText += d.choices[0].delta.content;
            } catch (e) {}
        }

        const thinkMatch = fullText.match(/([\s\S]*?)<\/think>/);
        return {
            think: thinkMatch ? thinkMatch[1].trim() : "",
            response: fullText.replace(/[\s\S]*?<\/think>/, "").trim()
        };
    } catch (error) {
        throw new Error(error.message);
    }
}
