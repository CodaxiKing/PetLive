/** Mascotes do app (cão e gato), para pets sem foto nas páginas por link. */
export function Mascote({ especie, className }: { especie: "cao" | "gato"; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      {especie === "cao" ? (
        <>
          <path d="M52 150Q100 190 148 150L170 200H30z" fill="#E3AD6A" />
          <path d="M50 58C26 68 22 122 40 146C58 146 64 102 64 70z" fill="#B97A3C" />
          <path d="M150 58C174 68 178 122 160 146C142 146 136 102 136 70z" fill="#B97A3C" />
          <ellipse cx={100} cy={92} rx={52} ry={56} fill="#EDB878" />
          <ellipse cx={100} cy={120} rx={30} ry={24} fill="#F8E3C0" />
          <ellipse cx={100} cy={104} rx={11} ry={7.5} fill="#2A211C" />
          <path d="M100 111v10M88 124c6 8 18 8 24 0" fill="none" stroke="#2A211C" strokeWidth={3} strokeLinecap="round" />
          <circle cx={79} cy={82} r={7} fill="#2A211C" />
          <circle cx={121} cy={82} r={7} fill="#2A211C" />
          <circle cx={81} cy={80} r={2} fill="#fff" />
          <circle cx={123} cy={80} r={2} fill="#fff" />
          <path d="M54 152Q100 182 146 152L150 166Q100 196 50 166z" fill="#FF7A7A" />
        </>
      ) : (
        <>
          <path d="M30 200Q36 150 100 150Q164 150 170 200z" fill="#E88F45" />
          <path d="M46 78L52 24L96 54z" fill="#E88F45" />
          <path d="M154 78L148 24L104 54z" fill="#E88F45" />
          <path d="M58 64L60 40L80 54z" fill="#F7B7B0" />
          <path d="M142 64L140 40L120 54z" fill="#F7B7B0" />
          <ellipse cx={100} cy={98} rx={58} ry={52} fill="#F2A65A" />
          <ellipse cx={100} cy={120} rx={22} ry={15} fill="#FBE3CC" />
          <ellipse cx={76} cy={94} rx={8} ry={10} fill="#3E8E6A" />
          <ellipse cx={124} cy={94} rx={8} ry={10} fill="#3E8E6A" />
          <ellipse cx={76} cy={94} rx={2.5} ry={7} fill="#1D1A18" />
          <ellipse cx={124} cy={94} rx={2.5} ry={7} fill="#1D1A18" />
          <circle cx={78} cy={90} r={2} fill="#fff" />
          <circle cx={126} cy={90} r={2} fill="#fff" />
          <path d="M93 109h14l-7 9z" fill="#E57373" />
          <path d="M100 118c0 7-8 8-12 4M100 118c0 7 8 8 12 4" fill="none" stroke="#6B4A3A" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M60 112l-26-4M60 120l-26 6M140 112l26-4M140 120l26 6" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
