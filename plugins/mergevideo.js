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

// Fungsi utama untuk menggabungkan foto dan audio menjadi slideshow video
async function createSlideshow(photoUrls, audioUrl, outputPath, photoDuration = 5, transitionDuration = 1) {
    const tempDir = os.tmpdir();
    const photoPaths = [];
    const resizedPhotoPaths = []; // Paths untuk foto yang sudah di-resize
    const fadedPhotoPaths = [];  // Paths untuk foto yang sudah ditambahkan fade
    let audioPath = null;

    try {
        console.log(`[photoSlideshow] Memulai proses slideshow...`);
        console.log(`[photoSlideshow] Photo URLs: ${photoUrls.length}`);
        console.log(`[photoSlideshow] Audio URL: ${audioUrl}`);

        // 1. Download semua foto
        const downloadPhotoPromises = photoUrls.map(async (url, index) => {
            const photoPath = path.join(tempDir, generateUniqueFilename(`photo_${index}`, 'png'));
            console.log(`[photoSlideshow] Mendownload foto ${index + 1}: ${url}`);
            await execPromise(`curl -L -o "${photoPath}" "${url}"`);
            console.log(`[photoSlideshow] Foto ${index + 1} disimpan di: ${photoPath}`);
            photoPaths.push(photoPath);
            return photoPath;
        });
        await Promise.all(downloadPhotoPromises);

        // 2. Resize semua foto ke resolusi yang konsisten (misal 1920x1080)
        // Ini penting agar transisi bekerja dengan baik
        const resizePromises = photoPaths.map(async (inputPath, index) => {
            const resizedPath = path.join(tempDir, generateUniqueFilename(`resized_${index}`, 'png'));
            // Gunakan ffmpeg untuk resize dengan padding jika rasio tidak sesuai
            const resizeCommand = `ffmpeg -y -i "${inputPath}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" "${resizedPath}"`;
            console.log(`[photoSlideshow] Resizing foto ${index + 1}: ${resizeCommand}`);
            await execPromise(resizeCommand);
            resizedPhotoPaths.push(resizedPath);
            return resizedPath;
        });
        await Promise.all(resizePromises);

        // 3. Tambahkan efek fade in dan fade out ke setiap foto
        const fadePromises = resizedPhotoPaths.map(async (inputPath, index) => {
            const fadedPath = path.join(tempDir, generateUniqueFilename(`faded_${index}`, 'mp4'));
            // Durasi total frame = photoDuration
            // Fade in duration = transitionDuration / 2
            // Fade out duration = transitionDuration / 2
            // Hold duration = photoDuration - transitionDuration
            const fadeInDuration = transitionDuration / 2;
            const fadeOutDuration = transitionDuration / 2;
            const holdDuration = photoDuration - transitionDuration;

            // ffmpeg command untuk membuat video pendek dari gambar dengan efek fade
            // Gunakan filter_complex untuk efek yang lebih presisi
            const fadeCommand = `ffmpeg -y -loop 1 -i "${inputPath}" -vf "fade=t=in:st=0:d=${fadeInDuration},fade=t=out:st=${holdDuration + fadeInDuration}:d=${fadeOutDuration}" -c:v libx264 -t ${photoDuration} -pix_fmt yuv420p "${fadedPath}"`;
            console.log(`[photoSlideshow] Menambahkan fade ke foto ${index + 1}: ${fadeCommand}`);
            await execPromise(fadeCommand);
            fadedPhotoPaths.push(fadedPath);
            return fadedPath;
        });
        await Promise.all(fadePromises);

        // 4. Download audio
        audioPath = path.join(tempDir, generateUniqueFilename('audio', 'mp3')); // Sesuaikan ekstensi jika perlu
        console.log(`[photoSlideshow] Mendownload audio: ${audioUrl}`);
        await execPromise(`curl -L -o "${audioPath}" "${audioUrl}"`);
        console.log(`[photoSlideshow] Audio disimpan di: ${audioPath}`);

        // 5. Gabungkan semua video pendek (dengan fade) menjadi satu video
        // Buat file list untuk ffmpeg concat demuxer
        const listFilePath = path.join(tempDir, generateUniqueFilename('filelist', 'txt'));
        const listContent = fadedPhotoPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(listFilePath, listContent);
        const concatVideoPath = path.join(tempDir, generateUniqueFilename('concatenated', 'mp4'));

        // Gunakan concat demuxer untuk menggabungkan video
        const concatCommand = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${concatVideoPath}"`;
        console.log(`[photoSlideshow] Menggabungkan video dengan fade: ${concatCommand}`);
        await execPromise(concatCommand);
        console.log(`[photoSlideshow] Video dengan fade digabungkan: ${concatVideoPath}`);

        // 6. Gabungkan video hasil dengan audio
        // Gunakan -shortest untuk memastikan durasi mengikuti yang terpendek jika audio lebih pendek dari 60 detik
        // Atau gunakan -t 60 untuk memotong audio jika lebih panjang
        const finalCommand = `ffmpeg -y -i "${concatVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;
        console.log(`[photoSlideshow] Menggabungkan video dan audio: ${finalCommand}`);
        await execPromise(finalCommand);
        console.log(`[photoSlideshow] Slideshow video final berhasil dibuat di: ${outputPath}`);

    } catch (error) {
        console.error('[photoSlideshow] Error saat membuat slideshow:', error.message);
        // Log stdout/stderr jika ada untuk debugging
        if (error.stdout) console.error('[photoSlideshow] FFmpeg stdout:', error.stdout);
        if (error.stderr) console.error('[photoSlideshow] FFmpeg stderr:', error.stderr);
        throw error;
    } finally {
        // 7. Bersihkan file sementara
        const tempFiles = [...photoPaths, ...resizedPhotoPaths, ...fadedPhotoPaths, audioPath, ...(fadedPhotoPaths.length > 0 ? [path.join(tempDir, 'filelist*.txt')] : [])].filter(Boolean);
        tempFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[photoSlideshow] File sementara dihapus: ${filePath}`);
                }
            } catch (err) {
                 // Abaikan error penghapusan, mungkin file sudah dihapus atau digunakan
                console.warn(`[photoSlideshow] Gagal menghapus file sementara: ${filePath}`, err.message);
            }
        });
        // Hapus file list khusus jika ada
        try {
             const listFiles = fs.readdirSync(tempDir).filter(fn => fn.startsWith('temp_filelist_') && fn.endsWith('.txt')).map(fn => path.join(tempDir, fn));
             listFiles.forEach(fp => { if (fs.existsSync(fp)) fs.unlinkSync(fp); console.log(`[photoSlideshow] File list sementara dihapus: ${fp}`); });
        } catch (err) { console.warn(`[photoSlideshow] Gagal menghapus file list sementara`, err.message); }
    }
}

