import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
const root='/Users/philippdobrinski/ultimate-hiking-league';const stage='/private/tmp/uhl-performance-20261106';const auth=JSON.parse(fs.readFileSync(os.homedir()+'/Library/Application Support/com.vercel.cli/auth.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('tmp/performance-20261106/source-manifest.json','utf8'));
const relevant=manifest.filter(f=>/^(app\/|public\/|middleware|next\.config|package|vercel\.json|tsconfig\.json|postcss|eslint)/.test(f.path));
const hash=b=>crypto.createHash('sha1').update(b).digest('hex');
for(const file of relevant){
 if(file.path.split('/').includes('..'))throw Error('Unsafe source path');
 let bytes=fs.readFileSync(path.join(root,file.path));
 if(hash(bytes)!==file.sha){
  const snapshots={'app/page.tsx':'page.before.tsx.txt','app/lib/useMilestoneLaunch.ts':'useMilestoneLaunch.before.ts.txt'};
  if(snapshots[file.path])bytes=fs.readFileSync('tmp/performance-20261106/'+snapshots[file.path]);
  else{
   const r=await fetch(`https://api.vercel.com/v8/deployments/dpl_9qa6nVHy1kCGfmUJkCyWoo1JNZgJ/files/${file.sha}?teamId=team_KOoenx7C4xYAHYtDHZVgGQsu`,{headers:{Authorization:'Bearer '+auth.token}});if(!r.ok)throw Error('Source retrieval HTTP '+r.status);const result=await r.json();if(typeof result.data!=='string')throw Error('Unexpected source format: '+Object.keys(result).join(','));bytes=Buffer.from(result.data,'base64');
  }
 }
 if(hash(bytes)!==file.sha)throw Error('Production source hash mismatch: '+file.path);
 const target=path.join(stage,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
}
fs.mkdirSync(path.join(stage,'.vercel'),{recursive:true});fs.writeFileSync(path.join(stage,'.vercel/project.json'),JSON.stringify({projectId:'prj_RcGB0GQCbVmqTMtOSzousYGfCktT',orgId:'team_KOoenx7C4xYAHYtDHZVgGQsu',projectName:'ultimate-hiking-league'}));
console.log('Verified production baseline runtime files:',relevant.length);console.log('Release staging:',stage);
