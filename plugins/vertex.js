const vertexAIInstance = require("../lib/vertexAI");

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            { method: "POST", path: "/vertex/chat", description: "vertex ai" }
        ]
    });

    app.post("/vertex/chat", async (req, res) => {
      let body = req.body
      const { message, history, fileBuffer, mode } = body;
      if (!message && !fileBuffer) return res.json({status:false, result: "message/fileBuffer is required!"})
      
    });
}

module.exports = router;
