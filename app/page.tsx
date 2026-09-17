"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Upload,
  WalletCards,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  Sparkles,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Check,
  X,
  Heart,
  CircleHelp,
} from "lucide-react";
import {
  BANK_CATALOG,
  parseCsvText,
  parsePdfText,
  parseWorkbook,
  type ParsedTransaction,
  type ParsedWallet,
} from "@/lib/statement-parser";

type ThemeKey = "sakura" | "matcha" | "blueberry" | "peach";
type LanguageKey = "id" | "en";
type BankKey = (typeof BANK_CATALOG)[number];
type MonthKey = "all" | "2026-09" | "2026-08" | "2026-07" | "2026-06";
type UploadItem = {
  id: number;
  name: string;
  bank: BankKey;
  status: "Selesai" | "Menunggu";
  size: string;
  parsedRows: number;
  warningCount: number;
};
const themeOptions: {
  key: ThemeKey;
  label: string;
  emoji: string;
  colors: string;
}[] = [
  { key: "sakura", label: "Sakura", emoji: "🌸", colors: "#ef8fa2" },
  { key: "matcha", label: "Matcha", emoji: "🍵", colors: "#8bb996" },
  { key: "blueberry", label: "Blueberry", emoji: "🫐", colors: "#8ca8e8" },
  { key: "peach", label: "Peach", emoji: "🍑", colors: "#f3aa77" },
];
const avatarForTheme: Record<ThemeKey, string> = {
  sakura: "/avatars/sakura.png",
  matcha: "/avatars/matcha.png",
  blueberry: "/avatars/blueberry.png",
  peach: "/avatars/peach.png",
};
const translations = {
  id: {
    date: "SENIN, 16 SEPTEMBER 2026",
    greeting: "Selamat pagi, Ria!",
    overview: "Ringkasan",
    transactions: "Transaksi",
    wallets: "Dompet saya",
    settings: "Pengaturan",
    overviewTitle: "Ringkasan September",
    overviewSub: "Mari lihat kabar uangmu.",
    month: "September 2026",
    balance: "TOTAL SALDO",
    spending: "PENGELUARAN BULAN INI",
    budget: "Cek budget",
    budgetSub: "Pengingat kecil, ketenangan besar.",
    monthlyBudget: "Budget bulanan",
    used: "terpakai",
    left: "tersisa",
    recent: "Transaksi terbaru",
    recentSub: "Pergerakan uangmu, semua di satu tempat.",
    seeAll: "Lihat semua",
    statements: "Masukkan statement",
    statementsSub: "Kami bantu merapikannya.",
    which: "Statement mana yang ditambahkan?",
    click: "Klik untuk upload",
    drop: "atau drag & drop file di sini",
    formats: "PDF, XLSX, XLS, atau CSV · maksimal 10 MB",
    uploaded: "File terupload",
    auto: "Auto Tagging",
    autoSub: "Atur transaksi secara otomatis.",
    manage: "Atur rules",
    mood: "Pilih mood",
    moodSub: "Buat Pocketpals terasa seperti kamu.",
    tipTitle: "Tips uang hari ini",
    tipText:
      "Coba aturan 24 jam sebelum membeli sesuatu yang diinginkan. Dirimu di masa depan akan berterima kasih!",
    footer: "Dibuat untuk hari-hari finansial yang lebih tenang",
    personal: "Ruang pribadi",
    food: "Makanan & Minuman",
    transport: "Transportasi",
  },
  en: {
    date: "MONDAY, 16 SEPTEMBER 2026",
    greeting: "Good morning, Ria!",
    overview: "Overview",
    transactions: "Transactions",
    wallets: "My wallets",
    settings: "Settings",
    overviewTitle: "September overview",
    overviewSub: "Let's see how your money is doing.",
    month: "September 2026",
    balance: "TOTAL BALANCE",
    spending: "THIS MONTH'S SPENDING",
    budget: "Budget check-in",
    budgetSub: "Small reminder, big peace of mind.",
    monthlyBudget: "Monthly budget",
    used: "used",
    left: "left",
    recent: "Recent transactions",
    recentSub: "Your money moves, all in one place.",
    seeAll: "See all",
    statements: "Bring your statements",
    statementsSub: "We'll help tidy them up for you.",
    which: "Which statement are you adding?",
    click: "Click to upload",
    drop: "or drag & drop your file here",
    formats: "PDF, XLSX, XLS, or CSV · max 10 MB",
    uploaded: "Uploaded files",
    auto: "Auto Tagging",
    autoSub: "Organize transactions automatically.",
    manage: "Manage rules",
    mood: "Pick your mood",
    moodSub: "Make Pocketpals feel like you.",
    tipTitle: "Money tip of the day",
    tipText:
      "Try the 24-hour rule before a want purchase. Your future self says thanks!",
    footer: "Made for gentle money days",
    personal: "Personal space",
    food: "Food & Drink",
    transport: "Transportasi",
  },
} as const;
const initialTransactions: ParsedTransaction[] = [
  {
    icon: "🍜",
    title: "Makan siang",
    meta: "Hari ini · Food & Drink",
    amount: "− Rp 42.000",
    color: "rose",
    category: "Food & Drink",
  },
  {
    icon: "🚕",
    title: "Grab perjalanan",
    meta: "Kemarin · Transportasi",
    amount: "− Rp 28.500",
    color: "blue",
    category: "Transportasi",
  },
  {
    icon: "🛍️",
    title: "Belanja bulanan",
    meta: "12 Sep · Kebutuhan",
    amount: "− Rp 385.000",
    color: "yellow",
    category: "Lainnya",
  },
  {
    icon: "💼",
    title: "Gaji masuk",
    meta: "01 Sep · Pemasukan",
    amount: "+ Rp 12.500.000",
    color: "green",
    category: "Pemasukan",
  },
];
const rupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
const monthOptions: { key: MonthKey; id: string; en: string }[] = [
  { key: "all", id: "Semua bulan", en: "All months" },
  { key: "2026-09", id: "September 2026", en: "September 2026" },
  { key: "2026-08", id: "Agustus 2026", en: "August 2026" },
  { key: "2026-07", id: "Juli 2026", en: "July 2026" },
  { key: "2026-06", id: "Juni 2026", en: "June 2026" },
];
const transactionMonth = (date?: string) =>
  date && date.length >= 10 ? `${date.slice(6, 10)}-${date.slice(3, 5)}` : "";

