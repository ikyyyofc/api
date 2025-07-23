function router(app, routes = [], pluginName) {
    // Menyimpan informasi route
    routes.push({
        plugin: pluginName, // Menggunakan nama file sebagai nama plugin
        endpoints: [
            { method: "GET", path: "/text", description: "Get text response" },
            { method: "POST", path: "/post", description: "Post text data" }
        ]
    });

    // GET /text - Mendapatkan response dengan parameter query
    app.get("/text", (req, res) => {
        // Mengambil parameter dari query string
        const { message, format } = req.query;

        // Response berdasarkan parameter
        const response = {
            status: true,
            message: message || "Default message",
            timestamp: new Date().toISOString()
        };

        // Jika format=json, kirim sebagai JSON
        if (format === "json") {
            res.json(response);
        } else {
            // Untuk format lain atau default
            res.json(response);
        }
    });

    // POST /post - Menambahkan data
    app.post("/post", (req, res) => {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                status: false,
                error: "text is required"
            });
        }

        res.json({
            status: true,
            receivedText: text,
            timestamp: new Date().toISOString()
        });
    });
}

module.exports = router;
