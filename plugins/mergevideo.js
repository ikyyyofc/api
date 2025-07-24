const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

// Fungsi untuk generate nama file unik
function generateUniqueFilename(extension) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    return `temp_${timestamp}_${randomString}.${extension}`;
}

// Fungsi utama untuk menggabungkan media
async function combineMedia(photoUrl, audioUrl, outputPath, duration = 60) {
    const tempDir = os.tmpdir();
    const photoPath = path.join(tempDir, generateUniqueFilename('jpg'));
    const audioPath = path.join(tempDir, generateUniqueFilename('mp3'));
    const videoOutputPath = outputPath;

    try {
        console.log(`[mergevideo] Mendownload foto dari: ${photoUrl}`);
        await execPromise(`curl -L -o "${photoPath}" "${photoUrl}"`);
        console.log(`[mergevideo] Foto disimpan di: ${photoPath}`);

        console.log(`[mergevideo] Mendownload audio dari: ${audioUrl}`);
        await execPromise(`curl -L -o "${audioPath}" "${audioUrl}"`);
        console.log(`[mergevideo] Audio disimpan di: ${audioPath}`);

        const ffmpegCommand = `ffmpeg -loop 1 -i "${photoPath}" -i "${audioPath}" -c:v libx264 -t ${duration} -pix_fmt yuv420p -y "${videoOutputPath}"`;
        console.log(`[mergevideo] Menjalankan ffmpeg: ${ffmpegCommand}`);
        await execPromise(ffmpegCommand);
        console.log(`[mergevideo] Video berhasil dibuat di: ${videoOutputPath}`);

    } catch (error) {
        console.error('[mergevideo] Error saat memproses media:', error.message);
        throw error;
    } finally {
        // Hapus file sementara
        try { if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath); } catch (err) { console.warn(`[mergevideo] Gagal hapus foto temp`, err.message); }
        try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (err) { console.warn(`[mergevideo] Gagal hapus audio temp`, err.message); }
    }
}

// Fungsi Router Plugin (disesuaikan nama plugin)
function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName, // Ini akan menjadi 'mergevideo' saat dipanggil
        endpoints: [
            {
                method: "GET",
                path: "/combine-media",
                description: "Gabungkan 1 foto (URL) dan 1 suara (URL) menjadi 1 file video berdurasi 60 detik. Parameter: photoUrl, audioUrl"
            }
        ]
    });

    app.get("/combine-media", async (req, res) => {
        try {
            const photoUrl = req.query.photoUrl;
            const audioUrl = req.query.audioUrl;

            if (!photoUrl || !audioUrl) {
                return res.status(400).json({
                    status: false,
                    message: "Parameter 'photoUrl' dan 'audioUrl' diperlukan."
                });
            }

            // === PENYESUAIAN PATH ===
            // Direktori output video: /app/api/public/videos
            const outputDir = path.join(__dirname, '..', 'public', 'videos');
            // =======================

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const outputFilename = generateUniqueFilename('mp4');
            const videoOutputPath = path.join(outputDir, outputFilename);

            console.log(`[mergevideo] Memulai proses penggabungan...`);
            await combineMedia(photoUrl, audioUrl, videoOutputPath, 60);

            // === PENYESUAIAN URL VIDEO ===
            // URL relatif untuk diakses via web server Anda
            const videoUrl = `/videos/${outputFilename}`;
            // =============================

            res.json({
                status: true,
                message: "Video berhasil dibuat.",
                videoUrl: videoUrl
            });

        } catch (error) {
            console.error('[mergevideo] Error di handler route:', error.message);
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat memproses media.",
                error: error.message
            });
        }
    });
}

module.exports = router; // Pastikan ini tetap ada