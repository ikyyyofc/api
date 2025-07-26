const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

// Fungsi untuk generate nama file unik
function generateUniqueFilename(prefix = 'temp', extension) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${timestamp}_${randomString}.${extension}`;
}

// Fungsi utama untuk menggabungkan video dengan transisi (Tanpa Resize)
async function mergeVideosWithTransitions(videoUrls, outputPath, clipDuration = 8, transitionDuration = 1) {
    const tempDir = os.tmpdir();
    const downloadedVideoPaths = [];
    const trimmedVideoPaths = []; // Paths untuk video yang sudah di-trim

    try {
        console.log(`[videoMerger] Memulai proses penggabungan video (Durasi Klip: ${clipDuration}s, Transisi: ${transitionDuration}s)...`);
        console.log(`[videoMerger] Jumlah Video URLs: ${videoUrls.length}`);

        // 1. Download semua video
        const downloadPromises = videoUrls.map(async (url, index) => {
            const urlObj = new URL(url);
            const ext = path.extname(urlObj.pathname).substring(1) || 'mp4';
            const videoPath = path.join(tempDir, generateUniqueFilename(`video_${index}`, ext));
            console.log(`[videoMerger] Mendownload video ${index + 1}: ${url}`);
            await execPromise(`curl -L -o "${videoPath}" "${url}"`);
            console.log(`[videoMerger] Video ${index + 1} disimpan di: ${videoPath}`);
            downloadedVideoPaths.push(videoPath);
            return videoPath;
        });
        await Promise.all(downloadPromises);

        // 2. Trim semua video ke durasi yang konsisten (tanpa re-encode video/audio jika format cocok)
        // Gunakan -c copy untuk kecepatan maksimal, fallback ke re-encode jika error
        const trimVideoPromises = downloadedVideoPaths.map(async (inputPath, index) => {
            const trimmedPath = path.join(tempDir, generateUniqueFilename(`trimmed_${index}`, 'mp4'));

            // === PERTAMA COBA TANPA RE-ENCODE ===
            let trimCommand = `ffmpeg -y -ss 0 -i "${inputPath}" -t ${clipDuration} -c copy "${trimmedPath}"`;
            console.log(`[videoMerger] [Coba 1 - Tanpa Re-encode] Trimming video ${index + 1}: ${trimCommand}`);
            try {
                 await execPromise(trimCommand);
                 console.log(`[videoMerger] [Sukses - Tanpa Re-encode] Video ${index + 1} di-trim: ${trimmedPath}`);
            } catch (trimError) {
                console.warn(`[videoMerger] [Gagal - Tanpa Re-encode] Video ${index + 1}. Mencoba dengan re-encode.`, trimError.message);
                // === KEDUA COBA DENGAN RE-ENCODE ===
                trimCommand = `ffmpeg -y -ss 0 -i "${inputPath}" -t ${clipDuration} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${trimmedPath}"`;
                console.log(`[videoMerger] [Coba 2 - Dengan Re-encode] Trimming video ${index + 1}: ${trimCommand}`);
                await execPromise(trimCommand); // Jika gagal lagi, akan throw error
                console.log(`[videoMerger] [Sukses - Dengan Re-encode] Video ${index + 1} di-trim: ${trimmedPath}`);
            }
            trimmedVideoPaths.push(trimmedPath);
            return trimmedPath;
        });
        await Promise.all(trimVideoPromises);

        // 3. Gabungkan semua klip yang sudah di-trim menggunakan filter_complex xfade
        if (trimmedVideoPaths.length < 2) {
             throw new Error("Diperlukan minimal 2 video untuk digabung.");
        }

        // Bangun chain filter_complex untuk xfade
        let filterComplexString = "";
        let lastVideoLabel = "[0:v]"; // Label video dari input pertama
        let lastAudioLabel = "[0:a]"; // Label audio dari input pertama
        let currentOutputLabelVideo = "";
        let currentOutputLabelAudio = "";

        for (let i = 1; i < trimmedVideoPaths.length; i++) {
             // Offset untuk xfade: waktu mulai transisi
             // Misal klip 8s, transisi 1s, maka offset klip ke-2 adalah 7.5s (8s - 0.5s)
             const offset = (i * clipDuration) - (transitionDuration / 2);
             currentOutputLabelVideo = `[vtmp${i}]`; // Gunakan label sementara yang unik
             currentOutputLabelAudio = `[atmp${i}]`;

             // Tambahkan filter xfade video dan audio
             filterComplexString += `${lastVideoLabel}[${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${currentOutputLabelVideo};`;
             filterComplexString += `${lastAudioLabel}[${i}:a]acrossfade=d=${transitionDuration}${currentOutputLabelAudio};`;
             lastVideoLabel = currentOutputLabelVideo;
             lastAudioLabel = currentOutputLabelAudio;
        }

        // Label akhir untuk video dan audio output
        const finalVideoLabel = lastVideoLabel;
        const finalAudioLabel = lastAudioLabel;

        // 4. Siapkan input files untuk ffmpeg
        const inputArgs = trimmedVideoPaths.map((p, index) => `-i "${p}"`).join(' ');

        // 5. Perintah ffmpeg final untuk menggabungkan dengan xfade
        // -vsync vfr: Sangat penting untuk xfade agar bekerja dengan baik
        const mergeCommand = `ffmpeg -y ${inputArgs} -filter_complex "${filterComplexString.slice(0, -1)}" -map "${finalVideoLabel}" -map "${finalAudioLabel}" -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 128k -vsync vfr "${outputPath}"`;
        console.log(`[videoMerger] Menggabungkan klip dengan xfade: ${mergeCommand}`);
        await execPromise(mergeCommand);
        console.log(`[videoMerger] Video final berhasil dibuat di: ${outputPath}`);

    } catch (error) {
        console.error('[videoMerger] Error saat menggabungkan video:', error.message);
        if (error.stdout) console.error('[videoMerger] FFmpeg stdout:', error.stdout);
        if (error.stderr) console.error('[videoMerger] FFmpeg stderr:', error.stderr);
        throw error; // Lempar ulang error agar bisa ditangkap oleh handler route
    } finally {
        // 6. Bersihkan file sementara
        const tempFiles = [...downloadedVideoPaths, ...trimmedVideoPaths].filter(Boolean);
        tempFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[videoMerger] File sementara dihapus: ${filePath}`);
                }
            } catch (err) {
                // Abaikan error penghapusan, mungkin file sedang digunakan atau tidak ada
                console.warn(`[videoMerger] Gagal menghapus file sementara: ${filePath}`, err.message);
            }
        });
    }
}


// Fungsi Router Plugin
function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "GET",
                path: "/merge-videos",
                description: "Gabungkan 8 klip video (URL) dengan transisi fade menjadi 1 video berdurasi ~64 detik. Parameter: videoUrl (comma-separated URLs). Resolusi video input harus konsisten."
            }
        ]
    });

    app.get("/merge-videos", async (req, res) => {
        try {
            const startTime = Date.now();
            console.log(`[videoMerger Route] Permintaan diterima di ${new Date(startTime).toISOString()}`);

            // 1. Ambil dan parsing parameter
            const rawVideoUrls = req.query.videoUrl;

            if (!rawVideoUrls) {
                return res.status(400).json({
                    status: false,
                    message: "Parameter 'videoUrl' (comma-separated) diperlukan."
                });
            }

            const videoUrls = rawVideoUrls.split(',').map(url => url.trim()).filter(url => url.length > 0);

            if (videoUrls.length !== 8) {
                 return res.status(400).json({
                    status: false,
                    message: `Diperlukan tepat 8 URL video. Ditemukan: ${videoUrls.length}.`
                });
            }

            // 2. Tentukan path output video
            const outputDir = path.join(__dirname, '..', 'public', 'videos');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const outputFilename = generateUniqueFilename('merged_video', 'mp4');
            const videoOutputPath = path.join(outputDir, outputFilename);

            // 3. Panggil fungsi mergeVideosWithTransitions
            // Durasi klip 8 detik, transisi 1 detik
            console.log(`[videoMerger Route] Memulai penggabungan 8 video...`);
            await mergeVideosWithTransitions(videoUrls, videoOutputPath, 8, 1);

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2); // Dalam detik
            console.log(`[videoMerger Route] Proses selesai dalam ${duration} detik.`);

            // 4. Tentukan URL video hasil
            const videoUrl = `/videos/${outputFilename}`;

            // 5. Kirim respons sukses
            res.json({
                status: true,
                message: `Video berhasil digabung (~64 detik). Proses: ${duration} detik.`,
                videoUrl: videoUrl
            });

        } catch (error) {
            console.error('[videoMerger Route] Error di handler route:', error.message);
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat menggabungkan video. Periksa log server untuk detailnya.",
            });
        }
    });
}

module.exports = router;