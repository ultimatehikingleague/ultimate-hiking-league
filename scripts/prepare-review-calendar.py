"""Generate a guarded migration and an audit report from a read-only calendar snapshot."""
import argparse
import collections
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit

# Cross-brand aliases require direct organizer evidence. Other catalogue names are kept
# as written, apart from case and whitespace. No edit-distance or domain-only matches.
SOURCES = [
    ('hundert24','Megamarsch · hundert24 GmbH',('megamarsch','hundert24 gmbh'),('megamarsch.de',),'https://www.megamarsch.de/teilnahmebedingungen'),
    ('mammutmarsch','Mammutmarsch UG (haftungsbeschränkt)',('mammutmarsch','mammutmarsch ug (haftungsbeschränkt)'),('mammutmarsch.de',),'https://mammutmarsch.de/terms-and-conditions'),
    ('action-challenge','Action Challenge Ltd · Ultra Challenge',('ultra challenge',),('ultrachallenge.com',),'https://www.ultrachallenge.com/wp-content/uploads/2025/06/2026-Ultra-Challenge-T-Cs.pdf'),
    ('nord-marsch','Nord-Marsch Sportevents UG',('nord marsch','nord-marsch','nordmarsch'),('nord-marsch.de',),'https://www.nord-marsch.de/agb'),
    ('schritt-fuer-schritt','Schritt für Schritt UG',('schritt für schritt',),('schrittfuerschritt.org',),'https://www.schrittfuerschritt.org/teilnahmebedingungen/'),
    ('jdxtrem','jdXtrem UG · Ultramarsch',('ultramarsch','ultra marsch'),('ultramarsch.de',),'https://www.ultramarsch.de/i/teilnahmebedingungen'),
    ('mountainman','MOUNTAINMAN GmbH',('mountainman',),('mountainman.de',),'https://mountainman.de/kontakt/'),
    ('laufszene-events','Laufszene Events GmbH',('firmenwandertag','laufszene events','laufszene events gmbh'),('firmenwandertag.de','adventurewalk.de'),'https://www.adventurewalk.de/thueringen/infos'),
    ('dein-ostseeweg','Dein Ostseeweg GmbH',('dein ostseeweg','hiking walk'),('ostseeweg.com','hiking-walk.de'),'https://www.ostseeweg.com/agb'),
    ('koelnpfad','Kölnpfad UltraWandern GbR',('kölnpfad','kölnpfad ultrawandern'),('koelnpfad.com','my.raceresult.com'),'https://koelnpfad.com/'),
    ('rennsteiglaufverein','GutsMuths-Rennsteiglaufverein e.V.',('rennsteiglauf',),('rennsteiglauf.de',),'https://www.rennsteiglauf.de/wp-content/uploads/2026/04/Rennsteiglauf_Programmheft_2026.pdf'),
    ('emti','E.M.T.I Extremwandern',('emti extremwandern','e.m.t.i extremwandern'),('emti-extremwandern.de',),'https://emti-extremwandern.de/agbs/'),
]
# Source-confirmed format or multi-day groupings prioritized by verified self-submissions.
MAMMUT_2026='https://mammutmarsch.de/wp-content/uploads/2026/03/eventliste-mammutmarsch-2026.pdf'
MEGA_2026='https://www.megamarsch.de/_files/ugd/c7d428_66f00e0c9d3240d89c534994f2c5a564.pdf'
CONFIRMED_GROUPS = [
    ([3,167,229], 'mammutmarsch-muenchen-fruehjahr', 'Mammutmarsch München (Frühjahr)', 'mammutmarsch', [MAMMUT_2026,'https://mammutmarsch.de/events/mammutmarsch-muenchen-starnberger-see']),
    ([6,649,515], 'mammutmarsch-ruhrgebiet-tag', 'Mammutmarsch Ruhrgebiet', 'mammutmarsch', [MAMMUT_2026,'https://mammutmarsch.de/events/mammutmarsch-ruhrgebiet']),
    ([9,585], 'mammutmarsch-berlin-75-100', 'Mammutmarsch Berlin 75/100 km', 'mammutmarsch', [MAMMUT_2026,'https://mammutmarsch.de/events/mammutmarsch-berlin']),
    ([26], 'mammutmarsch-berlin-herbst', 'Mammutmarsch Berlin 30/42/55 km', 'mammutmarsch', [MAMMUT_2026]),
    ([17,947], 'mammutmarsch-muenchen-75-100', 'Mammutmarsch München 75/100 km', 'mammutmarsch', [MAMMUT_2026,'https://mammutmarsch.de/events/mammutmarsch-muenchen']),
    ([506], 'mammutmarsch-muenchen-herbst', 'Mammutmarsch München (Herbst)', 'mammutmarsch', ['https://mammutmarsch.de/']),
    ([82,538], 'ultramarsch-eifel', 'Ultramarsch Eifel', 'jdxtrem', ['https://www.ultramarsch.de/i/ultramarsch-eifel']),
    ([328,431], 'ultramarsch-usedom', 'Ultramarsch Usedom', 'jdxtrem', ['https://www.ultramarsch.de/i/ultramarsch-usedom']),
    ([85,716,829], 'ultramarsch-dresden', 'Ultramarsch Dresden', 'jdxtrem', ['https://www.ultramarsch.de/c/tickets-1/reale-maersche-2026','https://www.ultramarsch.de/p/2027-ticket-ultramarsch-dresden']),
    ([88,720,826], 'ultramarsch-heidelberg', 'Ultramarsch Heidelberg', 'jdxtrem', ['https://www.ultramarsch.de/c/tickets-1/reale-maersche-2026','https://www.ultramarsch.de/p/2027-um-jahresticket-gueltig-fuer-alle-10-maersche']),
    ([34], 'megamarsch-hannover', 'Megamarsch Hannover', 'hundert24', [MEGA_2026]),
    ([36], 'megamarsch-weserbergland', 'Megamarsch Weserbergland', 'hundert24', [MEGA_2026]),
    ([47,822,950], 'megamarsch-frankfurt', 'Megamarsch Frankfurt', 'hundert24', [MEGA_2026,'https://www.megamarsch.de/en?comp-lv3numbc_page=2']),
    ([48,824], 'megamarsch-ruegen', 'Megamarsch Rügen', 'hundert24', [MEGA_2026,'https://www.megamarsch.de/ruegen']),
    ([529,532,533], '100-km-van-ieper', '100 km van Ieper', 'ieper-100km', ['https://www.100km.be/assets/pdf/Flyers/100km_van_Ieper_2026_fol_EN.pdf']),
]
CONFIRMED_GROUPS.extend([
    ([25,574],'mammutmarsch-wiesbaden','Mammutmarsch Wiesbaden','mammutmarsch',[MAMMUT_2026,'https://mammutmarsch.de/events/mammutmarsch-wiesbaden']),
    ([160],'mdr-osterspaziergang-meiningen','MDR Thüringen Osterspaziergang Meiningen','mdr-thueringen',['https://www.mdr.de/video/mdr-videos/c/video-1002212.html']),
    ([606,643,644],'ivv-europiade-buetgenbach','IVV Europiade Bütgenbach','fbsp-ivv',['https://ivveuropiade2026.be/index.php/en/acceuil-en/']),
    ([961],'wildauer-kleeblatt','Wildauer Kleeblatt-Wanderung','th-wildau',['https://www.th-wildau.de/index.php?buchen=1&id=19852&k_id=9101']),
    ([186,648],'haervejsmarchen-viborg','Hærvejsmarchen Viborg','haervejsmarchen',['https://www.haervejsmarchen.dk/about-us/contact']),
    ([416,601],'die-haard-winter','Die Ha(a)rd Winteredition','survivor-ev',['https://spoferan.com/events/die-haard-winteredition-2026/results/geschlechterwertung','https://spoferan.com/events/die-haard-winteredition']),

    ([158,612],'donautrail-linz','Donautrail Linz','trailabenteuer',['https://donautrail.at/teilnahmebedingungen/','https://donautrail.at/']),
    ([289,479],'ostfriesischer-freiheitsmarsch-aurich','Ostfriesischer Freiheitsmarsch','mtv-aurich',['https://ostfriesischer-freiheitsmarsch.de/']),
    ([562,563],'wanderabenteuer-edersee','Wanderabenteuer Edersee','edersee-marketing',['https://www.edertal.de/de/aktuelles/meldungen/Wandermarathon-2026.php']),
])
FEDERATION_PAIRS = [
    (329,892,'sporton','Sporton vzw'), (333,895,'wandelend-paal','KWSV Wandelend Paal vzw'),
    (335,896,'schoverik-diepenbeek','W.S.V. De Schoverik Diepenbeek'),
    (339,899,'wk-werchter','WK Werchter vzw'),(340,900,'mijnlamp-beringen','De Mijnlamp Beringen-Mijn vzw'),
    (347,905,'ok50-zonhoven','KWSV OK50 Zonhoven vzw'),(359,915,'mijnlamp-beringen','De Mijnlamp Beringen-Mijn vzw'),
    (360,916,'bosdravers-eksel','W.S.V. De Bosdravers Eksel'),(364,920,'paul-gerard-beringen','Wandelclub Paul Gerard Beringen'),
    (366,922,'vaartlandstappers','De Vaartlandstappers'),(367,923,'blauwvoet-westerlo','WSC De Blauwvoet'),
    (370,925,'sparrentrippers','W.S.V. De Sparrentrippers'),(527,936,'blijf-jong-genebos','W.S.V. Blijf Jong Genebos vzw'),
    (543,938,'witloofstappers','De Witloofstappers en -trappers vzw'),(604,939,'kampse-wandelaars','W.S.V. De Kampse Wandelaars'),
    (652,940,'milieu-2000-lommel','W.S.V. Milieu 2000 Lommel'),(361,917,'milieu-2000-lommel','W.S.V. Milieu 2000 Lommel'),
    (346,904,'kampse-wandelaars','W.S.V. De Kampse Wandelaars'),(354,910,'halewijn-geetbets','Koninklijke Wandelclub Halewijn vzw'),
    (357,913,'grevenbroekers-achel','WSV De Grevenbroekers vzw'),(362,918,'iris-kortessem','W.S.V. Iris Kortessem'),
    (345,903,'wandel-mee-brueghel','Wandel Mee Brueghel vzw'),(523,933,'paul-gerard-beringen','Wandelclub Paul Gerard Beringen'),
    (356,912,'torenvrienden-oostham','Torenvrienden Oostham'),
]
CONFIRMED_ORGANIZERS = {'mdr-thueringen':'MDR Thüringen','fbsp-ivv':'Fédération Belge de Sports Populaires · IVV Europiade','th-wildau':'Hochschulsport der TH Wildau','haervejsmarchen':'Hærvejsmarchen Danmark','survivor-ev':'Backyard Ultra Survivor e.V.','trailabenteuer':'Trailabenteuer – Verein für Outdoor und Natursport','mtv-aurich':'MTV Aurich von 1862 e.V.','edersee-marketing':'Edersee Marketing GmbH','ieper-100km':'100 km van Ieper vzw',**{r[0]:r[1] for r in SOURCES}}
PLATFORMS = ('wandel.be','walking.be','raceresult.com','eventbrite.de','eventbrite.com','facebook.com','instagram.com',
             'wikiloc.com','spoferan.com','time2win.at','finishers.com','raceid.com','rausgegangen.de',
             'njuko.net','my.raceresult.com','wandelsportvlaanderen.be','google.com','komoot.com','letsdothis.com')
