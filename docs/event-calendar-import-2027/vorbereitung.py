"""Build local review artifacts only. No database or network operations."""
from pathlib import Path
from urllib.parse import urlsplit
import csv, json, re, unicodedata, difflib, sys

def read(p):
 with open(p,encoding='utf-8-sig',newline='') as f:
  return list(csv.DictReader(f,delimiter=';'))

def norm(s):
 return ' '.join(re.findall('[a-z0-9]+',''.join(c for c in unicodedata.normalize('NFKD',(s or '').casefold()) if not unicodedata.combining(c))))

def title(s):
 return re.sub(r'^(\d+)(?:e|ste|de|th)?\s+(?!km\b)','',re.sub(r'\b20(?:25|26|27)\b','',norm(s))).strip()

def source(s):
 p=urlsplit(s or '')
 return p.netloc.removeprefix('www.')+p.path.rstrip('/') if p.path.rstrip('/') else ''

out=Path(__file__).resolve().parent
base=Path(sys.argv[1])
b=read(base/'bestaetigt-fehlend.csv')
a=read(base/'abgleich.csv')
live=json.loads((out/'kalenderstand.json').read_text())
from collections import Counter
import hashlib
today='2026-11-10'
countries={'BE':'Belgien','NL':'Niederlande','DE':'Deutschland','AT':'Österreich','CH':'Schweiz','DK':'Dänemark','ES':'Spanien','CZ':'Tschechien','LU':'Luxemburg'}
incomplete={
 'B052':'Offiziell belegte 2027-Distanzen für Tag 1',
 'B053':'Distanzen und Startorte je Tag für 2027',
 'B056':'Offiziell belegte 2027-Distanzen',
 'B059':'Vollständiges einschlägiges Distanzangebot und Abgrenzung der Staffel- und Spezialformate',
 'B060':'Offiziell belegte 2027-Distanzen und Startorte',
 'B063':'Verbindliche Zuordnung der Distanzen zu den Tagen und Abgrenzung der Sonderformate',
 'B065':'Bestätigung des vollständigen Angebots im Gehformat',
 'B066':'Offiziell belegte 2027-Distanzen der Gehformate',
 'B067':'Verbindliche 2027-Distanzen der Strecken und Staffelabschnitte',
 'B070':'Offiziell belegte 2027-Distanzen',
 'B078':'Konkreter Veranstaltungsort auf Rügen',
}
conflicts={
 'B075':'Die Jahresübersicht nennt 2027. Die erreichbare Detailseite zeigt Oktober 2026. 2027-Startort und Eventidentität gegenüber der alten Detailseite verbindlich klären.',
 'B046':'Ieper 2027 Tag 2. Darstellung mit Tag 1 (B052) und Tag 3 (B047) abstimmen.',
 'B047':'Ieper 2027 Tag 3. Darstellung mit Tag 1 (B052) und Tag 2 (B046) abstimmen.',
 'B055':'Veranstalter-/Verbandskalender belegt Samstag. Zweite Quelle nennt zusätzlich Sonntag. Umfang der Ausgabe klären.',
 'B064':'Die offiziellen Quellen bilden den 5. Juli und den Dreitagesmarsch unterschiedlich ab. Veranstaltungszeitraum klären.',
 'B069':'Zwei Veranstalterseiten nennen unterschiedliche Distanzen. Verbindlichen Stand klären.',
 'B071':'Veranstalter und Tourismuskalender bilden den Termin unterschiedlich ab. Gültiges Programm und Distanzen fehlen.',
 'B074':'Die Jahresübersicht nennt 2027. Die Detailseite bezieht sich auf 2026. September M585 ist die Langstreckenausgabe.',
}
notes={
 'B080':'Offizielle Startzeiten für beide Starttage und jede Distanz überprüft. Ein Masterevent mit Beginn am 8. Oktober. Tageszuordnung in der Beschreibung.',
 'B010':'Gleiche Bezeichnung und derselbe Wanderverein. 2027 ist Heverlee der ausgeschriebene Ort.',
 'B020':'Gleiche nummerierte Reihe und derselbe Veranstalter. 2027 startet die Ausgabe in Nieuwrode.',
 'B030':'Fortlaufende Editionsnummer und gleicher Wanderverein. 2027 ist Schilde der ausgeschriebene Ort.',
 'B033':'Gleiche spezifische Bezeichnung und derselbe Wanderverein. 2027 ist Ottenburg der ausgeschriebene Ort.',
 'B038':'Gleiche Marschreihe und derselbe Veranstalter. 2027 ist Kuringen der ausgeschriebene Ort.',
 'B043':'2027-Verbandseintrag weist Fosses-la-Ville als Veranstaltungsort der Streckenwanderung aus.',
 'B041':'Eigenständiger Sonntag laut Verbandskalender. Vorhanden ist der Samstag (M629).',
 'B057':'Distanz pro Tag. Enddatum in der Beschreibung.',
 'B058':'Offizielle 2027-Startseite nennt alle drei Distanzen und beide Tage.',
 'B061':'Offizielle Renninformationen bestätigen Termin, Startort und 35/52 km im Marschformat. Veranstalterbezeichnung aktualisiert.',
 'B062':'Eigenständig ausgeschriebene Wanderstrecken. Trailruns sind ein separates Format.',
 'B072':'Sommerausgabe in Krailling. M229 ist die Frühjahrsausgabe.',
 'B075':'Herbstausgabe in München. M229 ist die Frühjahrsausgabe. Die genaue Startadresse ist optional.',
 'B073':'Offiziell bestätigte Stadt. Die genaue Startadresse ist optional.',
 'B076':'Eigene Anmeldung für den Nachtmarsch. M702 ist die Tagesausgabe.',
 'B077':'Anderer Austragungsort als Erfurt (M751). Offizielles Start- und Zielgelände ist das Brentanobad.',
 'B079':'Schaffhausen ist der ausgeschriebene Ort. Die genaue Startadresse ist optional.',
}
extra={
 'B080':'Start am 08.10.2027 um 21:00 Uhr für 55 km bei Nacht, 85 km, 100 km und 110 km (Chauken-Marsch). Start am 09.10.2027 für 60 km um 07:30 Uhr, 43 km um 08:30 Uhr, 16 km um 09:30 Uhr und 30 km um 10:00 oder 10:30 Uhr. Start und Ziel Hagenbeckstraße 39, Hamburg. Die Website nennt als Veranstaltungsende sowohl 00:00 als auch 01:00 Uhr am 10.10.2027. Maßgeblich sind die Veranstalterinformationen.',
 'B041':'Sonntagsausgabe der zweitägigen Veranstaltung.',
 'B057':'Die angegebenen Distanzen gelten pro Tag.',
 'B061':'35 km mit Ziel in der Eng oder 52 km mit Ziel in Pertisau.',
 'B062':'Aufgeführt sind die offiziell ausgeschriebenen Wanderstrecken.',
 'B079':'Die 50 km sind ein offizielles Zwischenziel des 100-km-Marschs.',
}
review=[]; payload=[]
live_slugs={x['slug']:x['id'] for x in live}
for r in b:
 k=r['kandidat']
 missing=incomplete.get(k,'')
 if k=='B071': missing='Offiziell belegte 2027-Distanzen'
 state='Konflikt' if k in conflicts else ('Unvollständig' if missing else 'Importbereit')
 reason=conflicts.get(k) or missing or notes.get(k,'2027-Verbandsseite bestätigt Datum, Ort, Verein und Distanzen.')
 name=r['titel']+(' (Sonntag)' if k=='B041' else '')
 brand='Achensee Tourismus und Region Seefeld' if k=='B061' else ' '.join(r['veranstalter'].split())
 city=r['ort'].split(',')[0] if r['land']=='BE' and 'wandel.be' in r['quelle'] else r['ort']
 official=r['quelle'].split(' | ')[0].split('?trk=')[0]
 slug=re.sub('[^a-z0-9]+','-',name.lower()).strip('-')+'-'+r['start']
 if slug in live_slugs:
  state='Konflikt'; reason=f"Bestehender Slug M{live_slugs[slug]}."
 review.append({**r,'import_titel':name,'import_ort':city,'import_veranstalter':brand,'einstufung':state,'fehlende_pflichtangaben':missing,'entscheidung':reason,'letzte_pruefung':today})
 if state!='Importbereit':continue
 assert all(r[x] for x in ['start','ort','land','veranstalter','bestaetigte_km','quelle'])
 desc=[]
 if r['ende'] and r['ende']!=r['start']: desc.append(f"Veranstaltungszeitraum {r['start'][8:]}.{r['start'][5:7]}. bis {r['ende'][8:]}.{r['ende'][5:7]}.2027.")
 if k in extra:desc.append(extra[k])
 payload.append(dict(candidate_id=k,slug=slug,title=name,city=city,country=countries[r['land']],country_code=r['land'],event_date=r['start'],brand=brand,official_url=official,booking_url=r['anmeldung'] or None,description=' '.join(desc) or None,distances=sorted(set(float(x) if '.' in x else int(x) for x in r['bestaetigte_km'].split(',')))))