// Fungsi Router Plugin
function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "GET",
                path: "/create-slideshow",
                description: "Gabungkan 12 foto PNG (URL) dan 1 audio (URL) menjadi 1 video slideshow 60 detik dengan transisi fade. Parameter: photoUrl (comma-separated URLs), audioUrl"
            }
        ]
    });

    app.get("/create-slideshow", async (req, res) => {
        try {
            // 1. Ambil dan parsing parameter
            const rawPhotoUrls = req.query.photoUrl;
            const audioUrl = req.query.audioUrl;

            if (!rawPhotoUrls || !audioUrl) {
                return res.status(400).json({
                    status: false,
                    message: "Parameter 'photoUrl' (comma-separated) dan 'audioUrl' diperlukan."
                });
            }

            const photoUrls = rawPhotoUrls.split(',').map(url => url.trim()).filter(url => url.length > 0);

            if (photoUrls.length !== 12) {
                 return res.status(400).json({
                    status: false,
                    message: `Diperlukan tepat 12 URL foto. Ditemukan: ${photoUrls.length}.`
                });
            }

            // 2. Tentukan path output video
            const outputDir = path.join(__dirname, '..', 'public', 'videos');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const outputFilename = generateUniqueFilename('slideshow', 'mp4');
            const videoOutputPath = path.join(outputDir, outputFilename);

            // 3. Panggil fungsi createSlideshow
            console.log(`[photoSlideshow] Memulai pembuatan slideshow...`);
            await createSlideshow(photoUrls, audioUrl, videoOutputPath, 5, 1); // 5 detik per foto, 1 detik transisi

            // 4. Tentukan URL video hasil
            const videoUrl = `/videos/${outputFilename}`;

            // 5. Kirim respons sukses
            res.json({
                status: true,
                message: "Slideshow video berhasil dibuat.",
                videoUrl: videoUrl
            });

        } catch (error) {
            console.error('[photoSlideshow] Error di handler route:', error.message);
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat membuat slideshow.",
                // error: error.message // Hapus atau sembunyikan detail error di produksi
            });
        }
    });
}

module.exports = router;