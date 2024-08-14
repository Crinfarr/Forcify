import { EmbedBuilder, WebhookClient } from 'discord.js';
import { readFileSync } from 'fs';
import https from 'https';
import { stdout } from 'process';

type response = {
    version:string,
    type:string,
    provider_name:string,
    provider_url:string,
    url:string,
    width:number,
    height:number,
    scale:number,
    title:string
}

function genUrl() {
    const bytes = [];
    for (let i=0; i<16; i++) {
        bytes.push(Math.round(Math.random()*255).toString(16).padStart(2, "0"));
    }
    return bytes.join('');
}

var tries = [0, 0];
const clients:Array<WebhookClient> = [];
for (let {id:id, token:token} of JSON.parse(readFileSync('hooks.json').toString())) {
    clients.push(new WebhookClient({id:id, token:token}));
}

while (true) {
    const url = `https://api.gyazo.com/api/oembed?url=https://gyazo.com/${genUrl()}`;
    stdout.write(`[✅:${tries[0]} - ❌:${tries[1]}]\t${url}\r`);    
    https.get(url, (res) => {
        if (res.statusCode == 404) {
            tries[1]++;
            return;
        }
        tries[0]++;
        let data = '';
        res.on('data', (chunk) => {data+=chunk});
        res.once('close', () => {
            const jsres:response = JSON.parse(data);
            const embed = new EmbedBuilder().setImage(jsres.url);
            for (let client of clients) {
                client.send({
                    content:jsres.url,
                    username:`Gyoza Daemon #${tries[0]+tries[1]}`,
                    embeds: [embed]
                });
            }
        });
    });
}