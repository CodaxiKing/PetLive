import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { Passeio } from './passeio';
import { tipoFotoPasseio, type FotosPasseio } from './resumo';

function identificador(valor: string) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(valor)) throw new Error('Identificador de foto inválido.');
  return valor;
}

export class FotosPasseioLocal implements FotosPasseio {
  private pasta: Directory;
  constructor(tutorId: string) { this.pasta = new Directory(Paths.document, 'passeios-fotos', identificador(tutorId)); }
  private arquivo(id: string) { return new File(this.pasta, `${identificador(id)}.jpg`); }
  uri(id: string) { return this.arquivo(id).uri; }
  async salvar(id: string, origem: string) {
    if (!/^(file|content):\/\//.test(origem)) throw new Error('Escolha uma foto local da câmera ou da galeria.');
    const fonte = new File(origem);
    if (!fonte.exists || fonte.size > 5 * 1024 * 1024) throw new Error('Escolha uma foto de até 5 MB. Tente recortar ou escolher outra imagem.');
    this.pasta.create({ intermediates: true, idempotent: true });
    const destino = this.arquivo(id);
    if (destino.exists) throw new Error('Não foi possível criar uma nova cópia da foto. Tente novamente.');
    try { fonte.copy(destino); }
    catch (e) { if (destino.exists) destino.delete(); throw e; }
  }
  async remover(id: string) { const foto = this.arquivo(id); if (foto.exists) foto.delete(); }
  async apagarTodas() { if (this.pasta.exists) this.pasta.delete(); }
  async *exportar(passeios: Passeio[]) {
    for (const id of new Set(passeios.flatMap((p) => p.fotoId ? [p.fotoId] : []))) {
      const foto = this.arquivo(id);
      if (!foto.exists) throw new Error('Uma foto de passeio não está disponível neste aparelho. Confira o resumo antes de exportar.');
      const handle = foto.open(FileMode.ReadOnly);
      let tipo: string;
      try { tipo = tipoFotoPasseio(await handle.readBytes(12)); }
      finally { handle.close(); }
      yield { foto_id: id, tipo, base64: await foto.base64() };
    }
  }
}
