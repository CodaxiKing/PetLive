import Image from "next/image";
import Link from "next/link";
import { FormularioContato } from "@/components/FormularioContato";

const SERVICOS = [
  ['Petshop','Produtos','Vitrine com preço e estoque, retirada ou entrega pela loja.'],
  ['Clínica veterinária','Por horário','Consulta e vacina por horário. Remédios com receita só na loja.'],
  ['Banho e tosa','Por horário','Duração, vagas, profissionais e intervalo entre atendimentos.'],
  ['Passeador','Passeio','Duração, raio de atuação e acompanhamento do trajeto.'],
  ['Creche pet','Por dia','Dia inteiro ou meio período, vagas e pacotes.'],
  ['Hotelzinho','Diárias','Entrada, saída, extras e carteira de vacinação.'],
];
export default function PaginaLojistas() {
  return <div className="site-v2 lojistas-v2">
    <section className="v2-section v2-lojistas-hero"><div className="v2-lojistas-intro"><h1>Venda e agende pelo PetLive</h1><div><p className="v2-lead">Pedidos de produtos e reservas de banho, passeio, creche e hotel num painel simples.</p><div className="v2-lojistas-acoes"><a className="v2-botao" href="#cadastro">Quero cadastrar minha loja</a><a className="v2-botao claro" href="#beneficios">Ver como funciona</a></div></div></div><div className="v2-painel-previa"><Image src="/telas-v2/WebSolicitacoes.png" alt="Prévia ilustrativa do painel de solicitações da loja" width={1280} height={800} priority /></div></section>
    <section data-revelar className="v2-section" id="beneficios"><h2>Tudo para vender e atender melhor</h2><div className="v2-beneficios">{[['01','Vitrine e solicitações','Mostre produtos com preço e estoque. Receba e acompanhe as solicitações no mesmo lugar.'],['02','Agenda com horários livres','Defina dias, horários, vagas e folgas para organizar cada atendimento.'],['03','Operação em um painel','Catálogo, agenda e atendimento acessíveis pelo celular ou computador.']].map(([n,t,p])=><article className="v2-tile" key={n}><span className="v2-selo">{n}</span><h3>{t}</h3><p>{p}</p></article>)}</div></section>
    <section data-revelar className="v2-section v2-lojistas-servicos" id="servicos"><div><h2>Para clínicas, petshops e quem presta serviço</h2><p className="v2-lead">Cada serviço tem a sua forma de reserva, configurada por você.</p><div className="v2-aviso-receita"><b>Produtos com receita aparecem só para consulta</b><p>O tutor vê preço e estoque, mas a compra é feita na loja.</p></div></div><div className="v2-servicos-grade">{SERVICOS.map(([nome,tipo,descricao])=><article className="v2-tile" key={nome}><span className="v2-selo">{tipo}</span><h3>{nome}</h3><p>{descricao}</p></article>)}</div></section>
    <section data-revelar className="v2-section" id="como-comecar"><h2>Da sua loja para o celular do tutor</h2><div className="v2-etapas-lojista">{['Conte sobre sua loja','Escolha produtos e serviços','Configure sua operação','Prepare-se para atender'].map((t,i)=><article key={t}><span>{String(i+1).padStart(2,'0')}</span><h3>{t}</h3></article>)}</div></section>
    <section data-revelar className="v2-section" id="planos"><div className="v2-tile v2-lojistas-plano"><div><span className="v2-selo">Para o seu negócio</span><h2>Conheça as condições para sua loja</h2><p>Estamos preparando a operação para lojistas. Entre na lista de interesse para receber informações sobre disponibilidade e condições.</p></div><a className="v2-botao" href="#cadastro">Tenho interesse</a></div></section>
    <section data-revelar className="v2-section v2-cadastro-lojista" id="cadastro"><div><h2>Sua loja no PetLive</h2><p className="v2-lead">Conte sobre seu negócio. Nossa equipe entra em contato com os próximos passos.</p><Link href="/lojista/entrar">Já tem acesso? Entrar no painel →</Link></div><div className="v2-tile"><FormularioContato tipo="lojista" /></div></section>
  </div>;
}