assert len({x['slug'] for x in payload})==len(payload)
assert len({(norm(x['title']),x['event_date'],norm(x['city']),x['country_code']) for x in payload})==len(payload)
def write_csv(file, rows):
 with open(out/file,'w',encoding='utf-8-sig',newline='') as f:
  writer=csv.DictWriter(f,fieldnames=list(rows[0]),delimiter=';')
  writer.writeheader(); writer.writerows(rows)
write_csv('kandidaten.csv',review)
historical={r['id']:r for r in a}
queue={}
def join(*values):
 return ' | '.join(dict.fromkeys(v.strip() for x in values for v in x.split(' | ') if v.strip()))
def stable(key):
 return 'W-'+hashlib.sha256('|'.join(key).encode()).hexdigest()[:16]
def add(key, item):
 if key not in queue: queue[key]={'wartelisten_id':stable(key),**item}; return
 old=queue[key]
 for f,v in item.items():
  if f in ('letztes_datum','letzte_pruefung'): old[f]=max(old[f],v)
  else: old[f]=join(old[f],v)
for r in review:
 ids=r['historische_ids'].split(' | ')
 dates=[historical[i]['historisches_datum'] for i in re.findall(r'[A-Z]+[0-9]+',r['historische_ids']) if i in historical]
 add(('kandidat',r['kandidat']),dict(historische_referenzen=r['historische_ids'],kandidaten=r['kandidat'],veranstaltung=r['titel'],veranstalter=r['veranstalter'],land=r['land'],ort=r['ort'],letztes_datum=max(dates,default=''),datum_2027=r['start'],status_2027=r['einstufung'],bekannte_offizielle_quellen=join(r['quelle'],r['anmeldung']),weitere_quellen='',fehlende_informationen=r['fehlende_pflichtangaben'] or (r['entscheidung'] if r['einstufung']=='Konflikt' else ''),letzte_pruefung=today,zurueckstellung='Wartet auf produktive Freigabe' if r['einstufung']=='Importbereit' else r['entscheidung']))
