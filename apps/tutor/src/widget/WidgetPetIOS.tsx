import { Link, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, privacySensitive, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type PropsWidgetIOS = { titulo: string; detalhe: string; acao: string; url: string };

function LayoutWidget(props: PropsWidgetIOS) {
  'widget';
  return (
    <VStack alignment="leading" spacing={7} modifiers={[containerBackground('#E0F1FA', 'widget'), widgetURL(props.url), privacySensitive()]}>
      <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle('#1A5577')]}>PetLive</Text>
      <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle('#111111'), lineLimit(2)]}>{props.titulo}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle('#566070'), lineLimit(2)]}>{props.detalhe}</Text>
      <Link label={props.acao} destination={props.url} modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle('#1A5577')]} />
    </VStack>
  );
}

export default createWidget('ProximoPetIOS', LayoutWidget, {
  titulo: 'Seu pet, sempre por perto', detalhe: 'Abra o PetLive para atualizar.', acao: 'Abrir PetLive', url: 'petlive://inicio',
});
