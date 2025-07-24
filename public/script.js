// public/script.js
sendButton.addEventListener('click', function() {
    const method = methodSelect.value;
    let url = endpointInput.value.trim();
    const body = requestBody.value.trim();
    const queryParamsValue = queryParams.value.trim();

    // Validasi input
    if (!url) {
        alert('Please enter an endpoint URL');
        return;
    }

    // Tambahkan prefix / jika tidak ada
    if (!url.startsWith('/')) {
        url = '/' + url;
    }

    // Tambahkan parameter query ke URL jika ada
    if (queryParamsValue && method === 'GET') {
        const params = queryParamsValue.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .reduce((acc, line) => {
                const [key, value] = line.split('=');
                if (key && value !== undefined) {
                    acc[key.trim()] = value.trim();
                }
                return acc;
            }, {});
        
        const searchParams = new URLSearchParams(params);
        url += '?' + searchParams.toString();
    }

    // Siapkan opsi fetch
    const fetchOptions = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // Tambahkan body untuk method yang memerlukan
    if ((method === 'POST' || method === 'PUT') && body) {
        try {
            fetchOptions.body = JSON.stringify(JSON.parse(body));
        } catch (e) {
            alert('Invalid JSON in request body');
            return;
        }
    }

    // Tampilkan loading
    responseOutput.textContent = 'Loading...';

    // Kirim request
    fetch(url, fetchOptions)
        .then(response => {
            // Cek Content-Type untuk menentukan tindakan selanjutnya
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.startsWith('image/')) {
                // Jika respons adalah gambar, buat elemen <img> untuk menampilkannya
                return response.blob().then(blob => {
                    const imageUrl = URL.createObjectURL(blob);
                    responseOutput.innerHTML = `<img src="${imageUrl}" alt="Image Response">`;
                });
            } else if (contentType && contentType.startsWith('video/')) {
                // Jika respons adalah video, buat elemen <video> untuk menampilkannya
                return response.blob().then(blob => {
                    const videoUrl = URL.createObjectURL(blob);
                    responseOutput.innerHTML = `
                        <video controls width="640" height="360">
                            <source src="${videoUrl}" type="${contentType}">
                            Your browser does not support the video tag.
                        </video>
                    `;
                });
            } else {
                // Untuk respons lainnya (misalnya JSON), gunakan text()
                return response.text();
            }
        })
        .then(data => {
            // Tampilkan respons
            if (typeof data === 'string') {
                try {
                    // Coba parse sebagai JSON
                    const parsedData = JSON.parse(data);
                    responseOutput.textContent = JSON.stringify(parsedData, null, 2);
                } catch (e) {
                    // Jika bukan JSON, tampilkan sebagai teks biasa
                    responseOutput.textContent = data;
                }
            }
        })
        .catch(error => {
            responseOutput.textContent = `Error: ${error.message}`;
            console.error('API request error:', error);
        });
});