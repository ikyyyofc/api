export default {
  id: 'brat-generator',
  name: 'Brat Album Cover Generator',
  description: 'Membuat gambar dengan gaya cover album Brat (Charli XCX) yang viral.',
  method: 'get',
  path: '/api/tools/brat',
  tags: ['Image Generator'],
  parameters: [
    { in: 'query', name: 'text', type: 'string', required: true, description: 'Teks yang ingin ditampilkan (contoh: brat)' },
    { in: 'query', name: 'format', type: 'string', required: false, description: 'Format output: "json" (default) atau "image"' }
  ],
  handler: async (req, res) => {
    try {
      const text = req.query.text || 'brat';
      const format = req.query.format || 'json';
      
      // Sanitasi teks untuk mencegah XSS di dalam SVG dan ubah ke lowercase (khas Brat)
      const safeText = text.toLowerCase()
                           .replace(/&/g, '&amp;')
                           .replace(/</g, '&lt;')
                           .replace(/>/g, '&gt;');
      
      // Kalkulasi ukuran font dinamis agar teks panjang tidak terpotong (Max width 500px)
      const fontSize = Math.min(130, Math.floor(1000 / Math.max(1, safeText.length)));
      
      // Kalkulasi jarak antar huruf (letter-spacing) agar terlihat rapat
      const letterSpacing = -Math.max(1, Math.floor(fontSize / 25));

      // Template SVG dengan filter blur (low-resolution effect) dan warna hijau #8ACE00
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <filter id="blur">
      <feGaussianBlur stdDeviation="1.2" />
    </filter>
  </defs>
  <rect width="500" height="500" fill="#8ACE00" />
  <text 
    x="50%" 
    y="50%" 
    font-family="'Arial Narrow', Arial, sans-serif" 
    font-size="${fontSize}" 
    fill="black" 
    text-anchor="middle" 
    dominant-baseline="middle" 
    filter="url(#blur)" 
    letter-spacing="${letterSpacing}"
  >
    ${safeText}
  </text>
</svg>`;

      // Jika user meminta format gambar langsung (bisa dirender di tag <img> HTML)
      if (format === 'image') {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svg);
      }

      // Jika format JSON (Default), encode SVG ke Base64 Data URI
      const base64Svg = Buffer.from(svg).toString('base64');
      const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

      return res.json({
        success: true,
        data: {
          text: safeText,
          imageUrl: dataUri,
          svg: svg
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};