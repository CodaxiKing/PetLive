import Image from "next/image";
import { FormularioContato } from "@/components/FormularioContato";
import { Ingresso } from "@/components/site/Ingresso";

/*
 * Para lojistas (protótipo SiteLojistas). O marketplace abre na Fase 3:
 * "Cadastrar loja" leva ao formulário de interesse (BUSINESS.md 4.5).
 * Mesmo sistema do site para tutores: papel, tinta e o azul da marca,
 * com cardápio, canhoto e ingressos.
 */

const BENEFICIOS = [
  { nome: "Vitrine e solicitações", valor: "celular e computador", nota: "Mostre produtos com preço e estoque. O tutor solicita e você aceita." },
  { nome: "Agenda com horários livres", valor: "sem encavalar", nota: "Você define dias, horários, vagas e folgas. O app mostra só o que está livre." },
  { nome: "Recebimento por Pix", valor: "quando ativar", nota: "O tutor paga no app, a confirmação é automática e o repasse cai na sua chave." },
];

const SERVICOS = [
  { nome: "Petshop", selo: "produtos", texto: "Vitrine com preço e estoque, solicitação pelo app e retirada ou entrega pela loja." },
  { nome: "Clínica veterinária", selo: "por horário", texto: "Consulta e vacinação por horário. Remédios com receita ficam listados, com venda só no local." },
  { nome: "Banho e tosa", selo: "por horário", texto: "Duração, vagas por horário, profissionais e intervalo entre atendimentos." },
  { nome: "Passeador", selo: "por passeio", texto: "Passeios de 30 ou 60 min, raio de atuação e trajeto com fotos para o tutor." },
  { nome: "Creche pet", selo: "por dia", texto: "Dia inteiro ou meio período, vagas por dia e pacotes mensais." },
  { nome: "Hotelzinho pet", selo: "diárias", texto: "Preço por porte, entrada e saída, extras e vacinas em dia." },
];

const PASSOS = [
  { o_que: "Crie a conta da loja", valor: "dados e endereço" },
  { o_que: "Escolha o que oferece", valor: "produtos e serviços" },
  { o_que: "Configure preços e horários", valor: "vagas e folgas" },
  { o_que: "Publique e receba", valor: "mapa e vitrine" },
];

const SOLICITACOES = [
  { quem: "Diego · Rex", oque: "Ração adulto 10 kg · retirar hoje", selo: "Pago via Pix", destaque: true },
  { quem: "Ana · Mia", oque: "Banho e tosa · amanhã, 10:30", selo: "Aguardando" },
  { quem: "Rafa · Thor", oque: "Hotelzinho · 22 a 25 de out.", selo: "Pagar na loja" },
];

