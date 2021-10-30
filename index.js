const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const WebSocket = require('ws');

const localAgent = new https.Agent({
    rejectUnauthorized: false
});

async function asyncTimeout(delay) {
    return new Promise(resolve => {
        setTimeout(resolve, delay);
    });
}

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

async function getHelp(port, password) {
    return (await fetch(`https://127.0.0.1:${port}/help`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        },
        agent: localAgent
    })).json();
}

async function waitForLockfile()
{
    return new Promise(async (resolve, reject) =>
    {
        const watcher = fs.watch(path.join(process.env['LOCALAPPDATA'], 'Riot Games\\Riot Client\\Config\\'), (eventType, fileName) =>
        {
            if(eventType === 'rename' && fileName === 'lockfile')
            {
                watcher.close();
                resolve();
            }
        });
    });
}

(async () => {
    let lockData = null;
    do
    {
        try
        {
            lockData = await getLockfileData();
        }
        catch(e)
        {
            console.log('Waiting for lockfile...');
            await waitForLockfile();
        }
    } while(lockData === null);
    
    console.log('Got lock data...');
    
    let sessionData = null;
    let lastRetryMessage = 0;
    do
    {
        try
        {
            sessionData = await getSession(lockData.port, lockData.password);
            if(sessionData.loaded === false)
            {
                await asyncTimeout(1500);
                sessionData = null;
            }
        }
        catch(e)
        {
            const currentTime = (new Date()).getTime();
            if(currentTime - lastRetryMessage > 1000)
            {
                console.log('Unable to get session data, retrying...');
                lastRetryMessage = currentTime;
            }
        }
    } while(sessionData === null);
    
    let helpData = null;
    do
    {
        helpData = await getHelp(lockData.port, lockData.password);
        if(!helpData.events.hasOwnProperty('OnJsonApiEvent_chat_v4_presences')) {
            console.log('Retrying help data events...');
            helpData = null;
            await asyncTimeout(1500);
        }
    } while(helpData === null);
    
    console.log('Got PUUID...');
    
    try {
        await fs.promises.mkdir('./logs');
    }
    catch (ignored) {}
    const logPath = `./logs/${(new Date()).getTime()}.txt`;
    console.log(`Writing to ${logPath}`);
    
    const logStream = fs.createWriteStream(logPath);
    logStream.write(JSON.stringify(lockData) + '\n');
    logStream.write(JSON.stringify(sessionData) + '\n');
    logStream.write(JSON.stringify(helpData) + '\n\n');
    
    const ws = new WebSocket(`wss://riot:${lockData.password}@localhost:${lockData.port}`, {
        rejectUnauthorized: false
    });
    
    ws.on('open', () => {
        Object.entries(helpData.events).forEach(([name, desc]) => {
            if(name === 'OnJsonApiEvent') return;
            ws.send(JSON.stringify([5, name]));
        });
        console.log('Connected to websocket!');
    });
    
    ws.on('message', data => {
        logStream.write((new Date()).getTime() + ' ' + data + '\n');
    });
    
    ws.on('close', () => {
        console.log('Websocket closed!');
        logStream.end();
    });
})();
