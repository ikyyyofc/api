// public/script.js
document.addEventListener('DOMContentLoaded', function() {
    const pluginsContainer = document.getElementById('plugins-container');
    const endpointsContainer = document.getElementById('endpoints-container');
    const methodSelect = document.getElementById('method');
    const endpointInput = document.getElementById('endpoint');
    const bodyInput = document.getElementById('body-input');
    const requestBody = document.getElementById('request-body');
    const queryParams = document.getElementById('query-params');
    const sendButton = document.getElementById('send-request');
    const responseOutput = document.getElementById('response-output');

    // Memuat data plugin dan endpoint
    fetch('/api/plugins')
        .then(response => response.json())
        .then(data => {
            renderPlugins(data.plugins);
            renderEndpoints(data.routes);
        })
        .catch(error => {
            console.error('Error loading plugins:', error);
            pluginsContainer.innerHTML = '<p>Error loading plugins. Please try again later.</p>';
        });

    // Render plugin cards
    function renderPlugins(plugins) {
        pluginsContainer.innerHTML = '';
        
        plugins.forEach(plugin => {
            const pluginCard = document.createElement('div');
            pluginCard.className = 'plugin-card';
            pluginCard.innerHTML = `
                <h3>${plugin}</h3>
                <p>Active Plugin</p>
            `;
            
            pluginCard.addEventListener('click', () => {
                alert(`Plugin ${plugin} is currently active.`);
            });
            
            pluginsContainer.appendChild(pluginCard);
        });
    }

    // Render endpoint cards
    function renderEndpoints(routes) {
        endpointsContainer.innerHTML = '';
        
        routes.forEach(routeGroup => {
            routeGroup.endpoints.forEach(endpoint => {
                const endpointCard = document.createElement('div');
                endpointCard.className = 'endpoint-card';
                endpointCard.innerHTML = `
                    <div class="endpoint-header">
                        <span class="endpoint-method">${endpoint.method}</span>
                        <span class="endpoint-path">${endpoint.path}</span>
                    </div>
                    <p class="endpoint-description">${endpoint.description}</p>
                    <span class="endpoint-plugin">${routeGroup.plugin}</span>
                `;
                
                // Tambahkan event listener untuk mengisi form saat card diklik
                endpointCard.addEventListener('click', () => {
                    methodSelect.value = endpoint.method;
                    endpointInput.value = endpoint.path;
                    
                    // Tampilkan/hide body input berdasarkan method
                    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
                        bodyInput.style.display = 'block';
                    } else {
                        bodyInput.style.display = 'none';
                    }
                    
                    // Scroll ke form interaksi
                    document.querySelector('.interaction-section').scrollIntoView({ 
                        behavior: 'smooth' 
                    });
                });
                
                endpointsContainer.appendChild(endpointCard);
            });
        });
    }

    // Tampilkan/sembunyikan input body berdasarkan method
    methodSelect.addEventListener('change', function() {
        if (this.value === 'POST' || this.value === 'PUT') {
            bodyInput.style.display = 'block';
        } else {
            bodyInput.style.display = 'none';
        }
    });

    // Kirim request API
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
        responseOutput.innerHTML = '<p>Loading...</p>';
        
        // Kirim request
        fetch(url, fetchOptions)
            .then(async response => {
                // Simpan content-type dari header
                const contentType = response.headers.get('content-type') || '';
                
                // Cek apakah respons adalah binary content (gambar/video)
                if (contentType.includes('image/') || contentType.includes('video/')) {
                    // Jika ini adalah gambar/video, baca sebagai blob
                    const blob = await response.blob();
                    return {
                        type: 'binary',
                        data: blob,
                        contentType: contentType
                    };
                } else {
                    // Untuk JSON atau teks lainnya
                    try {
                        const jsonData = await response.json();
                        return {
                            type: 'json',
                            data: jsonData,
                            status: response.status
                        };
                    } catch (e) {
                        // Jika bukan JSON, coba baca sebagai teks
                        const textData = await response.text();
                        return {
                            type: 'text',
                            data: textData,
                            status: response.status
                        };
                    }
                }
            })
            .then(result => {
                // Bersihkan output sebelumnya
                responseOutput.innerHTML = '';
                
                // Tangani respons berdasarkan jenisnya
                if (result.type === 'binary') {
                    if (result.contentType.includes('image/')) {
                        // Untuk gambar
                        const img = document.createElement('img');
                        img.src = URL.createObjectURL(result.data);
                        img.alt = 'Image Response';
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                        responseOutput.appendChild(img);
                    } else if (result.contentType.includes('video/')) {
                        // Untuk video
                        const video = document.createElement('video');
                        video.src = URL.createObjectURL(result.data);
                        video.controls = true;
                        video.style.maxWidth = '100%';
                        video.style.height = 'auto';
                        responseOutput.appendChild(video);
                    }
                } else if (result.type === 'json') {
                    // Untuk JSON
                    const pre = document.createElement('pre');
                    pre.textContent = JSON.stringify(result.data, null, 2);
                    responseOutput.appendChild(pre);
                } else if (result.type === 'text') {
                    // Untuk teks lainnya
                    const pre = document.createElement('pre');
                    pre.textContent = result.data;
                    responseOutput.appendChild(pre);
                }
            })
            .catch(error => {
                responseOutput.innerHTML = `<p>Error: ${error.message}</p>`;
                console.error('API request error:', error);
            });
    });
});