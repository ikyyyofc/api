const vertex = require("../lib/vertexAI");

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            { method: "POST", path: "/vertex/chat", description: "vertex ai" }
        ]
    });

    app.post("/vertex/chat", async (req, res) => {


        res.json({status: true});
    });
}

module.exports = router;