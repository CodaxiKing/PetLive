import type { Metadata } from "next";
import { PaginaLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Direitos na LGPD",
  description:
    "Seus direitos como titular de dados no PetLive e como exercê-los: acesso, correção, exclusão, portabilidade e mais.",
};

const SECOES = [
  {
    titulo: "Você é o titular dos seus dados",
    paragrafos: [
      "A LGPD garante direitos a qualquer pessoa cujos dados são tratados. No PetLive, isso inclui os dados que você informa no cadastro e as informações de saúde do pet que você cadastra.",
      "Este guia resume os direitos do art. 18 da Lei nº 13.709/2018 e como exercê-los dentro do app.",
    ],
  },
  {
    titulo: "Seus direitos",
    itens: [
      "Confirmação da existência de tratamento — saiba se temos dados seus.",
      "Acesso aos dados — veja o que guardamos sobre você e seu pet.",
      "Correção — corrija informações incompletas, inexatas ou desatualizadas.",
      "Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.",
      "Portabilidade — receba seus dados em formato estruturado e interoperável.",
      "Eliminação dos dados tratados com consentimento, observadas as hipóteses de guarda legal.",
      "Informação sobre compartilhamento — saiba com quem seus dados foram compartilhados.",
      "Revogação do consentimento, a qualquer momento, sem custo.",
      "Oposição a tratamento baseado em fundamento diverso do consentimento, quando cabível.",
    ],
  },
  {
    titulo: "Como exercer dentro do app",
    itens: [
      "Editar dados: tela do perfil e tela de edição de cada pet (nome, peso, foto, histórico).",
      "Excluir um pet: na tela do pet, opção de exclusão — remove também arquivos enviados ao armazenamento.",
      "Sair da conta ou excluir a conta: menu da conta, com confirmação explícita.",
      "Revogar notificações: configurações do celular revogam permissões de push a qualquer momento.",
    ],
  },
  {
    titulo: "Como exercer fora do app",
    paragrafos: [
      "Envie sua solicitação para dpo@petlive.app.br informando o que deseja (acesso, exclusão, portabilidade etc.), o e-mail da sua conta e, se possível, uma cópia de documento para conferência de identidade.",
      "Responderemos confirmando o recebimento e concluído o pedido dentro dos prazos legais (em regra, 15 dias para resposta sobre a existência de tratamento e até 3 dias úteis para pedidos simplificados).",
    ],
  },
  {
    titulo: "Dados do pet e consentimento",
    paragrafos: [
      "Dados de saúde do pet são informados por você para cuidar do animal. Ao marcar a caixa de aceite no cadastro, você registra data e hora do consentimento — esse registro fica guardado como prova, conforme exigência da LGPD.",
      "Se você revogar o consentimento, avisamos que a carteira de saúde deixa de funcionar de forma completa; a eliminação dos dados pode ser pedida pelo canal do encarregado.",
    ],
  },
  {
    titulo: "Menores e terceiros",
    paragrafos: [
      "O PetLive é voltado a tutores maiores de idade. Não coletamos deliberadamente dados de crianças; se identificarmos tal situação, eliminaremos as informações.",
    ],
  },
  {
    titulo: "Reclamações",
    paragrafos: [
      "Se não ficar satisfeito com nossa resposta, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) em www.gov.br/anpd.",
    ],
  },
];

export default function PaginaLgpd() {
  return (
    <PaginaLegal
      titulo="Direitos na LGPD"
      resumo="Um guia prático dos seus direitos sobre os dados pessoais no PetLive e do passo a passo para usá-los."
      atualizado="20 de outubro de 2026"
      secoes={SECOES}
    />
  );
}
