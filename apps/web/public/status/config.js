// Endereços que a página de status consulta. Não há segredo aqui: a função
// "status" é pública e só de leitura. A página fica em /status do domínio do
// site, então o site é conferido pelo próprio domínio ("/").
window.PETLIVE_STATUS = {
  funcaoStatus: 'https://qurdqbhjtgapyksrilyk.supabase.co/functions/v1/status',
  site: '/',
  intervaloSegundos: 60,
};
