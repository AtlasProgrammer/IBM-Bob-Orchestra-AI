import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['server.mjs'],{stdio:'inherit',env:process.env});
const vite=spawn(process.platform==='win32'?'npx.cmd':'npx',['vite','--host','0.0.0.0'],{stdio:'inherit',env:process.env});
const stop=()=>{server.kill();vite.kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
