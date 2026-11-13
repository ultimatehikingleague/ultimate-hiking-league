import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const [origin, prefix, runs = '1'] = process.argv.slice(2)
const profile = await mkdtemp(path.join(os.tmpdir(), 'uhl-chrome-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking',
  '--user-data-dir=' + profile, 'about:blank',
], { stdio: 'ignore' })
const results = []
try {
  let port
  for (let i = 0; i < 100 && !port; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0] }
    catch { await delay(100) }
  }
  if (!port) throw Error('Chrome debugging port unavailable')
  for (const [label, width, height, dpr] of [['desktop',1440,900,1], ['mobile',390,844,2]]) {
    for (let run = 0; run < Number(runs); run++) {
      const target = await fetch('http://127.0.0.1:'+port+'/json/new?about:blank', {method:'PUT'}).then(r=>r.json())
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((ok, fail)=>{ws.onopen=ok;ws.onerror=fail})
      let id = 0
      const pending = new Map()
      const listeners = new Map()
      ws.onmessage = ({data}) => {
        const m = JSON.parse(data)
        if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p?.reject(Error(m.error.message)); else p?.resolve(m.result) }
        else listeners.get(m.method)?.(m.params)
      }
      const send = (method, params={}) => new Promise((resolve,reject)=>{
        pending.set(++id,{resolve,reject})
        ws.send(JSON.stringify({id,method,params}))
      })
      const evaluate = async expression => {
        const result = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
        if (result.exceptionDetails) throw Error(result.exceptionDetails.text)
        return result.result.value
      }
      await send('Page.enable')
      await send('Network.enable')
      await send('Network.setCacheDisabled',{cacheDisabled:true})
      await send('Network.clearBrowserCookies')
      await send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:1_250_000,uploadThroughput:625_000,connectionType:'wifi'})
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:label==='mobile'})
      await send('Page.addScriptToEvaluateOnNewDocument',{source:`
        window.__imageLcp = null;
        new PerformanceObserver(list => {
          const e = list.getEntries().at(-1);
          window.__imageLcp = {ms: Math.round(e.startTime), tag:e.element?.tagName, path:e.url ? new URL(e.url).pathname : ''};
        }).observe({type:'largest-contentful-paint',buffered:true});
      `})
      const loaded = new Promise(resolve => listeners.set('Page.loadEventFired',resolve))
      const nav = await send('Page.navigate',{url:origin+'/shop/schorschys-wanderkalender-2027'})
      if (nav.errorText) throw Error(nav.errorText)
      await Promise.race([loaded,delay(30000, undefined, {ref:false}).then(()=>{throw Error('Page load timeout')})])
      await delay(700)
      const verdict = await evaluate(`(async()=>{
        const buttons = Array.from(document.querySelectorAll('button[aria-label^="Bild "]'));
        const expected = ['cover-final.webp','month-1-final.webp','month-8-final.webp','month-12-final.webp'];
        const images = buttons.map(b=>new URL(b.querySelector('img').src).pathname.split('/').at(-1));
        if (JSON.stringify(images)!==JSON.stringify(expected)) throw Error('Unexpected thumbnails: '+images);
        buttons[0].click();
        const dialog = ()=>document.querySelector('[role="dialog"][aria-label="Produktbilder"]');
        const seen = [];
        for (let index=0;index<5;index++){
          await new Promise(resolve=>setTimeout(resolve,70));
          const image=dialog()?.querySelector('img');
          if(!image)throw Error('Missing modal image');
          await image.decode();
          seen.push(new URL(image.src).pathname.split('/').at(-1));
          dialog().querySelector('[aria-label="Nächstes Bild"]').click();
        }
        if(JSON.stringify(seen)!==JSON.stringify([...expected,expected[0]]))throw Error('Unexpected modal order: '+seen);
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
        await new Promise(resolve=>setTimeout(resolve,70));
        if(dialog())throw Error('Escape did not close modal');
        return {images,seen,checkoutLink:!!document.querySelector('a[href^="/shop/checkout"]')};
      })()`)
      results.push({label,width,height,...verdict})
      ws.close()
      await fetch('http://127.0.0.1:'+port+'/json/close/'+target.id)
    }
  }
  await writeFile(prefix+'.json',JSON.stringify({capturedAt:new Date().toISOString(),origin,results},null,2)+'\n')
  console.log(JSON.stringify(results))
} finally {
  chrome.kill()
  await delay(500)
  await rm(profile,{recursive:true,force:true,maxRetries:2})
}
