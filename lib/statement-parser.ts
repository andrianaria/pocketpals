import * as XLSX from "xlsx";

export type ParsedTransaction = {
  id?: string;
  icon: string;
  title: string;
  meta: string;
  amount: string;
  amountValue: number;
  direction: "credit" | "debit";
  color: string;
  category: string;
  note?: string;
  date?: string;
};
export type ParsedWallet = {
  bank: string;
  accountName: string;
  accountNumber?: string;
  currency: string;
  endingBalance: number;
  source: string;
};
export type ParseResult = {
  bank: string;
  transactions: ParsedTransaction[];
  wallets: ParsedWallet[];
  warnings: string[];
  rowsFound: number;
  failedRows: number;
  failureDetails: string[];
  statementPeriod?: string;
};

export const BANK_CATALOG = [
  "DBS",
  "BCA",
  "Kartu Kredit BCA",
  "Mandiri",
  "BNI",
  "BRI",
  "BTN",
  "CIMB Niaga",
  "Danamon",
  "Permata",
  "OCBC",
  "UOB",
  "Maybank",
  "Panin",
  "HSBC",
  "Bank Jago",
  "SeaBank",
  "Bank Syariah Indonesia",
  "Bank Neo Commerce",
  "BTPN / Jenius",
  "Blu by BCA Digital",
  "Bank Mega",
  "Bank Sinarmas",
  "Allo Bank",
  "Bank Muamalat",
  "Bank Woori Saudara",
  "Other / format belum dikenali",
] as const;

