import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportarDespesas } from '../despesas/exportar';
const m = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), disponivel: vi.fn(), share: vi.fn(), print: vi.fn(), arquivos: new Map<string, string>(), plataforma: { OS: 'android' } }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: m.user }, rpc: m.rpc } }));
vi.mock('react-native', () => ({ Platform: m.plataforma }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
vi.mock('expo-print', () => ({ printToFileAsync: m.print }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: m.disponivel, shareAsync: m.share }));
vi.mock('expo-file-system', () => ({ Paths: { cache: 'file:///cache' }, File: class {
  uri: string;
  constructor(...partes: string[]) { this.uri = partes.join('/'); }
  get exists() { return m.arquivos.has(this.uri); }
  create() { m.arquivos.set(this.uri, ''); }
  async write(s: string) { m.arquivos.set(this.uri, s); }
  delete() { m.arquivos.delete(this.uri); }
} }));
beforeEach(() => {
  vi.resetAllMocks(); m.arquivos.clear(); m.plataforma.OS = 'android';
  m.user.mockResolvedValue({ data: { user: { id: 'a' } }, error: null });
  m.disponivel.mockResolvedValue(true); m.share.mockResolvedValue(undefined);
  m.rpc.mockResolvedValue({ data: { mes: '2026-10', pet_nome: 'Mia', itens: [] }, error: null });
  m.print.mockImplementation(async () => { m.arquivos.set('file:///cache/gerado.pdf', 'pdf'); return { uri: 'file:///cache/gerado.pdf' }; });
});
describe('exportação privada de despesas', () => {
  it('busca o relatório autenticado com filtro e compartilha CSV antes de limpar o cache', async () => {
    m.share.mockImplementation(async (uri) => { expect(m.arquivos.get(uri)).toContain('\uFEFF"Data"'); });
    await exportarDespesas('a', '2026-10', 'pet', 'csv');
    expect(m.rpc).toHaveBeenCalledWith('despesas_exportar', { p_tutor: 'a', p_mes: '2026-10-01', p_pet: 'pet' });
    expect(m.share).toHaveBeenCalledWith(expect.stringContaining('.csv'), expect.objectContaining({ mimeType: 'text/csv' }));
    expect(m.arquivos.size).toBe(0);
  });
  it('produz PDF com o mesmo snapshot e limpa mesmo quando o compartilhamento falha', async () => {
    m.share.mockRejectedValue(new Error('Cancelado'));
    await expect(exportarDespesas('a', '2026-10', null, 'pdf')).rejects.toThrow('Cancelado');
    expect(m.print).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('Nenhuma despesa') }));
    expect(m.arquivos.size).toBe(0);
  });
  it('recusa conta diferente ou plano recusado no servidor, sem criar arquivos', async () => {
    m.user.mockResolvedValueOnce({ data: { user: { id: 'b' } }, error: null });
    await expect(exportarDespesas('a', '2026-10', null, 'csv')).rejects.toThrow('conta mudou');
    expect(m.rpc).not.toHaveBeenCalled();
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Requer Premium' } });
    await expect(exportarDespesas('a', '2026-10', null, 'csv')).rejects.toThrow('Premium');
    expect(m.share).not.toHaveBeenCalled(); expect(m.arquivos.size).toBe(0);
  });
  it('interrompe e limpa se a conta muda durante a geração de PDF', async () => {
    m.print.mockImplementationOnce(async () => {
      m.arquivos.set('file:///cache/gerado.pdf', 'pdf');
      m.user.mockResolvedValue({ data: { user: { id: 'b' } }, error: null });
      return { uri: 'file:///cache/gerado.pdf' };
    });
    await expect(exportarDespesas('a', '2026-10', null, 'pdf')).rejects.toThrow('conta mudou');
    expect(m.share).not.toHaveBeenCalled(); expect(m.arquivos.size).toBe(0);
  });
  it('interrompe quando a tela perde o foco durante a consulta', async () => {
    let atual = true;
    m.rpc.mockImplementationOnce(async () => { atual = false; return { data: { mes: '2026-10', pet_nome: 'Todos', itens: [] }, error: null }; });
    await expect(exportarDespesas('a', '2026-10', null, 'csv', () => atual)).rejects.toThrow('novamente');
    expect(m.share).not.toHaveBeenCalled();
  });
  it('explica indisponibilidade e rejeita dados incompletos', async () => {
    m.disponivel.mockResolvedValueOnce(false);
    await expect(exportarDespesas('a', '2026-10', null, 'pdf')).rejects.toThrow('disponível');
    m.rpc.mockResolvedValueOnce({ data: { mes: '2026-10', itens: null }, error: null });
    await expect(exportarDespesas('a', '2026-10', null, 'csv')).rejects.toThrow('incompleto');
    expect(m.share).not.toHaveBeenCalled();
  });
});
