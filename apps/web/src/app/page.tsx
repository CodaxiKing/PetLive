import Link from "next/link";

const RECURSOS = [
  {
    fundo: "bg-roxo-fundo",
    texto: "text-roxo-texto",
    titulo: "Carteira de saúde",
    descricao:
      "Vacinas, vermífugo, peso e consultas num só histórico. Exporte em PDF para o veterinário.",
    icone: (
      <path d="M14 4l6 6-9 9-6-6z M5 13l6 6" />
    ),
  },
  {
    fundo: "bg-amarelo-fundo",
    texto: "text-amarelo-texto",
    titulo: "Lembretes que avisam",
    descricao:
      "Vacina, remédio a cada dose, banho e tosa. Você confirma e o PetLive cuida do resto.",
    icone: <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z M10 21h4" />,
  },
  {
    fundo: "bg-verde-fundo",
    texto: "text-verde-texto",
    titulo: "Mapa pet",
    descricao:
      "Clínicas, petshops, banho e tosa e veterinários 24h por perto, com rota e contato.",
    icone: (
      <>
        <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" />
        <circle cx="12" cy="11" r="2" />
      </>
    ),
  },
  {
    fundo: "bg-azul-fundo",
    texto: "text-azul-texto",
    titulo: "Loja e serviços",
    descricao:
      "Solicite produtos e reserve banho e tosa, passeio, creche e hotelzinho pelo app.",
    icone: <path d="M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2" />,
  },
];

const PASSOS = [
  {
    titulo: "Cadastre seu pet",
    descricao:
      "Nome, espécie, raça e nascimento. O app já sugere o calendário de vacinas.",
  },
  {
    titulo: "Receba os lembretes",
    descricao:
      "Vacinas, remédios e consultas chegam no horário certo, sem planilha.",
  },
  {
    titulo: "Encontre e reserve",
    descricao:
      "Quando a vacina vence, veja clínicas por perto e reserve um horário.",
  },
];

const SERVICOS = [
  { rotulo: "Banho e tosa", classe: "bg-roxo-fundo" },
  { rotulo: "Passeador", classe: "bg-verde-fundo" },
  { rotulo: "Creche pet", classe: "bg-rosa-fundo" },
  { rotulo: "Hotelzinho pet", classe: "bg-azul-fundo" },
  { rotulo: "Clínicas veterinárias", classe: "bg-amarelo-fundo" },
  { rotulo: "Petshops", classe: "bg-fundo" },
];

const PERGUNTAS = [
  {
    pergunta: "O PetLive substitui o veterinário?",
    resposta:
      "Não. O PetLive organiza informações de saúde, lembretes e agendamentos; decisões clínicas e emergências devem sempre passar por um veterinário habilitado.",
  },
  {
    pergunta: "Meus dados e os do meu pet estão protegidos?",
    resposta:
      "Sim. Seguimos a LGPD, com acesso controlado por conta, tráfego criptografado e registro do seu consentimento no cadastro. Veja a Política de Privacidade e a página de Direitos na LGPD.",
  },
  {
    pergunta: "Posso comprar remédios pelo app?",
    resposta:
      "Você pode solicitar produtos ao petshop mais próximo e retirar no local. A venda de medicamentos veterinários segue as regras de cada estabelecimento.",
  },
  {
    pergunta: "Quais cidades o PetLive atende?",
    resposta:
      "O app já funciona em todo o Brasil para carteira de saúde e lembretes. A rede de clínicas, petshops e serviços começa pelo Rio de Janeiro e cresce conforme novos parceiros entram.",
  },
];