# Locality variants with primary evidence for the same event site.
SITE_ALIASES = {('hundert24','es','mallorca','megamarsch mallorca'): 'alcudia'}
GENERIC = {'tourist-information','sportplatz hirschgartendreick','wikiloc','time2win','walking.be','tweedaagse','2daagse','vivenu gmbh'}

def n(value):
    return ' '.join(unicodedata.normalize('NFC',value or '').lower().split())

def title(value):
    return ' '.join(re.sub(r'\b202[67]\b',' ',n(value)).strip(' –—-').split())

def host(url):
    try:
        return (urlsplit(url or '').hostname or '').removeprefix('www.')
    except ValueError:
        return ''

def slug(value):
    return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',value).encode('ascii','ignore').decode().lower()).strip('-')

def lit(value):
    if value is None:
        return 'null'
    if isinstance(value,int):
        return str(value)
    return "'" + str(value).replace("'","''") + "'"

def values(rows):
    return ',\n'.join('  (' + ','.join(map(lit,row)) + ')' for row in rows)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('snapshot',type=Path)
    parser.add_argument('--self-submission-audit',type=Path)
    args=parser.parse_args()
    data=json.loads(args.snapshot.read_text())
    rows=data['calendar']
    scope=[r for r in rows if (r['event_date'] or '')[:4] in ('2026','2027')]
    byname=collections.defaultdict(list)
    byhost=collections.defaultdict(set)
    for r in scope:
        brand=n(r['brand'])
        byname[brand].append(r)
        if brand and host(r['official_url']):
            byhost[host(r['official_url'])].add(brand)
    source_by_alias={a: source for source in SOURCES for a in source[2]}

    def organizer(r):
        brand=n(r['brand'])
        domain=host(r['official_url'])
        if not brand or brand in GENERIC or re.search(r' / | und | ism ',brand):
            return None,'missing_or_multiple_organizers'
        if brand in source_by_alias:
            key,name,_,hosts,source=source_by_alias[brand]
            if domain in hosts or (not domain and n(r['title']).startswith(brand.replace('-',' '))):
                return (key,name,source),'verified_organizer_source'
        domains={host(a['official_url']) for a in byname[brand]} - {''}
        if domain and len(domains)==1 and len(byhost[domain])==1 and not any(domain==h or domain.endswith('.'+h) for h in PLATFORMS):
            return (f'calendar-{slug(brand)}-{min(a["id"] for a in byname[brand])}',byname[brand][0]['brand'],r['official_url']),'calendar_brand_and_dedicated_url'
        if re.search(r'(?:\bvzw|\basbl|\bgmbh|\bvereniging|\bverein|\bwandelclub|\be\.v\.|\bgemeinde|\bstadt)\b',brand) and len(domains)<=1:
            return (f'calendar-{slug(brand)}-{min(a["id"] for a in byname[brand])}',byname[brand][0]['brand'],r['official_url']),'explicit_organization_in_calendar'
        return None,'organizer_evidence_conflict' if len(domains)>1 or (domain and len(byhost[domain])>1) else 'organizer_evidence_missing'

    for r in scope:
        if r['id'] in (146,321):
            r['_organizer_override']=('quaelixfaktor','Quälixfaktor','https://quaelixfaktor.de/lindwurm-24')
    planned={}
    groups=collections.defaultdict(list)
    title_locations=collections.defaultdict(set)
    for r in scope:
        org,reason=organizer(r)
        if r.get('_organizer_override'):
            org,reason=r['_organizer_override'],'verified_organizer_source'
        if not org and not r['official_url'] and r['brand']:
            corroborated=[organizer(other)[0] for other in byname[n(r['brand'])] if other['official_url']
                          and title(other['title'])==title(r['title']) and n(other['city'])==n(r['city'])
                          and n(other['country_code'])==n(r['country_code'])
                          and other['event_date'][:4]!=r['event_date'][:4]]
            if len(corroborated)==1 and corroborated[0]:
                org,reason=corroborated[0],'organizer_corroborated_by_other_edition'
        place=n(r['city'])
        t=title(r['title'])
        if r['id'] in (146,321):
            t='lindwurm im auge des drachen'
        country=n(r['country_code'])
        if org:
            place=SITE_ALIASES.get((org[0],country,place,t),place)
        key=(country,place,t)
        groups[key].append(r)
        if org:
            title_locations[(org[0],country,t)].add(place)
        planned[r['id']]={'id':r['id'],'date':r['event_date'],'title':r['title'],'city':r['city'],'brand':r['brand'],
                          'url':(r['official_url'] or '').split('?')[0].split('#')[0] or None,'organizer':org,'organizer_evidence':reason}

    # Compare alternate course-length spellings only to flag possible overlap.
    course_groups=collections.defaultdict(list)
    for r in scope:
        core=re.sub(r'\s*[–—-]?\s*\b\d+(?:[.,]\d+)?(?:\s*/\s*\d+)*\s*km\s*$', '',title(r['title'])).strip()
        course_groups[(n(r['country_code']),n(r['city']),core)].append(r)
    variant_ids={r['id'] for group in course_groups.values() if len({title(x['title']) for x in group})>1
                 and any(len([x for x in group if x['event_date'][:4]==year])>1 for year in ('2026','2027'))
                 for r in group}
    variant_ids.update((3,17,167,169,229,506,947,443))
    seed={29:'megamarsch-mallorca',42:'megamarsch-muenchen',50:'megamarsch-nuernberg',581:'megamarsch-muenchen'}
    accepted=[]
    for (country,place,t),group in groups.items():
        ids=[r['id'] for r in group]
        orgs={planned[i]['organizer'][0] for i in ids if planned[i]['organizer']}
        years=[r['event_date'][:4] for r in group]
        different_dates_in_year=any(len({r['event_date'] for r in group if r['event_date'].startswith(year)})>1 for year in set(years))
        group_conflict=different_dates_in_year or len(orgs)>1 or any(i in variant_ids for i in ids)
        for r in group:
            item=planned[r['id']]
            org=item['organizer']
            alternate_site=org and len(title_locations[(org[0],country,t)])>1
            item['related_ids']=[i for i in ids if i!=r['id']]
            reason=('organizer_unresolved' if not org else 'edition_or_site_conflict' if group_conflict or alternate_site
                    else 'organizer_unresolved_in_pair' if len(group)>1 and any(not planned[i]['organizer'] for i in ids)
                    else 'cross_season' if len(set(years))>1 else 'same_date' if len(group)>1 else 'separate_edition')
            if r['id'] in seed:
                reason='cross_season' if r['id']!=50 else 'separate_edition'
            item['status']=reason
            if reason not in ('cross_season','same_date','separate_edition'):
                continue
            series_slug=next((seed[i] for i in ids if i in seed),f'{slug(t)[:90] or "event"}-{country}-{min(ids)}')
            item['series']=series_slug
            display=re.sub(r'\b202[67]\b',' ',group[0]['title']).strip(' –—-')
            display=' '.join(display.split())
            accepted.append((r['id'],r['slug'],r['title'],r['city'],r['country_code'],r['event_date'],r['brand'],(r['official_url'] or '').split('?')[0].split('#')[0] or None,
                             org[0],org[1],series_slug,display,group[0]['city']))
    indexed={row['id']:row for row in scope}
    curated=list(CONFIRMED_GROUPS)
    for previous,current,organizer,display in FEDERATION_PAIRS:
        first,second=indexed.get(previous),indexed.get(current)
        if not first or not second or not second['official_url'] or host(second['official_url'])!='wandel.be':
            continue
        # Keep the already planned organizer slug where the exact federation spelling
        # has appeared elsewhere in the calendar.
        organizer_slug='club-'+organizer
        CONFIRMED_ORGANIZERS[organizer_slug]=display
        curated.append(([previous,current],f'{slug(first["title"])}-{previous}',first['title'],
                        organizer_slug,[second['official_url']]))
    curated_ids={i for ids,*_ in curated for i in ids}
    accepted=[item for item in accepted if item[0] not in curated_ids]
    indexed={row['id']:row for row in scope}
    for ids,series_slug,name,org_slug,sources in curated:
        group=[indexed[i] for i in ids if i in indexed]
        years={r['event_date'][:4] for r in group}
        for r in group:
            org_name=CONFIRMED_ORGANIZERS[org_slug]
            item=planned[r['id']]
            item.update(status='cross_season' if len(years)>1 else 'source_confirmed_edition',
                        series=series_slug,organizer=(org_slug,org_name,sources[0]),
                        organizer_evidence='verified_organizer_source',series_evidence=sources,
                        related_ids=[i for i in ids if i!=r['id'] and i in indexed])
            accepted.append((r['id'],r['slug'],r['title'],r['city'],r['country_code'],r['event_date'],r['brand'],
              (r['official_url'] or '').split('?')[0].split('#')[0] or None,org_slug,org_name,series_slug,name,group[0]['city']))
    anchored=collections.defaultdict(set)
    for previous,current,organizer,_ in FEDERATION_PAIRS:
        for i in (previous,current):
            if i in curated_ids and i in indexed:
                anchored[(n(indexed[i]['brand']),n(indexed[i]['country_code']))].add('club-'+organizer)
    for j,entry in enumerate(accepted):
        i,_,_,_,country,_,brand,_,org_slug,*_=entry
        alternatives=anchored.get((n(brand),n(country)),set())
        if i not in curated_ids and len(alternatives)==1 and org_slug.startswith('calendar-'):
            canonical=next(iter(alternatives))
            name=CONFIRMED_ORGANIZERS[canonical]
            accepted[j]=(*entry[:8],canonical,name,*entry[10:])
            planned[i]['organizer']=(canonical,name,planned[i]['organizer'][2])
    for r in rows:
        if r['id'] not in planned:
            planned[r['id']]={'id':r['id'],'date':r['event_date'],'title':r['title'],'city':r['city'],'brand':r['brand'],
                              'created_at':r['created_at'],'status':'outside_review_seasons'}

    accepted_ids={a[0] for a in accepted}
    report={'calendar':list(planned.values()),'sources':SOURCES,
            'calendar_counts':dict(collections.Counter(v['status'] for v in planned.values()))}
    if args.self_submission_audit:
        audit=json.loads(args.self_submission_audit.read_text())
        audit['calendar_targets']=[
            {'event_id':r['id'],'title':r['title'],'date':r['date'],'count':count,
             'assignment':'prepared' if r.get('series') else r['status']}
            for key,count in audit.pop('target').items()
            for r in [planned[int(key)]]
        ]
        report['self_submitted_event_audit']=audit
    for row in report['calendar']:
        if row['status']=='outside_review_seasons':
            row['direct_record_references']=sum(r['event_master_id']==row['id'] for r in data.get('calendar2025references',[]))
    Path('docs/review-calendar-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    Path('supabase/migrations/20261212_uhl_review_calendar_assignments.sql').write_text(f"""-- Generated by scripts/prepare-review-calendar.py from the checked calendar snapshot.
begin;
create temp table review_calendar_input (event_id bigint, slug text, title text, city text, country_code text,
  event_date text, brand text, official_url text, organizer_slug text, organizer_name text, series_slug text,
  series_name text, locality text) on commit drop;
insert into review_calendar_input values
{values(sorted(accepted))};

-- Only unchanged source rows are eligible.
delete from review_calendar_input i where not exists (
  select 1 from public.events_master e where e.id=i.event_id and (e.slug,e.title,e.city,e.country_code,e.event_date,e.brand,nullif(regexp_replace(e.official_url,'[?#].*$',''),''))
    is not distinct from (i.slug,i.title,i.city,i.country_code,i.event_date::date,i.brand,i.official_url)
);
insert into uhl_reviews_private.organizers(slug,name)
select distinct organizer_slug,organizer_name from review_calendar_input on conflict(slug) do nothing;
insert into uhl_reviews_private.series(slug,name,locality)
select distinct series_slug,series_name,locality from review_calendar_input on conflict(slug) do nothing;
insert into uhl_reviews_private.editions(event_id,series_id,organizer_id)
select i.event_id,s.id,o.id
from review_calendar_input i join uhl_reviews_private.series s on s.slug=i.series_slug
join uhl_reviews_private.organizers o on o.slug=i.organizer_slug
on conflict(event_id) do nothing;

commit;
""")
    print(report['calendar_counts'])
    print('organizers',len({a[8] for a in accepted}),'series',len({a[10] for a in accepted}))
    print('by year',dict(collections.Counter(a[5][:4] for a in accepted)))

if __name__=='__main__':
    main()
