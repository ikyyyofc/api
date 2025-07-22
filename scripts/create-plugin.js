const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function createPlugin() {
  console.log('\n🔌 Plugin Generator\n');
  
  const pluginName = await askQuestion('Plugin name: ');
  const pluginDescription = await askQuestion('Description: ');
  const pluginVersion = await askQuestion('Version (default: 1.0.0): ') || '1.0.0';
  
module.exports = {
  name: '${pluginName}',
  version: '${pluginVersion}',
  description: '${pluginDescription}',
  
  routes: [
    {
      method: 'GET',
      path: '/api/${pluginName}',
      handler: (req, res) => {
        res.json({
          success: true,
          message: 'Hello from ${pluginName} plugin!',
          data: {
            plugin: '${pluginName}',
            version: '${pluginVersion}',
            timestamp: new Date().toISOString()
          }
        });
      }
    },
    
    {
      method: 'GET',
      path: '/api/${pluginName}/:id',
      handler: (req, res) => {
        const { id } = req.params;
        res.json({
          success: true,
          data: {
            id: id,
            plugin: '${pluginName}',
            message: `Item with ID \${id} from ${pluginName} plugin`
          }
        });
      }
    },
    
    {
      method: 'POST',
      path: '/api/${pluginName}',
      handler: (req, res) => {
        const data = req.body;
        res.status(201).json({
          success: true,
          message: 'Data created successfully',
          data: {
            id: Date.now(),
            ...data,
            createdAt: new Date().toISOString(),
            plugin: '${pluginName}'
          }
        });
      }
    }
  ]
};;

  const pluginPath = path.join(__dirname, '..', 'plugins', `${pluginName}.js`);
  
  try {
    fs.writeFileSync(pluginPath, template);
    console.log(`\n✅ Plugin created: ${pluginPath}`);
    console.log(`🚀 Restart server to load the plugin\n`);
  } catch (error) {
    console.error('❌ Error creating plugin:', error.message);
  }
  
  rl.close();
}

createPlugin();