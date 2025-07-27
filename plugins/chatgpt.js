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
        if (!req.body || !req.body.user || !req.body.system) {
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