export default function Home() {
  const [theme, setTheme] = useState<ThemeKey>("sakura");
  const [language, setLanguage] = useState<LanguageKey>("id");
  const [active, setActive] = useState("Overview");
  const [bank, setBank] = useState<BankKey>("DBS");
  const [monthFilter, setMonthFilter] = useState<MonthKey>("all");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [transactions, setTransactions] =
    useState<ParsedTransaction[]>(initialTransactions);
  const [wallets, setWallets] = useState<ParsedWallet[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [lastImportSummary, setLastImportSummary] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [autoTagging, setAutoTagging] = useState(true);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(
      "pocket-theme",
    ) as ThemeKey | null;
    const savedLanguage = window.localStorage.getItem(
      "pocket-language",
    ) as LanguageKey | null;
    if (savedTheme) setTheme(savedTheme);
    if (savedLanguage) setLanguage(savedLanguage);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("pocket-theme", theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem("pocket-language", language);
  }, [language]);
  useEffect(() => {
    try {
      const savedUploads = window.localStorage.getItem("pocket-uploads");
      const savedTransactions = window.localStorage.getItem(
        "pocket-transactions",
      );
      const savedWallets = window.localStorage.getItem("pocket-wallets");
      if (savedUploads) setUploads(JSON.parse(savedUploads));
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
      if (savedWallets) setWallets(JSON.parse(savedWallets));
    } catch (error) {
      console.warn("Pocketpals data could not be restored", error);
    } finally {
      setDataReady(true);
    }
  }, []);
  useEffect(() => {
    if (dataReady)
      window.localStorage.setItem("pocket-uploads", JSON.stringify(uploads));
  }, [uploads, dataReady]);
  useEffect(() => {
    if (dataReady)
      window.localStorage.setItem(
        "pocket-transactions",
        JSON.stringify(transactions),
      );
  }, [transactions, dataReady]);
  useEffect(() => {
    if (dataReady)
      window.localStorage.setItem("pocket-wallets", JSON.stringify(wallets));
  }, [wallets, dataReady]);
  const currentTheme = themeOptions.find((item) => item.key === theme)!;
  const c = translations[language];
  const importedTransactions = useMemo(
    () => transactions.filter((item) => Boolean(item.date)),
    [transactions],
  );
  const filteredTransactions = useMemo(() => {
    if (monthFilter === "all") return transactions;
    return transactions.filter(
      (item) => transactionMonth(item.date) === monthFilter,
    );
  }, [monthFilter, transactions]);
  const filteredImportedTransactions = useMemo(() => {
    if (monthFilter === "all") return importedTransactions;
    return importedTransactions.filter(
      (item) => transactionMonth(item.date) === monthFilter,
    );
  }, [importedTransactions, monthFilter]);
  const monthLabel = (month: MonthKey) => {
    const option =
      monthOptions.find((item) => item.key === month) ?? monthOptions[0];
    return language === "id" ? option.id : option.en;
  };
  const spendTotal = useMemo(
    () => (uploads.length ? 5820000 : 4820000),
    [uploads.length],
  );
  const chooseTheme = (key: ThemeKey) => {
    setTheme(key);
    setToast("Tema berhasil diganti ✨");
    window.setTimeout(() => setToast(""), 2200);
  };
  const processFile = async (file: File) => {
    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["csv", "xls", "xlsx", "pdf"].includes(extension)) {
      setToast("Format file belum didukung");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast("Ukuran file maksimal 10 MB");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    setToast(
      language === "id" ? "Sedang membaca statement…" : "Reading statement…",
    );
    try {
      let result;
      if (extension === "csv")
        result = parseCsvText(await file.text(), bank, file.name);
      else if (extension === "xls" || extension === "xlsx")
        result = parseWorkbook(await file.arrayBuffer(), bank, file.name);
      else {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const document = await pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          disableWorker: true,
        }).promise;
        const pages: string[] = [];
        for (
          let pageNumber = 1;
          pageNumber <= document.numPages;
          pageNumber += 1
        ) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          );
        }
        result = parsePdfText(pages.join("\n"), bank, file.name);
      }
      const parsedBank = (
        BANK_CATALOG.includes(result.bank as BankKey) ? result.bank : bank
      ) as BankKey;
      setBank(parsedBank);
      setTransactions((items) => [...result.transactions, ...items]);
      setWallets((items) => [...result.wallets, ...items]);
      setParseWarnings(result.warnings);
      setLastImportSummary(
        `${result.rowsFound} transaksi${result.wallets.length ? ` · ${result.wallets.length} saldo rekening` : ""}`,
      );
      const kb = `${Math.max(1, Math.round(file.size / 1024))} KB`;
      setUploads((items) => [
        {
          id: Date.now(),
          name: file.name,
          bank: parsedBank,
          status: "Selesai",
          size: kb,
          parsedRows: result.rowsFound,
          warningCount: result.warnings.length,
        },
        ...items,
      ]);
      setToast(
        result.warnings.length
          ? "Statement masuk, perlu review kecil"
          : `${file.name} berhasil diproses ✨`,
      );
    } catch (error) {
      console.error(error);
      setParseWarnings([
        "File berhasil dipilih tetapi belum bisa dipetakan otomatis. Coba format statement lain atau review kolomnya.",
      ]);
      setLastImportSummary("0 transaksi · perlu review");
      const kb = `${Math.max(1, Math.round(file.size / 1024))} KB`;
      setUploads((items) => [
        {
          id: Date.now(),
          name: file.name,
          bank,
          status: "Menunggu",
          size: kb,
          parsedRows: 0,
          warningCount: 1,
        },
        ...items,
      ]);
      setToast("File tersimpan, tapi parsing perlu review");
    }
    window.setTimeout(() => setToast(""), 3000);
  };
  const view =
    active === "Transactions"
      ? "transactions"
      : active === "My wallets"
        ? "wallets"
        : "overview";
  return (
    <main className={`app-shell theme-${theme} view-${view}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">✦</div>
          <div>
            <strong>
              Pocket<span>pals</span>
            </strong>
            <small>your money, but cuter</small>
          </div>
        </div>
        <nav className="nav-list" aria-label="Navigasi utama">
          {[
            { label: c.overview, key: "Overview", icon: LayoutDashboard },
            { label: c.transactions, key: "Transactions", icon: ReceiptText },
            { label: c.wallets, key: "My wallets", icon: WalletCards },
          ].map(({ label, key, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${active === key ? "selected" : ""}`}
              onClick={() => setActive(key)}
            >
              <Icon size={18} />
              {label}
              {key === "Overview" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <Settings2 size={18} />
            {c.settings}
          </button>
          <div className="mini-card">
            <div className="mini-kitty">♡</div>
            <p>
              Little steps
              <br />
              add up! <span>🐾</span>
            </p>
          </div>
          <div className="profile">
            <div className="avatar">
              <img
                src={avatarForTheme[theme]}
                alt={`${currentTheme.label} avatar`}
              />
            </div>
            <div>
              <strong>Ria Andriana</strong>
              <small>{c.personal}</small>
            </div>
            <UserButton
              appearance={{ elements: { avatarBox: "clerk-avatar" } }}
            />
          </div>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{c.date}</p>
            <h1>
              {active === "Transactions"
                ? c.transactions
                : active === "My wallets"
                  ? c.wallets
                  : c.greeting}{" "}
              <span>૮ ˶ᵔ ᵕ ᵔ˶ ა</span>
            </h1>
          </div>
          <div className="top-actions">
            <button className="help-btn" aria-label="Bantuan">
              <CircleHelp size={19} />
            </button>
            <div className="language-picker">
              <span>文</span>
              <select
                aria-label="Pilih bahasa"
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageKey)}
              >
                <option value="id">ID</option>
                <option value="en">EN</option>
              </select>
            </div>
            <div className="theme-picker">
              <span
                className="theme-swatch"
                style={{ background: currentTheme.colors }}
              >
                <img src={avatarForTheme[theme]} alt="" />
              </span>
              <select
                aria-label="Pilih tema"
                value={theme}
                onChange={(e) => chooseTheme(e.target.value as ThemeKey)}
              >
                {themeOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.emoji} {opt.label} theme
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>
        {active === "Transactions" && (
          <section className="section-view">
            <div className="section-toolbar">
              <div>
                <h2>
                  {c.recent} <span>🧾</span>
                </h2>
                <p>
                  {language === "id"
                    ? "Semua transaksi dari statement yang sudah diupload."
                    : "All transactions from uploaded statements."}
                </p>
              </div>
              <label className="month-button month-control">
                <select
                  aria-label={
                    language === "id"
                      ? "Filter bulan transaksi"
                      : "Transaction month filter"
                  }
                  value={monthFilter}
                  onChange={(event) =>
                    setMonthFilter(event.target.value as MonthKey)
                  }
                >
                  {monthOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {language === "id" ? option.id : option.en}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </label>
            </div>
            <div className="transaction-summary">
              <div>
                <span>
                  {language === "id" ? "Jumlah transaksi" : "Transactions"}
                </span>
                <strong>{filteredTransactions.length}</strong>
              </div>
              <div>
                <span>
                  {language === "id" ? "Auto-tagging" : "Auto-tagging"}
                </span>
                <strong className="summary-green">
                  {autoTagging
                    ? language === "id"
                      ? "Aktif"
                      : "On"
                    : language === "id"
                      ? "Nonaktif"
                      : "Off"}
                </strong>
              </div>
              <div>
                <span>{language === "id" ? "Statement" : "Statements"}</span>
                <strong>{uploads.length}</strong>
              </div>
            </div>
            <div className="full-list content-card">
              <div className="list-header">
                <strong>
                  {language === "id" ? "Aktivitas terbaru" : "Latest activity"}
                </strong>
                <span>{language === "id" ? "Kategori" : "Category"}</span>
                <span>{language === "id" ? "Nominal" : "Amount"}</span>
              </div>
              {filteredTransactions.map((item, index) => (
                <div
                  className="transaction-row"
                  key={`full-${item.title}-${index}`}
                >
                  <div className={`transaction-icon ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="transaction-info">
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                  </div>
                  <span className="list-category">
                    {item.color === "green"
                      ? language === "id"
                        ? "Pemasukan"
                        : "Income"
                      : item.color === "blue"
                        ? c.transport
                        : c.food}
                  </span>
                  <strong
                    className={`amount ${item.amount.startsWith("+") ? "positive" : ""}`}
                  >
                    {item.amount}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}
        {active === "My wallets" && (
          <section className="section-view">
            <div className="section-toolbar">
              <div>
                <h2>
                  {language === "id" ? "Saldo terakhir" : "Latest balances"}{" "}
                  <span>💳</span>
                </h2>
                <p>
                  {language === "id"
                    ? "Saldo per rekening dari statement yang berhasil diupload."
                    : "Balance per account from successfully uploaded statements."}
                </p>
              </div>
              <button
                className="link-button"
                onClick={() => setActive("Overview")}
              >
                ←{" "}
                {language === "id" ? "Kembali ke overview" : "Back to overview"}
              </button>
            </div>
            <div className="wallet-grid">
              <article className="wallet-total">
                <span>
                  {language === "id"
                    ? "TOTAL DARI UPLOADAN"
                    : "TOTAL FROM UPLOADS"}
                </span>
                <strong>
                  {wallets.length
                    ? rupiah(
                        wallets.reduce(
                          (total, wallet) => total + wallet.endingBalance,
                          0,
                        ),
                      )
                    : uploads.length
                      ? language === "id"
                        ? "Menunggu parsing"
                        : "Pending parsing"
                      : "—"}
                </strong>
                <small>
                  {wallets.length
                    ? `${wallets.length} ${language === "id" ? "rekening terbaca" : "accounts parsed"}`
                    : uploads.length
                      ? `${uploads.length} ${language === "id" ? "statement tersambung" : "statement connected"}`
                      : language === "id"
                        ? "Belum ada statement yang diupload"
                        : "No statement uploaded yet"}
                </small>
              </article>
              {wallets.length === 0 ? (
                <div className="wallet-empty content-card">
                  <div>🫶</div>
                  <strong>
                    {uploads.length
                      ? language === "id"
                        ? "Saldo belum terbaca dari file ini"
                        : "No balance found in this file yet"
                      : language === "id"
                        ? "Upload statement untuk melihat saldo"
                        : "Upload a statement to see balances"}
                  </strong>
                  <p>
                    {language === "id"
                      ? "Kami akan menampilkan saldo akhir hanya jika benar-benar terbaca dari statement."
                      : "Balances appear here only when an ending balance is actually read from the statement."}
                  </p>
                  <button
                    className="link-button"
                    onClick={() => setActive("Overview")}
                  >
                    {language === "id"
                      ? "Upload statement"
                      : "Upload statement"}{" "}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              ) : (
                wallets.map((wallet, index) => (
                  <article
                    className="wallet-card content-card"
                    key={`${wallet.source}-${wallet.accountName}-${index}`}
                  >
                    <div className="wallet-card-top">
                      <div className="wallet-bank-logo">
                        {wallet.bank === "DBS" ? "dbs" : "bca"}
                      </div>
                      <span className="status-pill">
                        {language === "id" ? "Terbaca" : "Parsed"}
                      </span>
                    </div>
                    <strong>
                      {wallet.bank} · {wallet.accountName}
                    </strong>
                    <small>{wallet.source}</small>
                    <b>{rupiah(wallet.endingBalance)}</b>
                    <span>
                      {language === "id"
                        ? `Saldo akhir · ${wallet.currency}`
                        : `Ending balance · ${wallet.currency}`}
                    </span>
                  </article>
                ))
              )}
            </div>
            <section className="wallet-detail-grid">
              <article className="content-card mutation-card">
                <div className="card-heading">
                  <div>
                    <h3>
                      {language === "id" ? "Mutasi bank" : "Bank activity"}{" "}
                      <span>↔️</span>
                    </h3>
                    <p>
                      {language === "id"
                        ? "Transaksi dari statement yang sudah dibaca."
                        : "Transactions parsed from uploaded statements."}
                    </p>
                  </div>
                  <label className="month-button month-control compact-month">
                    <select
                      aria-label={
                        language === "id"
                          ? "Filter bulan mutasi"
                          : "Mutation month filter"
                      }
                      value={monthFilter}
                      onChange={(event) =>
                        setMonthFilter(event.target.value as MonthKey)
                      }
                    >
                      {monthOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {language === "id" ? option.id : option.en}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} />
                  </label>
                </div>
                {filteredImportedTransactions.length === 0 ? (
                  <div className="mutation-empty">
                    <span>🧾</span>
                    <strong>
                      {uploads.length
                        ? language === "id"
                          ? `Tidak ada mutasi untuk ${monthLabel(monthFilter)}`
                          : `No activity for ${monthLabel(monthFilter)}`
                        : language === "id"
                          ? "Belum ada mutasi bank"
                          : "No bank activity yet"}
                    </strong>
                    <small>
                      {language === "id"
                        ? "Upload statement untuk melihat debit dan kredit di sini."
                        : "Upload a statement to see debits and credits here."}
                    </small>
                  </div>
                ) : (
                  <div className="mutation-list">
                    {filteredImportedTransactions.map((item, index) => (
                      <div
                        className="mutation-row"
                        key={`wallet-mutation-${item.date}-${item.title}-${index}`}
                      >
                        <div className={`transaction-icon ${item.color}`}>
                          {item.icon}
                        </div>
                        <div className="transaction-info">
                          <strong>{item.title}</strong>
                          <small>
                            {item.date} · {item.category}
                          </small>
                        </div>
                        <strong
                          className={`amount ${item.amount.startsWith("+") ? "positive" : ""}`}
                        >
                          {item.amount}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
              <article className="content-card statement-history-card">
                <div className="card-heading">
                  <div>
                    <h3>
                      {language === "id" ? "Riwayat upload" : "Upload history"}{" "}
                      <span>📂</span>
                    </h3>
                    <p>
                      {language === "id"
                        ? "Semua statement yang pernah dimasukkan."
                        : "Every statement you have added."}
                    </p>
                  </div>
                  <strong className="history-count">{uploads.length}</strong>
                </div>
                {uploads.length === 0 ? (
                  <div className="mutation-empty">
                    <span>🫶</span>
                    <strong>
                      {language === "id" ? "Belum ada file" : "No files yet"}
                    </strong>
                    <small>
                      {language === "id"
                        ? "Riwayat akan muncul setelah upload pertama."
                        : "History appears after your first upload."}
                    </small>
                  </div>
                ) : (
                  <div className="statement-history-list">
                    {uploads.map((file) => (
                      <div
                        className="statement-history-row"
                        key={`wallet-history-${file.id}`}
                      >
                        <FileText size={16} />
                        <div>
                          <strong>{file.name}</strong>
                          <small>
                            {file.bank} · {file.parsedRows}{" "}
                            {language === "id" ? "transaksi" : "transactions"} ·{" "}
                            {file.size}
                          </small>
                        </div>
                        <span className="status-pill">
                          {file.warningCount
                            ? "Review"
                            : language === "id"
                              ? "Selesai"
                              : "Done"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </section>
        )}
        <div className="main-grid">
          <div className="primary-column">
            <div className="month-row">
              <div>
                <h2>
                  {c.overviewTitle} <span>🌷</span>
                </h2>
                <p>{c.overviewSub}</p>
              </div>
              <label className="month-button month-control">
                <select
                  aria-label={
                    language === "id"
                      ? "Filter bulan ringkasan"
                      : "Overview month filter"
                  }
                  value={monthFilter}
                  onChange={(event) =>
                    setMonthFilter(event.target.value as MonthKey)
                  }
                >
                  {monthOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {language === "id" ? option.id : option.en}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </label>
            </div>
            <section className="stats-grid">
              <article className="stat-card balance-card">
                <div className="stat-label">
                  {c.balance} <span>●</span>
                </div>
                <div className="stat-value">
                  {wallets.length
                    ? rupiah(
                        wallets.reduce(
                          (total, wallet) => total + wallet.endingBalance,
                          0,
                        ),
                      )
                    : "—"}
                </div>
                <div className="stat-change">
                  <ArrowUpRight size={15} /> 12,8% <em>vs last month</em>
                </div>
                <div className="balance-spark">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </article>
              <article className="stat-card expense-card">
                <div className="stat-label">
                  {c.spending} <span>✿</span>
                </div>
                <div className="stat-value">{rupiah(spendTotal)}</div>
                <div className="stat-change down">
                  <ArrowDownRight size={15} /> 8,4% <em>vs last month</em>
                </div>
                <div className="expense-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </article>
            </section>
            <section className="content-card budget-card">
              <div className="card-heading">
                <div>
                  <h3>
                    {c.budget} <span>૮꒰ ˶• ༝ •˶꒱ა</span>
                  </h3>
                  <p>{c.budgetSub}</p>
                </div>
                <button className="more-btn">•••</button>
              </div>
              <div className="budget-line">
                <div className="budget-icon">🧸</div>
                <div className="budget-copy">
                  <div>
                    <strong>{c.monthlyBudget}</strong>
                    <span>Rp 7.500.000</span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: "64%" }} />
                  </div>
                  <small>
                    Rp 4.820.000 {c.used} <b>·</b> Rp 2.680.000 {c.left}
                  </small>
                </div>
                <div className="budget-percent">64%</div>
              </div>
            </section>
            <section className="content-card transactions-card">
              <div className="card-heading">
                <div>
                  <h3>
                    {c.recent} <span>🧾</span>
                  </h3>
                  <p>{c.recentSub}</p>
                </div>
                <button
                  className="link-button"
                  onClick={() => setActive("Transactions")}
                >
                  {c.seeAll} <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="transactions-list">
                {transactions.slice(0, 4).map((item, index) => (
                  <div
                    className="transaction-row"
                    key={`${item.title}-${index}`}
                  >
                    <div className={`transaction-icon ${item.color}`}>
                      {item.icon}
                    </div>
                    <div className="transaction-info">
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                    </div>
                    <strong
                      className={`amount ${item.amount.startsWith("+") ? "positive" : ""}`}
                    >
                      {item.amount}
                    </strong>
                    <button className="row-more">•••</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside className="right-column">
            <section className="upload-card">
              <div className="upload-confetti">✦</div>
              <div className="upload-title">
                <div className="upload-illustration">🛸</div>
                <div>
                  <h3>
                    {c.statements} <span>♡</span>
                  </h3>
                  <p>{c.statementsSub}</p>
                </div>
              </div>
              <div className="bank-options" aria-label="Pilih bank">
                <p>{c.which}</p>
                <div className="bank-select-card">
                  <span className="bank-logo">
                    {bank === "DBS"
                      ? "dbs"
                      : bank === "BCA" ||
                          bank === "Kartu Kredit BCA" ||
                          bank === "Blu by BCA Digital"
                        ? "bca"
                        : "bank"}
                  </span>
                  <select
                    className="bank-select"
                    aria-label="Pilih bank"
                    value={bank}
                    onChange={(event) => setBank(event.target.value as BankKey)}
                  >
                    {BANK_CATALOG.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.csv,.xlsx,.xls"
                onChange={(e) =>
                  e.target.files?.[0] && processFile(e.target.files[0])
                }
              />
              <button
                className="drop-zone"
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) processFile(file);
                }}
              >
                <Upload size={20} />
                <strong>{c.click}</strong>
                <span>{c.drop}</span>
                <small>{c.formats}</small>
              </button>
              {uploads.length > 0 && (
                <div className="upload-history">
                  <div className="history-heading">
                    <strong>{c.uploaded}</strong>
                    <span>{uploads.length}</span>
                  </div>
                  {uploads.slice(0, 2).map((file) => (
                    <div className="file-row" key={file.id}>
                      <FileText size={16} />
                      <div>
                        <strong>{file.name}</strong>
                        <small>
                          {file.bank} · {file.size} · {file.parsedRows}{" "}
                          transaksi
                          {file.warningCount ? " · review" : ""}
                        </small>
                      </div>
                      <span className="file-check">
                        <Check size={13} />
                      </span>
                    </div>
                  ))}
                  {lastImportSummary && (
                    <div className="import-review">
                      <strong>{lastImportSummary}</strong>
                      {parseWarnings.length > 0 && (
                        <small>{parseWarnings[0]}</small>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
            <section className="autotag-card">
              <div className="autotag-head">
                <div className="autotag-icon">🏷️</div>
                <div>
                  <h3>
                    {c.auto} <span>✨</span>
                  </h3>
                  <p>{c.autoSub}</p>
                </div>
                <button
                  className={`toggle ${autoTagging ? "on" : ""}`}
                  role="switch"
                  aria-checked={autoTagging}
                  onClick={() => setAutoTagging(!autoTagging)}
                >
                  <span />
                </button>
              </div>
              <div className="tag-rule">
                <span>🍜</span>
                <div>
                  <strong>{c.food}</strong>
                  <small>GrabFood, GoFood, restaurants</small>
                </div>
                <b>12</b>
              </div>
              <div className="tag-rule">
                <span>🚕</span>
                <div>
                  <strong>{c.transport}</strong>
                  <small>Grab, Gojek, toll, parking</small>
                </div>
                <b>8</b>
              </div>
              <button
                className="manage-tags"
                onClick={() =>
                  setToast(
                    language === "id"
                      ? "Pengaturan tag akan tersedia setelah contoh statement masuk"
                      : "Tag settings will be available after statement examples are added",
                  )
                }
              >
                {c.manage} <ArrowUpRight size={14} />
              </button>
            </section>
            <section className="theme-card">
              <div className="card-heading">
                <div>
                  <h3>
                    {c.mood} <span>🎨</span>
                  </h3>
                  <p>{c.moodSub}</p>
                </div>
                <Sparkles size={18} className="sparkle" />
              </div>
              <div className="theme-options">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={`theme-option ${theme === opt.key ? "active" : ""}`}
                    onClick={() => chooseTheme(opt.key)}
                  >
                    <span style={{ background: opt.colors }}>
                      <img
                        src={avatarForTheme[opt.key]}
                        alt={`${opt.label} avatar`}
                      />
                    </span>
                    <small>{opt.label}</small>
                    {theme === opt.key && <Check size={13} />}
                  </button>
                ))}
              </div>
            </section>
            <div className="tip-card">
              <div className="tip-bubble">💡</div>
              <div>
                <strong>{c.tipTitle}</strong>
                <p>{c.tipText}</p>
              </div>
              <button aria-label="Tutup tips">
                <X size={15} />
              </button>
            </div>
          </aside>
        </div>
        <footer className="footer-note">
          <Heart size={14} fill="currentColor" /> {c.footer} ·{" "}
          <span>pocketpals v1.0</span>
        </footer>
      </section>
      {toast && (
        <div className="toast">
          <Check size={16} /> {toast}
        </div>
      )}
    </main>
  );
}
