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

// Fungsi utama untuk menggabungkan klip video dengan transisi fade
async function mergeVideosWithFade(videoUrls, outputPath, totalDuration = 64, transitionDuration = 1) {
    const tempDir = os.tmpdir();
    const downloadedVideoPaths = [];
    const processedClipPaths = []; // Paths untuk klip yang sudah diproses (durasi & fade)

    try {
        console.log(`[videoMerger] Memulai proses penggabungan video...`);
        console.log(`[videoMerger] Jumlah video: ${videoUrls.length}`);
        console.log(`[videoMerger] Durasi total target: ${totalDuration} detik`);
        console.log(`[videoMerger] Durasi transisi: ${transitionDuration} detik`);

        if (videoUrls.length !== 8) {
             throw new Error(`Diperlukan tepat 8 URL video. Diterima: ${videoUrls.length}`);
        }

        // 1. Hitung durasi per klip (termasuk transisi)
        // Durasi tayang per klip = (totalDuration / jumlah_klip) - (transition_duration * (jumlah_klip - 1) / jumlah_klip)
        // Namun, untuk kesederhanaan dan memastikan durasi total, kita gunakan durasi tetap per klip termasuk transisi.
        // Total transisi = (jumlah_klip - 1) * transition_duration
        // Durasi tayang bersih = totalDuration - total_transisi
        // Durasi tayang per klip = durasi_tayang_bersih / jumlah_klip
        // Durasi klip input = durasi_tayang_per_klip + transition_duration

        const totalTransitions = (videoUrls.length - 1) * transitionDuration;
        const cleanPlayDuration = totalDuration - totalTransitions;
        const displayDurationPerClip = cleanPlayDuration / videoUrls.length;
        const inputClipDuration = displayDurationPerClip + transitionDuration; // Durasi klip input yang akan diambil

        console.log(`[videoMerger] Total durasi transisi: ${totalTransitions}s`);
        console.log(`[videoMerger] Total durasi tayang bersih: ${cleanPlayDuration}s`);
        console.log(`[videoMerger] Durasi tayang per klip: ${displayDurationPerClip}s`);
        console.log(`[videoMerger] Durasi input per klip (dengan buffer transisi): ${inputClipDuration}s`);

        // 2. Download semua video
        const downloadPromises = videoUrls.map(async (url, index) => {
            const videoPath = path.join(tempDir, generateUniqueFilename(`clip_${index}`, 'mp4')); // Asumsi MP4
            console.log(`[videoMerger] Mendownload video ${index + 1}: ${url}`);
            await execPromise(`curl -L -o "${videoPath}" "${url}"`);
            console.log(`[videoMerger] Video ${index + 1} disimpan di: ${videoPath}`);
            downloadedVideoPaths.push(videoPath);
            return videoPath;
        });
        await Promise.all(downloadPromises);

        // 3. Potong dan tambahkan efek fade ke setiap klip
        // Kita akan membuat klip yang sudah dipotong dan memiliki efek fade in/out
        const processPromises = downloadedVideoPaths.map(async (inputPath, index) => {
             // Untuk klip pertama, tidak perlu fade out di awal.
             // Untuk klip terakhir, tidak perlu fade in di akhir.
             // Untuk klip tengah, ada fade out di awal dan fade in di akhir.

             // Durasi yang diambil dari klip input
             const takeDuration = inputClipDuration;

             const processedPath = path.join(tempDir, generateUniqueFilename(`processed_clip_${index}`, 'mp4'));

             // Gunakan filter_complex untuk trim dan fade
             // fade=t=in:st=0:d=transitionDuration (fade in dari awal klip yang diambil)
             // fade=t=out:st=(takeDuration - transitionDuration):d=transitionDuration (fade out menjelang akhir klip yang diambil)
             const trimAndFadeCommand = `ffmpeg -y -i "${inputPath}" -ss 0 -t ${takeDuration} -vf "fade=t=in:st=0:d=${transitionDuration},fade=t=out:st=${takeDuration - transitionDuration}:d=${transitionDuration}" -c:v libx264 -c:a aac -strict experimental -pix_fmt yuv420p "${processedPath}"`;
             console.log(`[videoMerger] Memproses klip ${index + 1} (trim & fade): ${trimAndFadeCommand}`);
             await execPromise(trimAndFadeCommand);
             processedClipPaths.push(processedPath);
             console.log(`[videoMerger] Klip ${index + 1} diproses: ${processedPath}`);
             return processedPath;
        });
        await Promise.all(processPromises);

         // 4. Buat file list untuk ffmpeg concat demuxer
        const listFilePath = path.join(tempDir, generateUniqueFilename('filelist', 'txt'));
        const listContent = processedClipPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(listFilePath, listContent);

        // 5. Gabungkan video menggunakan concat filter dengan crossfade
        // Karena kita sudah menambahkan fade in/out di setiap klip, kita bisa langsung concatenate.
        // Namun, untuk transisi *crossfade* yang halus antar klip, kita butuh filter_complex yang lebih kompleks.
        // Kita akan gunakan `concat` filter dengan parameter `v=1:a=1` untuk video dan audio.

        // Perintah dasar concat
        // const concatCommand = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`;

        // Untuk transisi crossfade yang benar-benar halus antar klip, kita gunakan filter_complex concat dengan parameter transisi.
        // Ini lebih kompleks, tapi memberikan hasil yang lebih baik.
        // Kita bangun string filter_complex secara dinamis.

        let filterComplexString = "";
        let inputLabels = processedClipPaths.map((_, i) => `[${i}:v][${i}:a]`).join('');
        let concatInputs = processedClipPaths.map((_, i) => `[v${i}][a${i}]`).join('');

        // Buat filter untuk setiap klip: ambil stream video dan audio
        for (let i = 0; i < processedClipPaths.length; i++) {
            filterComplexString += `[${i}:v][${i}:a]`;
        }

        // Buat filter concat: 8 video, 8 audio, 7 transisi (crossfade)
        filterComplexString += `concat=n=${processedClipPaths.length}:v=1:a=1`;

        // Tambahkan parameter transisi crossfade
        // Durasi transisi dalam frame (perkiraan 30fps)
        // const transitionDurationFrames = Math.round(transitionDuration * 30);
        // filterComplexString += `:transition=${transitionDurationFrames}`;

        // Tanpa parameter transition (default concatenate)
        filterComplexString += `[vout][aout]`;

        const finalConcatCommand = `ffmpeg -y ${processedClipPaths.map(p => `-i "${p}"`).join(' ')} -filter_complex "${filterComplexString}" -map "[vout]" -map "[aout]" -c:v libx264 -c:a aac -strict experimental -shortest "${outputPath}"`;
        console.log(`[videoMerger] Menggabungkan klip dengan transisi: ${finalConcatCommand}`);
        await execPromise(finalConcatCommand);
        console.log(`[videoMerger] Video final berhasil dibuat di: ${outputPath}`);


    } catch (error) {
        console.error('[videoMerger] Error saat menggabungkan video:', error.message);
        if (error.stdout) console.error('[videoMerger] FFmpeg stdout:', error.stdout);
        if (error.stderr) console.error('[videoMerger] FFmpeg stderr:', error.stderr);
        throw error;
    } finally {
       // 6. Bersihkan file sementara
        const tempFiles = [...downloadedVideoPaths, ...processedClipPaths, ...(fs.existsSync(listFilePath) ? [listFilePath] : [])].filter(Boolean);
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
        // Hapus file list khusus jika ada (dengan pola)
        try {
             const listFiles = fs.readdirSync(tempDir).filter(fn => fn.startsWith('temp_filelist_') && fn.endsWith('.txt')).map(fn => path.join(tempDir, fn));
             listFiles.forEach(fp => { if (fs.existsSync(fp)) fs.unlinkSync(fp); console.log(`[videoMerger] File list sementara dihapus: ${fp}`); });
        } catch (err) { console.warn(`[videoMerger] Gagal menghapus file list sementara`, err.message); }
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
                description: "Gabungkan 8 klip video (URL) menjadi 1 video berdurasi 64 detik dengan transisi fade. Parameter: videoUrl (comma-separated URLs)"
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

            // 3. Panggil fungsi mergeVideosWithFade
            console.log(`[videoMerger] Memulai penggabungan 8 video...`);
            // Durasi total 64 detik, durasi transisi default 1 detik
            await mergeVideosWithFade(videoUrls, videoOutputPath, 64, 1);

            // 4. Tentukan URL video hasil
            const videoUrl = `/videos/${outputFilename}`;

            // 5. Kirim respons sukses
            res.json({
                status: true,
                message: "Video berhasil digabungkan (64 detik dengan fade).",
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