# Cadastro privado de ONG

Acesso: Adoção → Sou responsável por uma ONG → Cadastro da ONG. Lista paginada por data/ID, novo cadastro, retomar rascunho e consultar situação após envio.

Nome, CNPJ numérico ou alfanumérico, cidade/bairro, nome/e-mail/telefone do responsável. Valida formato e dígitos de CNPJ; isso não consulta a Receita nem comprova a existência/habilitação da organização. Referências: [Receita/CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico), [manual dos dígitos](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf). Algoritmo módulo 11 com ASCII menos 48; teste inclui vetor alfanumérico publicado pela Receita.

Primeiro salve rascunho. Anexe estatuto, comprovante da organização e documento do responsável (PDF/JPEG/PNG/WebP, até 10 MB cada, sem URL pública). PDF aceita documentos completos com várias páginas. Salve as referências ou envie para análise após concordância explícita e confirmação. Submissão cria a ONG pendente; não altera plano/papel, não autoaprova e não libera cadastro de pets antes de aprovação administrativa. A interface de moderação/aprovação continua em task própria; não há prazo de análise prometido nesta tela.

## Segurança e limites

Bucket ong-documentos privado com limite de tamanho/MIME no servidor. Nomes sem dados pessoais, em pasta plana por conta. RLS permite envio apenas para rascunho próprio e leitura própria; documentos imutáveis, sem UPDATE/DELETE pelo cliente. Policies restritivas preservam o bloqueio mesmo com uma permissiva antiga. Não expõe documentos no catálogo nem fornece URLs públicas/assinadas neste fluxo.

Versão otimista, ID estável e CNPJ único. Resposta perdida: Atualizar cadastro busca o recibo real; repetição da submissão retorna o registro já enviado sem criar outra ONG. Conta conferida antes/depois de chamadas; respostas após troca de tela/conta descartadas. Formulário/rascunho não persistem em AsyncStorage. Arquivos copiados pelo seletor para o cache próprio são removidos após tentativa de envio; falha de remoção fica para limpeza do sistema. Upload remoto sem referência salva pode permanecer privado até limpeza da conta.

Exportação LGPD inclui os cadastros; a FK remove os registros ao apagar a conta Auth. O código de lgpd-delete foi atualizado para incluir ong-documentos. Auditoria em 25/10 encontrou RPCs de exclusão, worker e cron ausentes da produção; tarefas de exclusão foram reabertas. Não houve ativação de apagamento automático de contas. A rotina completa de remoção de arquivos em produção permanece pendente e não está certificada por esta entrega.

## Verificações

- Tutor: 258 testes/43 arquivos, TypeScript e lint.
- PGlite `supabase/tests/testar-cadastro-ong.mjs`: CNPJ numérico/alfa, rascunho/versão/retry, isolamento inclusive Storage com policy permissiva antiga, ausência de autoaprovação, documentos obrigatórios/confirmados, bloqueio após envio, LGPD composta/cascata e reaplicação. Dados de teste somente em memória.
- Cliente: normalização sem apagar letras, campos, recibo, conta trocada, parâmetros de submissão e upload privado/imutável, tipos e tamanho.

## Homologação

Instalar o novo APK, pois expo-document-picker adiciona módulo nativo. Usar ONG real autorizada e arquivos legíveis completos: salvar rascunho, retomar, anexar/substituir, cancelar seletor, enviar e conferir situação pendente no painel (sem botão de publicar pet). Verificar tipo/tamanho inválidos, offline, duas telas com versões diferentes, resposta perdida e troca de conta. Outra conta não pode listar/baixar documentos ou editar cadastro. Testar teclado/fonte ampliada e PDF no Android/iOS. Não publicar documentos reais de terceiros sem autorização nem cadastrar ONGs fictícias na produção. Homologação nativa e moderação continuam pendentes.
