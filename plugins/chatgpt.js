module.exports = {
  name: 'nama-plugin',
  version: '1.0.0',
  description: 'Deskripsi plugin',
  
  routes: [
    {
      method: 'POST', // GET, POST, PUT, DELETE, PATCH, etc.
      path: '/api/tes',
      middleware: [middlewareFunction], // Opsional
      handler: (req, res) => {
        // Handler function
        res.json({ message: 'Hello from plugin!' });
      }
    }
  ]
};