const axios = require('axios');
const crypto = require('crypto');

function router(app, routes = [], pluginName) {
    routes.push({
        plugin: pluginName,
        endpoints: [
            {
                method: "POST",
                path: "/create-story",
                description: "create story"
            }
        ]
    });

    app.post("/create-story", async (req, res) => {
        res.json({ status: true });
    });
    app.post("/create-story/get-detail", async (req, res) => {
        res.json({ status: true });
    });
}

module.exports = router;

async function txt2vid(prompt, ratio = '16:9') {
    try {
        const _ratio = ['16:9', '9:16', '1:1', '4:3', '3:4'];
        
        if (!prompt) throw new Error('Prompt is required');
        if (!_ratio.includes(ratio)) throw new Error(`Available ratios: ${_ratio.join(', ')}`);
        
        const { data: cf } = await axios.get('https://api.nekorinn.my.id/tools/rynn-stuff', {
            params: {
                mode: 'turnstile-min',
                siteKey: '0x4AAAAAAATOXAtQtziH-Rwq',
                url: 'https://www.yeschat.ai/features/text-to-video-generator',
                accessKey: 'a40fc14224e8a999aaf0c26739b686abfa4f0b1934cda7fa3b34522b0ed5125d'
            }
        });
        
        const uid = crypto.createHash('md5').update(Date.now().toString()).digest('hex');
        const { data: task } = await axios.post('https://aiarticle.erweima.ai/api/v1/secondary-page/api/create', {
            prompt: prompt,
            imgUrls: [],
            quality: '540p',
            duration: 5,
            autoSoundFlag: false,
            soundPrompt: '',
            autoSpeechFlag: false,
            speechPrompt: '',
            speakerId: 'Auto',
            aspectRatio: ratio,
            secondaryPageId: 388,
            channel: 'PIXVERSE',
            source: 'yeschat.ai',
            type: 'features',
            watermarkFlag: false,
            privateFlag: false,
            isTemp: true,
            vipFlag: false
        }, {
            headers: {
                uniqueid: uid,
                verify: cf.result.token
            }
        });
        
        while (true) {
            const { data } = await axios.get(`https://aiarticle.erweima.ai/api/v1/secondary-page/api/${task.data.recordId}`, {
                headers: {
                    uniqueid: uid,
                    verify: cf.result.token
                }
            });
            
            if (data.data.state === 'success') return JSON.parse(data.data.completeData);
            await new Promise(res => setTimeout(res, 1000));
        }
    } catch (error) {
        throw new Error(error.message);
    }
}