const axios = require("axios");

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "GET",
                path: "/trendtiktok",
                description: "Get Tiktok Viral"
            }
        ]
    });

    app.get("/trendtiktok", async (req, res) => {
        if (!req.query.region) {
            return res.status(400).json({
                status: false,
                error: "region parameter is required"
            });
        }

        const trend = await axios.post(
            "https://tikwm.com/api/feed/list",
            "region=" + req.query.region
        );

        res.json(trend.data.data);
    });
}

module.exports = router;
