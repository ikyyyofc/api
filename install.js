const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Plugin REST API...\n');

// Buat folder yang diperlukan
const folders = ['public', 'plugins', 'logs', 'scripts'];

folders.forEach(folder => {
  const folderPath = path.join(__dirname, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`📁 Created folder: ${folder}`);
  }
});

// Copy file .env.example ke .env jika belum ada
const envExample = path.join(__dirname, '.env.example');
const envFile = path.join(__dirname, '.env');

if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile);
  console.log('📝 Created .env file from template');
}

console.log('\n✅ Setup completed successfully!');
console.log('\n🎯 Next steps:');
console.log('1. Copy your files to the appropriate folders');
console.log('2. Run: npm install');
console.log('3. Run: npm run dev');
console.log('4. Open: http://localhost:7680\n');