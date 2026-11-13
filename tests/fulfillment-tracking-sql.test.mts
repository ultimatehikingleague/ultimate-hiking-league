import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// Optional isolated PostgreSQL runtime; never connects to Supabase.
const modulePath=process.env.PGLITE_MODULE
const order='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', line='33333333-3333-4333-8333-333333333333'
test('migration, leases, deduplication, retries, cross-order guards and package mapping in isolated PostgreSQL',{skip:!modulePath},async()=>{
 const {PGlite}=await import(modulePath!)
 const db=new PGlite()
 try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE shop_orders(id uuid primary key,mode text,product_uid text);
 CREATE TABLE shop_order_lines(id uuid primary key,order_id uuid,quantity integer);
 CREATE TABLE shop_fulfillment(order_id uuid primary key,mode text,gelato_order_id text,status text);
 INSERT INTO shop_orders VALUES('${order}','live','calendar'),('${other}','test','calendar');
 INSERT INTO shop_order_lines VALUES('${line}','${order}',1);
 INSERT INTO shop_fulfillment VALUES('${order}','live','gelato-order','submitted');`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261106_fulfillment_tracking.sql',import.meta.url),'utf8'))
 await db.query('SELECT shop_tracking_seed()');await db.query('SELECT shop_tracking_seed()')
 const count=await db.query('SELECT count(*)::int AS n FROM shop_fulfillment_units');assert.equal(count.rows[0].n,1)
 await assert.rejects(db.query(`INSERT INTO shop_fulfillment_units(order_id,mode,provider) VALUES('${other}','live','manual')`),/mode does not match/)
 const claim=(await db.query('SELECT * FROM shop_tracking_claim()')).rows[0];assert.ok(claim.claim_token)
 assert.equal((await db.query('SELECT * FROM shop_tracking_claim()')).rows.length,0)
 const snapshot={raw_status:'in_production',production_status:'in_production',shipping_status:'unknown',delivery_status:'unknown',items:[{id:'item',product_uid:'calendar',quantity:1,raw_status:'in_production'}],packages:[{id:'package',shipment_id:'shipment',shipping_method_name:'method',tracking_number:'number',tracking_url:'https://carrier.example',item_ids:['item']}]}
 const apply=()=>db.query('SELECT shop_tracking_apply($1,$2,$3,$4)',[claim.unit_id,claim.claim_token,JSON.stringify(snapshot),'hash'])
 assert.equal((await apply()).rows[0].shop_tracking_apply,true)
 assert.equal((await apply()).rows[0].shop_tracking_apply,false)
 const pkg=(await db.query('SELECT * FROM shop_fulfillment_shipments')).rows[0];assert.equal(pkg.tracking_number,'number');assert.equal(pkg.shipping_status,'unknown');assert.equal(pkg.shipped_at,null)
 assert.equal((await db.query('SELECT * FROM shop_fulfillment_shipment_lines')).rows.length,1)
 await db.query("UPDATE shop_fulfillment_sync SET next_attempt_at=now()-interval '1 minute'")
 const second=(await db.query('SELECT * FROM shop_tracking_claim()')).rows[0]
 await db.query('SELECT shop_tracking_apply($1,$2,$3,$4)',[second.unit_id,second.claim_token,JSON.stringify(snapshot),'hash'])
 assert.equal((await db.query('SELECT count(*)::int AS n FROM shop_fulfillment_events')).rows[0].n,1)
 await db.query("UPDATE shop_fulfillment_sync SET next_attempt_at=now()-interval '1 minute'")
 const third=(await db.query('SELECT * FROM shop_tracking_claim()')).rows[0]
 await db.query('SELECT shop_tracking_apply($1,$2,NULL,$3,$4)',[third.unit_id,third.claim_token,'failure','GELATO_HTTP_503'])
 assert.equal((await db.query('SELECT raw_status FROM shop_fulfillment_units')).rows[0].raw_status,'in_production')
 assert.equal((await db.query('SELECT last_error_code FROM shop_fulfillment_sync')).rows[0].last_error_code,'GELATO_HTTP_503')
 // Expired worker cannot apply; a fresh lease can safely discover split orders.
 await db.query("UPDATE shop_fulfillment_sync SET next_attempt_at=now()-interval '1 minute'")
 const old=(await db.query('SELECT * FROM shop_tracking_claim()')).rows[0]
 await db.query("UPDATE shop_fulfillment_sync SET lease_until=now()-interval '1 second'")
 assert.equal((await db.query('SELECT shop_tracking_apply($1,$2,$3,$4)',[old.unit_id,old.claim_token,JSON.stringify(snapshot),'late'])).rows[0].shop_tracking_apply,false)
 const fresh=(await db.query('SELECT * FROM shop_tracking_claim()')).rows[0]
 await db.query('SELECT shop_tracking_link($1,$2,$3)',[fresh.unit_id,fresh.claim_token,'split-order'])
 await db.query('SELECT shop_tracking_link($1,$2,$3)',[fresh.unit_id,fresh.claim_token,'split-order'])
 assert.equal((await db.query('SELECT count(*)::int AS n FROM shop_fulfillment_units')).rows[0].n,2)
 await assert.rejects(db.query(`INSERT INTO shop_fulfillment_unit_lines(unit_id,order_id,order_line_id,quantity) VALUES('${fresh.unit_id}','${order}','44444444-4444-4444-8444-444444444444',1)`))
 const terminal={...snapshot,raw_status:'delivered',delivery_status:'delivered'}
 await db.query('SELECT shop_tracking_apply($1,$2,$3,$4)',[fresh.unit_id,fresh.claim_token,JSON.stringify(terminal),'delivered'])
 assert.equal((await db.query('SELECT state FROM shop_fulfillment_sync WHERE unit_id=$1',[fresh.unit_id])).rows[0].state,'idle')
 await db.query("UPDATE shop_fulfillment_sync SET state='review' WHERE unit_id<>$1",[fresh.unit_id])
 assert.equal((await db.query('SELECT * FROM shop_tracking_claim()')).rows.length,0)
 await db.query("UPDATE shop_fulfillment_sync SET last_attempt_at=now()-interval '2 minutes' WHERE unit_id=$1",[fresh.unit_id])
 assert.equal((await db.query('SELECT shop_tracking_refresh($1)',[order])).rows[0].shop_tracking_refresh,true)
 assert.equal((await db.query('SELECT * FROM shop_tracking_claim($1)',[other])).rows.length,0)
 assert.ok((await db.query('SELECT * FROM shop_tracking_claim($1)',[order])).rows[0].claim_token)
 assert.equal((await db.query("SELECT has_table_privilege('authenticated','shop_fulfillment_units','SELECT') AS allowed")).rows[0].allowed,false)
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','shop_tracking_seed(uuid)','EXECUTE') AS allowed")).rows[0].allowed,false)
 }finally{await db.close()}
})
