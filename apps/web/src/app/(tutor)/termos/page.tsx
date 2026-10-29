import type { Metadata } from "next";
import { PaginaLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Regras de uso do PetLive: conta, condutas permitidas, propriedade dos dados do pet e responsabilidades.",
};

const SECOES = [
  {
    titulo: "O que é o PetLive",
    paragrafos: [
      "O PetLive é um aplicativo de carteira de saúde do pet: reúne vacinas, vermífugos, remédios, consultas, pesos e lembretes, e permite agendar serviços com clínicas, petshops e prestadores cadastrados.",
      "Estes Termos de Uso regulam a sua relação com o PetLive. Ao criar uma conta e marcar a opção “Li e aceito os termos”, você declara ter lido e concordado com o que está escrito aqui.",
    ],
  },
  {
    titulo: "Sua conta",
    itens: [
      "Você precisa ter idade mínima para contratar na sua localidade (em regra, 18 anos) e fornecer informações verdadeiras e atualizadas.",
      "A conta é pessoal e intransferível. Você é responsável por manter a senha em sigilo e por tudo o que acontecer em sua conta.",
      "Se suspeitar de acesso indevido, troque a senha imediatamente e fale conosco pelo canal de suporte.",
    ],
  },
  {
    titulo: "Como você pode usar o PetLive",
    itens: [
      "Cadastrar e gerenciar a saúde dos seus pets, incluindo documentos, vacinas e medicamentos.",
      "Receber lembretes push e notificações locais sobre os eventos que você cadastrou.",
      "Agendar e avaliar serviços prestados por terceiros cadastrados na plataforma.",
      "Usar o aplicativo de forma pessoal, sem tentar explorar, copiar, revender ou interferir em sua operação.",
    ],
  },
  {
    titulo: "Condutas proibidas",
    paragrafos: [
      "É proibido usar o PetLive para publicar conteúdo ofensivo, discriminatório ou ilegal; se passar por outra pessoa; invadir sistemas; extrair dados em massa; ou praticar qualquer ato que prejudique outros usuários, prestadores ou o próprio serviço.",
      "Podemos suspender ou encerrar contas que violem estas regras, após aviso sempre que possível.",
    ],
  },
  {
    titulo: "Dados do pet e informações de saúde",
    paragrafos: [
      "As informações de saúde do pet são suas. Você pode exportá-las ou excluí-las a qualquer momento pelo aplicativo ou pelo canal de suporte.",
      "O PetLive organiza e lembra eventos de cuidado, mas não substitui veterinário. Em caso de doença ou emergência, procure sempre um profissional habilitado.",
    ],
  },
  {
    titulo: "Serviços de terceiros",
    paragrafos: [
      "Clínicas, petshops e prestadores são responsáveis pelos próprios serviços, preços e horários. O PetLive atua como intermediário de agendamento e não se responsabiliza pela execução do serviço.",
      "Avaliações devem refletir experiências reais; conteúdo publicado de má-fé pode ser removido.",
    ],
  },
  {
    titulo: "Propriedade intelectual",
    paragrafos: [
      "Marca, aplicativo, código, design e textos do PetLive pertencem aos seus titulares. Você mantém a propriedade sobre as fotos e informações que envia, concedendo apenas a licença necessária para hospedar e exibir esses conteúdos no serviço.",
    ],
  },
  {
    titulo: "Alterações destes termos",
    paragrafos: [
      "Podemos atualizar estes Termos conforme o produto e a lei mudarem. Alterações relevantes serão comunicadas no aplicativo; o uso continuado após a vigência implica concordância. A data da última atualização aparece no topo desta página.",
    ],
  },
  {
    titulo: "Contato",
    paragrafos: [
      "Dúvidas sobre estes termos: suporte@petlive.app.br. Consulte também a nossa Política de Privacidade e a página de Direitos na LGPD.",
    ],
  },
];

export default function PaginaTermos() {
  return (
    <PaginaLegal
      foto={{ src: "/fotos/noite.jpg", alt: "Tutora deitada no sofá abraçada ao seu cão" }}
      titulo="Termos de uso"
      resumo="As regras para usar o PetLive com segurança — conta, condutas, dados do pet e serviços contratados."
      atualizado="20 de outubro de 2026"
      secoes={SECOES}
    />
  );
}