const money = (value: string | number | undefined) => {
  if (value === undefined || value === null || value === "") return 0;
  const raw = String(value)
    .replace(/[^0-9,.-]/g, "")
    .trim();
  if (!raw) return 0;
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  return Math.abs(Number(normalized)) || 0;
};
const formatIdr = (value: number) =>
  `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
const classify = (text: string) => {
  const t = text.toLowerCase();
  if (/gaji|salary|payroll|income/.test(t)) return ["Pemasukan", "green", "💼"];
  if (
    /grabfood|gofood|food|restaurant|resto|makan|kopi|starbucks|indomaret|alfamart/.test(
      t,
    )
  )
    return ["Food & Drink", "rose", "🍜"];
  if (/grab|gojek|toll|rtol|parkir|transport|taxi|ojek/.test(t))
    return ["Transportasi", "blue", "🚕"];
  if (/bayar kk|credit card|kartu kredit|cc payment/.test(t))
    return ["Kartu Kredit", "purple", "💳"];
  if (/transfer|bifast|trf|payment|trx/.test(t))
    return ["Transfer", "yellow", "↔️"];
  if (/tax|pajak|withholding/.test(t)) return ["Pajak", "yellow", "🧾"];
  return ["Lainnya", "purple", "📄"];
};

export function detectBank(text: string, selectedBank: string) {
  const t = text.toLowerCase();
  if (/dbs|digibank|dbsi/.test(t)) return "DBS";
  if (/bank central asia|bca/.test(t))
    return selectedBank === "Kartu Kredit BCA" ? "Kartu Kredit BCA" : "BCA";
  if (/mandiri|livin/.test(t)) return "Mandiri";
  if (/bank negara indonesia|bni|wondr/.test(t)) return "BNI";
  if (/bank rakyat indonesia|bri|brimo/.test(t)) return "BRI";
  if (/cimb niaga|octo/.test(t)) return "CIMB Niaga";
  if (/permata/.test(t)) return "Permata";
  if (/danamon/.test(t)) return "Danamon";
  if (/ocbc/.test(t)) return "OCBC";
  if (/uob/.test(t)) return "UOB";
  if (/maybank/.test(t)) return "Maybank";
  if (/panin/.test(t)) return "Panin";
  if (/hsbc/.test(t)) return "HSBC";
  if (/bank jago/.test(t)) return "Bank Jago";
  if (/seabank/.test(t)) return "SeaBank";
  if (/syariah indonesia|bsi/.test(t)) return "Bank Syariah Indonesia";
  if (/neo commerce|neobank/.test(t)) return "Bank Neo Commerce";
  if (/jenius|btpn/.test(t)) return "BTPN / Jenius";
  if (/blu by bca|bca digital/.test(t)) return "Blu by BCA Digital";
  if (/bank mega/.test(t)) return "Bank Mega";
  if (/sinarmas/.test(t)) return "Bank Sinarmas";
  if (/allo bank|allo/.test(t)) return "Allo Bank";
  if (/muamalat/.test(t)) return "Bank Muamalat";
  if (/woori saudara/.test(t)) return "Bank Woori Saudara";
  return selectedBank;
}

function rowsToResult(
  rows: Record<string, unknown>[],
  selectedBank: string,
  source: string,
): ParseResult {
  const transactions: ParsedTransaction[] = [];
  let failedRows = 0;
  const failureDetails: string[] = [];
  for (const row of rows) {
    const entries = Object.entries(row);
    const get = (patterns: RegExp[]) =>
      entries.find(([key]) =>
        patterns.some((pattern) => pattern.test(key.toLowerCase())),
      )?.[1];
    const description = String(
      get([/description|detail|keterangan|remark|merchant|narrative|uraian/]) ??
        "",
    ).trim();
    const date = String(
      get([/^date$|tanggal|transaction date|posting date/]) ?? "",
    ).trim();
    const debit = money(get([/debit|withdrawal|keluar|debet/]));
    const credit = money(get([/credit|deposit|masuk|kredit/]));
    const amount =
      debit || credit || money(get([/amount|nominal|jumlah|value/]));
    if (!description && !date && !amount) {
      failedRows += 1;
      if (failureDetails.length < 5) failureDetails.push("Baris tanpa tanggal, keterangan, atau nominal.");
      continue;
    }
    const [category, color, icon] = classify(description);
    transactions.push({
      icon,
      title: description || "Imported transaction",
      meta: `${date || "Tanggal belum terbaca"} · ${category}`,
      amount: `${credit && !debit ? "+" : "−"} ${formatIdr(amount)}`,
      amountValue: amount,
      direction: credit && !debit ? "credit" : "debit",
      color,
      category,
      date,
    });
  }
  return {
    bank: detectBank(`${selectedBank} ${source}`, selectedBank),
    transactions: transactions.slice(0, 500),
    wallets: [],
    warnings: transactions.length
      ? []
      : ["Header transaksi belum terdeteksi. Review kolom diperlukan."],
    rowsFound: transactions.length,
    failedRows,
    failureDetails,
  };
}

export function parseWorkbook(
  buffer: ArrayBuffer,
  selectedBank: string,
  source: string,
): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { defval: "" },
    );
    const result = rowsToResult(rows, selectedBank, source);
    if (result.transactions.length) return result;
  }
  return {
    bank: selectedBank,
    transactions: [],
    wallets: [],
    warnings: ["Tidak menemukan baris transaksi yang bisa dipetakan."],
    rowsFound: 0,
    failedRows: 0,
    failureDetails: [],
  };
}

export function parseCsvText(
  text: string,
  selectedBank: string,
  source: string,
) {
  const workbook = XLSX.read(text, { type: "string", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return rowsToResult(
    XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }),
    selectedBank,
    source,
  );
}

export function parsePdfText(
  text: string,
  selectedBank: string,
  source: string,
): ParseResult {
  const bank = detectBank(text, selectedBank);
  const normalizedText = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const statementPeriod = normalizedText.match(
    /Statement Period\s*\/\s*Periode Rekening Koran\s+(.+?\d{4})/i,
  )?.[1];
  const wallets: ParsedWallet[] = [];
  const endingPattern = /Ending Balance\s+([0-9][0-9.,]*)\s*(?:Cr|DR)?/gi;
  let match: RegExpExecArray | null;
  while ((match = endingPattern.exec(normalizedText)) && wallets.length < 20) {
    const amount = money(match[1]);
    if (amount > 0)
      wallets.push({
        bank,
        accountName: "Statement account",
        currency: "IDR",
        endingBalance: amount,
        source,
      });
  }
  const transactions: ParsedTransaction[] = [];
  const linePattern =
    /(\d{2}\/\d{2}\/\d{4})\s+(?:\d{2}\/\d{2}\/\d{4}\s+)?(.+?)\s+([0-9][0-9.,]+)\s+Cr/g;
  while ((match = linePattern.exec(normalizedText)) && transactions.length < 500) {
    const body = match[2].replace(/\s+/g, " ").trim();
    const numericTokens = body.match(/[0-9][0-9.,]*/g) ?? [];
    const amountToken = numericTokens.at(-1) ?? "";
    const description = amountToken
      ? body.slice(0, body.lastIndexOf(amountToken)).trim()
      : body;
    const amount = money(amountToken);
    const [category, color, icon] = classify(description);
    if (amount)
      transactions.push({
        icon,
        title: description || "Imported transaction",
        meta: `${match[1]} · ${category}`,
        amount: `− ${formatIdr(amount)}`,
        amountValue: amount,
        direction: "debit",
        color,
        category,
        date: match[1],
      });
  }
  return {
    bank,
    transactions,
    wallets,
    warnings: [
      ...(wallets.length ? [] : ["Saldo akhir belum terdeteksi otomatis."]),
      ...(transactions.length
        ? []
        : ["Transaksi PDF perlu review manual atau contoh layout tambahan."]),
    ],
    rowsFound: transactions.length,
    failedRows: transactions.length ? 0 : 1,
    failureDetails: transactions.length ? [] : ["Format PDF belum cocok dengan pola transaksi yang dikenali."],
    statementPeriod,
  };
}
