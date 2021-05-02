const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const WebSocket = require('ws');

const localAgent = new https.Agent({
    rejectUnauthorized: false
});

async function getLockfileData() {
    const lockfilePath = path.join(process.env['LOCALAPPDATA'], 'Riot Games\\Riot Client\\Config\\lockfile');
    const contents = await fs.promises.readFile(lockfilePath, 'utf8');
    let d = {};
    [d.name, d.pid, d.port, d.password, d.protocol] = contents.split(':');
    return d;
}

async function getSession(port, password) {
    return (await fetch(`https://127.0.0.1:${port}/chat/v1/session`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        },
        agent: localAgent
    })).json();
}

(async () => {
    let lockData;
    try {
        lockData = await getLockfileData();
    }
    catch(e) {
        console.log('Could not find lockfile! Is Valorant running?');
        return;
    }
    console.log('Got lock data...');
    
    const sessionData = await getSession(lockData.port, lockData.password);
    console.log('Got PUUID...');
    
    try {
        await fs.promises.mkdir('./logs');
    }
    catch (ignored) {}
    const logPath = `./logs/${(new Date()).getTime()}.txt`;
    console.log(`Writing to ${logPath}`);
    
    const logStream = fs.createWriteStream(logPath);
    logStream.write(JSON.stringify(lockData) + '\n');
    logStream.write(JSON.stringify(sessionData) + '\n\n');
    
    const ws = new WebSocket(`wss://riot:${lockData.password}@localhost:${lockData.port}`, {
        rejectUnauthorized: false
    });
    
    ws.on('open', () => {
        ws.send('[5, "OnJsonApiEvent"]');
        console.log('Connected to websocket!');
    });
    
    ws.on('message', data => {
        logStream.write(data + '\n');
    });
    
    ws.on('close', () => {
        console.log('Websocket closed!');
        logStream.end();
    });
})();
