export function isoLocal(data: Date): string {
  return new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

type FormularioEvento = {
  titulo: string; descricao: string; local: string; inicio: string; fim: string;
  modoLocal: 'ponto' | 'google'; placeId: string; lat: string; lng: string;
  gratuito: boolean; preco: string; ingresso: string; vagas: string;
};

export function validarFormularioEvento(f: FormularioEvento, agora = new Date()) {
  const dataInicio = new Date(f.inicio);
  const dataFim = new Date(f.fim);
  const dataValida = (texto: string, data: Date) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)
    && Number.isFinite(data.getTime()) && isoLocal(data) === texto;
  if (f.titulo.trim().length < 3 || f.titulo.trim().length > 100 || f.descricao.trim().length < 10
    || f.descricao.trim().length > 3000 || f.local.trim().length < 2 || f.local.trim().length > 160) {
    throw new Error('Revise o título, a descrição e o nome do local.');
  }
  if (!dataValida(f.inicio, dataInicio) || !dataValida(f.fim, dataFim) || dataInicio <= agora || dataFim <= dataInicio
    || dataFim.getTime() - dataInicio.getTime() > 7 * 86400000) {
    throw new Error('Informe datas futuras válidas e uma duração de até 7 dias.');
  }
  const latitude = Number(f.lat.replace(',', '.'));
  const longitude = Number(f.lng.replace(',', '.'));
  if (f.modoLocal === 'google' ? !f.placeId.trim() || f.placeId.trim().length > 255
    : !f.lat.trim() || !f.lng.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Informe um local válido: latitude e longitude ou um lugar do Google.');
  }
  const precoCentavos = Math.round(Number(f.preco.replace(',', '.')) * 100);
  if (!f.gratuito) {
    let url: URL;
    try { url = new URL(f.ingresso.trim()); } catch { throw new Error('Informe um link HTTPS válido para o ingresso.'); }
    if (!Number.isSafeInteger(precoCentavos) || precoCentavos <= 0 || precoCentavos > 2147483647 || url.protocol !== 'https:' || !url.hostname) {
      throw new Error('Informe um preço válido e um link HTTPS para o ingresso.');
    }
  }
  const numeroVagas = f.vagas.trim() ? Number(f.vagas) : null;
  if (numeroVagas !== null && (!Number.isInteger(numeroVagas) || numeroVagas < 1 || numeroVagas > 100000)) {
    throw new Error('Use um número inteiro de vagas entre 1 e 100.000.');
  }
  return { dataInicio, dataFim, latitude, longitude, precoCentavos, numeroVagas };
}
