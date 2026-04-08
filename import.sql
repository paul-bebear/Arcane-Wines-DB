-- ================================================================
-- ARCANE WINES — Import from sampledb.xlsx
-- Run in Supabase SQL Editor (postgres role)
-- ================================================================

BEGIN;

-- 1. Clear synthetic test data (order matters — child tables first)
DELETE FROM btg_pours;
DELETE FROM btg_sessions;
DELETE FROM inventory_movements;
DELETE FROM pos_sync_log;
DELETE FROM wines;
DELETE FROM producers;
DELETE FROM regions;

-- 2. Insert producers
INSERT INTO producers (id, name, country, comune) VALUES
  ('d3885e3d-f853-5040-9976-c3437ba12368', '3 Fonteinen', 'Belgio', 'Berseel'),
  ('5077aa42-88de-5831-8254-a5c0221f6fac', 'A.J. Adam', 'Germania', 'Neumagen-Dhron'),
  ('73a8d1b8-db99-5980-a801-4cb36b87cf4d', 'Abbazia San Giorgio', 'Italia', 'Pantelleria'),
  ('2d11116c-1d89-5d6f-a4c6-a9c5bf13d5db', 'Agnes Paquet', 'Francia', 'Meloisey'),
  ('97a5d0f0-0f33-57af-a849-c8b5b003f808', 'Agostino Bosco', 'Italia', 'La Morra'),
  ('a41c748b-698d-540b-9b8f-569108a18432', 'Agrapart', 'Francia', 'Avize'),
  ('07c5b695-607c-5f31-a346-4d9940623bac', 'Ajola', 'Italia', 'Orvieto'),
  ('416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'Al Feu', 'Italia', 'Trapani'),
  ('32e9ae7b-d0d6-5985-8f6f-52154db96b87', 'Aladame', 'Francia', 'Montagny'),
  ('ab8d65ae-378a-5d17-b562-c4c9dc59f741', 'Alain Brumont', 'Francia', 'Maumusson-Laguian'),
  ('8fd38e5f-72d9-5604-9aa3-a966d220f4bb', 'Albert Morot', 'Francia', 'Beaune'),
  ('6ec4da74-260d-5cce-8f7b-cdeee65f496f', 'Alexandra Couvreur', 'Francia', 'Bouze-Les-Beaune'),
  ('d3d6a62d-06eb-55c2-a77d-6729a3cca2a2', 'Alexandre Filaine', 'Francia', 'Damery'),
  ('cc3af610-0447-5c64-aced-d050d3c5c8e0', 'Alfred Merkelbach', 'Germania', 'Urzig');

-- 3. Insert regions
INSERT INTO regions (id, region_name, country) VALUES
  ('7137c533-2f7b-5d73-afac-d4f4b61f15f5', 'Belgio', 'Belgio'),
  ('b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Mosel-Saar-Ruwer', 'Germania'),
  ('cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Sicilia', 'Italia'),
  ('823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Borgogna', 'Francia'),
  ('f7149b86-19c3-5512-961e-7dd9d9f13695', 'Piemonte', 'Italia'),
  ('aa526575-b5bb-5a3c-b06e-3733632fda75', 'Champagne', 'Francia'),
  ('e128aab0-6649-5084-91e7-828a033f97bf', 'Umbria', 'Italia'),
  ('ab16080f-0dcf-5f3a-a83a-4aa4ec182ae7', 'Sud-Ovest', 'Francia');

-- 4. Insert wines (one row per physical bottle-group in the inventory)
INSERT INTO wines (
  id, producer_id, region_id, wine_type, name, vintage, grapes,
  buy_price, table_price, takeaway_available, takeaway_price,
  reserved_list, format, bottle_count, shelf_location, glass_type, notes,
  ownership, location, census_date
) VALUES
  ('550a62e0-1511-5717-a003-15a68a70796c', 'd3885e3d-f853-5040-9976-c3437ba12368', '7137c533-2f7b-5d73-afac-d4f4b61f15f5', 'Birra/Cidre', 'Oude Gueuze Vintage', 2005, 'gueuze', 87.5000, 175.00, TRUE, 175.00, FALSE, '0.375L', 2, 'Cantina, in terra', 'Calice grande Bordeaux', NULL, 'store', 'Milan', '2026-03-05'),
  ('f6f7dc54-2bff-5ffd-ab40-db9ed18ab6a5', '5077aa42-88de-5831-8254-a5c0221f6fac', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Piesporter Goldtröpfchen riesling Kabinett', 2024, 'riesling', 16.2523, 50.00, TRUE, 40.00, FALSE, '0.75L', 6, 'CS2-4', 'Calice medio bianco', NULL, 'store', 'Milan', '2025-12-22'),
  ('8c066c99-b6c8-5b26-8d56-dfd5748deaf1', '5077aa42-88de-5831-8254-a5c0221f6fac', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Dhroner Hofberg riesling Kabinett', 2024, 'riesling', 14.8370, 45.00, TRUE, 36.00, FALSE, '0.75L', 2, 'CS2-4', 'Calice medio bianco', NULL, 'store', 'Milan', '2025-12-22'),
  ('2d6a5661-c2c2-553f-92a8-957cd1395d4f', '5077aa42-88de-5831-8254-a5c0221f6fac', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Dhroner Hofberg riesling Spätlese', 2024, 'riesling', 21.2195, 60.00, TRUE, 48.00, FALSE, '0.75L', 2, 'CS2-4', 'Calice medio bianco', NULL, 'store', 'Milan', '2025-12-22'),
  ('4b6afa82-f9fd-5884-8e65-4ec32a65e44e', '73a8d1b8-db99-5980-a801-4cb36b87cf4d', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Dolce', 'Passito Magico', 2014, 'zibibbo', 40.0000, 80.00, FALSE, NULL, FALSE, '0.5L', 0, 'Cantina, in terra', 'Calice grande Bordeaux', NULL, 'store', 'Milan', '2026-03-05'),
  ('79041a87-3956-545a-8758-e071a2913814', '73a8d1b8-db99-5980-a801-4cb36b87cf4d', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Passito', 'Cloè', 2016, 'zibibbo, perricone, carignano, nerello', 12.5000, 25.00, FALSE, NULL, FALSE, '0.75L', 1, 'CF1-2', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-14'),
  ('38565fb5-3295-53b7-aa3b-ae466a3c85f0', '2d11116c-1d89-5d6f-a4c6-a9c5bf13d5db', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Bollicine', 'Ali Boit Boit et Le 40 Buveurs', NULL, 'aligoté', 15.0000, 30.00, TRUE, 24.00, FALSE, '0.75L', 1, 'CF4-2', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-05'),
  ('22d54ed2-e78e-5cfb-98c9-c4917282e957', '97a5d0f0-0f33-57af-a849-c8b5b003f808', 'f7149b86-19c3-5512-961e-7dd9d9f13695', 'Rosso', 'Langhe Nebbiolo Rurem', 2020, 'nebbiolo', 12.5000, 25.00, TRUE, 20.00, FALSE, '0.75L', 1, 'CO10', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-01-23'),
  ('53a6a312-6e35-529d-aa64-a50d64bca7d6', 'a41c748b-698d-540b-9b8f-569108a18432', 'aa526575-b5bb-5a3c-b06e-3733632fda75', 'Bollicine', 'Mineral', 2005, 'chardonnay', 100.0000, 200.00, FALSE, NULL, FALSE, '0.75L', 1, 'CO24', 'Calice grande Borgogna', NULL, 'store', 'Milan', '2026-02-16'),
  ('66ab6747-d1a7-5379-b6d0-ead8883734aa', '07c5b695-607c-5f31-a346-4d9940623bac', 'e128aab0-6649-5084-91e7-828a033f97bf', 'Orange', 'Bianco #2', 2023, 'druppeggio, grechetto, malvasia, procanico, verdello', 12.1500, 35.00, TRUE, 28.00, FALSE, '0.75L', 12, 'CS1-3', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-05'),
  ('2bb4e1cd-ee04-5cc4-97f9-c030755abd21', '07c5b695-607c-5f31-a346-4d9940623bac', 'e128aab0-6649-5084-91e7-828a033f97bf', 'Bianco', 'Bianco', 2023, 'grechetto, malvasia, procanico, verdello', 12.1500, 35.00, TRUE, 28.00, FALSE, '0.75L', 12, 'CS1-3', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-05'),
  ('3bbafce8-616d-5c58-8a93-cb13546a292d', '07c5b695-607c-5f31-a346-4d9940623bac', 'e128aab0-6649-5084-91e7-828a033f97bf', 'Orange', 'Bianco #2', 2023, 'druppeggio, grechetto, malvasia, procanico, verdello', 12.1500, 35.00, TRUE, 28.00, FALSE, '0.75L', 6, 'CS1-3', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-05'),
  ('89aae79b-8909-5ae6-8866-537684f9db0d', '07c5b695-607c-5f31-a346-4d9940623bac', 'e128aab0-6649-5084-91e7-828a033f97bf', 'Bianco', 'Bianco', 2023, 'grechetto, malvasia, procanico, verdello', 12.1500, 35.00, TRUE, 28.00, FALSE, '0.75L', 5, 'CS1-3', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-05'),
  ('b77a3899-84fa-521e-8e59-4f6e94401890', '07c5b695-607c-5f31-a346-4d9940623bac', 'e128aab0-6649-5084-91e7-828a033f97bf', 'Orange', 'Bianco #2', 2023, 'druppeggio, grechetto, malvasia, procanico, verdello', 12.1500, 35.00, TRUE, 28.00, FALSE, '0.75L', 2, 'TF3-2', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-05'),
  ('89059637-3a95-5dca-9418-011486490345', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Rosso', 'Perricone', 2022, 'perricone', 10.0000, 20.00, TRUE, 16.00, FALSE, '0.75L', 2, 'CO36', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-01-08'),
  ('8aa875a3-45af-5b94-a295-b9298ee63caf', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Orange', 'Pazzarello', 2022, 'catarratto', 10.0000, 20.00, TRUE, 16.00, FALSE, '0.75L', 1, 'CF1-4', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-01-08'),
  ('dfb60187-f6d0-50c2-8161-2ca7546bfcc6', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Bianco', 'Insolia', 2022, 'insolia', 10.0000, 20.00, TRUE, 16.00, FALSE, '0.75L', 1, 'CF1-2', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-01-08'),
  ('3588d085-7e2e-5a69-9932-7a15af2098a3', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Orange', 'Pazzerello', 2024, 'catarratto', NULL, 20.00, FALSE, NULL, FALSE, '0.75L', 10, 'CS4-3', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-05'),
  ('7c8c33f9-b890-5a81-bb3e-bcc771c28695', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Orange', 'Pazzerello', 2023, 'catarratto', NULL, 20.00, FALSE, NULL, FALSE, '0.75L', 3, 'CS4-3', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-05'),
  ('97a89bff-d108-5956-a9d9-e53c22aef69b', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Bianco', 'Catarratto & Zibibbo', 2023, 'catarratto, zibibbo', NULL, 20.00, FALSE, NULL, FALSE, '0.75L', 2, 'CS1-4', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-05'),
  ('0ca76bd7-c909-5aee-8c02-e242fb2f37dc', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Rosso', 'Merlot', 2022, 'merlot', NULL, 20.00, FALSE, NULL, FALSE, '0.75L', 1, 'CO36', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-05'),
  ('31ce8f4f-d2cc-50e0-bf7d-f040969db7ce', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Rosso', 'Perricone', 2022, 'perricone', NULL, 20.00, TRUE, 16.00, FALSE, '0.75L', 1, 'CO36', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-05'),
  ('aa0af0f9-c3cc-53fd-b585-32f57b3fd835', '416c96ef-fb8c-5ca3-af6e-279e6b89c590', 'cbd95ad1-b6cb-56ed-b270-422d72a7d204', 'Bianco', 'Insolia', 2022, 'insolia', NULL, 20.00, TRUE, 16.00, FALSE, '0.75L', 1, 'CS1-4', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-05'),
  ('bef9b604-6788-57e8-a631-cb1332fe1e7f', '32e9ae7b-d0d6-5985-8f6f-52154db96b87', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Bollicine', 'Cremant de Bourgogne BdB Extra Brut', 2013, NULL, NULL, NULL, FALSE, NULL, FALSE, '0.75L', 1, NULL, NULL, NULL, 'store', 'Milan', '2026-04-02'),
  ('64fd6550-3741-5a8f-895c-a8a5c180eee5', '32e9ae7b-d0d6-5985-8f6f-52154db96b87', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Bollicine', 'Cremant de Bourgogne BdB Extra Brut', 2014, NULL, NULL, NULL, FALSE, NULL, FALSE, '0.75L', 1, NULL, NULL, NULL, 'store', 'Milan', '2026-04-02'),
  ('659e4af4-ae97-5a1f-a499-5cefcea28e76', '32e9ae7b-d0d6-5985-8f6f-52154db96b87', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Bollicine', 'Cremant de Bourgogne', 2013, NULL, NULL, NULL, FALSE, NULL, FALSE, '0.75L', 1, NULL, NULL, NULL, 'store', 'Milan', '2026-04-02'),
  ('26c9e326-d638-5056-8423-6213f1fee283', 'ab8d65ae-378a-5d17-b562-c4c9dc59f741', 'ab16080f-0dcf-5f3a-a83a-4aa4ec182ae7', 'Rosso', 'Chateau Montus', 1997, 'tannat, cabernet sauvignon', 155.0000, 300.00, TRUE, 240.00, FALSE, '6L', 1, 'Cantina, in terra', 'Calice grande Borgogna', 'Riservata Night of the Boccions', 'store', 'Milan', '2025-12-22'),
  ('3c8fd7d0-d6a3-5e01-8552-a1f3262383d0', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Teurons', 2007, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 5, 'CS4-4', 'Calice medio', NULL, 'store', 'Milan', '2026-02-26'),
  ('d4c2b9f4-cc0c-5473-b64d-92326787cae4', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Bressandes', 2010, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 3, 'CS4-4', 'Calice medio', NULL, 'store', 'Milan', '2026-02-26'),
  ('9f0d50ff-2678-585b-98d7-9f24c3151bcd', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Marconnets', 2008, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 1, 'CS4-4', 'Calice medio', 'venduta 1', 'store', 'Milan', '2026-02-26'),
  ('8154e379-518e-5bc7-ba6b-d00b616ee924', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Teurons', 2010, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 1, 'CS4-4', 'Calice medio', NULL, 'store', 'Milan', '2026-02-26'),
  ('8b88894f-e069-548f-81e5-0ac3968cb7f5', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Teurons', 2010, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 2, NULL, 'Calice medio', NULL, 'store', 'Milan', '2026-03-14'),
  ('88cc82ed-0618-5665-83cc-f98029cde11a', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Bressandes', 2010, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 1, NULL, 'Calice medio', NULL, 'store', 'Milan', '2026-03-14'),
  ('d319ad27-6e25-5b30-8376-0b662473c9af', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Bressandes', 2007, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 1, NULL, 'Calice medio', NULL, 'store', 'Milan', '2026-03-14'),
  ('030bd452-44ec-5ad6-a283-32dfe97a9b55', '8fd38e5f-72d9-5604-9aa3-a966d220f4bb', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Rosso', 'Beaune 1er Cru Teurons', 2007, 'pinot nero', 35.0000, 70.00, TRUE, 70.00, FALSE, '0.75L', 1, NULL, 'Calice medio', NULL, 'store', 'Milan', '2026-03-14'),
  ('3648fd63-2f7d-5bce-96f2-7e4a5a2a7111', '6ec4da74-260d-5cce-8f7b-cdeee65f496f', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Bianco', 'Le Cretot à Droite', 2022, 'aligoté', 46.0000, 100.00, FALSE, NULL, TRUE, '0.75L', 3, 'CO19', 'Calice grande Bordeaux', NULL, 'store', 'Milan', '2026-02-05'),
  ('2ff4ce17-72fd-5c72-b6cd-58799ebc8a93', '6ec4da74-260d-5cce-8f7b-cdeee65f496f', '823eb458-b853-54f0-ac19-2f5c76aa09f6', 'Bianco', 'Bourgogne Aligoté', 2022, 'aligoté', 46.0000, 100.00, FALSE, NULL, TRUE, '0.75L', 2, 'CO19', 'Calice grande Bordeaux', 'Da posizionare ancora una bottiglia (una sola in CO19)', 'store', 'Milan', '2026-02-05'),
  ('576ac90c-c4b3-54f9-9307-6d7a4c6a6b66', 'd3d6a62d-06eb-55c2-a77d-6729a3cca2a2', 'aa526575-b5bb-5a3c-b06e-3733632fda75', 'Bollicine', 'Cuvée Spéciale', NULL, 'pinot nero, chardonnay, pinot meunier', 62.5000, 125.00, TRUE, 125.00, FALSE, '0.75L', 0, 'TF2-1', 'Calice grande Borgogna', 'venduta 2', 'store', 'Milan', '2025-12-22'),
  ('d77a3993-e654-558c-a7cd-aec283ae3a7e', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Spätlese', 2011, 'riesling', 17.5000, 35.00, TRUE, 35.00, FALSE, '0.75L', 6, 'Cantina, in terra', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-16'),
  ('a7689013-723d-5e46-b2e3-4ce84dd2c555', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Auslese', 2012, 'riesling', 25.0000, 50.00, TRUE, 50.00, FALSE, '0.75L', 1, 'Cantina, in terra', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-16'),
  ('b0e73b17-8fab-5a40-ad7b-d78a7f80485d', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Auslese', 2015, 'riesling', 20.0000, 40.00, TRUE, 40.00, FALSE, '0.75L', 6, 'Cantina, in terra', 'Calice medio bianco', '1 usata per corso', 'store', 'Milan', '2026-02-26'),
  ('dc0cb1c9-e018-5bb5-9f9d-38e0ab32d8a9', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Spätlese', 2015, 'riesling', 10.0000, 20.00, TRUE, 20.00, FALSE, '0.75L', 6, 'Cantina, in terra', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-02-26'),
  ('dcbb4ecd-38f9-596b-9564-74d6d7372c2b', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Auslese', 2013, 'riesling', 25.0000, 50.00, FALSE, NULL, FALSE, '0.75L', 3, 'CS1-1', 'Calice grande Bordeaux', NULL, 'store', 'Milan', '2026-03-04'),
  ('46834b4c-a565-5429-ae71-6d9346da6c85', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Auslese "Urglück"', 2013, 'riesling', 40.0000, 80.00, FALSE, NULL, FALSE, '0.75L', 3, 'CS1-1', 'Calice grande Bordeaux', NULL, 'store', 'Milan', '2026-03-04'),
  ('1dc3d4ae-a205-5eee-bb67-68b02fc9a232', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Spätlese', 2013, 'riesling', 12.5000, 25.00, FALSE, NULL, FALSE, '0.75L', 3, 'CS1-1', 'Calice medio bianco', NULL, 'store', 'Milan', '2026-03-04'),
  ('e7565a42-324d-566c-8fc2-cb4b34c94a37', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Dolce', 'Urziger Würzgarten riesling Beerenauslese', 2010, 'riesling', 50.0000, 100.00, FALSE, NULL, FALSE, '0.75L', 1, 'Cantina, in terra', 'Calice grande Bordeaux', NULL, 'store', 'Milan', '2026-03-14'),
  ('e7332b5c-e08f-5091-a0f4-021265fd6a34', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Spätlese', 2016, NULL, NULL, NULL, FALSE, NULL, FALSE, '0.75L', 3, NULL, NULL, NULL, 'store', 'Milan', '2026-04-02'),
  ('90afb73d-12e8-5519-90ca-5490db75fa78', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Kinheimer Rosenberg riesling Spätlese', 2016, NULL, NULL, NULL, FALSE, NULL, FALSE, '0.75L', 3, NULL, NULL, NULL, 'store', 'Milan', '2026-04-02'),
  ('b897fc92-1cdd-5e29-8c96-5dfa3ec7a75b', 'cc3af610-0447-5c64-aced-d050d3c5c8e0', 'b8aea3c1-b816-56a6-aff8-e534ff1051eb', 'Bianco', 'Urziger Würzgarten riesling Kabinett', 2016, NULL, NULL, NULL, FALSE, NULL, FALSE, '0.75L', 3, NULL, NULL, NULL, 'store', 'Milan', '2026-04-02');

COMMIT;

-- ── Verify ──────────────────────────────────────────────────────────────
SELECT wine_type, COUNT(*) as wines, SUM(bottle_count) as bottles
FROM wines GROUP BY wine_type ORDER BY wines DESC;

SELECT COUNT(*) AS total_wines, SUM(bottle_count) AS total_bottles,
       COUNT(*) FILTER (WHERE reserved_list) AS reserved,
       COUNT(*) FILTER (WHERE bottle_count = 0) AS out_of_stock
FROM wines;