import fs from 'node:fs';import os from 'node:os';
const auth=JSON.parse(fs.readFileSync(os.homedir()+'/Library/Application Support/com.vercel.cli/auth.json','utf8'));
const base='https://api.vercel.com';const team='team_KOoenx7C4xYAHYtDHZVgGQsu';const id='dpl_9qa6nVHy1kCGfmUJkCyWoo1JNZgJ';
const r=await fetch(`${base}/v6/deployments/${id}/files?teamId=${team}`,{headers:{Authorization:'Bearer '+auth.token}});console.log('Source listing HTTP',r.status);if(!r.ok)process.exit(1);const data=await r.json();fs.writeFileSync('tmp/performance-20261106/deployment-files.json',JSON.stringify(data,null,2));console.log(JSON.stringify(data.slice(0,2)).slice(0,1500));
