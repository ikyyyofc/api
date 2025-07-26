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

// Fungsi utama untuk menggabungkan video dengan transisi (URUTAN DIPERTAHANKAN)
async function mergeVideosWithTransitions(videoUrls, outputPath, clipDuration = 8, transitionDuration = 1) {
    const tempDir = os.tmpdir();
    const downloadedVideoPaths = [];
    const trimmedVideoPaths = []; // Paths untuk video yang sudah di-trim

    try {
        console.log(`[videoMerger] Memulai proses penggabungan video (Durasi Klip: ${clipDuration}s, Transisi: ${transitionDuration}s)...`);
        console.log(`[videoMerger] Jumlah Video URLs: ${videoUrls.length}`);
        console.log(`[videoMerger] URUTAN VIDEO AKAN SESUAI INPUT: ${videoUrls.map((_, i) => `Video ${i+1}`).join(' -> ')}`);

        // 1. Download semua video SESUAI URUTAN
        const downloadPromises = videoUrls.map(async (url, index) => {
            const urlObj = new URL(url);
            const ext = path.extname(urlObj.pathname).substring(1) || 'mp4';
            const videoPath = path.join(tempDir, generateUniqueFilename(`video_${index}`, ext));
            console.log(`[videoMerger] [${index + 1}/${videoUrls.length}] Mendownload video: ${url}`);
            await execPromise(`curl -L -o "${videoPath}" "${url}"`);
            console.log(`[videoMerger] [${index + 1}/${videoUrls.length}] Video disimpan di: ${videoPath}`);
            downloadedVideoPaths.push(videoPath); // Urutan array sesuai urutan download
            return videoPath;
        });
        await Promise.all(downloadPromises);

        // 2. Trim semua video ke durasi yang konsisten SESUAI URUTAN
        const trimVideoPromises = downloadedVideoPaths.map(async (inputPath, index) => {
            const trimmedPath = path.join(tempDir, generateUniqueFilename(`trimmed_${index}`, 'mp4'));

            // === PERTAMA COBA TANPA RE-ENCODE ===
            let trimCommand = `ffmpeg -y -ss 0 -i "${inputPath}" -t ${clipDuration} -c copy "${trimmedPath}"`;
            console.log(`[videoMerger] [${index + 1}/${downloadedVideoPaths.length}] [Coba 1 - Tanpa Re-encode] Trimming...`);
            try {
                 await execPromise(trimCommand);
                 console.log(`[videoMerger] [${index + 1}/${downloadedVideoPaths.length}] [Sukses - Tanpa Re-encode] Video di-trim: ${trimmedPath}`);
            } catch (trimError) {
                console.warn(`[videoMerger] [${index + 1}/${downloadedVideoPaths.length}] [Gagal - Tanpa Re-encode]. Mencoba dengan re-encode.`, trimError.message?.substring(0, 100)); // Batasi log error
                // === KEDUA COBA DENGAN RE-ENCODE ===
                trimCommand = `ffmpeg -y -ss 0 -i "${inputPath}" -t ${clipDuration} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${trimmedPath}"`;
                console.log(`[videoMerger] [${index + 1}/${downloadedVideoPaths.length}] [Coba 2 - Dengan Re-encode] Trimming...`);
                await execPromise(trimCommand);
                console.log(`[videoMerger] [${index + 1}/${downloadedVideoPaths.length}] [Sukses - Dengan Re-encode] Video di-trim: ${trimmedPath}`);
            }
            trimmedVideoPaths.push(trimmedPath); // Urutan array sesuai urutan input
            return trimmedPath;
        });
        await Promise.all(trimVideoPromises);

        // 3. Gabungkan semua klip yang sudah di-trim SESUAI URUTAN menggunakan filter_complex xfade
        if (trimmedVideoPaths.length < 2) {
             throw new Error("Diperlukan minimal 2 video untuk digabung.");
        }

        // Bangun chain filter_complex untuk xfade SESUAI URUTAN
        console.log(`[videoMerger] Membangun filter_complex xfade untuk ${trimmedVideoPaths.length} klip...`);
        let filterComplexParts = [];
        let lastVideoLabel = "[0:v]"; // Label video dari input pertama
        let lastAudioLabel = "[0:a]"; // Label audio dari input pertama

        for (let i = 1; i < trimmedVideoPaths.length; i++) {
             // Offset untuk xfade: waktu mulai transisi
             // Klip i dimulai di detik (i * clipDuration)
             // Transisi dimulai setengah durasi transisi sebelum klip berikutnya penuh
             const offset = (i * clipDuration) - (transitionDuration / 2);
             const nextVideoLabel = `[v${i}]`; // Label untuk output video sementara
             const nextAudioLabel = `[a${i}]`; // Label untuk output audio sementara

             // Tambahkan filter xfade video dan audio
             filterComplexParts.push(`${lastVideoLabel}[${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${nextVideoLabel}`);
             filterComplexParts.push(`${lastAudioLabel}[${i}:a]acrossfade=d=${transitionDuration}${nextAudioLabel}`);
             lastVideoLabel = nextVideoLabel;
             lastAudioLabel = nextAudioLabel;
             console.log(`[videoMerger]   Menambahkan transisi dari klip ${i} ke klip ${i+1} (offset: ${offset}s)`);
        }

        // Label akhir untuk video dan audio output
        const finalVideoLabel = lastVideoLabel;
        const finalAudioLabel = lastAudioLabel;
        const filterComplexString = filterComplexParts.join(';');

        // 4. Siapkan input files untuk ffmpeg SESUAI URUTAN
        const inputArgs = trimmedVideoPaths.map((p, index) => `-i "${p}"`).join(' ');

        // 5. Perintah ffmpeg final untuk menggabungkan dengan xfade
        // -vsync vfr: Sangat penting untuk xfade
        const mergeCommand = `ffmpeg -y ${inputArgs} -filter_complex "${filterComplexString}" -map "${finalVideoLabel}" -map "${finalAudioLabel}" -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 128k -vsync vfr "${outputPath}"`;
        console.log(`[videoMerger] Menggabungkan klip dengan xfade (urutan dipertahankan)...`);
        await execPromise(mergeCommand);
        console.log(`[videoMerger] Video final berhasil dibuat di: ${outputPath}`);

    } catch (error) {
        console.error('[videoMerger] Error saat menggabungkan video:', error.message?.substring(0, 200)); // Batasi log error
        if (error.stderr) console.error('[videoMerger] FFmpeg stderr (potongan):', error.stderr?.substring(0, 500));
        throw error;
    } finally {
        // 6. Bersihkan file sementara
        const tempFiles = [...downloadedVideoPaths, ...trimmedVideoPaths].filter(Boolean);
        console.log(`[videoMerger] Membersihkan ${tempFiles.length} file sementara...`);
        tempFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[videoMerger] File sementara dihapus: ${filePath}`);
                }
            } catch (err) {
                console.warn(`[videoMerger] Gagal menghapus file sementara: ${filePath}`, err.message?.substring(0, 100));
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
                description: "Gabungkan 8 klip video (URL) dengan transisi fade menjadi 1 video ~64 detik. URUTAN PENTING: videoUrl=url1,url2,...,url8. Resolusi input harus konsisten."
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
            console.log(`[videoMerger Route] Memulai penggabungan 8 video (urutan dipertahankan)...`);
            await mergeVideosWithTransitions(videoUrls, videoOutputPath, 8, 1);

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2); // Dalam detik
            console.log(`[videoMerger Route] Proses selesai dalam ${duration} detik.`);

            // 4. Tentukan URL video hasil
            const videoUrl = `/videos/${outputFilename}`;

            // 5. Kirim respons sukses
            res.json({
                status: true,
                message: `Video berhasil digabung (urutan sesuai input, ~64 detik). Proses: ${duration} detik.`,
                videoUrl: videoUrl
            });

        } catch (error) {
            console.error('[videoMerger Route] Error di handler route:', error.message?.substring(0, 200));
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat menggabungkan video. Periksa log server.",
            });
        }
    });
}

module.exports = router;