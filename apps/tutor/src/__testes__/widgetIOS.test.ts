import { expect, it, vi } from 'vitest';
import { apresentarWidgetIOS } from '../widget/apresentacaoIOS';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
it('não leva tokens ao widget e exige abrir o app para confirmar', () => {
  const r = apresentarWidgetIOS({ tipo: 'dose', tutor_id: 'a', pet: 'Rex', pet_id: 'p', remedio: 'Nome privado', dose: '1 comprimido', medication_id: 'm', prevista_para: '2026-10-26T15:00:00Z' }, true);
  expect(r.titulo).toBe('Rex · Remédio'); expect(r.detalhe).not.toContain('comprimido');
  expect(r.url).toContain('widget-dose?'); expect(r.acao).toContain('no app');
  expect(JSON.stringify(r)).not.toContain('token');
});
it('cópia offline não oferece confirmação, e logout limpa dados de saúde', () => {
  const r = apresentarWidgetIOS({ tipo: 'dose', offline: true, tutor_id: 'a', pet: 'Rex', pet_id: 'p', remedio: 'X', dose: '1', medication_id: 'm', prevista_para: '2026-10-26T15:00:00Z' }, false);
  expect(r.url).toBe('petlive://inicio');
  expect(apresentarWidgetIOS({ tipo: 'sem_conta' }, false).titulo).not.toContain('Rex');
});
