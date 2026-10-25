# Perfil: confirmação de gravação e nova tentativa

Continuação da validação de Editar perfil após o reparo do Storage. Leitura exige um perfil existente; falha de rede ou perfil ausente mostra erro com nova tentativa, em vez de montar um formulário vazio. Estado isolado por tutor e respostas após desmontagem descartadas. Atualização do auth não recarrega nem sobrescreve campos em edição.

Salvar dados, trocar foto e remover foto verificam retorno do registro efetivamente alterado no banco. UPDATE sem linha não pode ser tratado como sucesso. Upload sem perfil confirmado tenta remover somente o arquivo novo e preserva a foto antiga. Remoção sem confirmação não apaga o arquivo. Trava imediata evita salvar durante o seletor/upload e impede operações duplicadas. Nome continua persistido em profiles, sem escrita secundária de metadados Auth que pudesse atingir outra sessão após uma troca de conta.

333 testes (54 arquivos) passaram, incluindo dois casos novos de UPDATE sem registro confirmado. TypeScript e lint verificados antes da entrega. Sem migration nova, sem alteração em cobrança ou limites. Teste visual e fluxo real do perfil no Android permanecem necessários.
