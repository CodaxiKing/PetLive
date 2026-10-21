-- PetLive: consentimento opcional "Dicas e novidades" (telas 97 e 99 do
-- BUSINESS.md, protótipo TermosConsentimento e PrivacidadeDados).
-- Avisos que não são de saúde só saem para quem aceitou aqui.

alter table public.consentimentos
  drop constraint consentimentos_tipo_check;

alter table public.consentimentos
  add constraint consentimentos_tipo_check check (
    tipo in ('termos_uso', 'politica_privacidade', 'avisos_push', 'localizacao', 'dicas_novidades')
  );
