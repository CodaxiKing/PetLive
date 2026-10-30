import { PerguntasV2 } from "@/components/site/PerguntasV2";
import Image from "next/image";
import Link from "next/link";
import { BotoesLojas } from "@/components/BotoesLojas";


function Celular({ tela, alt }: { tela: string; alt: string }) {
  return <div className="v2-celular"><Image src={`/telas-v2/${tela}.png`} alt={alt} width={390} height={844} /></div>;
}
export default function Inicio() {
  return <div className="site-v2">
    <section className="v2-hero" id="baixar">
      <div><h1>A saúde do seu pet, sempre em dia</h1><p className="v2-lead">Vacinas, lembretes de remédio e clínicas por perto. Grátis para começar.</p><BotoesLojas /></div>
      <div className="v2-hero-imagens"><Image className="v2-foto" src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=900&q=70&auto=format&fit=crop" alt="Cão ao ar livre, como na referência do canvas" fill priority unoptimized sizes="(max-width: 760px) 100vw, 560px" /><Celular tela="Inicio" alt="Prévia da nova tela inicial do PetLive" /></div>
    </section>
    <section data-revelar className="v2-section" id="recursos"><h2>Tudo do seu pet em um só lugar</h2><div className="v2-recursos">
      <article data-revelar className="v2-tile v2-saude"><span className="v2-selo">Saúde</span><h3>Carteira de saúde</h3><p>Vacinas, vermífugo, peso e consultas num só histórico. Exporte em PDF para o veterinário com Premium.</p><Celular tela="Vacina" alt="Registro de vacina no app" /></article>
      <article data-revelar className="v2-tile v2-rotina"><span className="v2-selo">Rotina</span><h3>Lembretes que avisam</h3><p>Vacina, remédio a cada dose e seus cuidados de rotina. Você confirma com um toque.</p></article>
      <article data-revelar className="v2-tile v2-perfil"><Image src="/fotos/tutora.jpg" alt="Tutora com seu cão" fill sizes="400px" /><div><h3>Um perfil por pet</h3><p>Cães e gatos, com foto e a rotina de cada um.</p></div></article>
      <article data-revelar className="v2-tile v2-mapa"><div><span className="v2-selo">Por perto</span><h3>Mapa pet</h3><p>Clínicas, petshops e veterinários 24 h por perto, com rota e contato.</p></div><Celular tela="Mapa" alt="Mapa de lugares pet no aplicativo" /></article>
    </div></section>
    <section data-revelar className="v2-section" id="como-comecar"><h2>Pronto em três passos</h2><div className="v2-passos">{[{tela:'CadastroPet',titulo:'Cadastre o pet',texto:'Nome, espécie, raça e nascimento. O app já sugere o calendário de vacinas.'},{tela:'Lembretes',titulo:'Receba os lembretes',texto:'Vacinas, remédios e consultas chegam na hora certa, sem planilha.'},{tela:'Lugar',titulo:'Encontre e reserve',texto:'Quando a vacina vence, veja clínicas por perto e conheça as opções de atendimento.'}].map(item=><article data-revelar key={item.tela}><div className="v2-passo-foto"><Celular tela={item.tela} alt={item.titulo} /></div><h3>{item.titulo}</h3><p>{item.texto}</p></article>)}</div></section>
    <section data-revelar className="v2-section" id="servicos"><div className="v2-servicos"><div><h2>Clínicas, petshops e serviços com hora marcada</h2><p className="v2-lead">Encontre os cuidados para o seu pet e conheça os serviços por perto.</p><div className="v2-servicos-chips"><span>Banho e tosa</span><span>Passeador</span><span>Creche pet</span><span>Hotelzinho</span><span>Clínicas veterinárias</span><span>Petshops</span></div><div className="v2-convite-lojista"><span className="v2-convite-icone" aria-hidden="true">↗</span><div><b>Tem uma loja ou clínica?</b><p>Conheça o PetLive para o seu negócio.</p></div><Link href="/lojistas">Conhecer para lojistas</Link></div></div><Celular tela="Agendar" alt="Prévia do agendamento no PetLive" /></div></section>
    <section data-revelar className="v2-section" id="planos"><h2>Comece grátis, mude quando quiser</h2><div className="v2-planos"><article data-revelar className="v2-tile"><h3>Grátis</h3><p>Para cuidar de um pet</p><strong>R$ 0</strong><ul><li>Vacinas, vermífugo e peso</li><li>Remédios e lembretes</li><li>Mapa pet e SOS</li></ul><a className="v2-botao" href="#baixar">Baixar o app</a></article><article data-revelar className="v2-tile v2-premium"><span className="v2-selo">Mais completo</span><h3>Premium</h3><p>Para a família toda</p><strong>Em breve</strong><ul><li>Mais pets na mesma conta</li><li>Carteira em PDF para o veterinário</li><li>Anexos e acesso para a família</li></ul><p>Preço e condições disponíveis no lançamento.</p></article></div></section>
    <PerguntasV2 />
  </div>;
}
