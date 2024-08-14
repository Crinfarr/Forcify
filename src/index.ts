import { EmbedBuilder, WebhookClient } from 'discord.js';
import { readFileSync } from 'fs';
import https from 'https';
import { stdout } from 'process';

type gyazo_response = {
    version: string,
    type: string,
    provider_name: string,
    provider_url: string,
    url: string,
    width: number,
    height: number,
    scale: number,
    title: string
}

type genitem = {
    url: string,
    sitename: "gyazo" | "imgur" | "pastebin"
}

function genGyazoUrl(): genitem {
    const bytes = [];
    for (let i = 0; i < 16; i++) {
        bytes.push(Math.round(Math.random() * 255).toString(16).padStart(2, "0"));
    }
    return { url: `https://api.gyazo.com/api/oembed?url=https://gyazo.com/${bytes.join('')}`, sitename: 'gyazo' };
}

const alphanumerics: Array<string> = [];
for (let i = 48; i <= 122; i++) {
    if (i >= 58 && i <= 64)
        continue;
    if (i >= 91 && i <= 96)
        continue;
    alphanumerics.push(String.fromCharCode(i));
}

function genImgurUrl(): genitem {
    const linkid = [];
    for (let i = 0; i < 5; i++)
        linkid.push(alphanumerics[Math.round(Math.random() * alphanumerics.length)]);
    return {
        url: `https://i.imgur.com/${linkid.join('')}.jpg`,//this works because imgur aliases every extension on their own
        sitename: 'imgur'
    }
}
function genPastebinUrl(): genitem {
    const linkid = [];
    for (let i = 0; i < 8; i++)
        linkid.push(alphanumerics[Math.round(Math.random() * alphanumerics.length)]);
    return {
        url: `https://pastebin.com/raw/${linkid.join('')}`,
        sitename: 'pastebin'
    }
}

const urlcycle: Array<() => genitem> = [genGyazoUrl, genImgurUrl, genPastebinUrl]

var tries: Map<genitem["sitename"], number> = new Map([
    ['gyazo', 0],
    ['imgur', 0],
    ['pastebin', 0]
]);
const clients: Array<WebhookClient> = [];
const no_hooks:Map<string, Array<string>> = new Map();
for (let { id: id, token: token, nohooks:nohooks } of JSON.parse(readFileSync('hooks.json').toString())) {
    clients.push(new WebhookClient({ id: id, token: token }));
    for (let hooktype of nohooks) {
        if (!no_hooks.has(id)) {
            no_hooks.set(id, []);
        }
        no_hooks.get(id)?.push(hooktype);
    }
}

let idx = 0;
setInterval(() => {
    const run = urlcycle[idx]();
    idx = (idx + 1) % urlcycle.length;

    // console.log(run);
    try {
        const basereq = https.get(run.url, (res) => {
            // console.log(res.statusCode);
            stdout.write(`[🥟: ${tries.get('gyazo')} 🖼️: ${tries.get('imgur')} 📄: ${tries.get('pastebin')}] ${run.url}                                                      \r`);
            if (res.statusCode != 200) {
                tries.set(run.sitename, tries.get(run.sitename)! + 1);
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk });
            res.once('close', () => {
                switch (run.sitename) {
                    case 'gyazo':
                        const jsres: gyazo_response = JSON.parse(data);
                        const gyazoembed = new EmbedBuilder().setImage(jsres.url);
                        for (let client of clients) {
                            if (no_hooks.get(client.id)?.includes('gyazo')) 
                                continue;
                            client.send({
                                content: `${tries.get('gyazo')} since last hit`,
                                username: `Gyoza Daemon`,
                                embeds: [gyazoembed]
                            });
                        }
                        tries.set(run.sitename, 0);
                        break;
                    case 'imgur':
                        
                        const imgurembed = new EmbedBuilder().setImage(run.url);
                        for (let client of clients) {
                            if (no_hooks.get(client.id)?.includes('imgur')) 
                                continue;

                            client.send({
                                content: `${tries.get('imgur')} since last hit`,
                                username: `Imgur Daemon`,
                                embeds: [imgurembed]
                            });
                        }
                        tries.set(run.sitename, 0);
                        break;
                    case 'pastebin':
                        // const pastebinembed = new EmbedBuilder()
                        for (let client of clients) {
                            if (no_hooks.get(client.id)?.includes('pastebin')) 
                                continue;

                            var content = `${tries.get('pastebin')} tries\n[link](${run.url})\`\`\`\n${data}`;
                            if (content.length > 1997) content = content.substring(0, 1997) + '```';
                            client.send({
                                content: content,
                                username: "Pastebin Daemon"
                            });
                        }
                        tries.set('pastebin', 0);
                        break;
                    default:
                        break;
                }
                // stdout.write(`[🥟: ${tries.get('gyazo')} 🖼️: ${tries.get('imgur')} 📄: ${tries.get('pastebin')}] ${run.sitename}\r`);
            });
        });
        basereq.end();
    } catch (_) { }
}, 20);