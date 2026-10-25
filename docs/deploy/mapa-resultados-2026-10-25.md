# Mapa: resultados progressivos e retorno dos favoritos — 25/10/2026

Corrigida a publicação progressiva dos lugares. Descobertas públicas válidas aparecem enquanto a consulta ao banco ainda está pendente. Categoria, distância, 24 h e nome são aplicados antes dos pins parciais. Em Todos, a busca por nome também filtra resultados pet friendly parciais; serviços e pet friendly podem completar em ordens diferentes. Dados públicos continuam independentes de cadastro da loja.

A tela limpa pins, seleção, erro e estado offline da consulta anterior ao mudar filtro/busca/região ou tentar novamente. Ao recuperar o foco depois da ficha do lugar, recarrega os resultados e os favoritos. Consultas da tela que perdeu o foco são invalidadas; respostas antigas não substituem a nova consulta.

Testes automatizados cobrem descoberta antes do banco, filtros antes da publicação parcial, busca em Todos/pet friendly e descarte de categorias sem correspondência, além das regras já existentes de fallback e deduplicação. Suíte do tutor: 294 testes em 49 arquivos; TypeScript e lint. Não há migration nem dependência nativa nova nesta alteração.

Validação física pendente: alternar rapidamente filtros e regiões; voltar da ficha após salvar/remover favorito; abrir sem rede; confirmar que os pins antigos não reaparecem e que os lugares novos chegam progressivamente. As tarefas de mapa permanecem Em andamento até essa validação. O código da main contém também a preparação nativa de push, que ainda depende do Firebase; não forçar seu runtime no APK já instalado.
