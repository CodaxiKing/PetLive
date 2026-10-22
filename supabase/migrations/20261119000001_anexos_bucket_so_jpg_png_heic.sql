-- PetLive: o bucket `anexos` passa a aceitar só JPG, PNG e HEIC/HEIF (P-B7CbI).
-- Antes ficava em `image/*`, e um upload direto pela API com GIF ou WebP
-- entrava no bucket sem registro. Agora o próprio storage recusa outro tipo e
-- arquivo acima de 10 MB. Recibos (despesas) e fotos da linha do tempo, que
-- usam o mesmo bucket, normalizam o tipo no app antes de subir.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
where id = 'anexos';
