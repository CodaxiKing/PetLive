# Cadastro da loja: provar que é do lojista e pôr no mapa

Como o cadastro do lojista confirma que a loja é mesmo dele e como a loja entra no mapa do app, aproveitando o lugar que já existe ou criando um novo. Os itens estão em `backlog.psv` (APP-LOJISTA "Cadastro da loja", BACKEND "Marketplace" e "Mapa", WEB "Painel admin").

O fluxo tem cinco partes: verificação de identidade, verificação de localização, marcação no mapa, correspondência com um lugar existente (ou criação de um) e revisão do admin.

## O que já existe

A migração `20270110030000_loja_cadastro_moderacao.sql` já tem:

- validação dos dígitos verificadores do CPF ou CNPJ, sem consultar a Receita;
- envio de documentos da loja (CNPJ, documento do responsável, comprovante de endereço, alvará, CRMV);
- o pedido para assumir um lugar (`loja_assumir_lugar`), que fica pendente e é bloqueado se outra loja já assumiu o lugar;
- a decisão do admin (`admin_loja_decidir`), que liga o lugar à loja só quando o dono foi conferido.

Os itens abaixo completam essa base.

## 1. Verificação de identidade

Quem está cadastrando a loja tem o direito de representá-la?

- **Loja com CNPJ:** consulta na Receita pela BrasilAPI (gratuita).
  - O CNPJ precisa estar **ativo**.
  - A atividade (CNAE) precisa ser do ramo pet, por exemplo 4789-0/04 (comércio de artigos para animais), 9609-2/08 (higiene e embelezamento de animais) ou 7500-1/00 (atividades veterinárias). Se não for, o caso vai para o admin, que decide.
  - O responsável precisa aparecer **entre os sócios**. Se não aparecer, ele envia uma procuração ou um contrato.
  - O resultado da consulta fica guardado como prova da verificação.
- **Autônomo com CPF** (passeador, por exemplo): documento com foto e telefone confirmado. Não tem loja física.

## 2. Verificação de localização

O lojista controla aquele endereço?

- **Código no telefone do lugar:** se a loja já existe no mapa, o código vai por SMS ou WhatsApp para o **telefone que já está no lugar**, não para um número que o lojista digitou. É a prova mais forte. Se o lugar é novo, o código vai para o telefone informado.
- **Foto da fachada (opcional):** tirada pelo app, com o GPS a até 100 m do endereço. Dá o selo "Verificada".

## 3. Marcação no mapa

- O endereço vira coordenadas automaticamente (geocodificação).
- Abre um mapa com o pino, e o lojista o arrasta até a porta da loja. O endereço pelo CEP costuma cair no meio da quadra.
- O lojista diz se atende no local ou só a domicílio. Quem atende só a domicílio não aparece como ponto no mapa: aparecem a área atendida ou o bairro.

## 4. Correspondência com um lugar existente

Procuramos lugares a até 100 m do pino que tenham nome parecido, o mesmo telefone ou o mesmo CNPJ, e perguntamos: **"Esta é a sua loja?"**, mostrando nome, foto e endereço.

- **É a loja dele:** o lugar continua o mesmo, com as avaliações, os favoritos e as visitas.
  - Depois da aprovação, os dados que o lojista preencheu (nome, horário, telefone, fotos) passam a valer sobre os importados.
  - O lugar ganha o selo "Perfil oficial".
  - As próximas importações de dados abertos não sobrescrevem os campos editados pelo dono.
- **Nenhum é dele:** criamos um lugar novo, de origem PetLive, que fica oculto no mapa até a aprovação.
- **O lugar já foi assumido por outra conta:** nada é transferido sozinho. Abre uma disputa para o admin.
- **Dois lugares são a mesma loja:** o admin junta os dois em um só.
- **A loja mudou de endereço:** o pino é movido, e o lugar antigo é marcado como "mudou de endereço", sem ser apagado.

Os lugares vêm do OpenStreetMap e de dados abertos, que podem ser guardados. Dados do Google não podem ser guardados de forma permanente, só o código do lugar (place_id).

## 5. Revisão do admin

- No painel admin, a tela Lojistas ganha uma fila de reivindicações. Cada pedido mostra as provas lado a lado: CNPJ, sócios, código confirmado, foto e endereço comparado com o do mapa.
- As ações são aprovar, pedir documento ou recusar. Disputas e junção de lugares duplicados ficam na mesma fila.
- Enquanto a loja está em análise, o lojista já usa o painel (por exemplo, para montar o catálogo), mas a loja não aparece para os tutores.

## O que ainda falta decidir

Propostas, a confirmar:

1. **Prova obrigatória para publicar:** CNPJ ativo do ramo pet, código no telefone e revisão do admin. A foto da fachada dá só o selo "Verificada".
2. **Loja em análise:** o painel fica liberado e a loja, invisível.
3. **Autônomo no mapa:** aparece só a área atendida, sem um ponto exato.
