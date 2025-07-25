const axios = require("axios");
function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            { method: "POST", path: "/aiimage", description: "generate image" }
        ]
    });

    app.post("/aiimage", async (req, res) => {
        let q = req.body;
        if (!q.prompt)
            return res.json({
                status: false,
                mess: "gunakan parameter prompt"
            });
        const resp = (
            await axios.get(
                `https://api.nekorinn.my.id/ai-img/ai4chat?text=${encodeURIComponent(
                    q.prompt
                )}&ratio=9%3A16`,
                { responseType: "arraybuffer" }
            )
        ).data;

        res.setHeader("Content-Type", "image/png");
        res.send(Buffer.from(resp[0].bytesBase64Encoded, "base64"));
    });
}

module.exports = router;