export default function PaginaLojistas() {
  return (
    <>
      {/* Herói escuro com o painel de solicitações. */}
      <section className="bg-[var(--tinta)] text-[var(--papel)]">
        <div className="site-moldura grid min-h-[calc(100svh-72px)] items-center gap-12 py-16 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h1 data-revelar className="t-display max-w-[12ch]" style={{ fontSize: "clamp(44px, 5.4vw, 84px)" }}>
              Venda e agende pelo PetLive
            </h1>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-8 max-w-[40ch]">
              Solicitações de produtos e reservas de banho e tosa, passeio, creche e hotelzinho num painel simples. O cadastro
              de lojas abre em breve: deixe o contato e avisamos primeiro.
            </p>
            <div data-revelar style={{ ["--ordem" as string]: 2 }} className="mt-10 flex flex-wrap items-center gap-6">
              <a href="#cadastro" className="botao bg-[var(--ceu)] text-[var(--tinta)] hover:bg-[var(--ceu-claro)]">
                Cadastrar minha loja
              </a>
              <a href="#como-comecar" className="link-sublinhado text-[17px] font-semibold">
                Ver como funciona
              </a>
            </div>
            <p className="t-pequeno mt-6 text-[#C9D0DB]">Sem mensalidade na vitrine e na agenda.</p>
          </div>

          {/* O painel do lojista (ilustrativo: chega com o marketplace). */}
          <div data-revelar style={{ ["--ordem" as string]: 2 }} className="lg:col-span-6">
            <div data-ui aria-label="Exemplo do painel de solicitações" className="flex min-h-[420px] bg-[var(--tom)] text-[var(--tinta)]">
              <div className="hidden w-[150px] flex-col gap-1 bg-[#1E1E1E] p-4 text-[14px] font-semibold text-[#C9D0DB] sm:flex">
                <p className="pb-3 text-[16px] font-extrabold text-[var(--papel)]">PetLive</p>
                <p className="bg-[var(--ceu)] px-3 py-2 text-[var(--tinta)]">Solicitações</p>
                <p className="px-3 py-2">Catálogo</p>
                <p className="px-3 py-2">Agenda</p>
                <p className="px-3 py-2">Recebimentos</p>
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-5">
                <p className="text-[22px] font-bold">Solicitações</p>
                <div className="flex gap-2 text-[14px]">
                  <span className="bg-[var(--tinta)] px-3 py-1.5 font-bold text-[var(--papel)]">Novas · 3</span>
                  <span className="bg-[var(--papel)] px-3 py-1.5 font-semibold">Em andamento</span>
                </div>
                {SOLICITACOES.map((s) => (
                  <div
                    key={s.quem}
                    className={`flex items-center justify-between gap-3 bg-[var(--papel)] px-4 py-3 ${s.destaque ? "outline-2 -outline-offset-2 outline-[var(--tinta)]" : ""}`}
                  >
                    <div>
                      <p className="text-[16px] font-bold">{s.quem}</p>
                      <p className="t-pequeno text-[var(--apagado)]">{s.oque}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 text-[14px] font-semibold ${s.destaque ? "bg-[var(--ceu)]" : "bg-[var(--tom)]"}`}>{s.selo}</span>
                  </div>
                ))}
                <div className="mt-auto flex gap-2 text-[16px] font-bold">
                  <span className="flex-1 bg-[var(--tinta)] p-3 text-center text-[var(--papel)]">Aceitar e separar</span>
                  <span className="bg-[var(--papel)] px-5 py-3">Recusar</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios como cardápio. */}
      <section id="beneficios" className="scroll-mt-4 bg-[var(--ceu)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,600px)_1fr]">
          <figure data-revelar className="relative hidden aspect-[3/4] lg:mt-24 lg:block">
            <Image src="/fotos/consulta.jpg" alt="Veterinário examinando um lulu-da-pomerânia" fill sizes="25vw" className="object-cover" />
          </figure>

          <div className="recorte-ondas bg-[var(--papel)] px-6 py-16 md:px-12">
            <h2 data-revelar className="t-titulo text-center">Para vender e atender</h2>
            <ul className="mt-12 space-y-7">
              {BENEFICIOS.map((b, i) => (
                <li key={b.nome} data-revelar style={{ ["--ordem" as string]: i }}>
                  <div className="flex items-end gap-3 text-[17px] font-semibold">
                    <span>{b.nome}</span>
                    <span aria-hidden="true" className="pontilhado" />
                    <span className="whitespace-nowrap">{b.valor}</span>
                  </div>
                  <p className="t-pequeno mt-1 max-w-[42ch] text-[var(--apagado)]">{b.nota}</p>
                </li>
              ))}
            </ul>
          </div>

          <div data-revelar className="bg-[var(--tinta)] p-6 text-[var(--papel)] lg:mt-48">
            <h3 className="text-[22px] font-bold leading-tight">Remédio com receita fica só para consulta</h3>
            <p className="t-corpo mt-4">
              O tutor vê preço e estoque, mas a compra é feita somente na loja. Você escolhe a mensagem que aparece.
            </p>
          </div>
        </div>
      </section>

      {/* Serviços como lista com pontilhado. */}
      <section id="servicos" className="scroll-mt-4 bg-[var(--papel)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 data-revelar className="t-titulo max-w-[12ch]">Cada serviço do seu jeito</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-6 max-w-[30ch]">
              Produtos, serviços ou os dois. Cada um com a própria forma de reserva, configurada por você.
            </p>
            <figure data-revelar style={{ ["--ordem" as string]: 2 }} className="relative mt-10 aspect-[4/3]">
              <Image src="/fotos/passeio.jpg" alt="Dois cães de coleira parados numa calçada" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
            </figure>
          </div>
          <ul className="grid gap-x-12 gap-y-9 md:grid-cols-2 lg:col-span-8">
            {SERVICOS.map((s, i) => (
              <li key={s.nome} data-revelar style={{ ["--ordem" as string]: i % 2 }}>
                <div className="flex items-end gap-3 text-[22px] font-bold">
                  <span>{s.nome}</span>
                  <span aria-hidden="true" className="pontilhado" />
                  <span className="whitespace-nowrap text-[17px] font-semibold">{s.selo}</span>
                </div>
                <p className="t-corpo mt-2 max-w-[44ch]">{s.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Como começar, como canhoto. */}
      <section id="como-comecar" className="scroll-mt-4 bg-[var(--tom)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 data-revelar className="t-titulo max-w-[12ch]">Sua loja no ar</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-6 max-w-[30ch]">
              Se a loja já está no mapa do PetLive, você assume o perfil em vez de criar outro.
            </p>
            <figure data-revelar style={{ ["--ordem" as string]: 2 }} className="relative mt-10 aspect-[4/3]">
              <Image src="/fotos/cao-dormindo.jpg" alt="Cão dormindo num travesseiro, à meia-luz" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            </figure>
          </div>
          <div data-revelar style={{ ["--ordem" as string]: 2 }} className="recorte-zigue bg-[var(--papel)] p-6 md:p-9 lg:col-span-6 lg:col-start-7">
            <h3 className="text-[17px] font-bold">Quando o cadastro abrir</h3>
            <ul className="mt-4 space-y-3 text-[17px]">
              {PASSOS.map((p) => (
                <li key={p.o_que} className="flex items-end gap-3">
                  <span>{p.o_que}</span>
                  <span aria-hidden="true" className="pontilhado" />
                  <span className="whitespace-nowrap text-right font-semibold">{p.valor}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 flex min-h-11 flex-wrap items-center justify-between gap-x-4 bg-[var(--tinta)] px-4 py-2 text-[17px] font-bold text-[var(--papel)]">
              <span>Loja no mapa e na vitrine</span>
              <span>pedidos no celular</span>
            </p>
          </div>
        </div>
      </section>

      {/* Planos como ingressos. */}
      <section id="planos" className="scroll-mt-4 bg-[var(--tinta)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura">
          <div className="grid gap-6 text-[var(--papel)] lg:grid-cols-2 lg:gap-16">
            <h2 data-revelar className="t-titulo">Só paga quando vende pelo app</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead max-w-[36ch] self-end">
              Vitrine e agenda sem mensalidade. O Pix pelo app cobra só sobre a venda.
            </p>
          </div>
          <div className="mx-auto mt-12 flex max-w-[1100px] flex-col gap-10">
            <Ingresso
              titulo="Vitrine e agenda"
              linhas={["Catálogo de produtos e serviços", "Solicitações e reservas", "Painel no celular e no computador", "Pagamento direto na loja"]}
              preco="Grátis"
              acao={
                <a href="#cadastro" className="botao w-full">
                  Cadastrar loja
                </a>
              }
            />
            <Ingresso
              titulo="Pix pelo app"
              linhas={["Tudo da vitrine e agenda", "Pagamento por Pix no app", "Confirmação automática e extrato", "Repasse na sua chave Pix"]}
              preco="Por venda"
              acao={<p className="t-pequeno text-center text-[var(--apagado)]">Comissão sobre cada venda paga no app</p>}
            />
          </div>
        </div>
      </section>

      {/* Cadastro de interesse até o marketplace abrir. */}
      <section id="cadastro" className="scroll-mt-4 bg-[var(--ceu)] py-[clamp(72px,10vw,160px)]">
        <div className="site-moldura grid items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 data-revelar className="t-titulo max-w-[12ch]">Coloque sua loja no PetLive</h2>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-6 max-w-[32ch]">
              O cadastro de lojas abre em breve. Deixe o seu contato e avisamos primeiro, com ajuda para montar a vitrine e a
              agenda.
            </p>
          </div>
          <div data-revelar style={{ ["--ordem" as string]: 2 }} className="bg-[var(--papel)] p-6 md:p-12 lg:col-span-8">
            <FormularioContato tipo="lojista" />
          </div>
        </div>
      </section>
    </>
  );
}
