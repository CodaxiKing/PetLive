import { FormularioContato } from "@/components/FormularioContato";

const BENEFICIOS = [
  {
    titulo: "Vitrine e solicitações",
    texto: "Mostre produtos com preço e estoque. O tutor solicita e você aceita pelo celular ou pelo computador.",
    fundo: "bg-roxo-fundo",
    cor: "text-[#4B3A73]",
    icone: ["M6 8h12l-1 12H7z", "M9 8V7a3 3 0 0 1 6 0v1"],
  },
  {
    titulo: "Agenda com horários livres",
    texto: "Você define dias, horários, vagas e folgas. O app mostra só o que está livre e evita encavalar reservas.",
    fundo: "bg-amarelo-fundo",
    cor: "text-amarelo-texto",
    icone: ["M4 6h16v14H4z", "M4 10h16M9 3v4M15 3v4"],
  },
  {
    titulo: "Recebimento por Pix",
    texto: "Quando você ativar, o tutor paga no app, a confirmação é automática e o repasse cai na sua chave Pix.",
    fundo: "bg-verde-fundo",
    cor: "text-verde-texto",
    icone: ["M3 6h18v13H3z", "M3 10h18M16 15h2"],
  },
];

const SERVICOS = [
  { nome: "Petshop", selo: "Produtos", texto: "Vitrine com preço e estoque, solicitação pelo app e retirada ou entrega pela loja.", fundo: "bg-amarelo-fundo", cor: "text-amarelo-texto" },
  { nome: "Clínica veterinária", selo: "Por horário e produtos", texto: "Consulta e vacinação por horário. Medicamentos com receita ficam listados, com venda só no local.", fundo: "bg-fundo border border-borda", cor: "text-cinza" },
  { nome: "Banho e tosa", selo: "Por horário", texto: "Duração, vagas por horário, profissionais e intervalo entre atendimentos.", fundo: "bg-roxo-fundo", cor: "text-roxo-texto" },
  { nome: "Passeador", selo: "Passeio", texto: "Passeios de 30 ou 60 min, raio de atuação e trajeto com fotos para o tutor.", fundo: "bg-verde-fundo", cor: "text-verde-texto" },
  { nome: "Creche pet", selo: "Por dia", texto: "Dia inteiro ou meio período, vagas por dia e pacotes mensais.", fundo: "bg-rosa-fundo", cor: "text-rosa-texto" },
  { nome: "Hotelzinho pet", selo: "Diárias", texto: "Preço por porte, check-in e check-out, extras e vacinas em dia.", fundo: "bg-azul-fundo", cor: "text-azul-texto" },
];

const PASSOS = [
  { titulo: "Crie a conta da loja", texto: "Dados, endereço e contato. Se a loja já está no mapa, assuma o perfil." },
  { titulo: "Escolha o que oferece", texto: "Produtos, serviços ou os dois. Configure preços, horários e vagas." },
  { titulo: "Publique e receba", texto: "Sua loja aparece no mapa e na vitrine. Aceite solicitações no celular ou no computador." },
];

const SOLICITACOES = [
  { quem: "Diego · Rex", oque: "Ração adulto 10 kg · retirar hoje", selo: "Pago via Pix", cor: "bg-verde-fundo text-verde-texto", destaque: true },
  { quem: "Ana · Mia", oque: "Banho e tosa · amanhã, 10:30", selo: "Aguardando", cor: "bg-amarelo-fundo text-amarelo-texto" },
  { quem: "Rafa · Thor", oque: "Hotelzinho · 22 a 25 de out.", selo: "Pagar na loja", cor: "bg-[#EEF1F5] text-tinta" },
];

