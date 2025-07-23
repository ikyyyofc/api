function router(app, routes = []) {
    // Menyimpan informasi route
    routes.push({
        plugin: "chatgpt request",
        endpoints: [
            { method: "GET", path: "/text", description: "Get all products" },
            { method: "POST", path: "/post", description: "Create new product" }
        ]
    });

    // GET /products - Mendapatkan semua produk
    app.get("/text", (req, res) => {
        res.json({ status: true });
    });

    // POST /products - Menambahkan produk baru
    app.post("/post", (req, res) => {
        const { text } = req.body;

        if (!text) {
            return res.json({ error: "text are required" });
        }

        res.json({ status: true });
    });
}

module.exports = router;