history_groups={}
for r in a:
 if r['klasse'] not in ('C','D','E'):continue
 ident=(r['land'], title(r['historischer_titel']), norm(r['historischer_ort']),norm(r['historischer_veranstalter']))
 key=('historisch',*ident) if all(ident) else ('historisch',r['id'])
 history_groups.setdefault(key,[]).append(r)
for key,rows in history_groups.items():
 for r in rows:
  # An exact historical identity already linked to a reviewed 2027 candidate stays with that candidate.
  linked=[x for x in a if x['b_kandidat'] and len(key)==5 and
   (x['land'],title(x['historischer_titel']),norm(x['historischer_ort']),norm(x['historischer_veranstalter']))==key[1:]]
  linked_ids=set(x['b_kandidat'] for x in linked)
  if len(linked_ids)==1:
   old=queue[('kandidat',next(iter(linked_ids)))]
   old['historische_referenzen']=join(old['historische_referenzen'],r['id'],r['weitere_quell_ids'])
   old['letztes_datum']=max(old['letztes_datum'],r['historisches_datum'])
   old['weitere_quellen']=join(old['weitere_quellen'],r['recherchequelle'],r['historische_eventseite'])
   continue
  status={'C':'2027 nicht bestätigt','D':'Manuelle Prüfung','E':'Ausfall belegt'}[r['klasse']]
  add(key,dict(historische_referenzen=join(r['id'],r['weitere_quell_ids']),kandidaten='',veranstaltung=r['historischer_titel'],veranstalter=r['historischer_veranstalter'],land=r['land'],ort=r['historischer_ort'],letztes_datum=r['historisches_datum'],datum_2027='',status_2027=status,bekannte_offizielle_quellen=r['historische_eventseite'],weitere_quellen=r['recherchequelle'],fehlende_informationen='' if r['klasse']=='E' else ('Offizielle Ausgabe 2027' if r['klasse']=='C' else 'Identität, Kalenderzuordnung oder belastbare Angaben 2027 prüfen'),letzte_pruefung=r['stichtag'] or '2026-11-09',zurueckstellung=join(r['hinweis'],r['pruefstand'])))
queue_rows=sorted(queue.values(),key=lambda x:(not bool(x['kandidaten']),x['kandidaten'],x['veranstaltung'].casefold()))
write_csv('warteliste.csv',queue_rows)
fingerprint=json.loads((out/'anfrage.json').read_text())['reviewed_fingerprint']
(out/'anfrage.json').write_text(json.dumps(dict(candidates=sorted(payload,key=lambda x:x['candidate_id']),reviewed_fingerprint=fingerprint),ensure_ascii=False,indent=2)+'\n')
print(Counter(x['einstufung'] for x in review),sum(len(x['distances']) for x in payload),len(queue_rows),sum(bool(x['fehlende_pflichtangaben']) for x in review))

matches=[]
for r in review:
 for e in live:
  if e['country_code'] and r['land']!=e['country_code'].upper():
   continue
  same=r['start']==e['event_date']
  ratio=difflib.SequenceMatcher(None,title(r['titel']).replace(' ',''),title(e['title']).replace(' ','')).ratio()
  url=any(source(p) and source(p)==source(e['official_url']) for p in r['quelle'].split(' | '))
  if (same and ratio>=.56) or ratio>=.78 or url:
   matches.append(dict(kandidat=r['kandidat'],bestehende_id=e['id'],datum=e['event_date'],titel=e['title'],ort=e['city'],gleicher_tag=same,namensaehnlichkeit=round(ratio,3),gleiche_quellseite=url,entscheidung=r['entscheidung']))
(out/'aehnlichkeitstreffer.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2)+'\n')
assert all(r['id'] in {i for w in queue_rows for i in re.findall(r'[A-Z]+[0-9]+',w['historische_referenzen'])} for r in a if r['klasse']!='A')
