// Endereços que a página de status consulta. Não há segredo aqui: a função
// "status" é pública e só de leitura. Troque pelos endereços de produção.
window.PETLIVE_STATUS = {
  funcaoStatus: 'https://qurdqbhjtgapyksrilyk.supabase.co/functions/v1/status',
  site: 'http://nea67e6gbvk6kc25l5dct9qk.191.96.225.192.sslip.io',
  intervaloSegundos: 60,
};
