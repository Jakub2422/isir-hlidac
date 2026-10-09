insert into public.auction_sources(code,name,homepage_url,method) values
 ('burza-spravcu','Burza správců – nemovitosti','https://www.burzaspravcu.cz/kategorie/nemovite-veci/','html'),
 ('exekutor-ostrava','Exekutorský úřad Ostrava','https://www.eurad-ova.cz/sitemap.xml?typ=rss','rss')
on conflict (code) do update set name=excluded.name, homepage_url=excluded.homepage_url, method=excluded.method;
