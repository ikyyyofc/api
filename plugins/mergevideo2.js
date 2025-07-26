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

// Fungsi utama untuk menggabungkan video dengan transisi
async function mergeVideosWithTransitions(videoUrls, outputPath, targetWidth = 1280, targetHeight = 720, clipDuration = 8, transitionDuration = 1) {
    const tempDir = os.tmpdir();
    const downloadedVideoPaths = [];
    const resizedVideoPaths = []; // Paths untuk video yang sudah di-resize
    const processedClipPaths = []; // Paths untuk klip yang sudah diproses (trim & fade)

    try {
        console.log(`[videoMerger] Memulai proses penggabungan video (Resolusi: ${targetWidth}x${targetHeight}, Klip: ${clipDuration}s, Transisi: ${transitionDuration}s)...`);
        console.log(`[videoMerger] Jumlah Video URLs: ${videoUrls.length}`);

        // 1. Download semua video
        const downloadPromises = videoUrls.map(async (url, index) => {
            // Coba tebak ekstensi dari URL, fallback ke mp4
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

        // 2. Resize dan Trim semua video ke durasi & resolusi yang konsisten
        const processVideoPromises = downloadedVideoPaths.map(async (inputPath, index) => {
            const resizedPath = path.join(tempDir, generateUniqueFilename(`resized_${index}`, 'mp4'));

            // Perintah ffmpeg untuk resize, pad, dan trim
            // -vf scale,pad: Resize dan tambah padding ke resolusi target
            // -t clipDuration: Trim durasi video menjadi clipDuration detik
            // -c:a copy: Salin stream audio (jika ada) tanpa re-encode untuk kecepatan
            const resizeTrimCommand = `ffmpeg -y -i "${inputPath}" -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -t ${clipDuration} -c:a aac -b:a 128k "${resizedPath}"`;
            console.log(`[videoMerger] Resizing, padding, dan trimming video ${index + 1}: ${resizeTrimCommand}`);
            await execPromise(resizeTrimCommand);
            resizedVideoPaths.push(resizedPath);
            return resizedPath;
        });
        await Promise.all(processVideoPromises);

        // 3. Tambahkan efek fade in dan fade out ke setiap klip yang sudah di-resize
        const addFadePromises = resizedVideoPaths.map(async (inputPath, index) => {
            const fadedPath = path.join(tempDir, generateUniqueFilename(`faded_${index}`, 'mp4'));
            const fadeInDuration = transitionDuration / 2;
            const fadeOutDuration = transitionDuration / 2;
            // Durasi hold = total durasi klip - durasi transisi
            const holdDuration = clipDuration - transitionDuration;

            // ffmpeg command untuk menambahkan fade in dan fade out
            // Gunakan filter_complex untuk chaining filter
            // fade=t=in:st=0:d=... : Fade in
            // fade=t=out:st=...:d=... : Fade out
            const fadeCommand = `ffmpeg -y -i "${inputPath}" -vf "fade=t=in:st=0:d=${fadeInDuration},fade=t=out:st=${holdDuration + fadeInDuration}:d=${fadeOutDuration}" -c:v libx264 -preset fast -t ${clipDuration} -c:a aac -b:a 128k "${fadedPath}"`;
            console.log(`[videoMerger] Menambahkan fade ke klip video ${index + 1}: ${fadeCommand}`);
            await execPromise(fadeCommand);
            processedClipPaths.push(fadedPath);
            return fadedPath;
        });
        await Promise.all(addFadePromises);

        // 4. Gabungkan semua klip yang sudah diproses menggunakan filter_complex xfade
        // Ini adalah cara yang lebih baik untuk transisi antar video
        if (processedClipPaths.length < 2) {
             throw new Error("Diperlukan minimal 2 video untuk digabung.");
        }

        // Bangun chain filter_complex untuk xfade
        // Format: [0:v][1:v]xfade=transition=fade:duration=Td:offset=To[vout0];[vout0][2:v]xfade=...[vout1];...
        let filterComplexString = "";
        let lastVideoLabel = "[0:v]"; // Label video dari input pertama
        let lastAudioLabel = "[0:a]"; // Label audio dari input pertama
        let currentOutputLabelVideo = "";
        let currentOutputLabelAudio = "";

        for (let i = 1; i < processedClipPaths.length; i++) {
             // Offset untuk xfade adalah (i * clipDuration) - (transitionDuration / 2)
             // Ini membuat transisi dimulai di tengah-tengah durasi overlap
             const offset = (i * clipDuration) - (transitionDuration / 2);
             currentOutputLabelVideo = `[vout${i-1}]`;
             currentOutputLabelAudio = `[aout${i-1}]`;

             filterComplexString += `[${i-1}:v][${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${currentOutputLabelVideo};`;
             filterComplexString += `[${i-1}:a][${i}:a] acrossfade=d=${transitionDuration} ${currentOutputLabelAudio};`;
             lastVideoLabel = currentOutputLabelVideo;
             lastAudioLabel = currentOutputLabelAudio;
        }
        // Label akhir untuk video dan audio output
        const finalVideoLabel = currentOutputLabelVideo || "[0:v]";
        const finalAudioLabel = currentOutputLabelAudio || "[0:a]";

        // 5. Siapkan input files untuk ffmpeg
        const inputArgs = processedClipPaths.map(p => `-i "${p}"`).join(' ');

        // 6. Perintah ffmpeg final untuk menggabungkan dengan xfade
        // -c:v libx264 -preset medium -crf 23: Encoding video dengan kualitas baik
        // -c:a aac -b:a 128k: Encoding audio
        // -map label_akhir_video -map label_akhir_audio: Pilih stream output akhir
        const mergeCommand = `ffmpeg -y ${inputArgs} -filter_complex "${filterComplexString.slice(0, -1)}" -map "${finalVideoLabel}" -map "${finalAudioLabel}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -vsync vfr "${outputPath}"`;
        console.log(`[videoMerger] Menggabungkan klip dengan xfade: ${mergeCommand}`);
        await execPromise(mergeCommand);
        console.log(`[videoMerger] Video final berhasil dibuat di: ${outputPath}`);

    } catch (error) {
        console.error('[videoMerger] Error saat menggabungkan video:', error.message);
        if (error.stdout) console.error('[videoMerger] FFmpeg stdout:', error.stdout);
        if (error.stderr) console.error('[videoMerger] FFmpeg stderr:', error.stderr);
        throw error;
    } finally {
        // 7. Bersihkan file sementara
        const tempFiles = [...downloadedVideoPaths, ...resizedVideoPaths, ...processedClipPaths].filter(Boolean);
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


// Fungsi Router Plugin
function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "GET",
                path: "/merge-videos",
                description: "Gabungkan 8 klip video (URL) dengan transisi fade menjadi 1 video berdurasi ~64 detik (resolusi 1280x720). Parameter: videoUrl (comma-separated URLs)"
            }
        ]
    });

    app.get("/merge-videos", async (req, res) => {
        try {
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
            // Durasi klip 8 detik, transisi 1 detik, resolusi 1280x720
            // Total durasi teoritis = 8 klip * 8 detik = 64 detik (dengan overlap transisi)
            console.log(`[videoMerger] Memulai penggabungan 8 video...`);
            await mergeVideosWithTransitions(videoUrls, videoOutputPath, 1280, 720, 8, 1);

            // 4. Tentukan URL video hasil
            const videoUrl = `/videos/${outputFilename}`;

            // 5. Kirim respons sukses
            res.json({
                status: true,
                message: "Video berhasil digabung dengan transisi (1280x720, ~64 detik).",
                videoUrl: videoUrl
            });

        } catch (error) {
            console.error('[videoMerger] Error di handler route:', error.message);
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat menggabungkan video.",
                // error: error.message // Sembunyikan detail error di produksi
            });
        }
    });
}

module.exports = router;