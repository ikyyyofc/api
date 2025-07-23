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
    app.post("/covertiktok", async (req, res) => {
        if (!req.body.data) {
            return res.status(400).json({
                status: false,
                error: "data parameter is required"
            });
        }

        let img_url = [];

        for (let x of req.body.data) {
            delay(10000);
            axios
                .get(
                    "https://api.fasturl.link/aiexperience/describeimage?url=" +
                        x.cover
                )
                .then(a =>
                    img_url.push({
                        url: `https://api.fasturl.link/aiimage/gemini?prompt=${a.data.result}&imageUrl=${x.cover}`
                    })
                );
        }

        res.json({ status: true, result: img_url });
    });
}

module.exports = router;

const delay = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
