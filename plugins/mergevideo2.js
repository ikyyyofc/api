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

// Fungsi utama untuk menggabungkan video dengan transisi (Tanpa Resize, Urutan Terjaga)
async function mergeVideosWithTransitions(videoUrls, outputPath, clipDuration = 8, transitionDuration = 1) {
    const tempDir = os.tmpdir();
    const downloadedVideoPaths = [];
    const trimmedVideoPaths = []; // Paths untuk video yang sudah di-trim

    try {
        console.log(`[videoMerger] Memulai proses penggabungan video (Durasi Klip: ${clipDuration}s, Transisi: ${transitionDuration}s, Urutan Terjaga)...`);
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

        // 2. Trim semua video ke durasi yang konsisten (tanpa re-encode jika memungkinkan)
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
                await execPromise(trimCommand);
                console.log(`[videoMerger] [Sukses - Dengan Re-encode] Video ${index + 1} di-trim: ${trimmedPath}`);
            }
            trimmedVideoPaths.push(trimmedPath);
            return trimmedPath;
        });
        await Promise.all(trimVideoPromises);

        // 3. Gabungkan semua klip yang sudah di-trim menggunakan filter_complex xfade (DENGAN URUTAN YANG DITENTUKAN)
        if (trimmedVideoPaths.length < 2) {
             throw new Error("Diperlukan minimal 2 video untuk digabung.");
        }

        // Bangun chain filter_complex untuk xfade dengan URUTAN YANG DITENTUKAN
        let filterComplexString = "";
        // Gunakan label input eksplisit
        // Label video: [in0:v], [in1:v], ...
        // Label audio: [in0:a], [in1:a], ...
        let lastVideoLabel = "[in0:v]"; // Label video dari input pertama yang sudah diberi label
        let lastAudioLabel = "[in0:a]"; // Label audio dari input pertama yang sudah diberi label
        let currentOutputLabelVideo = "";
        let currentOutputLabelAudio = "";

        for (let i = 1; i < trimmedVideoPaths.length; i++) {
             // Offset untuk xfade: waktu mulai transisi
             // Misal klip 8s, transisi 1s, maka offset klip ke-2 adalah 7.5s (8s - 0.5s)
             const offset = (i * clipDuration) - (transitionDuration / 2);
             currentOutputLabelVideo = `[vtmp${i}]`;
             currentOutputLabelAudio = `[atmp${i}]`;

             // Tambahkan filter xfade video dan audio dengan label input eksplisit
             filterComplexString += `${lastVideoLabel}[in${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${currentOutputLabelVideo};`;
             filterComplexString += `${lastAudioLabel}[in${i}:a]acrossfade=d=${transitionDuration}${currentOutputLabelAudio};`;
             lastVideoLabel = currentOutputLabelVideo;
             lastAudioLabel = currentOutputLabelAudio;
        }

        // Label akhir untuk video dan audio output
        const finalVideoLabel = lastVideoLabel;
        const finalAudioLabel = lastAudioLabel;

        // 4. Siapkan input files untuk ffmpeg dengan mapping label eksplisit
        // Format: -i "file1" -i "file2" ...
        const inputArgsArray = trimmedVideoPaths.map((p, index) => `-i "${p}"`);
        // Tambahkan mapping untuk memberi label eksplisit pada input
        // Format: [0:v]setpts=PTS-STARTPTS[in0:v]; [0:a]asetpts=PTS-STARTPTS[in0:a]; ...
        const setPtsFilters = trimmedVideoPaths.map((_, index) =>
             `[${index}:v]setpts=PTS-STARTPTS[in${index}:v]; [${index}:a]asetpts=PTS-STARTPTS[in${index}:a];`
        ).join(' ');

        const fullInputArgs = [...inputArgsArray, `-filter_complex`, `"${setPtsFilters} ${filterComplexString.slice(0, -1)}"`].join(' ');

        // 5. Perintah ffmpeg final untuk menggabungkan dengan xfade (URUTAN TERJAGA)
        // -vsync vfr: Sangat penting untuk xfade
        const mergeCommand = `ffmpeg -y ${fullInputArgs} -map "${finalVideoLabel}" -map "${finalAudioLabel}" -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 128k -vsync vfr "${outputPath}"`;
        console.log(`[videoMerger] Menggabungkan klip dengan xfade (Urutan Terjaga): ${mergeCommand}`);
        await execPromise(mergeCommand);
        console.log(`[videoMerger] Video final berhasil dibuat di: ${outputPath}`);

    } catch (error) {
        console.error('[videoMerger] Error saat menggabungkan video:', error.message);
        if (error.stdout) console.error('[videoMerger] FFmpeg stdout:', error.stdout);
        if (error.stderr) console.error('[videoMerger] FFmpeg stderr:', error.stderr);
        throw error;
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
                console.warn(`[videoMerger] Gagal menghapus file sementara: ${filePath}`, err.message);
            }
        });
    }
}


// Fungsi Router Plugin (tidak berubah)
function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "GET",
                path: "/merge-videos",
                description: "Gabungkan 8 klip video (URL) dengan transisi fade menjadi 1 video berdurasi ~64 detik. Parameter: videoUrl (comma-separated URLs). Resolusi video input harus konsisten. Urutan video sesuai input."
            }
        ]
    });

    app.get("/merge-videos", async (req, res) => {
        try {
            const startTime = Date.now();
            console.log(`[videoMerger Route] Permintaan diterima di ${new Date(startTime).toISOString()}`);

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

            const outputDir = path.join(__dirname, '..', 'public', 'videos');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const outputFilename = generateUniqueFilename('merged_video', 'mp4');
            const videoOutputPath = path.join(outputDir, outputFilename);

            console.log(`[videoMerger Route] Memulai penggabungan 8 video (Urutan Terjaga)...`);
            await mergeVideosWithTransitions(videoUrls, videoOutputPath, 8, 1);

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`[videoMerger Route] Proses selesai dalam ${duration} detik.`);

            const videoUrl = `/videos/${outputFilename}`;

            res.json({
                status: true,
                message: `Video berhasil digabung (~64 detik, Urutan Terjaga). Proses: ${duration} detik.`,
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