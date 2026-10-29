import Image from "next/image";
import { Foto } from "@/components/site/Foto";
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
    grupo: "Lojas e serviços",
    itens: [
      { nome: "Pedido ao petshop", valor: "retirada ou entrega", nota: "Monte o pedido na vitrine e acompanhe até chegar." },
      { nome: "Banho e tosa", valor: "por horário", nota: "Só os horários livres, com remarcação pelo app." },
      { nome: "Creche, hotel e passeio", valor: "reserva", nota: "E o passeio do passeador acompanhado ao vivo." },
      { nome: "Conversa com a loja", valor: "por pedido", nota: "Tire dúvidas sem sair do app; o pagamento é na loja." },
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
      { o_que: "Banho e tosa no horário livre", valor: "reserva" },
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
    aba: "Pagamento",
    pergunta: "Dá para pagar pelo app?",
    resposta:
      "Ainda não. Nos pedidos e reservas, o pagamento é feito na loja, na retirada, na entrega ou no atendimento. A loja confirma pelo app antes.",
  },
  {
    aba: "Cidades",
    pergunta: "Quais cidades o PetLive atende?",
    resposta:
      "A carteira de saúde e os lembretes funcionam em todo o Brasil. As lojas e os serviços com pedido e reserva começam pelo Rio de Janeiro e crescem conforme novas lojas entram.",
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
    "Carteira de saúde do pet, lembretes de vacinas e remédios, SOS com a clínica 24 h mais perto, pedidos ao petshop e reservas de banho e tosa, creche, hotelzinho e passeio.",
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

      {/* Herói: o título grande no azul da marca e o pet dormindo, com a carteirinha dele. */}
      <section className="bg-[var(--ceu)] pb-[clamp(40px,6vw,96px)] pt-[clamp(28px,4vw,64px)]">
        <div className="site-moldura">
          <h1 className="t-display text-balance" style={{ fontSize: "clamp(40px, 6.4vw, 104px)" }}>
            Carteira de saúde do seu pet
          </h1>

          <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-8 lg:col-span-4">
              <p className="t-lead max-w-[30ch]">
                Vacinas, remédios e consultas no celular, com aviso na hora de cada dose. E o petshop, o banho e tosa e o
                passeio a um toque.
              </p>

              <ul className="flex flex-wrap gap-2 text-[15px] font-semibold" aria-label="O que tem no app">
                {["Carteirinha de vacinas", "Remédio dose a dose", "SOS 24 h", "Banho e tosa", "Passeio ao vivo"].map((c) => (
                  <li key={c} className="rounded-full bg-[var(--papel)] px-4 py-2">
                    {c}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <a href="#baixar" className="botao">
                  Baixar o app
                </a>
                <a href="#calendario" className="link-sublinhado text-[16px] font-semibold">
                  Ver o calendário de vacinas
                </a>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="relative">
                <figure className="relative aspect-[4/3] overflow-hidden rounded-[var(--raio-g)] bg-[var(--tinta)] sm:aspect-[16/10] lg:aspect-[16/9]">
                  <div className="foto-respira absolute inset-0">
                    <Image
                      src="/fotos/tutora.jpg"
                      alt="Tutora sorrindo com o cão no colo, em casa"
                      fill
                      priority
                      sizes="(min-width: 1024px) 66vw, 100vw"
                      className="object-cover object-[30%_40%]"
                    />
                  </div>
                </figure>

                {/* A carteirinha do pet da foto, presa no canto como um cartão. */}
                <div
                  data-ui
                  aria-label="Exemplo de carteirinha: vacinas do Rex"
                  className="relative mx-3 -mt-16 rounded-[var(--raio)] bg-[var(--papel)] p-4 sm:absolute sm:bottom-5 sm:right-5 sm:m-0 sm:w-[360px]"
                >
                  <div className="flex items-center gap-3">
                    <Image src="/logo-petlive.png" alt="" width={32} height={32} />
                    <p className="text-[16px] font-bold">Rex · cão · 3 anos</p>
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-2">
                    {SELOS.map((s) => (
                      <li key={s.vacina} className="rounded-[var(--raio-p)] border-[3px] border-dotted border-[var(--ceu)] p-2.5">
                        <p className="text-[16px] font-bold">{s.vacina}</p>
                        <p className="t-pequeno tabular-nums text-[var(--apagado)]">{s.data}</p>
                      </li>
                    ))}
                    <li className="rounded-[var(--raio-p)] bg-[var(--ceu)] p-2.5">
                      <p className="text-[16px] font-bold">Próxima V10</p>
                      <p className="t-pequeno tabular-nums">30/11/26</p>
                    </li>
                  </ul>
                </div>

                {/* O aviso do remédio chegando, no outro canto. */}
                <div
                  data-ui
                  aria-hidden="true"
                  className="absolute right-5 top-5 hidden w-[320px] items-center gap-3 rounded-[var(--raio)] bg-[var(--papel)] p-3 md:flex"
                >
                  <Image src="/logo-petlive.png" alt="" width={36} height={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">Hora do remédio do Rex</p>
                    <p className="t-pequeno text-[var(--apagado)]">Vermífugo · 1 comprimido</p>
                  </div>
                  <span className="rounded-full bg-[var(--tinta)] px-3 py-1.5 text-[14px] font-bold text-[var(--papel)]">Feito</span>
                </div>
              </div>
              <p className="t-pequeno mt-3 text-right text-[var(--apagado)]">Foto: Samson Katt, Pexels</p>
            </div>
          </div>
        </div>
      </section>

      {/* A interação: o calendário de vacinas do pet do visitante. */}
      <section id="calendario" className="secao scroll-mt-4 bg-[var(--papel)]">
        <div className="site-moldura">
          <CalendarioVacinas />
        </div>
      </section>

      {/* Recursos como um cardápio impresso. */}
      <section id="recursos" className="secao scroll-mt-4 bg-[var(--tinta)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,600px)_1fr]">
          <figure data-revelar className="relative overflow-hidden rounded-[var(--raio-g)] hidden aspect-[3/4] lg:mt-40 lg:block">
            <Foto src="/fotos/consulta.jpg" alt="Lulu-da-pomerânia sendo examinado na clínica" fill desliza sizes="25vw" className="object-cover" />
          </figure>

          <div className="recorte-ondas rounded-[var(--raio-g)] bg-[var(--papel)] px-6 py-16 md:px-12">
            <h2 data-revelar className="t-titulo text-center">O que vem no app</h2>
            <div className="mt-12 space-y-12">
              {CARDAPIO.map((g, gi) => (
                <div key={g.grupo} data-revelar style={{ ["--ordem" as string]: gi }}>
                  <h3 className="text-[22px] font-bold">{g.grupo}</h3>
                  <ul className="mt-5 space-y-5">
                    {g.itens.map((i) => (
                      <li key={i.nome}>
                        <div className="flex items-end justify-between gap-3 text-[17px] font-semibold">
                          <span>{i.nome}</span>
                          <span aria-hidden="true" className="pontilhado" />
                          <span className={`whitespace-nowrap text-right ${i.valor === "Premium" ? "rounded-full bg-[var(--ceu)] px-2.5" : ""}`}>{i.valor}</span>
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

          <figure data-revelar className="relative overflow-hidden rounded-[var(--raio-g)] hidden aspect-[3/4] lg:block">
            <Foto src="/fotos/cao-dormindo.jpg" alt="Cão dormindo num travesseiro, na sala à meia-luz" fill desliza sizes="25vw" className="object-cover" />
          </figure>
        </div>
      </section>

      {/* Um dia com o PetLive: a foto presa e as etapas passando. */}
      <section className="secao bg-[var(--papel)] py-[clamp(72px,10vw,160px)]">
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
      <section id="como-comecar" className="secao scroll-mt-4 bg-[var(--ceu)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 data-revelar className="t-titulo max-w-[12ch]">Como começar</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-6 max-w-[30ch]">
              Cinco minutos hoje e o PetLive cuida dos avisos a partir de amanhã.
            </p>
          </div>

          <div data-revelar style={{ ["--ordem" as string]: 2 }} className="recorte-zigue rounded-t-[var(--raio-g)] bg-[var(--papel)] p-6 md:p-9 lg:col-span-6 lg:col-start-7">
            {CANHOTO.map((bloco) => (
              <div key={bloco.quando} className="mt-7 first:mt-0">
                <h3 className="text-[17px] font-bold">{bloco.quando}</h3>
                <ul className="mt-3 space-y-3 text-[17px]">
                  {bloco.linhas.map((l) => (
                    <li key={l.o_que} className="flex items-end justify-between gap-3">
                      <span>{l.o_que}</span>
                      <span aria-hidden="true" className="pontilhado" />
                      <span className="whitespace-nowrap text-right font-semibold">{l.valor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mt-8 flex min-h-11 flex-wrap items-center justify-between gap-x-4 rounded-[var(--raio-p)] bg-[var(--tinta)] px-4 py-2 text-[17px] font-bold text-[var(--papel)]">
              <span>Saúde do pet em dia</span>
              <span>no seu celular</span>
            </p>
          </div>
        </div>
      </section>

      {/* Planos como ingressos. */}
      <section id="planos" className="secao scroll-mt-4 bg-[var(--tinta)] py-[clamp(72px,10vw,160px)] text-[var(--tinta)]">
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
              linhas={["Carteirinha e calendário de vacinas", "Remédios e lembretes", "Mapa, SOS e QR da coleira", "Pedidos e reservas nas lojas"]}
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
      <section id="perguntas" className="secao scroll-mt-4 bg-[var(--papel)] py-[clamp(72px,10vw,160px)]">
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
                  <summary className="block cursor-pointer list-none [--aba:132px] md:[--aba:200px] [&::-webkit-details-marker]:hidden">
                    {/* As abas andam da esquerda à direita sem passar da borda. */}
                    <span
                      className="t-pequeno flex h-10 w-[var(--aba)] items-center rounded-t-[var(--raio-p)] bg-[var(--cor)] px-4 font-bold"
                      style={{ marginLeft: `calc(${i / (PERGUNTAS.length - 1)} * (100% - var(--aba)))` }}
                    >
                      {p.aba}
                    </span>
                    {/* Sem canto redondo onde a aba encosta na ficha (a primeira à esquerda, a última à direita). */}
                    <span
                      className={`flex min-h-[64px] items-center justify-between gap-4 rounded-[var(--raio-p)] bg-[var(--cor)] px-5 text-[17px] font-semibold group-open:rounded-b-none md:px-7 md:text-[22px] ${i === 0 ? "rounded-tl-none" : ""} ${i === PERGUNTAS.length - 1 ? "rounded-tr-none" : ""}`}
                    >
                      {p.pergunta}
                      <span aria-hidden="true" className="text-[22px] font-medium transition-transform duration-300 group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <div className="rounded-b-[var(--raio-p)] bg-[var(--cor)] px-5 pb-7 md:px-7">
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
      <section id="baixar" className="secao scroll-mt-4 bg-[var(--ceu)] py-[clamp(72px,9vw,144px)]">
        <div className="site-moldura grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col lg:col-span-5">
            <h2 data-revelar className="t-display max-w-[9ch]">Comece pelo seu pet</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-6 max-w-[34ch]">
              Baixe o app, cadastre o pet e o PetLive monta o calendário de vacinas na hora.
            </p>
            <ul data-revelar style={{ ["--ordem" as string]: 2 }} className="mt-10 space-y-3 text-[17px] font-semibold lg:mt-auto">
              {["Grátis para um pet", "Aviso de vacina e remédio no celular", "A família acompanha junto"].map((l) => (
                <li key={l} className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tinta)] text-[var(--papel)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          </div>

          {/* A foto grande e, por cima, a primeira tela do app para o visitante preencher. */}
          <div data-revelar style={{ ["--ordem" as string]: 2 }} className="relative lg:col-span-7">
            <figure className="relative aspect-[4/5] overflow-hidden rounded-[var(--raio-g)] sm:aspect-[4/3] lg:ml-auto lg:aspect-[4/5] lg:w-[72%]">
              <Foto
                src="/fotos/tutora-celular.jpg"
                alt="Tutora sorrindo para o celular com o cão branco no colo, num gramado"
                fill
                desliza
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="object-cover object-[50%_35%]"
              />
            </figure>
            <div className="relative mx-3 -mt-28 sm:mx-auto sm:max-w-[440px] lg:absolute lg:bottom-10 lg:left-0 lg:mx-0 lg:mt-0 lg:w-[420px]">
              <NovoPet />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
