// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");

class PluginBasedAPI {
    constructor() {
        this.app = express();
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, "public")));
        this.plugins = [];
        this.routes = [];
    }

    // Method untuk secara otomatis memuat semua plugin dari folder plugins
    loadPlugins() {
        const pluginsDir = path.join(__dirname, "plugins");

        // Cek apakah folder plugins ada
        if (!fs.existsSync(pluginsDir)) {
            console.log("Plugins directory not found");
            return;
        }

        // Baca semua file dalam folder plugins
        const pluginFiles = fs.readdirSync(pluginsDir);

        pluginFiles.forEach(file => {
            // Hanya memuat file .js
            if (path.extname(file) === ".js") {
                try {
                    const pluginPath = path.join(pluginsDir, file);
                    const plugin = require(pluginPath);

                    // Pastikan plugin adalah fungsi
                    if (typeof plugin === "function") {
                        // Menggunakan nama file sebagai nama plugin (tanpa ekstensi)
                        const pluginName = path.basename(file, ".js");

                        plugin(this.app, this.routes, pluginName);
                        this.plugins.push(pluginName);
                        console.log(`Plugin loaded: ${pluginName}`);
                    } else {
                        console.warn(
                            `Invalid plugin in file: ${file}. Plugin must be a function.`
                        );
                    }
                } catch (error) {
                    console.error(
                        `Error loading plugin ${file}:`,
                        error.message
                    );
                }
            }
        });
    }

    // Method untuk menjalankan server
    listen(port, callback) {
        this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
        // Endpoint untuk mendapatkan informasi plugin dan route
        this.app.get("/api/plugins", (req, res) => {
            res.json({
                plugins: this.plugins,
                routes: this.routes
            });
        });

        // Route default untuk mengarahkan ke UI
        this.app.get("/", (req, res) => {
            res.sendFile(path.join(__dirname, "public", "index.html"));
        });

        this.app.listen(port, callback);
    }
}

module.exports = PluginBasedAPI;
