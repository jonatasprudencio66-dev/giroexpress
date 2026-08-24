export const PRICING_TABLE = [
  { km: 0.5, price: 3.99, timeMin: 12 }, { km: 1.0, price: 3.99, timeMin: 14 },
  { km: 1.5, price: 4.99, timeMin: 16 }, { km: 2.0, price: 4.99, timeMin: 17 },
  { km: 2.5, price: 5.99, timeMin: 18 }, { km: 3.0, price: 5.99, timeMin: 19 },
  { km: 3.5, price: 6.99, timeMin: 20 }, { km: 4.0, price: 6.99, timeMin: 21 },
  { km: 4.5, price: 7.99, timeMin: 22 }, { km: 5.0, price: 7.99, timeMin: 23 },
  { km: 5.5, price: 8.99, timeMin: 24 }, { km: 6.0, price: 9.99, timeMin: 25 },
  { km: 6.5, price: 10.99, timeMin: 26 }, { km: 7.0, price: 11.99, timeMin: 27 },
  { km: 7.5, price: 12.99, timeMin: 29 }, { km: 8.0, price: 13.99, timeMin: 30 },
  { km: 8.5, price: 14.99, timeMin: 31 }, { km: 9.0, price: 15.99, timeMin: 32 },
  { km: 9.5, price: 16.99, timeMin: 33 }, { km: 10.0, price: 17.99, timeMin: 33 },
  { km: 10.5, price: 19.99, timeMin: 34 }, { km: 11.0, price: 19.99, timeMin: 34 },
  { km: 11.5, price: 20.99, timeMin: 35 }, { km: 12.0, price: 22.99, timeMin: 36 },
  { km: 12.5, price: 22.99, timeMin: 37 }, { km: 13.0, price: 24.99, timeMin: 38 },
  { km: 13.5, price: 24.99, timeMin: 39 }, { km: 14.0, price: 24.99, timeMin: 39 },
  { km: 14.5, price: 24.99, timeMin: 40 }, { km: 15.0, price: 24.99, timeMin: 41 },
];

export const PLATFORM_FEE = 1.0;

export function priceFromKm(km) {
  const v = Math.max(0.1, Number(km) || 0);
  let m = PRICING_TABLE[PRICING_TABLE.length - 1];
  for (const r of PRICING_TABLE) {
    if (v <= r.km) { m = r; break; }
  }
  const gross = m.price;
  const net = Number((gross - PLATFORM_FEE).toFixed(2));
  return { kmBracket: m.km, grossPrice: gross, platformFee: PLATFORM_FEE, netCourier: net, estimatedMin: m.timeMin };
}

export function formatBRL(n) {
  return `R$ ${(Number(n) || 0).toFixed(2).replace(".", ",")}`;
}
