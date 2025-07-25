const axios = require("axios");

function router(app, routes = [], pluginName) {
    // Menyimpan informasi route
    routes.push({
        plugin: pluginName, // Menggunakan nama file sebagai nama plugin
        endpoints: [
            { method: "POST", path: "/chatgpt/post", description: "Post text data" }
        ]
    });

    app.post("/chatgpt/post", async (req, res) => {
        if (!req.body) {
            return res.status(400).json({
                status: false,
                error: "body is required"
            });
        }

        const ai = await askAI(req.body);

        res.json(ai);
    });
}

module.exports = router;

// Komentar: Pastikan axios dan fungsi estimateTokens didefinisikan di tempat lain

const INTERNAL_MODEL_ID = "claude-3-sonnet";
const DISPLAYED_MODEL_NAME = "claude-3-5-sonnet";

async function askAI(body, options = {}) {
    const { model, messages, max_tokens, temperature, user, ...rest } =
        body || {};

    // Validasi messages
    if (!messages) {
        return Promise.reject(
            createOpenAIError(
                "Missing required parameter: messages.",
                "invalid_request_error",
                "messages"
            )
        );
    }

    if (!Array.isArray(messages)) {
        return Promise.reject(
            createOpenAIError(
                "'messages' must be an array.",
                "invalid_request_error",
                "messages",
                "messages_type_invalid"
            )
        );
    }

    if (messages.length === 0) {
        return Promise.reject(
            createOpenAIError(
                "'messages' array must not be empty.",
                "invalid_request_error",
                "messages",
                "messages_empty"
            )
        );
    }

    // Validasi setiap pesan dalam array
    for (const [index, msg] of messages.entries()) {
        if (!msg || typeof msg !== "object") {
            return Promise.reject(
                createOpenAIError(
                    `Message at index ${index} must be an object.`,
                    "invalid_request_error",
                    `messages[${index}]`,
                    "message_not_object"
                )
            );
        }
        if (!msg.role || typeof msg.role !== "string") {
            return Promise.reject(
                createOpenAIError(
                    `Message at index ${index} must have a 'role' field of type string.`,
                    "invalid_request_error",
                    `messages[${index}].role`,
                    "message_role_missing"
                )
            );
        }
        // Perbaikan: Tambahkan validasi role yang valid
        if (!["system", "user", "assistant"].includes(msg.role)) {
             return Promise.reject(
                createOpenAIError(
                    `Message at index ${index} has an invalid 'role'. Valid roles are 'system', 'user', or 'assistant'.`,
                    "invalid_request_error",
                    `messages[${index}].role`,
                    "message_role_invalid"
                )
            );
        }
        if (typeof msg.content !== "string") {
            return Promise.reject(
                createOpenAIError(
                    `Message at index ${index} must have a 'content' field of type string.`,
                    "invalid_request_error",
                    `messages[${index}].content`,
                    "message_content_type_invalid"
                )
            );
        }
    }

    // Proses pesan: ubah role 'system' menjadi 'user'
    let processedMessages = [];
    let systemMessagesAsUser = [];

    for (const msg of messages) {
        if (msg.role === "system") {
            systemMessagesAsUser.push({ role: "user", content: msg.content });
        } else {
            processedMessages.push(msg);
        }
    }

    const finalMessagesToSend = [...systemMessagesAsUser, ...processedMessages];

    // Periksa apakah ada pesan setelah pemrosesan
    if (finalMessagesToSend.length === 0) {
         return Promise.reject(
            createOpenAIError(
                "No valid messages to send after processing.",
                "invalid_request_error",
                "messages"
            )
        );
    }

    try {
        // Perbaikan: Akses pesan terakhir dengan benar menggunakan .length - 1
        const lastMessage = finalMessagesToSend[finalMessagesToSend.length - 1];
        const history = finalMessagesToSend.slice(0, -1); // Semua pesan sebelum yang terakhir

        const apiResponse = await axios.post(
            "https://whatsthebigdata.com/api/ask-ai/", // Perbaikan: Hapus spasi ekstra
            {
                message: lastMessage.content, // Perbaikan: Gunakan konten dari lastMessage
                history: history,             // Perbaikan: Gunakan history yang dihitung
                model: INTERNAL_MODEL_ID
            },
            {
                headers: {
                    "content-type": "application/json",
                    "origin": "https://whatsthebigdata.com", // Perbaikan: Hapus spasi ekstra
                    "referer": "https://whatsthebigdata.com/ai-chat/", // Perbaikan: Hapus spasi ekstra
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                },
                timeout: options.timeout || 10000
            }
        );

        const aiTextResponse = apiResponse.data?.text;

        if (typeof aiTextResponse === "string") {
            const timestamp = Math.floor(Date.now() / 1000);
            const dummyId = `chatcmpl-${Math.random()
                .toString(36)
                .substring(2, 15)}${Math.random()
                .toString(36)
                .substring(2, 15)}`;

            const promptTokens = estimateTokens(
                JSON.stringify(finalMessagesToSend)
            );
            const completionTokens = estimateTokens(aiTextResponse);
            const totalTokens = promptTokens + completionTokens;

            return {
                id: dummyId,
                object: "chat.completion",
                created: timestamp,
                model: DISPLAYED_MODEL_NAME,
                choices: [
                    {
                        index: 0,
                        message: {
                            role: "assistant",
                            content: aiTextResponse.trim()
                        },
                        logprobs: null,
                        finish_reason: "stop"
                    }
                ],
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens
                }
            };
        } else {
            return Promise.reject(
                createOpenAIError(
                    "Invalid or missing text in API response.",
                    "api_error",
                    null,
                    "response_text_invalid"
                )
            );
        }
    } catch (error) {
        console.error("Internal Error Details:", error);
        let errorMessage = "An unknown error occurred.";
        let errorType = "unknown_error";
        let errorCode = null;

        if (axios.isAxiosError(error)) {
            if (error.code === "ECONNABORTED") {
                // Timeout
                errorMessage = "Request timed out.";
                errorType = "timeout_error";
                errorCode = "timeout";
            } else if (error.response) {
                const status = error.response.status;
                if (status === 400) {
                    errorMessage = "The request was invalid or malformed.";
                    errorType = "invalid_request_error";
                    errorCode = "bad_request";
                } else if (status === 401) {
                    errorMessage = "Incorrect API key provided.";
                    errorType = "authentication_error";
                    errorCode = "invalid_api_key";
                } else if (status === 403) {
                    errorMessage = "Access forbidden.";
                    errorType = "permission_error";
                    errorCode = "forbidden";
                } else if (status === 429) {
                    errorMessage = "Rate limit reached for requests.";
                    errorType = "rate_limit_exceeded";
                    errorCode = "rate_limit_exceeded";
                } else if (status >= 500) {
                    errorMessage = `Server error (${status}).`;
                    errorType = "server_error";
                    errorCode = "server_error";
                } else {
                    errorMessage = `HTTP ${status}: ${
                        error.response.statusText || "Error"
                    }.`;
                    errorType = "api_error";
                    errorCode = `http_${status}`;
                }
            } else if (error.request) {
                // No response received
                errorMessage =
                    "No response received from the server. Please check your internet connection.";
                errorType = "service_unavailable";
                errorCode = "no_response";
            } else {
                // Request setup error
                errorMessage = `Request setup error: ${error.message}`;
                errorType = "unknown_error";
                errorCode = "request_setup_error";
            }
        } else {
            errorMessage = `Unexpected error: ${error.message}`;
            errorType = "unknown_error";
            errorCode = "unexpected_error";
        }

        return Promise.reject(
            createOpenAIError(errorMessage, errorType, null, errorCode)
        );
    }
}

// Fungsi pembantu untuk membuat error dalam format OpenAI
function createOpenAIError(message, type, param = null, code = null) {
    return {
        error: {
            message,
            type,
            param,
            code
        }
    };
}

// Fungsi pembantu untuk estimasi jumlah token (perkiraan kasar)
function estimateTokens(str) {
    if (!str) return 0;
    // Perkiraan kasar: 1 token sekitar 4 karakter
    return Math.ceil(str.length / 4);
}

// Contoh penggunaan (tidak dijalankan):
/*
askAI({ messages: [{ role: "user", content: "Hello!" }] })
  .then(response => console.log(response))
  .catch(error => console.error(error));
*/