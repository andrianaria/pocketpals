"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
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
  Search,
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
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

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
  statementPeriod?: string;
};
type ImportReport = {
  fileName: string;
  bank: BankKey;
  progress: number;
  status: "reading" | "parsing" | "complete" | "error";
  totalRows: number;
  successRows: number;
  failedRows: number;
  failures: string[];
};
const categoryOptions = [
  ["Pemasukan", "green", "💼"],
  ["Makanan & Minuman", "rose", "🍜"],
  ["Transportasi", "blue", "🚕"],
  ["Kartu Kredit", "purple", "💳"],
  ["Transfer", "yellow", "↔️"],
  ["Pajak", "yellow", "🧾"],
  ["Lainnya", "purple", "📄"],
] as const;
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
    uploadStatement: "Upload statement",
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
    uploadStatement: "Upload statement",
  },
} as const;
const rupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
const walletAmount = (amount: number, currency: string) =>
  currency === "IDR"
    ? rupiah(amount)
    : `${currency} ${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(amount)}`;
const monthOptions: { key: MonthKey; id: string; en: string }[] = [
  { key: "all", id: "Semua bulan", en: "All months" },
  { key: "2026-09", id: "September 2026", en: "September 2026" },
  { key: "2026-08", id: "Agustus 2026", en: "August 2026" },
  { key: "2026-07", id: "Juli 2026", en: "July 2026" },
  { key: "2026-06", id: "Juni 2026", en: "June 2026" },
];
const transactionMonth = (date?: string) =>
  date && date.length >= 10 ? `${date.slice(6, 10)}-${date.slice(3, 5)}` : "";
const walletKey = (wallet: ParsedWallet) =>
  [
    wallet.bank,
    wallet.source,
    wallet.accountNumber ?? wallet.accountName,
    wallet.currency,
  ].join(":");
const uniqueWallets = (items: ParsedWallet[]) =>
  Array.from(new Map(items.map((item) => [walletKey(item), item])).values());

