import Image from "next/image";
import Link from "next/link";
import { URL_APP_STORE, URL_GOOGLE_PLAY } from "@/components/BotoesLojas";
import { CalendarioVacinas } from "@/components/site/CalendarioVacinas";
import { HistoriaDia } from "@/components/site/HistoriaDia";
import { Ingresso } from "@/components/site/Ingresso";
import { NovoPet } from "@/components/site/NovoPet";

/*
 * Página inicial do site para tutores. A ideia: a página é a carteirinha
 * de vacinação do pet, impressa em papel. O herói é a carteirinha, os
 * recursos são um cardápio, o começo é um canhoto, os planos são
 * ingressos e as perguntas são fichas de arquivo. Os recursos citados
 * existem no app (apps/tutor); os planos seguem a tela Premium do app.
 */

const SELOS = [
  { vacina: "V10", data: "30/11/25" },
  { vacina: "Antirrábica", data: "15/03/26" },
  { vacina: "Gripe canina", data: "10/06/26" },
];

const CARDAPIO = [
  {
    grupo: "Saúde",
    itens: [
      { nome: "Carteirinha de vacinas", valor: "incluído", nota: "Vacinas, vermífugo, peso e consultas num só lugar." },
      { nome: "Calendário sugerido", valor: "por espécie", nota: "As vacinas que faltam, com a data de cada uma." },
      { nome: "Carteirinha em PDF", valor: "Premium", nota: "Para levar à clínica ou mandar ao veterinário." },
    ],
  },
  {
    grupo: "Rotina",
    itens: [
      { nome: "Remédios dose a dose", valor: "na hora", nota: "Aviso no horário e Feito na própria notificação." },
      { nome: "Lembretes e rotina", valor: "incluído", nota: "Banho, antipulgas, vermífugo e o que você quiser." },
      { nome: "Passeios gravados", valor: "com mapa", nota: "Trajeto, distância e tempo de cada passeio." },
    ],
  },
  {
    grupo: "Quando precisar",
    itens: [
      { nome: "SOS e clínica 24 h", valor: "1 toque", nota: "A clínica 24 h mais perto, para ligar ou ir." },
      { nome: "Primeiros socorros", valor: "sem internet", nota: "Passo a passo guardado no celular." },
      { nome: "QR da coleira", valor: "incluído", nota: "Quem achar o pet vê como falar com você." },
    ],
  },
];

const CANHOTO = [
  {
    quando: "Hoje",
    linhas: [
      { o_que: "Baixe o app e crie a conta", valor: "grátis" },
      { o_que: "Cadastre o pet", valor: "nome e nascimento" },
      { o_que: "Registre as vacinas já tomadas", valor: "na carteirinha" },
    ],
  },
  {
    quando: "Amanhã",
    linhas: [
      { o_que: "Chega o aviso do remédio", valor: "na hora certa" },
      { o_que: "Marque Feito na notificação", valor: "1 toque" },
    ],
  },
  {
    quando: "Quando precisar",
    linhas: [
      { o_que: "Clínica 24 h mais perto", valor: "1 toque" },
      { o_que: "Primeiros socorros", valor: "sem internet" },
    ],
  },
];

const PERGUNTAS = [
  {
    aba: "Veterinário",
    pergunta: "O PetLive substitui o veterinário?",
    resposta:
      "Não. O PetLive organiza informações de saúde, lembretes e o caminho até a clínica; decisões clínicas e emergências devem sempre passar por um veterinário habilitado.",
  },
  {
    aba: "Dados",
    pergunta: "Meus dados estão protegidos?",
    resposta:
      "Sim. Seguimos a LGPD, com acesso controlado por conta, tráfego criptografado e registro do seu consentimento no cadastro. Veja a Política de Privacidade e a página Direitos na LGPD.",
  },
  {
    aba: "Sem internet",
    pergunta: "O app funciona sem internet?",
    resposta:
      "O essencial, sim: os primeiros socorros e os dados de emergência ficam guardados no celular. A busca no mapa e as rotas precisam de internet.",
  },
  {
    aba: "Família",
    pergunta: "Dá para dividir com a família?",
    resposta:
      "Sim. Na guarda compartilhada você convida outra pessoa por um link, e a dose que ela marcar como dada aparece para você.",
  },
  {
    aba: "Cidades",
    pergunta: "Quais cidades o PetLive atende?",
    resposta:
      "A carteira de saúde e os lembretes funcionam em todo o Brasil. A rede de clínicas, petshops e serviços começa pelo Rio de Janeiro e cresce conforme novos parceiros entram.",
  },
];

