import { concluirPasseio, novoPasseio, pausarPasseio, registrarPonto, retomarPasseio, type AmostraGps, type Passeio } from './passeio';
import type { RepositorioPasseios } from './repositorio';
import { anotacaoPasseio, type FotosPasseio } from './resumo';
import { textoDeErro } from '../lib/erros';

export type GpsPasseio = { observar(ponto: (p: AmostraGps) => void | Promise<void>, erro: (mensagem: string) => void | Promise<void>): Promise<() => void | Promise<void>> };
type Estado = { carregando: boolean; ocupado: boolean; erro: string | null; aviso: string | null; passeios: Passeio[] };

/** Uma fila por sessão mantém pontos, pausa e finalização na ordem em que ocorreram. */
export class GravadorPasseio {
  private estado: Estado = { carregando: true, ocupado: false, erro: null, aviso: null, passeios: [] };
  private ouvintes = new Set<() => void>();
  private fila = Promise.resolve();
  private removerGps: (() => void | Promise<void>) | null = null;
  private geracao = 0;
  private bloqueado = false;
  private segundoPlano = false;
  constructor(private repo: RepositorioPasseios, private gps: GpsPasseio, private agora: () => number, private id: () => string, private fotos?: FotosPasseio) {}
  snapshot = () => this.estado;
  permiteSegundoPlano = () => this.segundoPlano;
  configurarGps(gps: GpsPasseio, segundoPlano: boolean) {
    if (this.bloqueado || this.atual()?.status === 'gravando') return false;
    this.gps = gps;
    this.segundoPlano = segundoPlano;
    return true;
  }
  assinar = (fn: () => void) => { this.ouvintes.add(fn); return () => { this.ouvintes.delete(fn); }; };
  private emitir(mudanca: Partial<Estado>) { this.estado = { ...this.estado, ...mudanca }; this.ouvintes.forEach((fn) => fn()); }
  private atual() { return this.estado.passeios.find((p) => p.status !== 'concluido'); }
  private pararGps() {
    this.geracao++;
    const remover = this.removerGps;
    if (!remover) return Promise.resolve();
    return Promise.resolve().then(() => remover()).then(() => {
      if (this.removerGps === remover) this.removerGps = null;
    });
  }
  private enfileirar(fn: () => Promise<void>) {
    const tarefa = this.fila.then(fn);
    this.fila = tarefa.catch(() => undefined);
    return tarefa;
  }
  private async persistir(passeio: Passeio) {
    const existe = this.estado.passeios.some((p) => p.id === passeio.id);
    const passeios = existe ? this.estado.passeios.map((p) => p.id === passeio.id ? passeio : p) : [...this.estado.passeios, passeio];
    await this.repo.salvar(passeios);
    this.emitir({ passeios, erro: null });
  }
  async carregar() {
    await this.enfileirar(async () => {
      if (!this.estado.carregando) return;
      try {
        const passeios = await this.repo.carregar();
        const recuperados = passeios.map((p) => pausarPasseio(p, p.atualizadoEm));
        await this.repo.salvar(recuperados);
        this.emitir({ passeios: recuperados, carregando: false, erro: null,
          aviso: passeios.some((p) => p.status === 'gravando') ? 'O passeio foi recuperado pausado. Retome quando estiver pronto.' : null });
      } catch { this.emitir({ erro: 'Não foi possível ler os passeios salvos. Tente novamente; seus dados não foram substituídos.', carregando: true }); }
    });
  }
  private async comando(fn: () => Promise<void>) {
    if (this.bloqueado || this.estado.carregando) return false;
    this.bloqueado = true; this.emitir({ ocupado: true, erro: null });
    try { await this.enfileirar(fn); return true; }
    catch (e) {
      await this.pararGps().catch(() => undefined);
      this.emitir({ erro: textoDeErro(e, 'Não foi possível salvar o passeio.') });
      const p = this.atual();
      if (p?.status === 'gravando') {
        const pausado = pausarPasseio(p, this.agora());
        this.emitir({ passeios: this.estado.passeios.map((x) => x.id === p.id ? pausado : x) });
      }
      return false;
    } finally { this.bloqueado = false; this.emitir({ ocupado: false }); }
  }
  private async ligarGps() {
    await this.pararGps();
    const geracao = ++this.geracao;
    const remover = await this.gps.observar((ponto) => {
      if (geracao !== this.geracao) return;
      return this.enfileirar(async () => {
        // Pontos recebidos antes de pausar/finalizar devem ser gravados antes do comando.
        const p = this.atual();
        if (!p || p.status !== 'gravando') return;
        if (p.pontos.length >= 10000) { void this.pausar('O limite de pontos deste passeio foi atingido. Finalize para salvar.'); return; }
        const proximo = registrarPonto(p, ponto, this.agora());
        if (proximo !== p) await this.persistir(proximo);
      }).catch(async () => { await this.pausar('Falha ao salvar o GPS. Passeio pausado; tente retomar.'); });
    }, (mensagem) => { if (geracao === this.geracao) return this.pausar(mensagem); });
    if (geracao !== this.geracao) await remover();
    else this.removerGps = remover;
  }
  iniciar(pet: { id: string; nome: string }) {
    return this.comando(async () => {
      if (this.atual()) return;
      // Só persistimos uma sessão ativa após a permissão e o observador estarem disponíveis.
      await this.ligarGps();
      await this.persistir(novoPasseio(this.id(), this.repo.tutorId, pet.id, pet.nome, this.agora()));
      this.emitir({ aviso: this.segundoPlano ? 'Gravando também com a tela apagada. Abra o PetLive para pausar ou finalizar.' : 'Mantenha esta tela aberta. Ao sair do app ou desta tela, o passeio será pausado.' });
    });
  }
  retomar() {
    return this.comando(async () => {
      const p = this.atual();
      if (!p || p.status !== 'pausado') return;
      await this.ligarGps();
      await this.persistir(retomarPasseio(p, this.agora()));
      this.emitir({ aviso: this.segundoPlano ? 'Passeio retomado, inclusive com a tela apagada.' : 'Passeio retomado. Mantenha esta tela aberta.' });
    });
  }
  pausar(aviso = 'Passeio pausado.') {
    // Cancela imediatamente inclusive uma assinatura que ainda está sendo criada.
    const parada = this.pararGps().then(() => null, () => 'Não foi possível encerrar o GPS. Tente pausar novamente.');
    return this.enfileirar(async () => {
      const erroParada = await parada;
      const p = this.atual();
      if (p) {
        const pausado = pausarPasseio(p, this.agora());
        this.emitir({ passeios: this.estado.passeios.map((x) => x.id === p.id ? pausado : x), aviso });
        try { await this.persistir(pausado); }
        catch { this.emitir({ erro: 'Não foi possível salvar a pausa. Os dados continuam nesta tela. Tente salvar novamente.' }); }
      }
      if (erroParada) this.emitir({ erro: erroParada });
    });
  }
  finalizar() {
    if (this.bloqueado) return Promise.resolve();
    return this.comando(async () => {
      await this.pararGps();
      const p = this.atual();
      if (!p) return;
      await this.persistir(concluirPasseio(p, this.agora()));
      this.emitir({ aviso: 'Passeio concluído e salvo neste aparelho.' });
    });
  }
  apagar(prepararExclusao?: () => Promise<void>) {
    return this.comando(async () => {
      if (this.atual()?.status === 'gravando') throw new Error('Pause o passeio antes de apagar os dados.');
      await prepararExclusao?.();
      await this.fotos?.apagarTodas();
      await this.repo.salvar([]);
      this.emitir({ passeios: [], aviso: 'Os passeios desta conta foram apagados deste aparelho.' });
    });
  }
  sincronizar(executar: (passeios: Passeio[], salvar: (p: Passeio[]) => Promise<void>) => Promise<Passeio[]>) {
    return this.comando(async () => {
      if (this.atual()?.status === 'gravando') throw new Error('Pause o passeio antes de sincronizar.');
      const passeios = await executar(this.estado.passeios, (p) => this.repo.salvar(p));
      this.emitir({ passeios, aviso: 'Trajetos e anotações sincronizados. As fotos continuam somente neste aparelho.' });
    });
  }
  salvarResumo(id: string, anotacao: string, foto: string | null | undefined) {
    return this.comando(async () => {
      const p = this.estado.passeios.find((p) => p.id === id);
      if (!p || p.status === 'gravando') throw new Error('Pause o passeio antes de revisar e salvar.');
      const nota = anotacaoPasseio(anotacao);
      let novaFoto: string | null | undefined = p.fotoId;
      if (foto !== undefined) {
        if (!this.fotos) throw new Error('O armazenamento de fotos não está disponível.');
        if (foto === '') throw new Error('Escolha uma foto válida ou remova a foto.');
        novaFoto = foto === null ? null : this.id();
        if (foto && novaFoto) await this.fotos.salvar(novaFoto, foto);
      }
      try {
        await this.persistir({ ...concluirPasseio(p, p.atualizadoEm), anotacao: nota, fotoId: novaFoto });
      } catch (e) {
        if (novaFoto && novaFoto !== p.fotoId) await this.fotos?.remover(novaFoto).catch(() => undefined);
        throw e;
      }
      if (p.fotoId && p.fotoId !== novaFoto) await this.fotos?.remover(p.fotoId).catch(() => undefined);
      this.emitir({ aviso: 'Resumo do passeio salvo neste aparelho.' });
    });
  }
  checkpoint() {
    return this.enfileirar(async () => {
      const p = this.atual();
      if (p?.status !== 'gravando') return;
      try { await this.persistir({ ...p, atualizadoEm: this.agora() }); }
      catch { void this.pausar('Falha ao salvar. Passeio pausado para preservar os dados.'); }
    });
  }
}
