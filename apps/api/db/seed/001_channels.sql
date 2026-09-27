-- 001_channels.sql — Canali e combinazioni pubblicabili
--
-- `specs` contiene le dimensioni della tela e gli override dei limiti editoriali.
-- I default dei limiti stanno in src/content/blocks.ts: qui si scrive solo
-- ciò che differisce per quella specifica combinazione.

INSERT INTO channels (code, name, kind) VALUES
  ('indeed',    'Indeed',    'job_board'),
  ('whatsapp',  'WhatsApp',  'messaging'),
  ('instagram', 'Instagram', 'social'),
  ('tiktok',    'TikTok',    'social');

INSERT INTO channel_formats (channel_code, format, aspect_ratio, specs) VALUES
  -- Job board: solo testo
  ('indeed', 'text', NULL, '{}'),

  -- WhatsApp: A4, l'unico formato mostrato per intero nell'anteprima della chat.
  -- Il messaggio da solo porta il dettaglio; accanto all'immagine resta breve.
  ('whatsapp', 'text',       NULL, '{"limits":{"text":{"bullets":[3,6]}}}'),
  ('whatsapp', 'image',      'A4', '{"width_px":1240,"height_px":1754}'),
  ('whatsapp', 'image_text', 'A4', '{"width_px":1240,"height_px":1754,"limits":{"text":{"bullets":[0,2]}}}'),

  -- Instagram: feed quadrato, feed verticale, stories/reels.
  -- In 9:16 c'è più spazio verticale per l'hook.
  ('instagram', 'image',      '1:1',  '{"width_px":1080,"height_px":1080}'),
  ('instagram', 'image',      '4:5',  '{"width_px":1080,"height_px":1350}'),
  ('instagram', 'image',      '9:16', '{"width_px":1080,"height_px":1920,"limits":{"image":{"hook_max":40}}}'),
  ('instagram', 'image_text', '1:1',  '{"width_px":1080,"height_px":1080}'),
  ('instagram', 'image_text', '4:5',  '{"width_px":1080,"height_px":1350}'),
  ('instagram', 'image_text', '9:16', '{"width_px":1080,"height_px":1920,"limits":{"image":{"hook_max":40}}}'),

  -- TikTok: solo verticale; testo dell'ad volutamente breve (scelta editoriale)
  ('tiktok', 'image',      '9:16', '{"width_px":1080,"height_px":1920,"limits":{"image":{"hook_max":40}}}'),
  ('tiktok', 'image_text', '9:16', '{"width_px":1080,"height_px":1920,"limits":{"image":{"hook_max":40},"text":{"primary_max":150,"hashtags":[0,3]}}}');