export default function Home() {
  return (
    <>
      {/* Herói */}
      <section id="download" className="relative overflow-hidden bg-azul-hero">
        <svg
          className="absolute right-6 top-8 hidden opacity-40 md:block"
          width="260"
          height="260"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="0.5"
          aria-hidden="true"
        >
          <circle cx="6" cy="10" r="1.8" />
          <circle cx="10" cy="6" r="1.8" />
          <circle cx="14" cy="6" r="1.8" />
          <circle cx="18" cy="10" r="1.8" />
          <path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
        </svg>

        <div className="mx-auto max-w-[1440px] px-6 pb-28 pt-14 md:px-12 md:pb-36 md:pt-20 xl:px-[120px]">
          <span className="inline-block rounded-full bg-fundo px-4 py-2 text-[13px] font-bold">
            Grátis para começar
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl font-medium leading-[1.06] tracking-tight md:text-[66px]">
            A saúde do seu pet, sempre em dia
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-azul-texto md:text-xl">
            Carteira de vacinação, lembretes de remédios, clínicas por perto e
            serviços com horário marcado. Tudo no PetLive.
          </p>
          <div className="mt-9 flex flex-wrap gap-3.5">
            <span className="flex h-16 cursor-default items-center gap-3 rounded-full bg-tinta pl-3.5 pr-6.5 text-[15px] font-bold text-white">
              <span className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-azul">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" aria-hidden="true">
                  <path d="M7 3l12 9-12 9z" />
                </svg>
              </span>
              Baixar no Google Play
            </span>
            <span className="flex h-16 cursor-default items-center gap-3 rounded-full bg-fundo px-6 text-[15px] font-bold">
              <span className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-tinta">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#9AD6F8" aria-hidden="true">
                  <path d="M7 3l12 9-12 9z" />
                </svg>
              </span>
              Baixar na App Store
            </span>
          </div>
          <p className="mt-5.5 text-[13px] font-medium text-azul-escuro">
            Feito para tutores de cães e gatos no Rio de Janeiro.
          </p>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="px-6 py-16 md:px-12 md:py-24 xl:px-[120px]">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-center text-sm font-bold text-azul-escuro">Recursos</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center text-4xl font-medium tracking-tight md:text-[54px]">
            Tudo do seu pet em um só lugar
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {RECURSOS.map((recurso) => (
              <article
                key={recurso.titulo}
                className={`${recurso.fundo} flex h-full flex-col rounded-[36px] p-7`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fundo">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#111"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {recurso.icone}
                  </svg>
                </span>
                <h3 className="mt-6 text-[22px] font-extrabold">{recurso.titulo}</h3>
                <p className={`mt-2 text-[15px] leading-relaxed ${recurso.texto}`}>
                  {recurso.descricao}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="bg-[#F6F1FD] px-6 py-16 md:px-12 md:py-24 xl:px-[120px]">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-center text-sm font-bold text-roxo-texto">Como funciona</p>
          <h2 className="mt-3 text-center text-4xl font-medium tracking-tight md:text-[46px]">
            Pronto em três passos
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {PASSOS.map((passo, i) => (
              <div key={passo.titulo} className="flex gap-4">
                <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-tinta text-xl font-extrabold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-extrabold">{passo.titulo}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-roxo-texto">
                    {passo.descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section className="bg-tinta px-6 py-16 text-white md:px-12 md:py-24 xl:px-[120px]">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold text-azul">
              Clínicas, petshops e serviços com horário marcado
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-medium leading-[1.06] tracking-tight md:text-[46px]">
              Clínicas, petshops, banho e tosa, passeio, creche e hotelzinho
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#B8C2D3]">
              Marque consulta e vacina na clínica, peça produtos no petshop e
              reserve serviços. Cada loja define dias, horários e vagas, e você
              só vê horários livres.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {SERVICOS.map((servico) => (
                <span
                  key={servico.rotulo}
                  className={`${servico.classe} flex h-10 items-center rounded-full px-5 text-sm font-bold text-tinta`}
                >
                  {servico.rotulo}
                </span>
              ))}
            </div>
          </div>

          {/* Miniatura do app de agendamento */}
          <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[44px] border-[9px] border-[#2A2A2A] bg-fundo text-tinta">
            <div className="h-24 bg-azul-hero px-4 pt-7 text-xl font-medium tracking-tight">
              Agendar horário
            </div>
            <div className="flex flex-col gap-2 p-3.5">
              <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-bold">
                <span className="rounded-xl bg-tinta py-1.5 text-white">Seg 19</span>
                <span className="rounded-xl bg-suave py-1.5">Ter 20</span>
                <span className="rounded-xl bg-suave py-1.5">Qua 21</span>
                <span className="rounded-xl bg-suave py-1.5">Qui 22</span>
                <span className="rounded-xl bg-suave py-1.5">Sex 23</span>
              </div>
              <p className="mt-1 text-[11px] font-bold">Horários disponíveis</p>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold">
                <span className="rounded-2xl border-[1.5px] border-borda py-2">09:00</span>
                <span className="rounded-2xl bg-suave py-2 text-[#A0A8B5] line-through">10:30</span>
                <span className="rounded-2xl border-[1.5px] border-borda py-2">13:00</span>
                <span className="rounded-2xl bg-tinta py-2 text-white">14:30</span>
                <span className="rounded-2xl border-[1.5px] border-borda py-2">16:00</span>
                <span className="rounded-2xl bg-suave py-2 text-[#A0A8B5] line-through">17:30</span>
              </div>
              <p className="rounded-2xl bg-roxo-fundo p-2.5 text-[11px] font-bold">
                Banho e tosa · Rex
                <br />
                <span className="font-medium text-roxo-texto">Seg, 19 · 14:30</span>
              </p>
              <span className="flex h-10 items-center justify-center rounded-full bg-tinta text-xs font-bold text-white">
                Reservar horário
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Para lojistas */}
      <section id="lojistas" className="px-6 py-14 md:px-12 xl:px-[120px]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 rounded-[44px] bg-roxo-fundo px-8 py-12 md:px-14 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-bold text-roxo-texto">Para lojas e clínicas</p>
            <h2 className="mt-2 text-3xl font-medium leading-tight tracking-tight md:text-[38px]">
              Tem uma loja ou clínica?
              <br />
              Venda e agende pelo PetLive.
            </h2>
          </div>
          <a
            href="mailto:parceiros@petlive.app.br"
            className="flex h-16 shrink-0 items-center gap-4 rounded-full bg-tinta py-2 pl-7 pr-2 text-base font-semibold text-white transition hover:-translate-y-0.5"
          >
            Conhecer para lojistas
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-azul">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </a>
        </div>
      </section>

      {/* Planos */}
      <section className="px-6 py-16 md:px-12 md:py-24 xl:px-[120px]">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-center text-sm font-bold text-azul-escuro">Planos</p>
          <h2 className="mt-3 text-center text-4xl font-medium tracking-tight md:text-[46px]">
            Comece grátis, evolua quando quiser
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="rounded-[40px] bg-suave p-8">
              <h3 className="text-2xl font-extrabold">Grátis</h3>
              <p className="mt-1 text-[15px] text-cinza">Para cuidar de um pet</p>
              <ul className="mt-6 space-y-3 text-[15px] font-semibold">
                <li>✓ 1 pet e lembretes básicos</li>
                <li>✓ Vacinas, vermífugo e peso</li>
                <li>✓ Mapa pet e lojas por perto</li>
                <li>✓ Solicitações e reservas</li>
              </ul>
            </div>
            <div className="rounded-[40px] bg-tinta p-8 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-extrabold">Premium</h3>
                <span className="rounded-full bg-azul px-3 py-1.5 text-xs font-bold text-tinta">
                  Mais completo
                </span>
              </div>
              <p className="mt-1 text-[15px] text-[#B8C2D3]">Valor a combinar no lançamento</p>
              <ul className="mt-6 space-y-3 text-[15px] font-semibold">
                <li>✓ Vários pets na mesma conta</li>
                <li>✓ Carteira em PDF para o veterinário</li>
                <li>✓ Anexos e acesso para a família</li>
                <li>✓ QR Code da coleira</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Perguntas */}
      <section id="perguntas" className="bg-suave px-6 py-16 md:px-12 md:py-24 xl:px-[120px]">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-4xl font-medium tracking-tight md:text-[44px]">
            Perguntas frequentes
          </h2>
          <div className="mt-10 flex flex-col gap-3">
            {PERGUNTAS.map((item) => (
              <details
                key={item.pergunta}
                className="group rounded-3xl bg-fundo px-6 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-bold">
                  {item.pergunta}
                  <span
                    aria-hidden="true"
                    className="text-2xl font-medium transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-cinza">{item.resposta}</p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-cinza">
            Ficou com dúvida? Escreva para{" "}
            <Link href="mailto:suporte@petlive.app.br" className="font-semibold text-tinta underline">
              suporte@petlive.app.br
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
