import type { Metadata } from "next";
import { PaginaLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "O que o PetLive coleta, para que usa, com quem compartilha e por quanto tempo guarda seus dados.",
};

const SECOES = [
  {
    titulo: "Escopo desta política",
    paragrafos: [
      "Esta Política de Privacidade descreve como o PetLive trata dados pessoais de tutores, conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). Ela se aplica ao aplicativo, ao site e aos canais de atendimento.",
    ],
  },
  {
    titulo: "Dados que coletamos",
    itens: [
      "Cadastro: nome, e-mail e, se você fornecer, telefone.",
      "Dados do pet: nome, espécie, raça, data de nascimento, peso, foto, histórico de vacinas, vermífugos, medicamentos, consultas e lembretes.",
      "Uso do app: quando você abre o app, conclui lembretes e usa o SOS e os guias de emergência (para medir se o app ajuda; ficam só no PetLive e são apagados em 13 meses), além das preferências de notificação.",
      "Técnicos: identificadores de dispositivo e tokens de push notification (Expo), necessários para entregar lembretes.",
    ],
  },
  {
    titulo: "Para que usamos os dados",
    itens: [
      "Fornecer o serviço: criar sua conta, sincronizar a carteira de saúde do pet e enviar lembretes que você cadastrou.",
      "Agendamentos: mostrar seus horários e comunicar prestadores envolvidos.",
      "Segurança e prevenção a fraude.",
      "Cumprir obrigações legais e responder a ordens de autoridade.",
      "Melhorar o produto, sempre que possível com dados agregados ou anonimizados.",
    ],
  },
  {
    titulo: "Base legal do tratamento",
    paragrafos: [
      "Tratamos dados com fundamento na execução do contrato (art. 7º, V), no consentimento (art. 7º, I) — dado no ato do cadastro, com o aceite dos termos — e no cumprimento de obrigação legal (art. 7º, II).",
      "O consentimento pode ser revogado a qualquer momento, sem prejudicar a licitude do tratamento anterior.",
    ],
  },
  {
    titulo: "Compartilhamento",
    itens: [
      "Com prestadores de serviço (hospedagem, banco de dados, envio de notificações), mediante contrato e apenas para executar o serviço.",
      "Com a clínica ou petshop quando você agenda um serviço — apenas os dados necessários ao atendimento.",
      "Com autoridades públicas, quando exigido por lei.",
      "Nunca vendemos seus dados pessoais.",
    ],
  },
  {
    titulo: "Armazenamento e segurança",
    paragrafos: [
      "Os dados são armazenados em infraestrutura Supabase com controle de acesso por linha (RLS), tráfego criptografado em trânsito e backups periódicos.",
      "Ainda que adotemos medidas razoáveis, nenhum sistema é imune a incidentes; em caso de violação com risco relevante, notificaremos você e a ANPD conforme a lei.",
    ],
  },
  {
    titulo: "Retenção e descarte",
    paragrafos: [
      "Mantemos seus dados enquanto a conta estiver ativa e pelo período necessário ao cumprimento de obrigações legais. Após a exclusão da conta, os dados são removidos ou anonimizados em prazo razoável, salvo obrigação legal de guarda.",
    ],
  },
  {
    titulo: "Site: cookies e formulários",
    itens: [
      "Cookies essenciais: guardam só a sua escolha sobre cookies. Não identificam você.",
      "Cookies de medição (Google Analytics): só são usados se você tocar em Aceitar no aviso do site, com IP anonimizado e sem publicidade. Você muda a escolha a qualquer momento em Preferências de cookies, no rodapé.",
      "Formulários de contato e de interesse de lojistas: guardamos nome, e-mail e o que você escrever (e, no caso de lojas, nome, tipo e cidade da loja) só para responder. Apagamos em até 12 meses, ou antes, se você pedir.",
    ],
  },
  {
    titulo: "Seus direitos",
    paragrafos: [
      "Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e revogação do consentimento. A página Direitos na LGPD explica como exercer cada um.",
    ],
  },
  {
    titulo: "Encarregado de dados (DPO)",
    paragrafos: [
      "Canal oficial: dpo@petlive.app. Responderemos às suas solicitações nos prazos previstos em lei.",
    ],
  },
  {
    titulo: "Alterações desta política",
    paragrafos: [
      "Atualizaremos esta página sempre que a prática de dados mudar. Mudanças relevantes serão avisadas no aplicativo. A data da última atualização aparece no topo desta página.",
    ],
  },
];

export default function PaginaPrivacidade() {
  return (
    <PaginaLegal
      foto={{ src: "/fotos/gato-janela.jpg", alt: "Gatinho laranja sentado junto à janela" }}
      titulo="Política de privacidade"
      resumo="Como coletamos, usamos, compartilhamos e protegemos os dados de você e do seu pet."
      atualizado="21 de outubro de 2026"
      secoes={SECOES}
    />
  );
}
