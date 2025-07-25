function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "POST",
                path: "/create-story",
                description: "create story"
            }
        ]
    });

    app.post("/<endpoint>", async (req, res) => {
        res.json({ status: true });
    });
}

module.exports = router;
