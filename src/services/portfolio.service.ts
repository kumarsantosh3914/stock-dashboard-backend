import { PortfolioData, PortfolioItem, PortfolioSector } from "../types/portfolio.type";

const NA_STRINGS = new Set([
  '#N/A', '#N/A N.A.', 'N/A', 'NA', '#NA', '—', '-', '', 'n/a', 'NaN'
]);

function cleanCell(value: any): any {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (NA_STRINGS.has(trimmed)) return null;

    const num = Number(trimmed.replace(/,/g, ''));
    if (!Number.isNaN(num) && trimmed !== '') return num;
    return trimmed;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  return value;
}

function detectSectorHeader(row: Record<string, any>): boolean {
  const no = row['No'] ?? row['no'] ?? null;
  const name = row['Particulars'] ?? row['particulars'] ?? null;
  const sym = row['NSE/BSE'] ?? row['NSE'] ?? row['BSE'] ?? null;
  const qty = row['Qty'] ?? row['qty'] ?? null;
  
  return (no === null || no === '') && typeof name === 'string' && (sym === null || sym === '') && (qty === null || qty === '');
}

function convertSymbol(raw: any): { exchange: 'NSE' | 'BSE' | null; yahooSymbol: string | null } {
  if (raw == null) return { exchange: null, yahooSymbol: null };

  let s = String(raw).trim();
  if (!s) return { exchange: null, yahooSymbol: null };
  if (/\.NS$/i.test(s)) return { exchange: 'NSE', yahooSymbol: s.toUpperCase() };
  if (/\.BO$/i.test(s)) return { exchange: 'BSE', yahooSymbol: s.toUpperCase() };
  if (/^\d+$/.test(s)) return { exchange: 'BSE', yahooSymbol: `${s}.BO` };

  return { exchange: 'NSE', yahooSymbol: `${s}.NS` };
}

function num(value: any): number | null {
  const v = cleanCell(value);
  return typeof v === 'number' ? v : null;
}

export function buildPortfolio(sheetName: string, rows: Record<string, any>[]): PortfolioData {
  const cleaned = rows.map(r => {
    const obj: Record<string, any> = {};
    for (const k of Object.keys(r)) obj[k] = cleanCell(r[k]);
    return obj;
  });

  const sectors: PortfolioSector[] = [];
  let currentSector: PortfolioSector | null = null;

  const ensureSector = (name: string) => {
    if (!currentSector || currentSector.name !== name) {
      currentSector = {
        name,
        totals: { investment: 0, presentValue: 0, gainLoss: 0, portfolioPct: 0 },
        items: []
      };
      sectors.push(currentSector);
    }
  };

  ensureSector('Uncategorized');

  for (const row of cleaned) {
    if (detectSectorHeader(row)) {
      const sectorName = String(row['Particulars']).trim();
      ensureSector(sectorName);
      
      const inv = num(row['Investment']) || 0;
      const pv = num(row['Present value']) || 0;
      const gl = num(row['Gain/Loss']) || 0;
      const pct = num(row['Portfolio (%)']) || 0;

      currentSector!.totals.investment = inv;
      currentSector!.totals.presentValue = pv;
      currentSector!.totals.gainLoss = gl;
      currentSector!.totals.portfolioPct = pct;
      continue;
    }

    // Skip obvious empty rows
    const values = Object.values(row);
    if (values.every(v => v === null || v === '')) continue;

    const { exchange, yahooSymbol } = convertSymbol(row['NSE/BSE']);
    const item: PortfolioItem = {
      no: num(row['No']),
      name: (row['Particulars'] ?? null) as any,
      purchasePrice: num(row['Purchase Price']),
      qty: num(row['Qty']),
      investment: num(row['Investment']),
      portfolioPct: num(row['Portfolio (%)']),
      rawSymbol: (row['NSE/BSE'] ?? null) as any,
      exchange,
      yahooSymbol,
      cmp: num(row['CMP']),
      presentValue: num(row['Present value']),
      gainLoss: num(row['Gain/Loss']),
      gainLossPct: num(row['Gain/Loss (%)']) ?? num(row['Gain/Loss (%)']) ?? null,
      marketCap: num(row['Market Cap']),
      peTTM: num(row['P/E (TTM)']) ?? num(row['P/E']) ?? null,
      latestEarnings: cleanCell(row['Latest Earnings']),
    };

    currentSector!.items.push(item);
  }

  const totals = sectors.reduce((acc, s) => {
    acc.investment += s.totals.investment || s.items.reduce((sum, it) => sum + (it.investment || 0), 0);
    acc.presentValue += s.totals.presentValue || s.items.reduce((sum, it) => sum + (it.presentValue || 0), 0);
    acc.gainLoss += s.totals.gainLoss || s.items.reduce((sum, it) => sum + (it.gainLoss || 0), 0);
    return acc;
  }, { investment: 0, presentValue: 0, gainLoss: 0, portfolioPct: 0 });

  const totalInvestment = totals.investment || 0;
  if (totalInvestment > 0) {
    for (const s of sectors) {
      const inv = s.totals.investment || s.items.reduce((sum, it) => sum + (it.investment || 0), 0);
      s.totals.portfolioPct = inv / totalInvestment;
    }
  }

  return {
    sheet: sheetName,
    sectors,
    totals: {
      investment: totals.investment,
      presentValue: totals.presentValue,
      gainLoss: totals.gainLoss,
      portfolioPct: 1
    }
  };
}
