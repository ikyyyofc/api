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

// Fungsi utama untuk menggabungkan 8 klip video dengan transisi
async function mergeVideosWithTransitions(videoUrls, outputPath, clipDuration = 8, transitionDuration = 1) {
    const tempDir = os.tmpdir();
    const downloadedVideoPaths = [];
    const processedClipPaths = []; // Paths untuk klip yang sudah dipotong & ditambahkan fade
    const listFilePath = path.join(tempDir, generateUniqueFilename('filelist', 'txt'));

    try {
        console.log(`[videoMerger] Memulai proses penggabungan 8 video...`);
        console.log(`[videoMerger] Durasi klip: ${clipDuration} detik, Durasi transisi: ${transitionDuration} detik`);
        console.log(`[videoMerger] Video URLs: ${videoUrls.length}`);

        // 1. PROSES SECARA BERURUTAN: Download, Potong, dan Tambahkan Fade
        for (let i = 0; i < videoUrls.length; i++) {
            const videoUrl = videoUrls[i];
            console.log(`[videoMerger] [Langkah 1.${i+1}] Memproses klip video ${i + 1}/${videoUrls.length}: ${videoUrl}`);

            // --- a. Download Video ---
            const downloadedPath = path.join(tempDir, generateUniqueFilename(`downloaded_clip_${i}`, 'mp4'));
            console.log(`[videoMerger] [1.${i+1}.a] Mendownload klip ${i + 1}...`);
            await execPromise(`curl -L -o "${downloadedPath}" "${videoUrl}"`);
            console.log(`[videoMerger] [1.${i+1}.a] Klip ${i + 1} diunduh ke: ${downloadedPath}`);
            downloadedVideoPaths.push(downloadedPath);

            // --- b. Potong Video menjadi durasi klip (clipDuration) ---
            const trimmedPath = path.join(tempDir, generateUniqueFilename(`trimmed_clip_${i}`, 'mp4'));
            console.log(`[videoMerger] [1.${i+1}.b] Memotong klip ${i + 1} menjadi ${clipDuration} detik...`);
            // Gunakan -t untuk durasi, -avoid_negative_ts make_zero untuk menghindari timestamp negatif
            const trimCommand = `ffmpeg -y -ss 0 -i "${downloadedPath}" -t ${clipDuration} -c copy -avoid_negative_ts make_zero "${trimmedPath}"`;
            await execPromise(trimCommand);
            console.log(`[videoMerger] [1.${i+1}.b] Klip ${i + 1} dipotong: ${trimmedPath}`);

            // --- c. Tambahkan Efek Fade In dan Fade Out ---
            const processedPath = path.join(tempDir, generateUniqueFilename(`processed_clip_${i}`, 'mp4'));
            console.log(`[videoMerger] [1.${i+1}.c] Menambahkan fade ke klip ${i + 1}...`);

            let filterComplex = '';
            if (i === 0) {
                // Klip pertama: hanya fade-out di akhir
                const holdDuration = clipDuration - transitionDuration;
                filterComplex = `fade=t=out:st=${holdDuration}:d=${transitionDuration}`;
                console.log(`[videoMerger] [1.${i+1}.c] Fade-out saja untuk klip pertama.`);
            } else if (i === videoUrls.length - 1) {
                // Klip terakhir: hanya fade-in di awal
                filterComplex = `fade=t=in:st=0:d=${transitionDuration}`;
                 console.log(`[videoMerger] [1.${i+1}.c] Fade-in saja untuk klip terakhir.`);
            } else {
                // Klip tengah: fade-in di awal dan fade-out di akhir
                const holdDuration = clipDuration - transitionDuration;
                filterComplex = `fade=t=in:st=0:d=${transitionDuration},fade=t=out:st=${holdDuration}:d=${transitionDuration}`;
                 console.log(`[videoMerger] [1.${i+1}.c] Fade-in dan fade-out untuk klip tengah.`);
            }

            // Gunakan -c:a copy jika ingin cepat dan format audio kompatibel, atau -c:a aac jika perlu transcoding
            const fadeCommand = `ffmpeg -y -i "${trimmedPath}" -vf "${filterComplex}" -c:v libx264 -c:a aac -strict experimental -pix_fmt yuv420p "${processedPath}"`;
            await execPromise(fadeCommand);
            console.log(`[videoMerger] [1.${i+1}.c] Klip ${i + 1} selesai diproses dengan fade: ${processedPath}`);
            processedClipPaths.push(processedPath);

            // --- d. Bersihkan file sementara klip ini (downloaded & trimmed) ---
            try {
                if (fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);
                console.log(`[videoMerger] [1.${i+1}.d] File sementara dihapus: ${downloadedPath}`);
            } catch (err) { console.warn(`[videoMerger] [1.${i+1}.d] Gagal hapus: ${downloadedPath}`, err.message); }
            try {
                if (fs.existsSync(trimmedPath)) fs.unlinkSync(trimmedPath);
                console.log(`[videoMerger] [1.${i+1}.d] File sementara dihapus: ${trimmedPath}`);
            } catch (err) { console.warn(`[videoMerger] [1.${i+1}.d] Gagal hapus: ${trimmedPath}`, err.message); }
        }

        // 2. Buat File List untuk FFmpeg Concat Demuxer
        console.log(`[videoMerger] [Langkah 2] Membuat file list untuk penggabungan...`);
        const listContent = processedClipPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(listFilePath, listContent);
        console.log(`[videoMerger] [Langkah 2] File list dibuat: ${listFilePath}`);

        // 3. Gabungkan Video dengan Transisi Menggunakan FFmpeg Concat Filter
        // Karena kita sudah menambahkan transisi di setiap klip secara individual,
        // kita bisa langsung menggabungkan file-file tersebut.
        // Namun, untuk memastikan transisi terjadi antar klip (dan bukan hanya dalam klip),
        // kita gunakan filter_complex concat dengan parameter v=1:a=1.
        console.log(`[videoMerger] [Langkah 3] Menggabungkan semua klip menjadi video final...`);
        // Siapkan input untuk filter_complex
        let inputString = '';
        processedClipPaths.forEach(p => {
             inputString += `-i "${p}" `;
        });
        const numOfInputs = processedClipPaths.length;

        // Buat filter_complex untuk concat
        // Format: [0:v] [0:a] [1:v] [1:a] ... concat=n=JUMLAH_KLIP:v=1:a=1 [v] [a]
        let concatInputs = '';
        for(let j = 0; j < numOfInputs; j++) {
            concatInputs += `[${j}:v] [${j}:a] `;
        }
        const filterComplexConcat = `${concatInputs}concat=n=${numOfInputs}:v=1:a=1 [v] [a]`;

        // Command gabung akhir
        // Gunakan map [v] dan [a] dari filter_complex
        const finalMergeCommand = `ffmpeg -y ${inputString} -filter_complex "${filterComplexConcat}" -map "[v]" -map "[a]" -c:v libx264 -c:a aac -strict experimental -pix_fmt yuv420p "${outputPath}"`;
        console.log(`[videoMerger] [Langkah 3] Command FFmpeg: ${finalMergeCommand}`);
        await execPromise(finalMergeCommand);
        console.log(`[videoMerger] [Langkah 3] Video final berhasil dibuat di: ${outputPath}`);

    } catch (error) {
        console.error('[videoMerger] Error saat menggabungkan video:', error.message);
        if (error.stdout) console.error('[videoMerger] FFmpeg stdout:', error.stdout);
        if (error.stderr) console.error('[videoMerger] FFmpeg stderr:', error.stderr);
        throw error;
    } finally {
        // 4. Bersihkan Semua File Sementara
        console.log(`[videoMerger] [Langkah 4] Membersihkan file sementara...`);
        const allTempFiles = [...downloadedVideoPaths, ...processedClipPaths, listFilePath].filter(Boolean);
        allTempFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[videoMerger] [Langkah 4] File dihapus: ${filePath}`);
                }
            } catch (err) {
                console.warn(`[videoMerger] [Langkah 4] Gagal hapus: ${filePath}`, err.message);
            }
        });
         // Hapus file list txt lain jika ada
        try {
             const listFiles = fs.readdirSync(tempDir).filter(fn => fn.startsWith('temp_filelist_') && fn.endsWith('.txt')).map(fn => path.join(tempDir, fn));
             listFiles.forEach(fp => { if (fs.existsSync(fp)) fs.unlinkSync(fp); console.log(`[videoMerger] [Langkah 4] File list sementara dihapus: ${fp}`); });
        } catch (err) { console.warn(`[videoMerger] [Langkah 4] Gagal hapus file list sementara`, err.message); }
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
                description: "Gabungkan 8 klip video (URL) menjadi 1 video berdurasi 64 detik (8 detik per klip) dengan transisi fade. Parameter: videoUrl (comma-separated URLs)"
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

            // 3. Panggil fungsi mergeVideosWithTransitions (SECARA BERURUTAN DI DALAM FUNGSI)
            console.log(`[videoMerger] Memulai penggabungan 8 video dengan transisi...`);
            // Durasi klip 8 detik, transisi 1 detik
            await mergeVideosWithTransitions(videoUrls, videoOutputPath, 8, 1);

            // 4. Tentukan URL video hasil
            const videoUrl = `/videos/${outputFilename}`;

            // 5. Kirim respons sukses
            res.json({
                status: true,
                message: "Video berhasil digabung dengan transisi (8 klip, 64 detik).",
                videoUrl: videoUrl
            });

        } catch (error) {
            console.error('[videoMerger] Error di handler route:', error.message);
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat menggabungkan video.",
            });
        }
    });
}

module.exports = router;