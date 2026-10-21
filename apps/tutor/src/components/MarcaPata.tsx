import { type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

/** Pata em traço, decorativa, dos heróis e do cartão Premium do protótipo. */
export function MarcaPata({
  size = 150,
  cor = '#FFFFFF',
  style,
}: {
  size?: number
  cor?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth={1.1}
      style={style}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={6} cy={10} r={1.8} />
      <Circle cx={10} cy={6} r={1.8} />
      <Circle cx={14} cy={6} r={1.8} />
      <Circle cx={18} cy={10} r={1.8} />
      <Path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
    </Svg>
  )
}
