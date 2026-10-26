# Horários livres — preparação do Todo

Card conferido em Todo no [Project 5](https://github.com/users/CodaxiKing/projects/5): **[BACKEND] Marketplace: Função de horários livres (horários da loja, folgas, reservas, vagas e duração)**. Referência: `BUSINESS.md` 6 e regra de vagas da seção 21.

Implementado o motor isolado `supabase/functions/_shared/horarios.ts`, exportando `calcularHorariosLivres`. É preparação da Fase 3: não cria reservas, não expõe endpoint público e não ativa marketplace/pagamento.

## Contrato e regras

- O servidor futuro deve buscar agenda, folgas e reservas autorizadas do mesmo serviço/recurso, materializar horários no fuso da loja e informar instantes Unix em milissegundos. A função não interpreta strings de horário local, não geocodifica e não converte fuso. `dia` informa início/fim reais; não há constante de 24 horas.
- `aberturas` e `folgas` usam intervalos semiabertos `[inicio,fim)`. Aberturas sobrepostas ou contíguas são unidas e recortadas ao dia, evitando duplicações. Períodos de almoço separados são preservados.
- A grade começa em cada abertura recortada e avança por `duracaoMinutos + intervaloMinutos`. O intervalo posterior ocupa capacidade e deve caber antes do fechamento; pode ser zero. Essa é a política explícita desta preparação, não um valor comercial padrão.
- Inícios anteriores ao `agora` fornecido pelo servidor não aparecem. Folga sobreposta ao serviço ou ao intervalo posterior remove a opção. Encostar exatamente no fim de outro período não é sobreposição.
- Cada reserva recebida representa um bloqueio real, com ID único, período ocupado completo (incluindo seu próprio intervalo) e número de vagas. O chamador deve excluir canceladas e outras situações que não bloqueiam vagas, conforme a futura máquina de estados; não aceitar status arbitrário do cliente.
- Vagas livres são capacidade menos o **pico simultâneo** dentro de toda a ocupação candidata. Reservas sequenciais não têm suas quantidades somadas como se fossem simultâneas. Só retorna opções com vagas suficientes para a quantidade solicitada.
- Retorna início, fim do atendimento, ocupação até o fim do intervalo e vagas livres. Resultado não altera os objetos de entrada.
- Configuração/dados inválidos retornam `valido=false`, com motivo; não simulam agenda vazia. Até 10 mil entradas em cada coleção e 2 mil candidatos; exceder o limite gera erro explícito, nunca truncamento silencioso. Dinheiro não faz parte desta função.

## Integrações pendentes

Tabelas/consultas `store_hours`, `time_off`, serviços, profissionais/recursos e reservas; regras de bloqueio por status; conversão de calendário/fuso incluindo horários locais ambíguos ou inexistentes; disponibilidade por profissional; endpoint autenticado e telas. Creche/diárias/passeador possuem modelos próprios e não são implementados por este motor de horários.

A cotação **não garante uma vaga**. A criação da reserva deve reconferir capacidade sob transação/lock no banco, ser idempotente e resolver pedidos concorrentes. Essa garantia não pode ser obtida só calculando uma lista em memória. Ainda falta essa integração; nenhum horário real foi reservado.

Status sugerido: **Todo → In Progress**, “motor de cálculo implementado; persistência, reserva transacional e telas pendentes”. Board permanece com atualização manual pelo usuário.

## Verificação

12 testes específicos: abertura, duração, fechamento, intervalo, folga, capacidade, quantidade, dados fora do dia, configuração inválida, overflow, limites e imutabilidade. Inclui dias normalizados com 23/25 horas e comparação com uma simulação independente em 80 agendas determinísticas.

Suíte Node completa do backend: **39 testes aprovados**. Deno 2.5.6 `check` e `lint` aprovados para o módulo; CI ampliado para verificá-lo junto com frete. Sem migration, dependência de aplicação ou chamada a serviços externos.
