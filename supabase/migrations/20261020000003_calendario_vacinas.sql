-- PetLive: calendário sugerido de vacinas por espécie e idade.
-- Tarefa: [BACKEND] Base: "Calendário de vacinas por espécie e idade (tabela e regras)"
-- O app usa estes dados para sugerir datas no cadastro de vacina.
-- Ajuste fino de protocolo deve ser validado com veterinário antes do lançamento.

insert into public.vaccine_schedule (especie, nome, primeira_dose_meses, reforco_meses, descricao, ordem) values
  -- Cães
  ('cao', 'V10', 45, 30, 'Quíntupla: cinomose, hepatite, parainfluenza, parvovírose e leptospirose.', 10),
  ('cao', 'Antirrábica', 120, 365, 'Obrigatória por lei; dose anual a partir de 3 meses.', 20),
  ('cao', 'V4 (Gêmea)', 45, 30, 'Tosse dos canis (parainfluenza e bordetella).', 30),
  ('cao', 'Giárdia', 90, 365, 'Prevenção de giardíase, dose anual.', 40),
  ('cao', 'Gripe canina', 60, 365, 'Coxiella e demais agentes respiratórios.', 50),
  ('cao', 'Vermífugo (rotina)', 30, 90, 'Prevenção de verminoses, a cada 3 meses até 6 meses de idade.', 60),
  -- Gatos
  ('gato', 'V4 Felina', 45, 30, 'Panleucopenia, rinotraqueíte, calicivírose e clamydia.', 10),
  ('gato', 'V5 Felina', 45, 30, 'Inclui a pifteria (febre felina).', 20),
  ('gato', 'Antirrábica', 120, 365, 'Obrigatória por lei; dose anual a partir de 3 meses.', 30),
  ('gato', 'Leucemia felina (FeLV)', 60, 365, 'Recomendada para gatos que saem de casa.', 40),
  ('gato', 'Vermífugo (rotina)', 30, 90, 'Prevenção de verminoses, a cada 3 meses até 6 meses de idade.', 50);

-- Leitura pública: o app precisa das sugestões sem sessão expandida
-- (a policy de leitura já está na migração de RLS).
