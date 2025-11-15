export type PortfolioItem = {
  no: number | null;
  name: string | null;
  purchasePrice: number | null;
  qty: number | null;
  investment: number | null;
  portfolioPct: number | null;
  rawSymbol: string | null;
  exchange: 'NSE' | 'BSE' | null;
  yahooSymbol: string | null;
  cmp: number | null;
  presentValue: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
  marketCap: number | null;
  peTTM: number | null;
  latestEarnings: number | string | null;
  [key: string]: any;
};

export type PortfolioSector = {
  name: string;
  totals: {
    investment: number;
    presentValue: number;
    gainLoss: number;
    portfolioPct: number;
  };
  items: PortfolioItem[];
};

export type PortfolioData = {
  sheet: string;
  sectors: PortfolioSector[];
  totals: {
    investment: number;
    presentValue: number;
    gainLoss: number;
    portfolioPct: number;
  };
};
