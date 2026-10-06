export interface Frac {
  num: number;
  den: number;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

export function reduce(f: Frac): Frac {
  const g = gcd(f.num, f.den) || 1;
  const sign = f.den < 0 ? -1 : 1;
  return { num: (sign * f.num) / g, den: (sign * f.den) / g };
}

export function add(a: Frac, b: Frac): Frac {
  return reduce({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
}

export function sub(a: Frac, b: Frac): Frac {
  return reduce({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
}

export function mul(a: Frac, b: Frac): Frac {
  return reduce({ num: a.num * b.num, den: a.den * b.den });
}

/** 가분수를 대분수 표기로: 7/3 → "2와 1/3" */
export function formatFrac(f: Frac): string {
  const r = reduce(f);
  if (r.den === 1) return String(r.num);
  const whole = Math.trunc(r.num / r.den);
  const rest = r.num - whole * r.den;
  return whole === 0 ? `${rest}/${r.den}` : `${whole}와 ${rest}/${r.den}`;
}

/** 문제 표시용: 대분수는 "2와 1/3" 형태 */
export function showFrac(f: Frac): string {
  return formatFrac(f);
}