const CORES_FICHAS = ["var(--ceu)", "var(--ceu-claro)", "var(--tom)"];

/** Dados estruturados do app para os buscadores (schema.org). */
const DADOS_ESTRUTURADOS = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: "PetLive",
  operatingSystem: "Android, iOS",
  applicationCategory: "HealthApplication",
  description:
    "Carteira de saúde do pet, lembretes de vacinas e remédios, SOS com a clínica 24 h mais perto e lugares pet por perto.",
  inLanguage: "pt-BR",
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  ...(URL_GOOGLE_PLAY || URL_APP_STORE
    ? { downloadUrl: [URL_GOOGLE_PLAY, URL_APP_STORE].filter(Boolean) }
    : {}),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON fixo do próprio site, sem dado de usuário.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DADOS_ESTRUTURADOS) }}
      />

      {/* Herói: a carteirinha sobre um cômodo à meia-luz. */}
      <section className="relative flex min-h-[calc(100svh-72px)] items-center overflow-hidden bg-[var(--tinta)] py-10">
        <div className="foto-respira absolute inset-0">
          <Image
            src="/fotos/cao-dormindo.jpg"
            alt="Cão dormindo num travesseiro, na sala à meia-luz"
            fill
            priority
            sizes="100vw"
            className="object-cover brightness-[0.62]"
          />
        </div>

        <div className="site-moldura relative">
          <div className="mx-auto flex min-h-[62svh] w-full max-w-[860px] flex-col justify-between gap-8 bg-[var(--papel)] p-6 md:p-8">
            <h1 className="t-titulo flex flex-wrap gap-x-[0.28em] md:items-baseline md:justify-between" style={{ fontSize: "clamp(36px, 4vw, 58px)" }}>
              <span>Carteira</span>
              <span>de saúde</span>
              <span>do seu pet</span>
            </h1>

            <div className="grid items-start gap-8 md:grid-cols-[1.1fr_1fr]">
              <div>
                <ul className="t-lead space-y-1 font-semibold">
                  <li>Vacinas, remédios e consultas</li>
                  <li>Aviso na hora de cada dose</li>
                  <li>Para cães e gatos</li>
                </ul>
                <p className="t-corpo mt-5 max-w-[34ch]">
                  O PetLive guarda a saúde do seu pet no celular e avisa você na hora de cada cuidado.
                </p>
              </div>

              {/* Os selos das vacinas, como numa carteirinha de papel. */}
              <div data-ui className="bg-[var(--tom)] p-4" aria-label="Exemplo de carteirinha: vacinas do Rex">
                <div className="flex items-center gap-3">
                  <Image src="/logo-petlive.png" alt="" width={32} height={32} />
                  <p className="text-[16px] font-bold">Rex · cão · 3 anos</p>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {SELOS.map((s) => (
                    <li key={s.vacina} className="border-[3px] border-dotted border-[var(--ceu)] bg-[var(--papel)] p-2.5">
                      <p className="text-[16px] font-bold">{s.vacina}</p>
                      <p className="t-pequeno tabular-nums text-[var(--apagado)]">{s.data}</p>
                    </li>
                  ))}
                  <li className="bg-[var(--ceu)] p-2.5">
                    <p className="text-[16px] font-bold">Próxima V10</p>
                    <p className="t-pequeno tabular-nums">30/11/26</p>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <p className="t-pequeno order-3 text-[var(--apagado)] md:order-1">Foto: Enrique, Pexels</p>
              <a href="#baixar" className="botao order-1 md:order-2">
                Baixar o app
              </a>
              <a href="#calendario" className="link-sublinhado order-2 text-[16px] font-semibold md:order-3">
                Ver o calendário de vacinas
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* A interação: o calendário de vacinas do pet do visitante. */}
      <section id="calendario" className="scroll-mt-4 bg-[var(--papel)]">
        <div className="site-moldura">
          <CalendarioVacinas />
        </div>
      </section>

      {/* Recursos como um cardápio impresso. */}
      <section id="recursos" className="scroll-mt-4 bg-[var(--tinta)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,600px)_1fr]">
          <figure data-revelar className="relative hidden aspect-[3/4] lg:mt-40 lg:block">
            <Image src="/fotos/consulta.jpg" alt="Lulu-da-pomerânia sendo examinado na clínica" fill sizes="25vw" className="object-cover" />
          </figure>

          <div className="recorte-ondas bg-[var(--papel)] px-6 py-16 md:px-12">
            <h2 data-revelar className="t-titulo text-center">O que vem no app</h2>
            <div className="mt-12 space-y-12">
              {CARDAPIO.map((g, gi) => (
                <div key={g.grupo} data-revelar style={{ ["--ordem" as string]: gi }}>
                  <h3 className="text-[22px] font-bold">{g.grupo}</h3>
                  <ul className="mt-5 space-y-5">
                    {g.itens.map((i) => (
                      <li key={i.nome}>
                        <div className="flex items-end gap-3 text-[17px] font-semibold">
                          <span>{i.nome}</span>
                          <span aria-hidden="true" className="pontilhado" />
                          <span className={`whitespace-nowrap ${i.valor === "Premium" ? "bg-[var(--ceu)] px-2" : ""}`}>{i.valor}</span>
                        </div>
                        <p className="t-pequeno mt-1 max-w-[40ch] text-[var(--apagado)]">{i.nota}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="t-pequeno mt-12 text-center text-[var(--apagado)]">
              Premium: assinatura em breve, pela loja do celular.
            </p>
          </div>

          <figure data-revelar className="relative hidden aspect-[3/4] lg:block">
            <Image src="/fotos/tutora.jpg" alt="Tutora sorrindo com o cão no colo, em casa" fill sizes="25vw" className="object-cover" />
          </figure>
        </div>
      </section>

      {/* Um dia com o PetLive: a foto presa e as etapas passando. */}
      <section className="bg-[var(--papel)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-16">
            <h2 data-revelar className="t-titulo max-w-[14ch]">Um dia com o PetLive</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead max-w-[38ch] self-end">
              Da dose da manhã à escova de dentes da noite: o app avisa, você marca e o histórico se escreve sozinho.
            </p>
          </div>
          <div className="mt-12 lg:mt-16">
            <HistoriaDia />
          </div>
        </div>
      </section>

      {/* Como começar, impresso como um canhoto. */}
      <section id="como-comecar" className="scroll-mt-4 bg-[var(--ceu)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 data-revelar className="t-titulo max-w-[12ch]">Como começar</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-6 max-w-[30ch]">
              Cinco minutos hoje e o PetLive cuida dos avisos a partir de amanhã.
            </p>
          </div>

          <div data-revelar style={{ ["--ordem" as string]: 2 }} className="recorte-zigue bg-[var(--papel)] p-6 md:p-9 lg:col-span-6 lg:col-start-7">
            {CANHOTO.map((bloco) => (
              <div key={bloco.quando} className="mt-7 first:mt-0">
                <h3 className="text-[17px] font-bold">{bloco.quando}</h3>
                <ul className="mt-3 space-y-3 text-[17px]">
                  {bloco.linhas.map((l) => (
                    <li key={l.o_que} className="flex items-end gap-3">
                      <span>{l.o_que}</span>
                      <span aria-hidden="true" className="pontilhado" />
                      <span className="whitespace-nowrap text-right font-semibold">{l.valor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mt-8 flex min-h-11 flex-wrap items-center justify-between gap-x-4 bg-[var(--tinta)] px-4 py-2 text-[17px] font-bold text-[var(--papel)]">
              <span>Saúde do pet em dia</span>
              <span>no seu celular</span>
            </p>
          </div>
        </div>
      </section>

      {/* Planos como ingressos. */}
      <section id="planos" className="scroll-mt-4 bg-[var(--tinta)] py-[clamp(72px,10vw,160px)] text-[var(--tinta)]">
        <div className="site-moldura">
          <div className="grid gap-6 text-[var(--papel)] lg:grid-cols-2 lg:gap-16">
            <h2 data-revelar className="t-titulo">Planos</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead max-w-[36ch] self-end">
              Comece de graça com um pet. O Premium chega pela loja de apps do celular.
            </p>
          </div>
          <div className="mx-auto mt-12 flex max-w-[1100px] flex-col gap-10">
            <Ingresso
              titulo="Grátis, para um pet"
              linhas={["Carteirinha e calendário de vacinas", "Remédios e lembretes", "Mapa e SOS", "QR básico da coleira"]}
              preco="R$ 0"
              acao={
                <a href="#baixar" className="botao w-full">
                  Baixar o app
                </a>
              }
            />
            <Ingresso
              titulo="Premium"
              linhas={["Mais pets na mesma conta", "Carteirinha em PDF", "Histórico completo de despesas", "Tudo do plano grátis"]}
              preco="Em breve"
              acao={<p className="t-pequeno text-center text-[var(--apagado)]">Valor no lançamento da assinatura</p>}
            />
          </div>
        </div>
      </section>

      {/* Perguntas como fichas de arquivo. */}
      <section id="perguntas" className="scroll-mt-4 bg-[var(--papel)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura">
          <div className="mx-auto max-w-[920px]">
            <h2 data-revelar className="t-titulo">Perguntas</h2>
            <div className="mt-10">
              {PERGUNTAS.map((p, i) => (
                <details
                  key={p.aba}
                  name="perguntas"
                  open={i === 0}
                  className="group"
                  style={{ ["--cor" as string]: CORES_FICHAS[i % CORES_FICHAS.length] }}
                >
                  <summary className="block cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span
                      className="t-pequeno flex h-10 w-[140px] items-center bg-[var(--cor)] px-4 font-bold md:w-[200px]"
                      style={{ marginLeft: `min(${i * 150}px, ${i * 12}vw)` }}
                    >
                      {p.aba}
                    </span>
                    <span className="flex min-h-[64px] items-center justify-between gap-4 bg-[var(--cor)] px-5 text-[17px] font-semibold md:px-7 md:text-[22px]">
                      {p.pergunta}
                      <span aria-hidden="true" className="text-[22px] font-medium transition-transform duration-300 group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <div className="bg-[var(--cor)] px-5 pb-7 md:px-7">
                    <p className="t-corpo max-w-[56ch]">{p.resposta}</p>
                  </div>
                </details>
              ))}
            </div>
            <p className="t-corpo mt-10">
              Ficou com dúvida?{" "}
              <Link href="mailto:suporte@petlive.app.br" className="link-sublinhado font-semibold">
                suporte@petlive.app.br
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Fechamento: a primeira tela do app, já aberta. */}
      <section id="baixar" className="scroll-mt-4 bg-[var(--ceu)]">
        <div className="site-moldura grid min-h-[90svh] items-end gap-12 py-16 lg:grid-cols-12 lg:items-center lg:py-20">
          <div className="self-end lg:col-span-6">
            <h2 data-revelar className="t-display max-w-[9ch]">Comece pelo seu pet</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-6 max-w-[34ch]">
              Baixe o app, cadastre o pet e o PetLive monta o calendário de vacinas na hora.
            </p>
          </div>
          <div data-revelar style={{ ["--ordem" as string]: 2 }} className="flex justify-center lg:col-span-5 lg:col-start-8">
            <NovoPet />
          </div>
        </div>
      </section>
    </>
  );
}
