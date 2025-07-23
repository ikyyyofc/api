// plugins/productPlugin.js
function router(app, routes = []) {

  // Menyimpan informasi route
  routes.push({
    plugin: 'chatgpt request',
    endpoints: [
      { method: 'GET', path: '/text', description: 'Get all products' },
      { method: 'POST', path: '/post', description: 'Create new product' }
    ]
  });

  // GET /products - Mendapatkan semua produk
  app.get('/text', (req, res) => {
    res.json({true});
  });

  // POST /products - Menambahkan produk baru
  app.post('/post', (req, res) => {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text are required' });
    }
    
    
    res.status(201).json({true});
  });
}

module.exports = router;