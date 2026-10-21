import type { Metadata } from "next";
import { PaginaLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Créditos dos mapas",
  description: "Fontes abertas dos mapas e dos lugares do PetLive e as licenças de cada uma.",
  alternates: { canonical: "/creditos" },
};

/** Créditos e licenças dos dados abertos do mapa (ODbL, CDLA e Apache 2.0). */
export default function PaginaCreditos() {
  return (
    <PaginaLegal
      titulo="Créditos dos mapas"
      resumo="O mapa e os lugares pet do PetLive vêm de dados abertos. Agradecemos a quem mantém essas fontes."
      atualizado="21 de outubro de 2026"
      secoes={[
        {
          titulo: "OpenStreetMap",
          paragrafos: [
            "Mapa e parte dos lugares (clínicas, petshops, parques e áreas para cães): © colaboradores do OpenStreetMap, sob a Open Database License (ODbL) — openstreetmap.org/copyright. Os desenhos do mapa vêm do OpenFreeMap.",
          ],
        },
        {
          titulo: "Overture Maps",
          paragrafos: [
            "Lugares pet (clínicas, petshops, banho e tosa, creches, hotelzinhos e parques para cães): Overture Maps Foundation, sob a Community Data License Agreement – Permissive 2.0 (cdla.dev/permissive-2-0). Inclui dados da Meta, da Microsoft, do AllThePlaces (CC0) e da Foursquare.",
            "O PetLive filtra os lugares de baixa confiança, classifica pelo tipo e pelo nome, e junta os repetidos com o OpenStreetMap.",
          ],
        },
        {
          titulo: "Foursquare OS Places",
          paragrafos: [
            "Parte dos lugares vem do Foursquare OS Places, incluído no Overture Maps, sob a Apache License 2.0 (apache.org/licenses/LICENSE-2.0). Aviso da Foursquare, na íntegra:",
            "© 2025 Foursquare Labs, Inc. All rights reserved. The Foursquare OS Places dataset (the “Data”) is licensed under the Apache License, Version 2.0 (the \"License\"). You may not use, modify, or distribute the Data except in compliance with the License. You may obtain a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0. Unless required by applicable law or agreed to in writing, the Data distributed under the License is distributed on an \"AS IS\" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.",
            "Alteração feita pelo PetLive: só lugares pet da região do Rio de Janeiro, reclassificados nas categorias do app.",
          ],
        },
        {
          titulo: "Encontrou um erro?",
          paragrafos: [
            "Lugar fechado, endereço errado ou um lugar que aceita pets e não aparece: fale com a gente em /contato. Também dá para corrigir direto no OpenStreetMap, e a correção chega ao app na próxima atualização dos dados.",
          ],
        },
      ]}
    />
  );
}
