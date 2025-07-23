const axios = require("axios");

function router(app, routes = [], pluginName) {
    // Menyimpan informasi route
    routes.push({
        plugin: pluginName, // Menggunakan nama file sebagai nama plugin
        endpoints: [
            { method: "GET", path: "/text", description: "Get text response" },
            { method: "POST", path: "/post", description: "Post text data" }
        ]
    });

    app.post("/post", async (req, res) => {
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

// --- Konfigurasi ---
// Model yang selalu digunakan secara internal (tidak terlihat di input/output OpenAI)
const INTERNAL_MODEL_ID = "claude-3-sonnet"; // ID model dari API whatsthebigdata
const DISPLAYED_MODEL_NAME = "claude-3-5-sonnet"; // Nama model yang ditampilkan di output mirip OpenAI

/**
 * Fungsi utama untuk bertanya ke AI.
 * MENIRU INPUT DAN OUTPUT API OPENAI CHAT COMPLETIONS SECARA PENUH.
 * Model yang digunakan secara internal tetap 'claude-3-sonnet'.
 *
 * @param {Object} body - Body permintaan dalam format OpenAI.
 * @param {string} body.model - Nama model (akan diabaikan, tetap gunakan 'gpt-xxx' untuk konsistensi).
 * @param {Array<Object>} body.messages - Array objek pesan dalam format OpenAI.
 *   Contoh: [
 *     { role: 'system', content: 'Instruksi sistem...' },
 *     { role: 'user', content: 'Halo' },
 *     { role: 'assistant', content: 'Hai!' }
 *   ]
 * @param {number} [body.max_tokens] - Maksimum token untuk generate (akan diabaikan karena API tujuan mungkin tidak mendukungnya).
 * @param {number} [body.temperature] - Sampling temperature (akan diabaikan karena API tujuan mungkin tidak mendukungnya).
 * @param {string} [body.user] - ID unik pengguna (akan diabaikan).
 * @param {Object} [options] - Opsi tambahan untuk fungsi (misalnya timeout).
 * @returns {Promise<Object>} - Promise yang resolve ke objek respons mirip OpenAI atau reject dengan error mirip OpenAI.
 *
 * Contoh body input:
 * {
 *   "model": "gpt-4-turbo-preview", // Diabaikan
 *   "messages": [
 *     {"role": "system", "content": "You are a helpful assistant."},
 *     {"role": "user", "content": "Hello!"}
 *   ],
 *   "max_tokens": 1000, // Diabaikan
 *   "temperature": 0.7 // Diabaikan
 * }
 *
 * Contoh respons sukses (mirip OpenAI):
 * {
 *   "id": "chatcmpl-123",
 *   "object": "chat.completion",
 *   "created": 1677652288,
 *   "model": "claude-3-5-sonnet", // Nama model yang ditampilkan
 *   "choices": [{
 *     "index": 0,
 *     "message": {
 *       "role": "assistant",
 *       "content": "Hello there, how may I assist you today?",
 *     },
 *     "logprobs": null,
 *     "finish_reason": "stop"
 *   }],
 *   "usage": {
 *     "prompt_tokens": 9,
 *     "completion_tokens": 12,
 *     "total_tokens": 21
 *   }
 * }
 *
 * Contoh error (mirip OpenAI):
 * {
 *   "error": {
 *     "message": "Invalid 'messages' format.",
 *     "type": "invalid_request_error",
 *     "param": "messages",
 *     "code": "messages_format_invalid"
 *   }
 * }
 */
export async function askAI(body, options = {}) {
    const { model, messages, max_tokens, temperature, user, ...rest } =
        body || {};

    // --- Validasi Input Mirip OpenAI ---
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

    // Validasi isi messages
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
        if (!["system", "user", "assistant"].includes(msg.role)) {
            // OpenAI memungkinkan role lain, tapi API tujuan mungkin tidak. Kita bisa log atau abaikan.
            // Untuk kesederhanaan, kita abaikan role yang tidak dikenali.
            // console.warn(`Warning: Unknown role '${msg.role}' at index ${index}.`);
        }
        if (typeof msg.content !== "string") {
            // OpenAI juga mendukung array content, tapi kita sederhanakan
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

    // --- Proses Messages (Pengecohan Role System) ---
    let processedMessages = [];
    let systemMessagesAsUser = [];

    for (const msg of messages) {
        if (msg.role === "system") {
            // Ubah role 'system' menjadi 'user' dan kumpulkan
            systemMessagesAsUser.push({ role: "user", content: msg.content });
        } else {
            // Tambahkan pesan dengan role 'user' atau 'assistant' apa adanya
            processedMessages.push(msg);
        }
    }

    // Gabungkan: pesan system (sebagai user) di awal, diikuti pesan lainnya
    const finalMessagesToSend = [...systemMessagesAsUser, ...processedMessages];

    try {
        // --- Kirim ke API Tujuan ---
        const apiResponse = await axios.post(
            "https://whatsthebigdata.com/api/ask-ai/",
            {
                messages: finalMessagesToSend, // Kirim pesan yang sudah diproses
                model: INTERNAL_MODEL_ID // Gunakan model internal yang tetap
                // Parameter OpenAI lainnya (max_tokens, temperature) diabaikan
            },
            {
                headers: {
                    "content-type": "application/json",
                    origin: "https://whatsthebigdata.com",
                    referer: "https://whatsthebigdata.com/ai-chat/",
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                },
                // Terapkan timeout dari options jika ada
                timeout: options.timeout || 10000 // Default 10 detik
            }
        );

        // --- Bentuk Respons Mirip OpenAI ---
        const aiTextResponse = apiResponse.data?.text;

        if (typeof aiTextResponse === "string") {
            const timestamp = Math.floor(Date.now() / 1000);
            const dummyId = `chatcmpl-${Math.random()
                .toString(36)
                .substring(2, 15)}${Math.random()
                .toString(36)
                .substring(2, 15)}`;

            // Estimasi penggunaan token (sangat kasar)
            const promptTokens = estimateTokens(
                JSON.stringify(finalMessagesToSend)
            );
            const completionTokens = estimateTokens(aiTextResponse);
            const totalTokens = promptTokens + completionTokens;

            return {
                id: dummyId,
                object: "chat.completion",
                created: timestamp,
                model: DISPLAYED_MODEL_NAME, // Gunakan nama model yang ditampilkan
                choices: [
                    {
                        index: 0,
                        message: {
                            role: "assistant",
                            content: aiTextResponse.trim() // Trim whitespace di awal/akhir
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
            // Jika tidak ada teks respons yang valid
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
        // --- Tangani dan Format Error Mirip OpenAI ---
        console.error("Internal Error Details:", error); // Untuk debugging internal

        // Tentukan pesan dan tipe error berdasarkan error yang terjadi
        let errorMessage = "An unknown error occurred.";
        let errorType = "unknown_error";
        let errorCode = null;

        if (axios.isAxiosError(error)) {
            // Cek jika itu error dari Axios
            if (error.code === "ECONNABORTED") {
                // Timeout
                errorMessage = "Request timed out.";
                errorType = "timeout_error";
                errorCode = "timeout";
            } else if (error.response) {
                // Server merespons dengan error status
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
                // Permintaan dibuat tapi tidak ada respons (masalah jaringan)
                errorMessage =
                    "No response received from the server. Please check your internet connection.";
                errorType = "service_unavailable";
                errorCode = "no_response";
            } else {
                // Kesalahan lain saat menyiapkan permintaan
                errorMessage = `Request setup error: ${error.message}`;
                errorType = "unknown_error";
                errorCode = "request_setup_error";
            }
        } else {
            // Error non-Axios (misalnya dari logika kita)
            errorMessage = `Unexpected error: ${error.message}`;
            errorType = "unknown_error";
            errorCode = "unexpected_error";
        }

        return Promise.reject(
            createOpenAIError(errorMessage, errorType, null, errorCode)
        );
    }
}

// --- Fungsi Pembantu ---

/**
 * Membuat objek error dalam format OpenAI.
 * @param {string} message - Pesan error.
 * @param {string} type - Tipe error.
 * @param {string|null} param - Parameter terkait error.
 * @param {string|null} code - Kode error.
 * @returns {Object} - Objek error OpenAI.
 */
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

/**
 * Estimasi jumlah token (sangat kasar, hanya untuk simulasi).
 * @param {string} str - String untuk diestimasi.
 * @returns {number} - Estimasi jumlah token.
 */
function estimateTokens(str) {
    // Estimasi kasar: 1 token ~ 4 karakter
    // Ini sangat tidak akurat, hanya untuk memberikan angka pada 'usage'
    if (!str) return 0;
    return Math.ceil(str.length / 4);
}

// --- Contoh Penggunaan ---
async function runExamples() {
    console.log("--- Contoh 1: Permintaan Dasar ---");
    const requestBody1 = {
        model: "gpt-4-turbo", // Diabaikan
        messages: [
            {
                role: "system",
                content:
                    "Kamu adalah ahli dalam memberikan saran percintaan. Jawab dengan bahasa Indonesia santai dan singkat."
            },
            { role: "user", content: "Cara kembali dengan mantan?" }
        ],
        temperature: 0.8 // Diabaikan
    };

    try {
        const response = await askAI(requestBody1);
        console.log("Respons sukses (format mirip OpenAI):");
        console.log(JSON.stringify(response, null, 2));
        console.log("\n--- Jawaban Bersih ---");
        console.log(response.choices[0].message.content);
    } catch (err) {
        console.error("Error (format mirip OpenAI):");
        console.error(JSON.stringify(err, null, 2));
    }

    console.log("\n\n--- Contoh 2: Percakapan Multi-turn ---");
    const requestBody2 = {
        model: "gpt-3.5-turbo", // Diabaikan
        messages: [
            { role: "user", content: "Apa ibukota Prancis?" },
            { role: "assistant", content: "Ibukota Prancis adalah Paris." },
            {
                role: "user",
                content: "Sebutkan 2 tempat wisata populer di sana."
            }
        ],
        max_tokens: 200 // Diabaikan
    };

    try {
        const response = await askAI(requestBody2);
        console.log("Respons sukses (format mirip OpenAI):");
        console.log(JSON.stringify(response, null, 2));
        console.log("\n--- Jawaban Bersih ---");
        console.log(response.choices[0].message.content);
    } catch (err) {
        console.error("Error (format mirip OpenAI):");
        console.error(JSON.stringify(err, null, 2));
    }

    console.log("\n\n--- Contoh 3: Error Validasi Input ---");
    const invalidRequestBody = {
        model: "gpt-4",
        messages: "Ini bukan array" // Salah tipe
    };

    try {
        const response = await askAI(invalidRequestBody);
        console.log("Ini seharusnya tidak terjadi.");
    } catch (err) {
        console.error("Error karena input tidak valid (format mirip OpenAI):");
        console.error(JSON.stringify(err, null, 2));
    }

    console.log("\n\n--- Contoh 4: Error Timeout ---");
    const timeoutBody = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
    };

    try {
        // Gunakan timeout yang sangat pendek untuk mensimulasikan timeout
        const response = await askAI(timeoutBody, { timeout: 1 }); // 1ms timeout
        console.log("Ini seharusnya tidak terjadi.");
    } catch (err) {
        console.error("Error karena timeout (format mirip OpenAI):");
        console.error(JSON.stringify(err, null, 2));
    }
}

// Jalankan contoh
// runExamples();
