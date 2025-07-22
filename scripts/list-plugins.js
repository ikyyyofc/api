const fs = require('fs');
const path = require('path');

function listPlugins() {
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  
  console.log('\n📋 Available Plugins\n');
  
  try {
    if (!fs.existsSync(pluginsDir)) {
      console.log('❌ Plugins directory not found');
      return;
    }
    
    const files = fs.readdirSync(pluginsDir);
    const pluginFiles = files.filter(file => file.endsWith('.js'));
    
    if (pluginFiles.length === 0) {
      console.log('📁 No plugins found');
      return;
    }
    
    pluginFiles.forEach((file, index) => {
      try {
        const pluginPath = path.join(pluginsDir, file);
        const plugin = require(pluginPath);
        
        console.log(`${index + 1}. ${plugin.name || file}`);
        console.log(`   📝 ${plugin.description || 'No description'}`);
        console.log(`   🏷️  Version: ${plugin.version || 'N/A'}`);
        console.log(`   📁 File: ${file}`);
        console.log(`   🛣️  Routes: ${plugin.routes?.length || 0}`);
        
        if (plugin.routes && plugin.routes.length > 0) {
          plugin.routes.forEach(route => {
            console.log(`      ${route.method} ${route.path}`);
          });
        }
        
        console.log('');
      } catch (error) {
        console.log(`${index + 1}. ${file} (❌ Error loading)`);
        console.log(`   Error: ${error.message}\n`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error reading plugins directory:', error.message);
  }
}

listPlugins();