// public/script.js (versi lengkap yang diperbarui)
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
        responseOutput.textContent = 'Loading...';
        
        // Kirim request
        fetch(url, fetchOptions)
            .then(response => {
                // Format response berdasarkan content-type
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return response.json();
                } else {
                    return response.text();
                }
            })
            .then(data => {
                // Tampilkan response
                if (typeof data === 'object') {
                    responseOutput.textContent = JSON.stringify(data, null, 2);
                } else {
                    responseOutput.textContent = data;
                }
            })
            .catch(error => {
                responseOutput.textContent = `Error: ${error.message}`;
                console.error('API request error:', error);
            });
    });
});