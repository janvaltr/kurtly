-- Venues (haly pro V1 — scraper_config viz scrapers.md)
insert into public.venues (name, slug, address, city, sport, website_url, booking_url, scraper_key, scraper_config, is_active) values
(
  'Fit4All Nový Lískovec',
  'fit4all',
  'Chironova 544/8, 642 00 Brno',
  'Brno',
  '{badminton}',
  'https://www.fit4all.cz',
  'https://www.fit4all.cz/cs/online-rezervace?activity=6',
  'fit4all',
  '{"bookingUrl": "https://www.fit4all.cz/cs/online-rezervace", "activityId": 6, "horizonDays": 14}',
  true
),
(
  'Tenisová a badmintonová hala Sprint',
  'hala-sprint',
  'Sportovní 2A, 602 00 Brno-Královo Pole',
  'Brno',
  '{badminton,tenis}',
  'https://memberzone.cz/sprint_tenis/',
  'https://memberzone.cz/sprint_tenis/Sportoviste.aspx?ID_Sportoviste=3&NAZEV=Badminton+hala',
  'memberzone',
  '{"bookingUrl": "https://memberzone.cz/sprint_tenis/Sportoviste.aspx", "courtId": 3, "horizonDays": 14}',
  true  -- nastavit false pokud robots.txt potvrdí blokaci
),
(
  'Club Classic Brno',
  'club-classic',
  'Brno',
  'Brno',
  '{badminton,squash,tenis}',
  'https://www.clubclassic.cz',
  'https://rezervace.clubclassic.cz/?page=day_overview&id=22',
  'clubclassic',
  '{"bookingUrl": "https://rezervace.clubclassic.cz/", "venueId": 22, "horizonDays": 7, "waitBetweenRequestsMs": 2000}',
  false  -- zapnout až po ověření/souhlasu haly
);

-- Kurty pro Fit4All (4 badmintonové kurty)
with venue as (select id from public.venues where slug = 'fit4all')
insert into public.courts (venue_id, name, sport)
select venue.id, 'Kurt ' || n, 'badminton'
from venue, generate_series(1, 4) as n;

-- Kurty pro Halu Sprint (2 badmintonové kurty — ověřit skutečný počet)
with venue as (select id from public.venues where slug = 'hala-sprint')
insert into public.courts (venue_id, name, sport)
select venue.id, 'Dvorec ' || n, 'badminton'
from venue, generate_series(1, 2) as n;