function Icone({ caminhos }: { caminhos: string[] }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {caminhos.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function Check() {
  return <span aria-hidden="true">✓</span>;
}

/**
 * Para lojistas (protótipo SiteLojistas, board [WEB] "página para lojistas").
 * O marketplace abre na Fase 3: "Cadastrar minha loja" leva ao formulário
 * de interesse (BUSINESS.md 4.5).
 */
export default function PaginaLojistas() {
  return (
    <>
      {/* Herói escuro com o painel de solicitações */}
      <section className="relative overflow-hidden bg-tinta text-white">
        <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-6 pb-28 pt-14 md:px-12 lg:grid-cols-[1fr_1.05fr] lg:pt-20 xl:px-[120px]">
          <div>
            <span className="inline-block rounded-full bg-azul px-[18px] py-2 text-[13px] font-bold text-tinta">
              Para petshops, clínicas e prestadores
            </span>
            <h1 className="mt-6 text-5xl font-medium leading-[1.03] tracking-[-0.04em] md:text-[74px]">
              Venda e agende pelo PetLive
            </h1>
            <p className="mt-6 max-w-[540px] text-lg leading-relaxed text-[#B8C2D3] md:text-xl">
              Receba solicitações de produtos, reservas de banho e tosa, passeio, creche e hotelzinho, e acompanhe tudo num painel simples.
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <a
                href="#cadastro"
                className="flex h-16 items-center gap-[18px] rounded-full bg-azul pl-[30px] pr-2 font-bold text-tinta transition hover:-translate-y-0.5"
              >
                Cadastrar minha loja
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tinta">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </a>
              <a href="#como-comecar" className="flex h-16 items-center rounded-full border-[1.5px] border-[#3A3A3A] px-7 text-[15px] font-semibold transition hover:border-white">
                Ver como funciona
              </a>
            </div>
            <p className="mt-6 text-[13px] text-[#8A93A3]">Sem mensalidade na vitrine e na agenda.</p>
          </div>

          {/* Painel ilustrativo (o painel do lojista chega na Fase 3) */}
          <div aria-hidden="true" className="flex h-[440px] overflow-hidden rounded-[30px] bg-[#F5F6FA] text-tinta shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
            <div className="hidden w-[130px] flex-col gap-1.5 border-r border-[#2A2A2A] bg-tinta px-3 py-[18px] text-[11px] font-semibold text-[#C9D0DB] sm:flex">
              <div className="pb-2 text-[13px] font-extrabold text-white">PetLive</div>
              <div className="rounded-[10px] bg-azul px-2.5 py-2 font-bold text-tinta">Solicitações</div>
              <div className="px-2.5 py-2">Catálogo</div>
              <div className="px-2.5 py-2">Agenda</div>
              <div className="px-2.5 py-2">Recebimentos</div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-[18px]">
              <div className="text-xl font-medium tracking-tight">Solicitações</div>
              <div className="flex gap-1.5 text-[10px]">
                <span className="rounded-xl bg-tinta px-3 py-1.5 font-bold text-white">Novas · 3</span>
                <span className="rounded-xl bg-white px-3 py-1.5 font-semibold">Em andamento</span>
              </div>
              {SOLICITACOES.map((s) => (
                <div
                  key={s.quem}
                  className={`flex items-center justify-between rounded-2xl bg-white px-3 py-2.5 ${s.destaque ? "border-2 border-tinta" : ""}`}
                >
                  <div>
                    <div className="text-[11px] font-bold">{s.quem}</div>
                    <div className="text-[10px] text-cinza">{s.oque}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${s.cor}`}>{s.selo}</span>
                </div>
              ))}
              <div className="mt-auto flex gap-1.5 text-[10px]">
                <span className="flex-1 rounded-2xl bg-tinta p-2.5 text-center font-bold text-white">Aceitar e separar</span>
                <span className="rounded-2xl bg-white px-4 py-2.5 font-semibold">Recusar</span>
              </div>
            </div>
          </div>
        </div>
        <svg className="absolute bottom-[-1px] left-0 h-[60px] w-full" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 60V30C120 0 240 0 360 24S600 54 720 30 960 0 1080 24 1320 54 1440 30V60z" fill="#fff" />
        </svg>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="scroll-mt-6 px-6 py-16 text-center md:px-12 xl:px-[120px]">
        <p className="text-sm font-bold text-azul-escuro">Benefícios</p>
        <h2 className="mt-2.5 text-4xl font-medium tracking-tight md:text-[50px]">Tudo para vender e atender melhor</h2>
        <div className="mx-auto mt-11 grid max-w-[1200px] gap-5 text-left md:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className={`rounded-[36px] p-7 ${b.fundo}`}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                <Icone caminhos={b.icone} />
              </span>
              <h3 className="mt-5 text-[22px] font-extrabold">{b.titulo}</h3>
              <p className={`mt-2 text-[15px] leading-relaxed ${b.cor}`}>{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="scroll-mt-6 bg-suave px-6 py-16 md:px-12 xl:px-[120px]">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className="text-sm font-bold text-roxo-texto">Serviços</p>
          <h2 className="mt-2.5 text-4xl font-medium tracking-tight md:text-[50px]">Para clínicas, petshops e prestadores</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-cinza">
            Escolha o que a sua loja oferece: produtos, serviços ou os dois. Cada serviço tem a sua própria forma de reserva, configurada por você.
          </p>
          <div className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
            {SERVICOS.map((s) => (
              <div key={s.nome} className={`min-h-[220px] rounded-[30px] p-6 ${s.fundo}`}>
                <h3 className="text-xl font-extrabold">{s.nome}</h3>
                <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-bold">{s.selo}</span>
                <p className={`mt-3 text-[15px] leading-relaxed ${s.cor}`}>{s.texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col items-start gap-6 rounded-[40px] bg-amarelo-fundo p-8 text-left md:flex-row md:items-center md:px-14">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white">
              <Icone caminhos={["M6 11h12v9H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"]} />
            </span>
            <div>
              <h3 className="text-2xl font-medium tracking-tight md:text-[32px]">Produtos com receita aparecem só para consulta</h3>
              <p className="mt-2 leading-relaxed text-amarelo-texto">
                Para itens que exigem receita veterinária, o tutor vê preço e estoque, mas a compra é feita somente na loja. Você escolhe a mensagem que aparece.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Como começar */}
      <section id="como-comecar" className="scroll-mt-6 px-6 py-16 md:px-12 xl:px-[120px]">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className="text-sm font-bold text-azul-escuro">Como começar</p>
          <h2 className="mt-2.5 text-4xl font-medium tracking-tight md:text-[50px]">Sua loja no ar em três passos</h2>
          <ol className="mt-12 grid gap-8 text-left md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tinta text-lg font-extrabold text-white">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-extrabold">{p.titulo}</h3>
                  <p className="mt-1 leading-relaxed text-cinza">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="scroll-mt-6 bg-suave px-6 py-16 md:px-12 xl:px-[120px]">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className="text-sm font-bold text-azul-escuro">Planos para lojistas</p>
          <h2 className="mt-2.5 text-4xl font-medium tracking-tight md:text-[50px]">Só paga quando vende pelo app</h2>
          <div className="mt-10 grid gap-5 text-left md:grid-cols-2">
            <div className="rounded-[36px] border border-borda bg-white p-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-extrabold">Vitrine e agenda</h3>
                <span className="rounded-full bg-verde-fundo px-3 py-1 text-xs font-bold text-verde-texto">Grátis</span>
              </div>
              <ul className="mt-5 space-y-2 font-semibold">
                <li><Check /> Catálogo de produtos e serviços</li>
                <li><Check /> Solicitações e reservas</li>
                <li><Check /> Painel no celular e no computador</li>
                <li><Check /> Pagamento direto na loja</li>
              </ul>
            </div>
            <div className="rounded-[36px] bg-tinta p-8 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-extrabold">Pix pelo app</h3>
                <span className="rounded-full bg-azul px-3 py-1 text-xs font-bold text-tinta">Comissão por venda</span>
              </div>
              <ul className="mt-5 space-y-2 font-semibold">
                <li><Check /> Tudo da vitrine e agenda</li>
                <li><Check /> Pagamento por Pix dentro do app</li>
                <li><Check /> Confirmação automática e extrato</li>
                <li><Check /> Repasse na sua chave Pix</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Cadastro: interesse até o marketplace abrir */}
      <section id="cadastro" className="scroll-mt-6 px-6 py-16 md:px-12 xl:px-[120px]">
        <div className="mx-auto grid max-w-[1200px] gap-10 rounded-[44px] bg-tinta p-8 text-white md:p-14 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-4xl font-medium leading-tight tracking-tight md:text-[44px]">Coloque a sua loja no PetLive</h2>
            <p className="mt-4 leading-relaxed text-[#B8C2D3]">
              O cadastro de lojas abre em breve. Deixe o seu contato e avisamos você primeiro, com ajuda para montar a vitrine e a agenda.
            </p>
          </div>
          <FormularioContato tipo="lojista" escuro />
        </div>
      </section>
    </>
  );
}