export default function Home() {
  const { user, isLoaded } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [theme, setTheme] = useState<ThemeKey>("sakura");
  const [language, setLanguage] = useState<LanguageKey>("id");
  const [active, setActive] = useState("Overview");
  const [bank, setBank] = useState<BankKey>("DBS");
  const [monthFilter, setMonthFilter] = useState<MonthKey>("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [wallets, setWallets] = useState<ParsedWallet[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [lastImportSummary, setLastImportSummary] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [autoTagging, setAutoTagging] = useState(true);
  const [toast, setToast] = useState("");
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<ParsedTransaction | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
    if (!isLoaded || !user?.id) return;
    let cancelled = false;
    fetch("/api/pocketpals")
      .then((response) => (response.ok ? response.json() : null))
      .then((remote) => {
        if (cancelled || !remote) return;
        const localUploads = JSON.parse(window.localStorage.getItem("pocket-uploads") ?? "[]") as UploadItem[];
        const localTransactions = JSON.parse(window.localStorage.getItem("pocket-transactions") ?? "[]") as ParsedTransaction[];
        const localWallets = JSON.parse(window.localStorage.getItem("pocket-wallets") ?? "[]") as ParsedWallet[];
        const remoteHasData = remote.uploads?.length || remote.transactions?.length || remote.wallets?.length;
        if (!remoteHasData && localUploads.length) {
          for (const upload of localUploads) {
            void fetch("/api/pocketpals", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "import",
                upload: {
                  name: upload.name,
                  bank: upload.bank,
                  size: upload.size,
                  parsedRows: upload.parsedRows,
                  warningCount: upload.warningCount,
                  statementPeriod: upload.statementPeriod,
                },
                transactions: localTransactions.filter((item) => item.source === upload.name && item.bank === upload.bank),
                wallets: localWallets.filter((item) => item.source === upload.name && item.bank === upload.bank),
              }),
            });
          }
          return;
        }
        if (Array.isArray(remote.uploads)) setUploads(remote.uploads);
        if (Array.isArray(remote.transactions)) setTransactions(remote.transactions);
        if (Array.isArray(remote.wallets)) setWallets(uniqueWallets(remote.wallets));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isLoaded, user?.id]);
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
      if (savedUploads) {
        const restoredUploads = JSON.parse(savedUploads) as UploadItem[];
        setUploads(Array.from(new Map(restoredUploads.map((item) => [`${item.bank}:${item.name}`, item])).values()));
      }
      if (savedTransactions) {
        const restored = JSON.parse(savedTransactions) as ParsedTransaction[];
        setTransactions(
          restored.filter(
            (item) =>
              Boolean(item.date) && typeof item.amountValue === "number",
          ).map((item, index) => ({ ...item, id: item.id ?? `restored-${index}-${item.date}` })),
        );
      }
      if (savedWallets) {
        setWallets(uniqueWallets(JSON.parse(savedWallets) as ParsedWallet[]));
      }
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
  const profileName = user?.fullName || user?.firstName || "Ria Andriana";
  const profileEmail = user?.primaryEmailAddress?.emailAddress || "Ruang pribadi";
  const importedTransactions = useMemo(
    () => transactions.filter((item) => Boolean(item.date)),
    [transactions],
  );
  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLocaleLowerCase("id-ID");
    const compactQuery = query.replace(/\D/g, "");
    return transactions.filter((item) => {
      const matchesMonth =
        monthFilter === "all" || transactionMonth(item.date) === monthFilter;
      if (!matchesMonth) return false;
      if (!query) return true;
      const searchableText = [
        item.title,
        item.category,
        item.note ?? "",
        item.meta,
        item.amount,
        rupiah(item.amountValue),
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID");
      const compactAmount = String(item.amountValue).replace(/\D/g, "");
      return (
        searchableText.includes(query) ||
        (compactQuery.length > 0 && compactAmount.includes(compactQuery))
      );
    });
  }, [monthFilter, transactionSearch, transactions]);
  const filteredImportedTransactions = useMemo(() => {
    const importedIds = new Set(importedTransactions.map((item) => item.id));
    return filteredTransactions.filter((item) => importedIds.has(item.id));
  }, [filteredTransactions, importedTransactions]);
  const mutationGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; accountNumber?: string; currency?: string; items: ParsedTransaction[] }
    >();
    for (const item of filteredImportedTransactions) {
      const key = item.accountNumber ?? item.accountName ?? "unassigned";
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, {
          label: item.accountName ?? (language === "id" ? "Akun statement" : "Statement account"),
          accountNumber: item.accountNumber,
          currency: item.currency,
          items: [item],
        });
      }
    }
    return Array.from(groups.values());
  }, [filteredImportedTransactions, language]);
  const monthLabel = (month: MonthKey) => {
    const option =
      monthOptions.find((item) => item.key === month) ?? monthOptions[0];
    return language === "id" ? option.id : option.en;
  };
  const spendTotal = useMemo(
    () =>
      filteredImportedTransactions
        .filter((item) => item.direction === "debit")
        .reduce((total, item) => total + item.amountValue, 0),
    [filteredImportedTransactions],
  );
  const categorySummary = useMemo(() => {
    const counts = importedTransactions.reduce<Record<string, number>>(
      (summary, item) => {
        summary[item.category] = (summary[item.category] ?? 0) + 1;
        return summary;
      },
      {},
    );
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
  }, [importedTransactions]);
  const latestWallets = useMemo(() => {
    const accounts = new Map<string, ParsedWallet>();
    for (const wallet of wallets) {
      const key = [
        wallet.bank,
        wallet.accountNumber ?? wallet.accountName,
        wallet.currency,
      ].join(":");
      if (!accounts.has(key)) accounts.set(key, wallet);
    }
    return Array.from(accounts.values());
  }, [wallets]);
  const idrWalletTotal = useMemo(
    () =>
      latestWallets
        .filter((wallet) => wallet.currency === "IDR")
        .reduce((total, wallet) => total + wallet.endingBalance, 0),
    [latestWallets],
  );
  const chooseTheme = (key: ThemeKey) => {
    setTheme(key);
    setToast("Tema berhasil diganti ✨");
    window.setTimeout(() => setToast(""), 2200);
  };
  const saveEditedTransaction = () => {
    if (!editingTransaction?.id) return;
    const updated = {
      ...editingTransaction,
      meta: `${editingTransaction.date || "Tanggal belum terbaca"} · ${editingTransaction.category}`,
      amount: `${editingTransaction.direction === "credit" ? "+" : "−"} ${rupiah(editingTransaction.amountValue)}`,
    };
    setTransactions((items) =>
      items.map((item) => (item.id === updated.id ? updated : item)),
    );
    void fetch("/api/pocketpals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: updated.id, changes: updated }),
    });
    setEditingTransaction(null);
    setToast("Transaksi berhasil disimpan ✨");
    window.setTimeout(() => setToast(""), 2200);
  };
  const deleteTransaction = (transaction: ParsedTransaction) => {
    if (!transaction.id) return;
    if (!window.confirm(`Hapus transaksi “${transaction.title}”?`)) return;
    setTransactions((items) => items.filter((item) => item.id !== transaction.id));
    void fetch("/api/pocketpals", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: transaction.id }),
    });
    setToast("Transaksi dihapus");
    window.setTimeout(() => setToast(""), 2200);
  };
  const updateTransactionInline = (
    id: string,
    changes: Partial<ParsedTransaction>,
  ) => {
    setTransactions((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...changes };
        return {
          ...next,
          meta: `${next.date || "Tanggal belum terbaca"} · ${next.category}`,
        };
      }),
    );
    void fetch("/api/pocketpals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, changes }),
    });
  };
  const updateTransactionCategory = (
    transaction: ParsedTransaction,
    category: string,
  ) => {
    if (!transaction.id) return;
    const selected = categoryOptions.find(([name]) => name === category);
    updateTransactionInline(transaction.id, {
      category,
      ...(selected
        ? { color: selected[1], icon: selected[2] }
        : {}),
    });
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
    setImportReport({ fileName: file.name, bank, progress: 8, status: "reading", totalRows: 0, successRows: 0, failedRows: 0, failures: [] });
    try {
      let result;
      if (extension === "csv") {
        setImportReport((report) => report && { ...report, progress: 35, status: "parsing" });
        result = parseCsvText(await file.text(), bank, file.name);
      } else if (extension === "xls" || extension === "xlsx") {
        setImportReport((report) => report && { ...report, progress: 35, status: "parsing" });
        result = parseWorkbook(await file.arrayBuffer(), bank, file.name);
      } else {
        const pdfDocument = await pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          useWorkerFetch: false,
          isEvalSupported: false,
        }).promise;
        const pages: string[] = [];
        for (
          let pageNumber = 1;
          pageNumber <= pdfDocument.numPages;
          pageNumber += 1
        ) {
          const page = await pdfDocument.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) => (item && "str" in item ? item.str : ""))
              .join(" "),
          );
          setImportReport((report) => report && { ...report, progress: 15 + Math.round((pageNumber / pdfDocument.numPages) * 55), status: "parsing" });
        }
        result = parsePdfText(pages.join("\n"), bank, file.name);
      }
      const parsedBank = (
        BANK_CATALOG.includes(result.bank as BankKey) ? result.bank : bank
      ) as BankKey;
      setBank(parsedBank);
      setTransactions((items) => {
        const hasSameUpload = uploads.some(
          (item) => item.name === file.name && item.bank === parsedBank,
        );
        const legacyTransactions = items.filter(
          (item) => !item.source && !item.bank,
        );
        const replaceLegacyImport =
          hasSameUpload && legacyTransactions.length === result.transactions.length;
        const keptItems = items.filter(
          (item) =>
            item.source !== file.name &&
            !(replaceLegacyImport && !item.source && !item.bank),
        );
        return [
          ...result.transactions.map((item, index) => ({
            ...item,
            bank: parsedBank,
            source: file.name,
            id: item.id ?? `import-${Date.now()}-${index}`,
          })),
          ...keptItems,
        ];
      });
      setWallets((items) =>
        uniqueWallets([
          ...result.wallets,
          ...items.filter(
            (item) => !(item.bank === parsedBank && item.source === file.name),
          ),
        ]),
      );
      setParseWarnings(result.warnings);
      setLastImportSummary(
        `${result.rowsFound} berhasil · ${result.failedRows} gagal${result.statementPeriod ? ` · periode ${result.statementPeriod}` : ""}${result.wallets.length ? ` · ${result.wallets.length} saldo rekening` : ""}`,
      );
      setImportReport({ fileName: file.name, bank: parsedBank, progress: 100, status: "complete", totalRows: result.rowsFound + result.failedRows, successRows: result.rowsFound, failedRows: result.failedRows, failures: result.failureDetails.length ? result.failureDetails : result.warnings });
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
          statementPeriod: result.statementPeriod,
        },
        ...items.filter((item) => !(item.name === file.name && item.bank === parsedBank)),
      ]);
      void fetch("/api/pocketpals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "import",
          upload: {
            name: file.name,
            bank: parsedBank,
            size: kb,
            parsedRows: result.rowsFound,
            warningCount: result.warnings.length,
            statementPeriod: result.statementPeriod,
          },
          transactions: result.transactions.map((item, index) => ({
            ...item,
            bank: parsedBank,
            source: file.name,
            id: item.id ?? `import-${Date.now()}-${index}`,
          })),
          wallets: result.wallets,
        }),
      }).catch(() => setToast("Tersimpan di perangkat, sinkronisasi database perlu dicoba lagi"));
      setToast(
        result.warnings.length
          ? "Statement masuk, perlu review kecil"
          : `${file.name} berhasil diproses ✨`,
      );
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setParseWarnings([
        `Parser gagal membaca file: ${errorMessage || "format belum dikenali"}`,
      ]);
      setLastImportSummary("0 berhasil · 1 gagal · perlu review");
      setImportReport({ fileName: file.name, bank, progress: 100, status: "error", totalRows: 1, successRows: 0, failedRows: 1, failures: ["File tidak bisa dibaca di browser atau formatnya belum dikenali."] });
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
        ...items.filter((item) => !(item.name === file.name && item.bank === bank)),
      ]);
      setToast("File tersimpan, tapi parsing perlu review");
    }
    window.setTimeout(() => setToast(""), 3000);
  };
  const view =
    active === "Upload statement"
      ? "upload"
      : active === "Transactions"
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
            { label: c.uploadStatement, key: "Upload statement", icon: Upload },
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
          <div className={`profile ${profileMenuOpen ? "profile-open" : ""}`}>
            <div className="avatar">
              <img
                src={avatarForTheme[theme]}
                alt={`${currentTheme.label} avatar`}
              />
            </div>
            <button
              type="button"
              className="profile-trigger"
              aria-expanded={profileMenuOpen}
              aria-label="Buka menu profil"
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <strong>{profileName}</strong>
              <small>{profileEmail}</small>
            </button>
            <button
              type="button"
              className="profile-more"
              aria-label="Buka menu profil"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <ChevronDown size={16} />
            </button>
            {profileMenuOpen && (
              <div className="profile-menu">
                <div className="profile-menu-heading">
                  <span className="profile-menu-avatar">{profileName.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{profileName}</strong>
                    <small>{profileEmail}</small>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    openUserProfile();
                  }}
                >
                  <span>👤</span>
                  {language === "id" ? "Profil saya" : "My profile"}
                </button>
                <button
                  type="button"
                  className="profile-logout"
                  onClick={() => signOut({ redirectUrl: "/sign-in" })}
                >
                  <span>↪</span>
                  {language === "id" ? "Keluar" : "Log out"}
                </button>
              </div>
            )}
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
                  : active === "Upload statement"
                    ? c.uploadStatement
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
            <div className="section-toolbar transaction-toolbar">
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
              <div className="transaction-tools">
                <label className="transaction-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">
                    {language === "id"
                      ? "Cari transaksi"
                      : "Search transactions"}
                  </span>
                  <input
                    type="search"
                    value={transactionSearch}
                    onChange={(event) => setTransactionSearch(event.target.value)}
                    placeholder={
                      language === "id"
                        ? "Cari deskripsi, kategori, remarks, nominal…"
                        : "Search description, category, remarks, amount…"
                    }
                    aria-label={
                      language === "id"
                        ? "Cari deskripsi, kategori, remarks, atau nominal"
                        : "Search description, category, remarks, or amount"
                    }
                  />
                  {transactionSearch && (
                    <button
                      type="button"
                      className="clear-search"
                      aria-label={language === "id" ? "Hapus pencarian" : "Clear search"}
                      onClick={() => setTransactionSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
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
              <datalist id="category-options">
                {categoryOptions.map(([name]) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <div className="list-header">
                <strong className="list-header-activity">
                  {language === "id" ? "Aktivitas terbaru" : "Latest activity"}
                </strong>
                <span>{language === "id" ? "Kategori & remarks" : "Category & remarks"}</span>
                <span>{language === "id" ? "Nominal" : "Amount"}</span>
                <span>{language === "id" ? "Aksi" : "Actions"}</span>
              </div>
              {filteredTransactions.map((item, index) => (
                  <div
                    className="transaction-row"
                  key={item.id ?? `full-${item.title}-${index}`}
                >
                  <div className={`transaction-icon ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="transaction-info">
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                    {item.note && <small className="transaction-note">📝 {item.note}</small>}
                  </div>
                  <div className="transaction-inline-fields">
                    <label className="sr-only" htmlFor={`category-${item.id}`}>
                      Kategori
                    </label>
                    <input
                      id={`category-${item.id}`}
                      className="inline-category-input"
                      list="category-options"
                      value={item.category}
                      onChange={(event) =>
                        updateTransactionCategory(item, event.target.value)
                      }
                      aria-label={`Kategori ${item.title}`}
                    />
                    <label className="sr-only" htmlFor={`note-${item.id}`}>
                      Remarks
                    </label>
                    <input
                      id={`note-${item.id}`}
                      className="inline-note-input"
                      value={item.note ?? ""}
                      onChange={(event) =>
                        item.id &&
                        updateTransactionInline(item.id, {
                          note: event.target.value,
                        })
                      }
                      placeholder="Remarks…"
                      aria-label={`Remarks ${item.title}`}
                    />
                  </div>
                  <strong
                    className={`amount ${item.amount.startsWith("+") ? "positive" : ""}`}
                  >
                    {item.amount}
                  </strong>
                  <div className="transaction-actions">
                    <button
                      className="row-action edit-action"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => setEditingTransaction(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="row-action delete-action"
                      aria-label={`Hapus ${item.title}`}
                      onClick={() => deleteTransaction(item)}
                    >
                      <X size={14} />
                    </button>
                  </div>
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
                  {latestWallets.some((wallet) => wallet.currency === "IDR")
                    ? rupiah(idrWalletTotal)
                    : uploads.length
                      ? language === "id"
                        ? "Menunggu parsing"
                        : "Pending parsing"
                      : "—"}
                </strong>
                <small>
                  {latestWallets.length
                    ? `${latestWallets.length} ${language === "id" ? "rekening aktif" : "active accounts"}`
                    : uploads.length
                      ? `${uploads.length} ${language === "id" ? "statement tersambung" : "statement connected"}`
                      : language === "id"
                        ? "Belum ada statement yang diupload"
                        : "No statement uploaded yet"}
                </small>
              </article>
              {latestWallets.length === 0 ? (
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
                latestWallets.map((wallet, index) => (
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
                    {wallet.accountNumber && (
                      <small>Rekening · {wallet.accountNumber}</small>
                    )}
                    <b>{walletAmount(wallet.endingBalance, wallet.currency)}</b>
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
                    {mutationGroups.map((group) => (
                      <div className="mutation-account-group" key={group.accountNumber ?? group.label}>
                        <div className="mutation-account-heading">
                          <strong>{group.label}</strong>
                          <small>
                            {group.accountNumber ? `Rekening · ${group.accountNumber}` : ""}
                            {group.currency ? ` · ${group.currency}` : ""}
                          </small>
                        </div>
                        {group.items.map((item, index) => (
                          <div
                            className="mutation-row"
                            key={`wallet-mutation-${item.id ?? item.date}-${item.title}-${index}`}
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
        {active === "Upload statement" && (
          <section className="section-view upload-page">
            <div className="section-toolbar upload-page-intro">
              <p>{language === "id" ? "Upload, rapikan, dan cek hasil import statement-mu." : "Upload, tidy, and review your imported statements."}</p>
              <span className="upload-page-count">{uploads.length} {language === "id" ? "file tersimpan" : "saved files"}</span>
            </div>
            <div className="upload-page-grid">
              <section className="upload-card dedicated-upload-card">
                <div className="upload-confetti">✦</div>
                <div className="upload-title">
                  <div className="upload-illustration">🛸</div>
                  <div><h3>{c.statements} <span>♡</span></h3><p>{c.statementsSub}</p></div>
                </div>
                <div className="bank-options" aria-label="Pilih bank">
                  <p>{c.which}</p>
                  <div className="bank-select-card">
                    <span className="bank-logo">{bank === "DBS" ? "dbs" : bank.includes("BCA") ? "bca" : "bank"}</span>
                    <select className="bank-select" aria-label="Pilih bank" value={bank} onChange={(event) => setBank(event.target.value as BankKey)}>
                      {BANK_CATALOG.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </div>
                <input ref={fileRef} type="file" hidden accept=".pdf,.csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                <button className="drop-zone" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) processFile(file); }}>
                  <Upload size={20} /><strong>{c.click}</strong><span>{c.drop}</span><small>{c.formats}</small>
                </button>
                {importReport && (
                  <div className="import-progress-panel">
                    <div className="import-progress-label"><strong>{importReport.status === "complete" ? "Import selesai" : importReport.status === "error" ? "Import perlu review" : "Sedang membaca statement…"}</strong><span>{importReport.progress}%</span></div>
                    <div className="import-progress-track"><span style={{ width: `${importReport.progress}%` }} /></div>
                    <div className="import-stat-grid"><div><strong>{importReport.totalRows}</strong><small>Total baris</small></div><div className="success"><strong>{importReport.successRows}</strong><small>Berhasil</small></div><div className="failed"><strong>{importReport.failedRows}</strong><small>Gagal</small></div></div>
                    {importReport.failures.length > 0 && <ul className="import-error-list">{importReport.failures.slice(0, 3).map((failure, index) => <li key={`${failure}-${index}`}>{failure}</li>)}</ul>}
                  </div>
                )}
              </section>
              <section className="content-card import-history-card">
                <div className="card-heading"><div><h3>{c.uploaded} <span>🗂️</span></h3><p>{language === "id" ? "Semua percobaan upload tersimpan di sini." : "Every upload attempt is saved here."}</p></div><strong>{uploads.length}</strong></div>
                {uploads.length === 0 ? <div className="overview-empty-state"><span>📂</span><strong>{language === "id" ? "Belum ada statement" : "No statements yet"}</strong><small>{language === "id" ? "Upload file pertamamu untuk mulai." : "Upload your first file to begin."}</small></div> : <div className="upload-history full-history">{uploads.map((file) => <div className="file-row" key={file.id}><FileText size={16} /><div><strong>{file.name}</strong><small>{file.bank} · {file.size} · {file.parsedRows} berhasil{file.warningCount ? " · review" : ""}</small>{file.statementPeriod && <small>Periode statement: {file.statementPeriod}</small>}</div><span className={`file-check ${file.status === "Menunggu" ? "file-failed" : ""}`}>{file.status === "Menunggu" ? <X size={13} /> : <Check size={13} />}</span></div>)}</div>}
              </section>
            </div>
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
                  {latestWallets.some((wallet) => wallet.currency === "IDR")
                    ? rupiah(idrWalletTotal)
                    : "—"}
                </div>
                <div className="stat-change">
                  {latestWallets.length
                    ? language === "id"
                      ? "Saldo terbaca dari statement"
                      : "Balance parsed from statement"
                    : language === "id"
                      ? "Belum ada saldo statement"
                      : "No statement balance yet"}
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
                <div className="stat-value">
                  {filteredImportedTransactions.length
                    ? rupiah(spendTotal)
                    : "—"}
                </div>
                <div className="stat-change down">
                  {filteredImportedTransactions.length}{" "}
                  {language === "id" ? "transaksi nyata" : "real transactions"}
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
              <div className="budget-empty-state">
                <div className="budget-icon">🧸</div>
                <div>
                  <strong>
                    {language === "id"
                      ? "Belum ada budget tersimpan"
                      : "No saved budget yet"}
                  </strong>
                  <small>
                    {language === "id"
                      ? "Tambahkan budget setelah data asli masuk."
                      : "Add a budget after your real data is imported."}
                  </small>
                </div>
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
                {filteredImportedTransactions.slice(0, 4).map((item, index) => (
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
                {filteredImportedTransactions.length === 0 && (
                  <div className="overview-empty-state">
                    <span>🧾</span>
                    <strong>
                      {language === "id"
                        ? "Belum ada transaksi nyata"
                        : "No real transactions yet"}
                    </strong>
                    <small>
                      {language === "id"
                        ? "Upload statement untuk mulai melihat pergerakan uangmu."
                        : "Upload a statement to start seeing your money movement."}
                    </small>
                  </div>
                )}
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
              {categorySummary.length ? (
                categorySummary.map(([category, count]) => (
                  <div className="tag-rule" key={category}>
                    <span>🏷️</span>
                    <div>
                      <strong>{category}</strong>
                      <small>
                        {language === "id"
                          ? "Dari transaksi statement"
                          : "From statement transactions"}
                      </small>
                    </div>
                    <b>{count}</b>
                  </div>
                ))
              ) : (
                <div className="tag-empty-state">
                  <span>🏷️</span>
                  <strong>
                    {language === "id"
                      ? "Belum ada kategori nyata"
                      : "No real categories yet"}
                  </strong>
                  <small>
                    {language === "id"
                      ? "Kategori akan muncul setelah statement diproses."
                      : "Categories appear after a statement is processed."}
                  </small>
                </div>
              )}
              <button
                className="manage-tags"
                onClick={() =>
                  setToast(
                    language === "id"
                      ? "Aturan tag siap diatur setelah transaksi nyata masuk"
                      : "Tag rules can be managed after real transactions are imported",
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
      {editingTransaction && (
        <div className="edit-backdrop" role="presentation" onClick={() => setEditingTransaction(null)}>
          <form
            className="edit-transaction-card"
            onSubmit={(event) => {
              event.preventDefault();
              saveEditedTransaction();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="edit-card-heading">
              <div>
                <span className="eyebrow">Pocketpals</span>
                <h2>Edit transaksi ✨</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditingTransaction(null)} aria-label="Tutup editor"><X size={18} /></button>
            </div>
            <label>Nama / keterangan transaksi<input value={editingTransaction.title} onChange={(event) => setEditingTransaction({ ...editingTransaction, title: event.target.value })} /></label>
            <div className="edit-field-grid">
              <label>Tanggal<input value={editingTransaction.date ?? ""} onChange={(event) => setEditingTransaction({ ...editingTransaction, date: event.target.value })} placeholder="DD/MM/YYYY" /></label>
              <label>Nominal<input type="number" min="0" value={editingTransaction.amountValue} onChange={(event) => setEditingTransaction({ ...editingTransaction, amountValue: Number(event.target.value) || 0 })} /></label>
            </div>
            <div className="edit-field-grid">
              <label>Kategori<select value={editingTransaction.category} onChange={(event) => { const selected = categoryOptions.find(([name]) => name === event.target.value) ?? categoryOptions[6]; setEditingTransaction({ ...editingTransaction, category: selected[0], color: selected[1], icon: selected[2] }); }}>
                {categoryOptions.map(([name]) => <option key={name} value={name}>{name}</option>)}
              </select></label>
              <label>Jenis<select value={editingTransaction.direction} onChange={(event) => setEditingTransaction({ ...editingTransaction, direction: event.target.value as "credit" | "debit" })}><option value="debit">Pengeluaran</option><option value="credit">Pemasukan</option></select></label>
            </div>
            <label>Catatan pribadi<textarea value={editingTransaction.note ?? ""} onChange={(event) => setEditingTransaction({ ...editingTransaction, note: event.target.value })} placeholder="Contoh: reimbursement kantor, langganan, atau keperluan lain…" /></label>
            <div className="edit-card-actions"><button type="button" className="secondary-button" onClick={() => setEditingTransaction(null)}>Batal</button><button type="submit" className="primary-button">Simpan perubahan</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
