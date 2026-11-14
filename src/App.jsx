
import React, { useEffect, useRef, useState } from "react";
import { cases } from "./data/cases.js";
import { supabase } from "./supabase.js";
import { getUpgradeSectorCenter, normalizeUpgradeChance } from "./utils/upgradeWheel.js";

// Human-readable case titles. Backend identifiers intentionally stay unchanged.
const CASE_DISPLAY_NAMES = {
  "Truckini Case": "Frostbite Case",
  "Summer Case": "Aurora Case",
  "Bloody Case": "Crimson Blizzard",
  "Crafting Case": "Iceforge Case",
  "Legend Case": "Glacial Legend",
  "Elite Case": "Arctic Elite",
  "All In Strawberry Elephant": "All In Strawberry Elephant",
  "All In Headless Horseman": "All In Headless Horseman",
};
function displayCaseName(value) {
  const key = String(value || "");
  return CASE_DISPLAY_NAMES[key] || key || "Кейс";
}

// Official/game-style reference artwork for the named Steal a Brainrot characters.
const BRAINROT_ART = [
  { match: ["skibidi toilet"], image: "https://img.g4mmo.com/images/class/steal%20a%20brainrot%20Skibidi%20Toilet-095404.png" },
  { match: ["john pork"], image: "https://nmomkdgujymyytwdbgsf.supabase.co/storage/v1/object/public/brainrot-assets/images/0.37983365394187085.webp" },
  { match: ["headless horseman"], image: "https://www.bloxah.com/uploads/images/goods/steal-a-brainrot/all-server-headless-horseman.png?v=1" },
  { match: ["meowl"], image: "https://gamebox.biz/wp-content/uploads/2025/10/meowl-myaovl-v-ukradi-breynrot-steal-a-brainrot-kak-poluchit-i-ego-harakteristiki.webp" },
  { match: ["strawberry elephant"], image: "https://sabapi.voxelvalues.com/uploads/compressed_1758353786097_52w553.png" },
  { match: ["dragon cannelloni", "dragon canneloni"], image: "https://bloxskins.com/cdn/shop/files/New_Dragon_Canneloni.png?v=1774435470" },
  { match: ["la grande combinasion"], image: "https://cdn.shopify.com/s/files/1/0815/2068/9482/files/2E5Nv3x.png?v=1754504186" },
];

function brainrotImage(item) {
  const supplied = item?.image || item?.image_url || item?.photo_url || item?.avatar_url;
  if (supplied) return supplied;
  const name = String(item?.item_name || item?.name || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return BRAINROT_ART.find((entry) => entry.match.some((key) => name.includes(key)))?.image || "";
}

function caseImageSrc(item, fallback = false) {
  const filename = String(item?.image || "").split("/").pop();
  if (!filename) return "";
  const stem = filename.replace(/\.(webp|png|jpe?g|svg)$/i, "");
  const asset = fallback ? `${stem.replace(/-arctic$/, "")}-arctic.svg` : filename;
  return `${import.meta.env.BASE_URL}cases/${asset}`;
}

function CaseArtwork({ item, className = "", alt }) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const primary = caseImageSrc(item);
  const fallback = caseImageSrc(item, true);
  return (
    <div className={`${className} case-artwork ${failed && fallbackFailed ? "case-artwork-missing" : ""}`}>
      {!fallbackFailed ? (
        <img
          src={failed ? fallback : primary}
          alt={alt || item?.name || "Изображение кейса"}
          loading="eager"
          decoding="async"
          onError={() => {
            if (!failed && fallback && fallback !== primary) setFailed(true);
            else setFallbackFailed(true);
          }}
        />
      ) : (
        <span className="case-artwork-placeholder">Изображение кейса</span>
      )}
    </div>
  );
}

function calculateUpgradeChance(source, target, luckMultiplier = 1) {
  const sourcePrice = Number(source?.value_gg);
  const targetPrice = Number(target?.value_gg);

  if (
    !Number.isFinite(sourcePrice) ||
    !Number.isFinite(targetPrice) ||
    sourcePrice <= 0 ||
    targetPrice <= 0
  ) {
    return 0;
  }

  return Math.min(
    90,
    Math.max(0.1, (sourcePrice / targetPrice) * 100 * Math.max(1, Number(luckMultiplier) || 1))
  );
}

export default function App() {
  const [page, setPage] = useState("Главная");
  const [openCount, setOpenCount] = useState(1);
  const [fastOpen, setFastOpen] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [authError, setAuthError] = useState("");
  const [lastRewards, setLastRewards] = useState([]);
  // Live Drops показывает только награды, подтверждённые сервером в этой сессии.
  const [liveDrops, setLiveDrops] = useState([]);
  const [reelItems, setReelItems] = useState([]);
  const [reelPosition, setReelPosition] = useState(0);
  const [reelWinnerIndex, setReelWinnerIndex] = useState(-1);
  const [reelRows, setReelRows] = useState([]);
  const [rareDropIndex, setRareDropIndex] = useState(-1);
  const [skipAvailable, setSkipAvailable] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardInventoryRows, setRewardInventoryRows] = useState([]);
  const skipRequestedRef = useRef(false);
  const audioContextRef = useRef(null);
  const musicTimerRef = useRef(null);
  const eventMusicTimerRef = useRef(null);
  const eventAudioRef = useRef(null);
  const caseRewardsRequestRef = useRef(0);
  const winterMusicWasEnabledRef = useRef(false);
  const eventWasActiveRef = useRef(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicNotice, setMusicNotice] = useState("");

  const [globalEvent, setGlobalEvent] = useState(null);
  const [globalMessage, setGlobalMessage] = useState(null);
  const [eventClock, setEventClock] = useState(Date.now());
  const [caseRewards, setCaseRewards] = useState([]);
  const [caseRewardsFor, setCaseRewardsFor] = useState("");
  const [caseRewardsLoading, setCaseRewardsLoading] = useState(false);
  const [mobileUpgradeList, setMobileUpgradeList] = useState("source");

  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryRarity, setInventoryRarity] = useState("Все");
  const [inventorySort, setInventorySort] = useState("newest");

  const [upgradeTargets, setUpgradeTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [targetItem, setTargetItem] = useState("");
  const [upgradeChance, setUpgradeChance] = useState(50);
  const [upgradeResult, setUpgradeResult] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeRotation, setUpgradeRotation] = useState(0);
  const [upgradeWheelAnimating, setUpgradeWheelAnimating] = useState(false);
  const [upgradeVisualChance, setUpgradeVisualChance] = useState(null);

  const [sellingId, setSellingId] = useState(null);
  const [sellingAll, setSellingAll] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const pages = ["Главная", "Кейсы", "Апгрейдер", "Инвентарь", "Рейтинг", "Задания", "Викторина", "Профиль"];
  const [customError, setCustomError] = useState("");

  // Состояние защищённой админ-панели BrainGG
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [globalMessageDraft, setGlobalMessageDraft] = useState("");
  const [globalMessageSending, setGlobalMessageSending] = useState(false);
  const [adminEventLoading, setAdminEventLoading] = useState(false);
  const [adminEventFeedback, setAdminEventFeedback] = useState("");
  const [adminEventFeedbackError, setAdminEventFeedbackError] = useState(false);
  const visiblePages = isAdmin ? [...pages, "Админка"] : pages;
  const [adminGameId, setAdminGameId] = useState("");
  const [adminPlayer, setAdminPlayer] = useState(null);
  const [adminInventory, setAdminInventory] = useState([]);
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);
  const [adminGrantType, setAdminGrantType] = useState("coins");
  const [adminAmount, setAdminAmount] = useState("100");
  const [adminItemName, setAdminItemName] = useState("");
  const [adminCaseName, setAdminCaseName] = useState("Truckini Case");
  const [adminGrantLoading, setAdminGrantLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminMessageError, setAdminMessageError] = useState(false);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminLogsLoading, setAdminLogsLoading] = useState(false);
  const [adminSection, setAdminSection] = useState("overview");
  const [adminLogQuery, setAdminLogQuery] = useState("");
  const [adminLogAction, setAdminLogAction] = useState("all");
  const [gameHub, setGameHub] = useState({ progress: null, tasks: [], leaderboard: [], liveDrops: [], dailyClaimed: false });
  const [hubLoading, setHubLoading] = useState(false);
  const [dailyClaimLoading, setDailyClaimLoading] = useState(false);
  const [taskClaimLoading, setTaskClaimLoading] = useState("");
  const [hubMessage, setHubMessage] = useState("");
  const [quizStatus, setQuizStatus] = useState({ used: 0, remaining: 3, correct: 0 });
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [adminGameStats, setAdminGameStats] = useState(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupStars, setTopupStars] = useState(100);
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupMessage, setTopupMessage] = useState("");

  const initData = () => window.Telegram?.WebApp?.initData;
  const telegramIdentity = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
  const greetingLabel = telegramIdentity.username
    ? `@${telegramIdentity.username}`
    : (telegramIdentity.first_name || player?.username || "друг");

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    try {
      tg.ready?.();
      tg.expand?.();
      tg.setHeaderColor?.("#071827");
      tg.setBackgroundColor?.("#071827");
    } catch (error) {
      console.warn("Telegram WebApp viewport setup failed:", error);
    }
  }, []);

  function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    if (audioContextRef.current.state === "suspended") audioContextRef.current.resume();
    return audioContextRef.current;
  }

  function playUiSound(kind = "tab") {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const presets = {
      tab: [660, 880, 0.055], spin: [220, 330, 0.16], reveal: [660, 990, 0.2], rare: [523, 784, 1175],
      upgrade: [330, 494, 0.14], win: [659, 880, 1318], lose: [260, 196, 0.16],
    };
    const values = presets[kind] || presets.tab;
    values.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = kind === "spin" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.075);
      gain.gain.setValueAtTime(0.0001, now + index * 0.075);
      gain.gain.exponentialRampToValueAtTime(kind === "rare" ? 0.075 : 0.035, now + index * 0.075 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.075 + (kind === "spin" ? 0.32 : 0.42));
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(now + index * 0.075); oscillator.stop(now + index * 0.075 + 0.45);
    });
  }

  function stopWinterMusic() {
    if (musicTimerRef.current) window.clearInterval(musicTimerRef.current);
    musicTimerRef.current = null;
  }

  function stopEventMusic() {
    if (eventMusicTimerRef.current) window.clearInterval(eventMusicTimerRef.current);
    eventMusicTimerRef.current = null;
    if (eventAudioRef.current) {
      eventAudioRef.current.pause();
      eventAudioRef.current.currentTime = 0;
      eventAudioRef.current = null;
    }
  }

  function startWinterMusic() {
    stopEventMusic();
    stopWinterMusic();
    const ctx = getAudioContext();
    if (!ctx) return;
    const bars = [
      { chord: [196.00, 246.94, 293.66], bass: 98.00, bells: [783.99, 659.25, 587.33, 659.25] },
      { chord: [174.61, 220.00, 261.63], bass: 87.31, bells: [698.46, 587.33, 523.25, 587.33] },
      { chord: [146.83, 185.00, 220.00], bass: 73.42, bells: [587.33, 659.25, 698.46, 659.25] },
      { chord: [164.81, 207.65, 246.94], bass: 82.41, bells: [659.25, 783.99, 880.00, 783.99] },
    ];
    let barIndex = 0;
    const playTone = (frequency, when, duration, volume, type = "sine", attack = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = type === "triangle" ? 1500 : 2600;
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.connect(lowpass); lowpass.connect(gain); gain.connect(ctx.destination);
      osc.start(when); osc.stop(when + duration + 0.04);
    };
    const playBar = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime + 0.04;
      const bar = bars[barIndex % bars.length];
      bar.chord.forEach((frequency, index) => playTone(frequency, now, 3.7, 0.0065, "sine", 0.7 + index * 0.08));
      playTone(bar.bass, now, 2.8, 0.009, "sine", 0.45);
      bar.bells.forEach((frequency, index) => {
        const at = now + index * 0.82;
        playTone(frequency, at, 1.05, 0.012, "sine", 0.025);
        playTone(frequency * 2, at + 0.015, 0.62, 0.0028, "sine", 0.02);
      });
      barIndex += 1;
    };
    ctx.resume().then(playBar).catch(() => setMusicNotice("Нажми кнопку музыки, чтобы разрешить воспроизведение."));
    musicTimerRef.current = window.setInterval(playBar, 3300);
  }

  function startEventMusic(eventName) {
    stopWinterMusic();
    stopEventMusic();
    setMusicNotice("");

    if (eventName === "tacos") {
      // A licensed copy of the requested recording can be added at this public asset path.
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/its-raining-tacos.mp3`);
      audio.loop = true;
      audio.volume = 0.48;
      audio.addEventListener("error", () => {
        setMusicNotice("Добавь лицензированный трек в public/audio/its-raining-tacos.mp3, чтобы включить оригинальную песню.");
      }, { once: true });
      eventAudioRef.current = audio;
      audio.play().then(() => setMusicNotice("")).catch(() => {
        setMusicNotice("Если музыка не запустилась, нажми «♫ Музыка». Для оригинальной песни нужен файл public/audio/its-raining-tacos.mp3.");
      });
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) return;
    const tracks = {
      lucky: {
        notes: [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.00, 698.46, 523.25, 659.25, 783.99, 1046.5],
        bass: [130.81, 164.81, 196.00, 164.81], stepMs: 330, volume: 0.022, bassVolume: 0.009, wave: "triangle",
      },
      strawberry: {
        notes: [392.00, 493.88, 587.33, 493.88, 440.00, 523.25, 587.33, 440.00],
        bass: [98.00, 123.47, 146.83, 123.47], stepMs: 560, volume: 0.009, bassVolume: 0.004, wave: "sine",
      },
    };
    const track = tracks[eventName];
    if (!track) return;
    let step = 0;
    const playTone = (frequency, when, duration, volume, wave) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = eventName === "strawberry" ? 1150 : 2200;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.00015, volume), when + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      oscillator.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      oscillator.start(when); oscillator.stop(when + duration + 0.025);
    };
    const playStep = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime + 0.02;
      const note = track.notes[step % track.notes.length];
      playTone(note, now, eventName === "strawberry" ? 0.48 : 0.26, track.volume, track.wave);
      if (step % 2 === 0) playTone(note * 2, now + 0.018, eventName === "strawberry" ? 0.28 : 0.16, track.volume * 0.22, "sine");
      if (step % 3 === 0) playTone(track.bass[Math.floor(step / 3) % track.bass.length], now, 0.55, track.bassVolume, "sine");
      step += 1;
    };
    ctx.resume().then(playStep).catch(() => setMusicNotice("Нажми кнопку музыки, чтобы разрешить воспроизведение."));
    eventMusicTimerRef.current = window.setInterval(playStep, track.stepMs);
  }

  function toggleWinterMusic() {
    const next = !musicEnabled;
    setMusicEnabled(next);
    if (!next) {
      if (globalEvent?.event_name) winterMusicWasEnabledRef.current = false;
      stopWinterMusic();
      stopEventMusic();
      setMusicNotice("");
      return;
    }
    if (globalEvent?.event_name) startEventMusic(globalEvent.event_name);
    else startWinterMusic();
  }

  useEffect(() => () => {
    stopWinterMusic();
    stopEventMusic();
  }, []);


  async function startStarsTopup() {
    if (topupBusy) return;
    if (!initData()) { setTopupMessage("Открой BrainGG через Telegram, чтобы оплатить Stars."); return; }
    const stars = Number(topupStars);
    if (!Number.isSafeInteger(stars) || stars < 25 || stars > 10000) { setTopupMessage("Укажи от 25 до 10000 Stars."); return; }
    setTopupBusy(true); setTopupMessage("Создаём счёт Telegram Stars...");
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", { body: { initData: initData(), action: "create_stars_invoice", stars } });
      if (error || !data?.success || !data.invoiceUrl) throw new Error(data?.error || error?.message || "Не удалось создать счёт");
      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        tg?.openLink?.(data.invoiceUrl);
        setTopupMessage("Счёт открыт. После оплаты вернись в BrainGG — баланс обновится автоматически.");
      } else {
        tg.openInvoice(data.invoiceUrl, async (status) => {
          if (status === "paid") {
            setTopupMessage("Оплата принята Telegram. Проверяем зачисление GG...");
            for (let attempt = 0; attempt < 10; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 1200));
              const checked = await supabase.functions.invoke("braingg-api", { body: { initData: initData(), action: "check_stars_payment", orderId: data.orderId } });
              if (checked.data?.status === "paid") {
                setPlayer(current => current ? { ...current, balance: checked.data.balance } : current);
                setTopupMessage(`Успешно! Начислено ${Number(data.gg).toLocaleString("ru-RU")} GG.`);
                return;
              }
            }
            setTopupMessage("Платёж получен. Зачисление обрабатывается — обнови баланс через несколько секунд.");
          } else if (status === "cancelled") setTopupMessage("Оплата отменена. Деньги не списаны.");
          else if (status === "failed") setTopupMessage("Telegram не смог обработать платёж. Попробуй ещё раз.");
        });
      }
    } catch (error) { console.error("Stars top-up error:", error); setTopupMessage(error?.message || "Не удалось создать платёж."); }
    finally { setTopupBusy(false); }
  }

  // Перехватываем стандартные браузерные alert(), чтобы они не показывались
  // поверх приложения в системном стиле WebView.
  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message) => {
      const raw = String(message || "").toLowerCase();
      let friendly = "Не удалось выполнить действие. Попробуй ещё раз.";

      if (
        raw.includes("insufficient") ||
        raw.includes("not enough") ||
        raw.includes("balance")
      ) {
        friendly = "Недостаточно средств для этого действия.";
      } else if (
        raw.includes("telegram") ||
        raw.includes("auth")
      ) {
        friendly = "Не удалось подтвердить профиль. Перезапусти BrainGG через Telegram.";
      }

      setCustomError(friendly);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  async function friendlyActionError(error, data, fallback) {
    let message =
      data?.error ||
      data?.result?.error ||
      error?.message ||
      fallback;

    if (error?.context) {
      try {
        const response = error.context.clone();
        const body = await response.json();
        message = body?.error || body?.message || message;
      } catch {
        // Используем уже полученное сообщение.
      }
    }

    const normalized = String(message || "").toLowerCase();

    if (
      normalized.includes("insufficient") ||
      normalized.includes("not enough") ||
      normalized.includes("недостаточно") ||
      normalized.includes("balance")
    ) {
      return "Недостаточно средств";
    }

    if (
      normalized.includes("telegram") ||
      normalized.includes("authentication") ||
      normalized.includes("auth")
    ) {
      return "Открой BrainGG через Telegram";
    }

    if (
      normalized.includes("inventory") ||
      normalized.includes("not found")
    ) {
      return "Предмет не найден. Обнови инвентарь и попробуй ещё раз.";
    }

    // Не показываем игрокам технические ответы базы данных и сервера.
    if (
      normalized.includes("postgres") ||
      normalized.includes("sql") ||
      normalized.includes("rpc") ||
      normalized.includes("function") ||
      normalized.includes("invalid input") ||
      normalized.includes("internal server")
    ) {
      return fallback;
    }

    return message || fallback;
  }

  const rarityColors = {
    "Обычный": "#a5a5b5",
    "Редкий": "#43a5ff",
    "Эпический": "#bd65ff",
    "Легендарный": "#ffbd45",
    "Мифический": "#ff5c9d",
    "OG": "#ffe27a",
  };

  useEffect(() => {
    async function registerPlayer() {
      if (!initData()) {
        setAuthError("Открой BrainGG через Telegram");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "braingg-api",
          { body: { initData: initData() } }
        );

        if (error) throw error;

        if (!data?.success || !data?.player) {
          throw new Error(data?.error || "Не удалось загрузить игрока");
        }

        setPlayer(data.player);
        // Игровой прогресс загружается отдельно, чтобы не затрагивать старую таблицу players.
        loadGameHub();

        // Сервер сам проверяет Telegram ID в ADMIN_TELEGRAM_IDS и отдельно подтверждает владельца.
        // Наличие вкладки в интерфейсе не даёт права выполнять админ-действия.
        try {
          const { data: adminData, error: adminError } =
            await supabase.functions.invoke("braingg-api", {
              body: {
                initData: initData(),
                action: "admin_get_logs",
              },
            });

          if (!adminError && adminData?.success) {
            setIsAdmin(true);
            setIsOwner(Boolean(adminData.isOwner));
            setAdminLogs(adminData.logs || []);
            loadAdminGameStats();
          }
        } catch (adminCheckError) {
          console.info("Админ-доступ не активирован для этого аккаунта.");
        }
      } catch (error) {
        console.error("Ошибка регистрации:", error);
        setAuthError("Не удалось подключиться к серверу");
      } finally {
        setLoading(false);
      }
    }

    registerPlayer();
  }, []);

  async function loadGameHub() {
    if (!initData()) return;
    setHubLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "get_game_hub" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось загрузить игровой центр");
      setGameHub(data);
      setLiveDrops(data.liveDrops || []);
    } catch (error) {
      console.error("Game hub loading failed:", error);
      setHubMessage("Игровой центр пока недоступен. Проверь миграцию Season 2 в Supabase.");
    } finally { setHubLoading(false); }
  }

  async function loadQuizStatus() {
    if (!initData()) return;
    const { data, error } = await supabase.functions.invoke("braingg-api", {
      body: { initData: initData(), action: "get_quiz_status" },
    });
    if (error || !data?.success) throw new Error(data?.error || "Не удалось загрузить викторину");
    setQuizStatus(data.status);
    return data.status;
  }

  async function startQuizQuestion() {
    if (quizLoading) return;
    setQuizLoading(true); setQuizFeedback(""); setQuizSelected(null); setQuizAnswered(false);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "get_quiz_question" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось загрузить вопрос");
      setQuizQuestion(data.question || null);
      if (!data.question) setQuizFeedback("На сегодня вопросы закончились. Загляни завтра!");
      if (data.status) setQuizStatus(data.status);
    } catch (error) { setQuizFeedback(error.message || "Викторина временно недоступна."); }
    finally { setQuizLoading(false); }
  }

  async function submitQuizAnswer() {
    if (quizLoading || quizAnswered || quizSelected === null || !quizQuestion) return;
    setQuizLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "submit_quiz_answer", questionId: quizQuestion.id, optionIndex: quizSelected },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось проверить ответ");
      setQuizAnswered(true);
      setQuizStatus(data.status);
      setQuizFeedback(data.correct ? `Верно! +${data.reward_gg} GG 🎉` : `Неверно. Правильный ответ: ${data.correct_answer}`);
      if (data.balance !== undefined) setPlayer(current => current ? { ...current, balance: data.balance } : current);
      setQuizQuestion(current => current ? { ...current, explanation: data.explanation || "", correctIndex: data.correct_index } : current);
    } catch (error) { setQuizFeedback(error.message || "Не удалось проверить ответ."); }
    finally { setQuizLoading(false); }
  }

  async function claimDailyReward() {
    if (dailyClaimLoading || gameHub.dailyClaimed) return;
    setDailyClaimLoading(true); setHubMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "claim_daily_reward" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось получить награду");
      if (data.result?.already_claimed) setHubMessage("Сегодняшняя награда уже получена.");
      else {
        setPlayer((current) => current ? { ...current, balance: data.balance ?? current.balance } : current);
        setHubMessage(`Получено ${data.result.reward_gg} GG и ${data.result.reward_xp} XP!`);
      }
      await loadGameHub();
    } catch (error) { setHubMessage(await friendlyActionError(error, null, "Не удалось получить ежедневную награду.")); }
    finally { setDailyClaimLoading(false); }
  }

  async function claimTaskReward(taskId) {
    if (taskClaimLoading) return;
    setTaskClaimLoading(taskId); setHubMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "claim_task_reward", taskId },
      });
      if (error) throw error;
      if (!data?.success || data.result?.success === false) throw new Error(data?.result?.error || data?.error || "Задание пока не выполнено");
      setPlayer((current) => current ? { ...current, balance: data.balance ?? current.balance } : current);
      setHubMessage(`Награда получена: ${data.result.reward_gg} GG и ${data.result.reward_xp} XP!`);
      await loadGameHub();
    } catch (error) { setHubMessage(await friendlyActionError(error, null, "Пока нельзя забрать эту награду.")); }
    finally { setTaskClaimLoading(""); }
  }

  async function loadAdminGameStats() {
    const { data, error } = await supabase.functions.invoke("braingg-api", { body: { initData: initData(), action: "admin_get_game_stats" } });
    if (!error && data?.success) setAdminGameStats(data.stats);
  }

  useEffect(() => {
    if (!player?.telegram_id) return undefined;
    let mounted = true;
    const channel = supabase.channel("braingg-global-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_global_state", filter: "id=eq.1" }, (payload) => {
        if (!mounted) return;
        const nextEvent = payload.new;
        const active = nextEvent?.event_name && nextEvent?.event_ends_at && Date.parse(nextEvent.event_ends_at) > Date.now();
        setGlobalEvent(active ? nextEvent : null);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_global_messages" }, (payload) => {
        if (mounted && payload.new?.message) setGlobalMessage(payload.new);
      })
      .subscribe();
    loadGlobalState().catch((error) => console.warn("Global BrainGG state unavailable:", error));
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [player?.telegram_id]);

  useEffect(() => {
    if (!globalEvent?.event_ends_at) return undefined;
    const remaining = Math.max(0, Date.parse(globalEvent.event_ends_at) - Date.now());
    const timer = window.setTimeout(() => setGlobalEvent(null), remaining);
    return () => window.clearTimeout(timer);
  }, [globalEvent?.event_ends_at]);

  useEffect(() => {
    if (!globalEvent?.event_name) return undefined;
    const timer = window.setInterval(() => setEventClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [globalEvent?.event_name]);

  useEffect(() => {
    if (!globalMessage?.id) return undefined;
    const timer = window.setTimeout(() => setGlobalMessage(null), 12000);
    return () => window.clearTimeout(timer);
  }, [globalMessage?.id]);

  useEffect(() => {
    const eventName = globalEvent?.event_name || "";
    if (eventName) {
      if (!eventWasActiveRef.current) winterMusicWasEnabledRef.current = musicEnabled;
      eventWasActiveRef.current = true;
      setMusicEnabled(true);
      startEventMusic(eventName);
    } else if (eventWasActiveRef.current) {
      stopEventMusic();
      eventWasActiveRef.current = false;
      const resumeWinter = winterMusicWasEnabledRef.current;
      setMusicEnabled(resumeWinter);
      if (resumeWinter) startWinterMusic();
      else stopWinterMusic();
    }
  }, [globalEvent?.event_name]);

  useEffect(() => {
    const eventName = globalEvent?.event_name || "";
    const colors = { tacos: "#3b1b0c", lucky: "#102a16", strawberry: "#3b1020" };
    if (eventName) {
      document.body.dataset.brainggEvent = eventName;
      try { window.Telegram?.WebApp?.setBackgroundColor?.(colors[eventName]); } catch { /* Telegram theme is optional. */ }
    } else {
      delete document.body.dataset.brainggEvent;
      try { window.Telegram?.WebApp?.setBackgroundColor?.("#071827"); } catch { /* Telegram theme is optional. */ }
    }
    return () => { delete document.body.dataset.brainggEvent; };
  }, [globalEvent?.event_name]);

  useEffect(() => {
    if (selectedCase?.caseName) loadCaseRewards(selectedCase.caseName);
  }, [globalEvent?.event_name, selectedCase?.caseName]);

  useEffect(() => {
    if (!player?.telegram_id) return undefined;
    const timer = window.setInterval(() => { loadGameHub(); }, 20000);
    return () => window.clearInterval(timer);
  }, [player?.telegram_id]);

  async function loadGlobalState() {
    const { data, error } = await supabase.functions.invoke("braingg-api", {
      body: { initData: initData(), action: "get_global_state" },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Не удалось загрузить состояние событий");
    setGlobalEvent(data.event || null);
    return data.event || null;
  }

  async function loadCaseRewards(caseName) {
    if (!caseName) return [];
    const requestId = ++caseRewardsRequestRef.current;
    setCaseRewardsLoading(true);
    setCaseRewardsFor(caseName);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "get_case_rewards", caseName },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось загрузить награды кейса");
      if (requestId !== caseRewardsRequestRef.current) return [];
      setCaseRewards(data.items || []);
      return data.items || [];
    } catch (error) {
      console.error("Case reward pool loading failed:", error);
      if (requestId === caseRewardsRequestRef.current) {
        setCaseRewards([]);
        setActionMessage(error?.message || "Не удалось загрузить содержимое кейса.");
      }
      return [];
    } finally {
      if (requestId === caseRewardsRequestRef.current) setCaseRewardsLoading(false);
    }
  }

  async function sendGlobalMessage(event) {
    event?.preventDefault();
    if (!isOwner) return;
    const message = globalMessageDraft.trim();
    if (!message) {
      setAdminMessage("Напиши текст глобального сообщения.");
      setAdminMessageError(true);
      return;
    }
    setGlobalMessageSending(true);
    setAdminMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "admin_send_global_message", message },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось отправить сообщение");
      setGlobalMessageDraft("");
      setGlobalMessage(data.message || null);
      setAdminMessage("Глобальное сообщение отправлено всем игрокам онлайн.");
      setAdminMessageError(false);
    } catch (error) {
      setAdminMessage(error?.message || "Не удалось отправить глобальное сообщение.");
      setAdminMessageError(true);
    } finally {
      setGlobalMessageSending(false);
    }
  }

  async function toggleAdminEvent(eventName) {
    if (!isOwner || adminEventLoading) return;
    setAdminEventLoading(true);
    setAdminEventFeedback("");
    setAdminEventFeedbackError(false);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "admin_set_event", eventName },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось изменить ивент");
      setGlobalEvent(data.event || null);
      setAdminEventFeedback(data.event
        ? "Ивент запущен. Он автоматически завершится через 2:59."
        : "Ивент остановлен. Оформление и бонусы возвращены к обычным.");
      setAdminEventFeedbackError(false);
    } catch (error) {
      setAdminEventFeedback(error?.message || "Не удалось изменить ивент.");
      setAdminEventFeedbackError(true);
    } finally {
      setAdminEventLoading(false);
    }
  }

  async function loadInventory() {
    setInventoryLoading(true);
    setInventoryError("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "get_inventory",
          },
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Не удалось загрузить инвентарь");
      }

      setInventory(data.items || []);
      return data.items || [];
    } catch (error) {
      console.error("Ошибка инвентаря:", error);
      setInventoryError(
        "Не удалось загрузить инвентарь. Попробуй ещё раз."
      );
      return [];
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadUpgradeTargets() {
    setTargetsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "get_upgrade_targets",
          },
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Не удалось загрузить цели");
      }

      const uniqueTargets = new Map();
      for (const item of data.items || []) {
        const key = String(item.item_name || "").trim();
        if (!key) continue;
        const existing = uniqueTargets.get(key);
        if (!existing || Number(item.value_gg || 0) > Number(existing.value_gg || 0)) uniqueTargets.set(key, item);
      }
      setUpgradeTargets([...uniqueTargets.values()].sort((a, b) => Number(a.value_gg || 0) - Number(b.value_gg || 0)));
    } catch (error) {
      console.error("Ошибка загрузки целей:", error);
      setActionMessage("Не удалось загрузить список целей апгрейда.");
    } finally {
      setTargetsLoading(false);
    }
  }

  async function loadAdminLogs() {
    if (!isAdmin) return;
    setAdminLogsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "admin_get_logs",
          },
        }
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Не удалось загрузить историю");
      }

      setAdminLogs(data.logs || []);
      setIsOwner(Boolean(data.isOwner));
    } catch (error) {
      console.error("Ошибка истории админки:", error);
      setAdminMessage("Не удалось загрузить историю выдач.");
      setAdminMessageError(true);
    } finally {
      setAdminLogsLoading(false);
    }
  }

  async function searchAdminPlayer(event) {
    event?.preventDefault();
    const gameId = adminGameId.trim();

    if (!gameId) {
      setAdminMessage("Введи игровой ID игрока.");
      setAdminMessageError(true);
      return;
    }

    setAdminSearchLoading(true);
    setAdminMessage("");
    setAdminMessageError(false);
    setAdminPlayer(null);
    setAdminInventory([]);

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "admin_find_player",
            gameId,
          },
        }
      );

      if (error) throw error;
      if (!data?.success || !data?.player) {
        throw new Error(data?.error || "Игрок с таким Game ID не найден.");
      }

      setAdminPlayer(data.player);
      setAdminInventory(data.inventory || data.items || []);
      setAdminMessage("Игрок найден. Проверь профиль перед выдачей.");
      setAdminMessageError(false);

      if (upgradeTargets.length === 0) {
        await loadUpgradeTargets();
      }
    } catch (error) {
      console.error("Ошибка поиска игрока:", error);
      setAdminMessage(
        error?.message || "Не удалось найти игрока. Проверь Game ID."
      );
      setAdminMessageError(true);
    } finally {
      setAdminSearchLoading(false);
    }
  }

  async function grantAdminReward(event) {
    event?.preventDefault();

    if (!adminPlayer?.game_id) {
      setAdminMessage("Сначала найди игрока по Game ID.");
      setAdminMessageError(true);
      return;
    }

    const amount = Number(adminAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) {
      setAdminMessage("Количество должно быть целым числом от 1 до 1 000 000.");
      setAdminMessageError(true);
      return;
    }

    if (adminGrantType === "brainrot" && !adminItemName) {
      setAdminMessage("Выбери брейнрота для выдачи.");
      setAdminMessageError(true);
      return;
    }

    if (adminGrantType === "cases" && !adminCaseName) {
      setAdminMessage("Выбери кейс для бесплатной выдачи.");
      setAdminMessageError(true);
      return;
    }

    setAdminGrantLoading(true);
    setAdminMessage("");
    setAdminMessageError(false);

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: adminGrantType === "xp" ? "admin_adjust_xp" : "admin_grant",
            gameId: String(adminPlayer.game_id),
            grantType: adminGrantType,
            amount,
            itemName: adminGrantType === "brainrot" ? adminItemName : null,
            caseName: adminGrantType === "cases" ? adminCaseName : null,
          },
        }
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Сервер не подтвердил выдачу.");
      }

      const labels = {
        coins: "GG",
        cases: "бесплатных кейсов",
        brainrot: "брейнротов",
        xp: "XP",
      };
      setAdminMessage(
        `Успешно выдано: ${amount} ${
          adminGrantType === "brainrot" ? adminItemName : labels[adminGrantType]
        }.`
      );
      setAdminMessageError(false);

      // Обновляем профиль и инвентарь выбранного игрока после выдачи.
      const refreshed = await supabase.functions.invoke("braingg-api", {
        body: {
          initData: initData(),
          action: "admin_find_player",
          gameId: String(adminPlayer.game_id),
        },
      });

      if (!refreshed.error && refreshed.data?.success) {
        const freshPlayer = refreshed.data.player || adminPlayer;
        setAdminPlayer(freshPlayer);
        setAdminInventory(
          refreshed.data.inventory || refreshed.data.items || []
        );

        // Если админ выдал награду самому себе, обновляем баланс в шапке сразу.
        if (
          player?.telegram_id != null &&
          String(freshPlayer.telegram_id) === String(player.telegram_id)
        ) {
          setPlayer(freshPlayer);
        }
      }

      await loadAdminLogs();
    } catch (error) {
      console.error("Ошибка выдачи админом:", error);
      setAdminMessage(
        error?.message || "Не удалось выполнить выдачу. Проверь настройки сервера."
      );
      setAdminMessageError(true);
    } finally {
      setAdminGrantLoading(false);
    }
  }

  function findClosestTarget(source, desiredChance) {
    if (!source || upgradeTargets.length === 0) return null;

    const possible = upgradeTargets
      .filter((item) => item.item_name !== source.item_name)
      .map((item) => ({
        ...item,
        actualChance: calculateUpgradeChance(source, item, globalEvent?.event_name === "lucky" ? 2 : 1),
      }))
      .filter((item) => item.actualChance > 0);

    if (possible.length === 0) return null;

    possible.sort((a, b) => {
      const differenceA = Math.abs(a.actualChance - desiredChance);
      const differenceB = Math.abs(b.actualChance - desiredChance);

      if (differenceA !== differenceB) {
        return differenceA - differenceB;
      }

      // При одинаковом расстоянии предпочитаем шанс не выше выбранного.
      const aAbove = a.actualChance > desiredChance;
      const bAbove = b.actualChance > desiredChance;

      if (aAbove !== bAbove) return aAbove ? 1 : -1;

      return a.value_gg - b.value_gg;
    });

    return possible[0];
  }

  function chooseChance(preset) {
    setUpgradeChance(preset);
    setUpgradeVisualChance(null);
    setUpgradeRotation(0);
    setUpgradeWheelAnimating(false);
    setUpgradeResult(null);
    setActionMessage("");

    const closest = findClosestTarget(selectedUpgrade, preset);

    if (closest) {
      setTargetItem(closest.item_name);
    } else {
      setTargetItem("");
    }
  }

  function chooseSource(item) {
    setSelectedUpgrade(item);
    setUpgradeVisualChance(null);
    setUpgradeRotation(0);
    setUpgradeWheelAnimating(false);
    setMobileUpgradeList("target");
    setUpgradeResult(null);
    setActionMessage("");

    const closest = findClosestTarget(item, upgradeChance);

    setTargetItem(closest?.item_name || "");
  }

  async function changePage(nextPage) {
    if (nextPage !== page) playUiSound("tab");
    setPage(nextPage);
    setActionMessage("");

    if (nextPage === "Инвентарь" || nextPage === "Апгрейдер") {
      await loadInventory();
    }

    if (nextPage === "Апгрейдер" && upgradeTargets.length === 0) {
      await loadUpgradeTargets();
    }

    if (["Рейтинг", "Задания", "Профиль"].includes(nextPage)) await loadGameHub();
    if (nextPage === "Викторина") {
      try { await loadQuizStatus(); await startQuizQuestion(); }
      catch (error) { setQuizFeedback(error.message || "Викторина временно недоступна."); }
    }

    if (nextPage === "Админка" && isAdmin) {
      await loadAdminGameStats();
      if (upgradeTargets.length === 0) {
        await loadUpgradeTargets();
      }
      await loadAdminLogs();
    }
  }

  async function openSelectedCase() {
    if (!selectedCase || !player || opening || caseRewardsLoading || caseRewardsFor !== selectedCase.caseName || caseRewards.length === 0) return;

    setOpening(true);
    setLastRewards([]);
    setReelWinnerIndex(-1);
    setReelRows([]);
    setRareDropIndex(-1);
    setActionMessage("");
    setShowRewardModal(false);
    setSkipAvailable(false);
    skipRequestedRef.current = false;
    const rewards = [];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const makeReel = (winner, rowIndex) => {
      const pool = caseRewards.length ? caseRewards : [];
      const fallback = ["Noobini Pizzanini", "Lirili Larila", "Trippi Troppi", "Ballerina Cappuccina", "Cappuccino Assassino", "Bombardiro Crocodilo"];
      const cards = Array.from({ length:  41 }, (_, index) => {
        const source = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        return source
          ? { item_name: source.item_name, value_gg: source.value_gg, image: source.image || source.image_url || source.photo_url }
          : { item_name: fallback[(index + rowIndex) % fallback.length], value_gg: 0 };
      });
      // Each reel has its own winner slot; a small offset makes multi-open spins feel natural.
      const winnerIndex = 34 + (rowIndex % 2);
      cards[winnerIndex] = { ...winner, image: winner.image || winner.image_url || winner.photo_url };
      return { id: `reel-${rowIndex}`, cards, winnerIndex, position: 0, revealed: false };
    };

    try {
      // Ask the server for every result first. The animation never chooses or changes a reward.
      for (let i = 0; i < openCount; i++) {
        const { data, error } = await supabase.functions.invoke("braingg-api", {
          body: { initData: initData(), action: "open_case", caseName: selectedCase.caseName },
        });
        if (error || !data?.success || !data?.result?.success) {
          const message = await friendlyActionError(error, data, "Не удалось открыть кейс. Попробуй ещё раз.");
          throw new Error(message);
        }

        const reward = data.result;
        rewards.push(reward);
        setLiveDrops((previous) => [{
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          item_name: reward.item_name || reward.name || "Brainrot",
          rarity: reward.rarity || "Награда",
          value_gg: Number(reward.value_gg || reward.sold_price || 0),
          image: reward.image || reward.image_url || reward.photo_url,
          case_name: selectedCase.name,
          mutation: reward.mutation || null,
          created_at: new Date().toISOString(),
        }, ...previous].slice(0, 8));
        setPlayer((previous) => previous ? {
          ...previous,
          balance: reward.balance,
          ...(Array.isArray(data.free_case_credits) ? { free_case_credits: data.free_case_credits } : {}),
          ...(Number.isFinite(Number(data.free_cases_total)) ? { free_cases_total: Number(data.free_cases_total) } : {}),
        } : previous);
      }

      playUiSound("spin");
      const rows = fastOpen
        ? rewards.map((reward, index) => ({ id: `reel-${index}`, cards: [reward], winnerIndex: 0, position: 0, revealed: true }))
        : rewards.map((reward, index) => makeReel(reward, index));
      setReelRows(rows);

      if (!fastOpen) {
        setSkipAvailable(true);
        await nextFrame();
        setReelRows((current) => current.map((row) => ({ ...row, position: row.winnerIndex })));
        for (let elapsed = 0; elapsed < 5600 && !skipRequestedRef.current; elapsed += 100) await wait(100);
        setReelRows((current) => current.map((row) => ({ ...row, revealed: true })));
      }

      setSkipAvailable(false);
      setLastRewards(rewards);
      const freshInventory = await loadInventory();
      setRewardInventoryRows(freshInventory);
      setActionMessage(`Готово! Открыто кейсов: ${rewards.length}`);
      const topValue = Math.max(...rewards.map((reward) => Number(reward.value_gg || reward.sold_price || 0)));
      const topIndex = rewards.findIndex((reward) => Number(reward.value_gg || reward.sold_price || 0) === topValue);
      const topReward = rewards[topIndex];
      const topRarity = String(topReward?.rarity || "").toLowerCase();
      const rareDrop = ["secret", "mythic", "секрет", "мифик", "легендар", "божествен"].some((word) => topRarity.includes(word)) || (Number(selectedCase.maxReward || 0) > 0 && topValue >= Number(selectedCase.maxReward) * 0.45);
      if (rareDrop) setRareDropIndex(topIndex);
      playUiSound(rareDrop ? "rare" : "reveal");
      setShowRewardModal(true);
    } catch (error) {
      console.error("Ошибка открытия:", error);
      const message = error.message || "Не удалось открыть кейс. Попробуй ещё раз.";
      setActionMessage(rewards.length > 0 ? `Открыто кейсов: ${rewards.length}. ${message}` : message);
      setSkipAvailable(false);
      if (rewards.length) {
        setReelRows(rewards.map((reward, index) => ({ id: `reel-${index}`, cards: [reward], winnerIndex: 0, position: 0, revealed: true })));
        setLastRewards(rewards);
        const freshInventory = await loadInventory();
        setRewardInventoryRows(freshInventory);
        setShowRewardModal(true);
      }
    } finally {
      setOpening(false);
      setSkipAvailable(false);
    }
  }

  async function sellItem(item) {
    if (sellingId || sellingAll || upgradeLoading) return;


    setSellingId(item.id);
    setActionMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "sell_item",
            inventoryId: item.id,
          },
        }
      );

      if (error) throw error;

      if (!data?.success || !data?.result?.success) {
        throw new Error(data?.error || "Не удалось продать предмет");
      }

      setPlayer((previous) => ({
        ...previous,
        balance: data.result.balance,
      }));

      setInventory((previous) =>
        previous.filter((entry) => entry.id !== item.id)
      );

      if (selectedUpgrade?.id === item.id) {
        setSelectedUpgrade(null);
        setTargetItem("");
      }

      setActionMessage(
        `${data.result.item_name} продан за ${data.result.sold_price} GG!`
      );
    } catch (error) {
      console.error("Ошибка продажи:", error);
      setActionMessage(
        await friendlyActionError(error, null, "Не удалось продать предмет. Попробуй ещё раз.")
      );
    } finally {
      setSellingId(null);
    }
  }

  async function sellAllItems() {
    if (sellingAll || sellingId || upgradeLoading || inventory.length === 0) return;
    setSellingAll(true);
    setActionMessage("");
    let soldCount = 0;
    let earned = 0;
    const failed = [];
    try {
      for (const item of [...inventory]) {
        try {
          const { data, error } = await supabase.functions.invoke("braingg-api", {
            body: { initData: initData(), action: "sell_item", inventoryId: item.id },
          });
          if (error) throw error;
          if (!data?.success || !data?.result?.success) throw new Error(data?.error || "Не удалось продать предмет");
          soldCount += 1;
          earned += Number(data.result.sold_price) || 0;
          setPlayer((previous) => ({ ...previous, balance: data.result.balance }));
          setInventory((previous) => previous.filter((entry) => entry.id !== item.id));
        } catch (error) {
          console.error("Ошибка массовой продажи:", item.id, error);
          failed.push(item.item_name || "Предмет");
        }
      }
      setActionMessage(soldCount ? `Продано предметов: ${soldCount}. Получено ${earned.toLocaleString("ru-RU")} GG.${failed.length ? ` Не удалось продать: ${failed.length}.` : ""}` : "Не удалось продать предметы. Попробуй ещё раз.");
    } finally {
      setSellingAll(false);
    }
  }

  async function performUpgrade() {
    if (!selectedUpgrade || !targetItem || !selectedTarget || upgradeLoading) {
      setActionMessage("Сначала выбери свой брейнрот и цель для улучшения.");
      return;
    }

    if (!initData()) {
      setActionMessage("Ошибка: открой BrainGG через Telegram.");
      return;
    }

    setUpgradeLoading(true);
    setUpgradeWheelAnimating(false);
    setUpgradeVisualChance(null);
    setUpgradeRotation(0);
    playUiSound("upgrade");
    setUpgradeResult(null);
    setActionMessage("Отправляем запрос на улучшение...");

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "upgrade_item",
            inventoryId: selectedUpgrade.id,
            targetItem,
          },
        }
      );

      if (error) {
        let details = error.message || "Ошибка сервера";

        if (error.context) {
          try {
            const response = error.context.clone();
            const body = await response.json();
            details = body.error || body.message || JSON.stringify(body);
          } catch {
            // Оставляем исходное сообщение ошибки.
          }
        }

        throw new Error(details);
      }

      if (!data?.success || !data?.result?.success) {
        throw new Error(
          data?.error ||
          data?.result?.error ||
          data?.message ||
          "Сервер не подтвердил улучшение"
        );
      }

      const result = data.result;
      const won = result.won === true;
      if (won && (result.inventory_verified !== true || !result.awarded_inventory_id)) {
        throw new Error("Сервер сообщил о победе, но не подтвердил выдачу предмета. Примени последнюю SQL-миграцию апгрейдера.");
      }
      // Use the chance returned by the database transaction, not a client-side
      // estimate, so the visible green sector is exactly the one used by the roll.
      const serverChance = normalizeUpgradeChance(result.chance, actualChance);
      const sectorCenter = getUpgradeSectorCenter(won, serverChance);
      const confirmedResult = {
        ...result,
        won,
        chance: Number(serverChance.toFixed(2)),
        target_item: result.target_item || targetItem,
      };

      setUpgradeVisualChance(serverChance);
      setUpgradeRotation(sectorCenter);
      setUpgradeWheelAnimating(true);

      setActionMessage("Результат подтверждён сервером. Стрелка показывает итог.");

      await new Promise((resolve) => setTimeout(resolve, 4200));
      setUpgradeWheelAnimating(false);

      setUpgradeResult(confirmedResult);
      playUiSound(won ? "win" : "lose");

      setPlayer((previous) => ({
        ...previous,
        balance: result.balance,
      }));

      await loadInventory();

      setSelectedUpgrade(null);
      setTargetItem("");
      setMobileUpgradeList("source");
    } catch (error) {
      console.error("Ошибка апгрейда:", error);
      setActionMessage(
        await friendlyActionError(error, null, "Не удалось выполнить апгрейд. Попробуй ещё раз.")
      );
    } finally {
      setUpgradeLoading(false);
      setUpgradeWheelAnimating(false);
    }
  }

  const selectedTarget = upgradeTargets.find(
    (item) => item.item_name === targetItem
  );

  const actualChance = selectedUpgrade && selectedTarget
    ? calculateUpgradeChance(selectedUpgrade, selectedTarget, globalEvent?.event_name === "lucky" ? 2 : 1)
    : 0;

  const availableTargets = upgradeTargets
    .filter((item) => item.item_name !== selectedUpgrade?.item_name)
    .map((item) => ({
      ...item,
      actualChance: selectedUpgrade
        ? calculateUpgradeChance(selectedUpgrade, item, globalEvent?.event_name === "lucky" ? 2 : 1)
        : null,
    }));

  const wheelChance = upgradeVisualChance ?? actualChance;
  const wheelAngle = wheelChance * 3.6;

  // Показатели панели строятся только по реально доступному журналу выдач.
  const adminTotalOperations = adminLogs.length;
  const adminTotalCoins = adminLogs
    .filter((log) => log.action === "coins")
    .reduce((sum, log) => sum + Number(log.amount || 0), 0);
  const adminUniquePlayers = new Set(adminLogs.map((log) => String(log.game_id))).size;
  const filteredAdminLogs = adminLogs.filter((log) => {
    const query = adminLogQuery.trim().toLowerCase();
    const matchesQuery = !query || [log.game_id, log.item_name, log.case_name, log.admin_telegram_id]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesAction = adminLogAction === "all" || log.action === adminLogAction;
    return matchesQuery && matchesAction;
  });

  const eventRemainingSeconds = globalEvent?.event_ends_at
    ? Math.max(0, Math.ceil((Date.parse(globalEvent.event_ends_at) - eventClock) / 1000))
    : 0;
  const eventRemainingLabel = `${Math.floor(eventRemainingSeconds / 60)}:${String(eventRemainingSeconds % 60).padStart(2, "0")}`;
  const eventPresentation = {
    tacos: { title: "IT'S RAINING TACOS", subtitle: "Тако падают с неба — наслаждайся событием!", emoji: "🌮", particle: "🌮" },
    lucky: { title: "LUCKY DAY!", subtitle: "Удача ×2 в кейсах и апгрейдере", emoji: "🍀", particle: "🍀" },
    strawberry: { title: "STRAWBERRY DAY!", subtitle: "5% шанс клубничной мутации · цена ×2.5", emoji: "🍓", particle: "🍓" },
  };
  const activeEventPresentation = globalEvent?.event_name ? eventPresentation[globalEvent.event_name] : null;
  const eventParticles = Array.from({ length: 30 }, (_, index) => ({
    id: index,
    left: `${(index * 31 + 7) % 100}%`,
    delay: `${-((index * 11) % 18)}s`,
    duration: `${12 + ((index * 5) % 12)}s`,
    size: `${18 + ((index * 7) % 17)}px`,
    drift: `${((index * 19) % 110) - 55}px`,
    opacity: 0.48 + ((index * 13) % 48) / 100,
  }));
  const snowflakes = Array.from({ length: 34 }, (_, index) => ({
    id: index,
    left: `${(index * 37 + 11) % 100}%`,
    delay: `${-((index * 13) % 24)}s`,
    duration: `${18 + ((index * 7) % 19)}s`,
    size: `${3 + ((index * 5) % 5)}px`,
    opacity: 0.28 + ((index * 11) % 55) / 100,
    drift: `${((index * 17) % 100) - 50}px`,
  }));

  return (
    <div className={`app ${globalEvent?.event_name ? `event-theme-${globalEvent.event_name}` : ""}`}>
      <div className={`winter-snow ${globalEvent?.event_name ? `event-particles event-particles-${globalEvent.event_name}` : ""}`} aria-hidden="true">
        {globalEvent?.event_name && activeEventPresentation ? eventParticles.map((particle) => (
          <i className="event-particle" key={particle.id} style={{ left: particle.left, animationDelay: particle.delay, animationDuration: particle.duration, fontSize: particle.size, opacity: particle.opacity, "--particle-drift": particle.drift }}>{activeEventPresentation.particle}</i>
        )) : snowflakes.map((flake) => (
          <i className="snowflake" key={flake.id} style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size, opacity: flake.opacity, "--snow-drift": flake.drift }} />
        ))}
      </div>
      <header className="header">
        <div className="logo"><span className="logo-heart">💜</span> BrainGG</div>
        <div className="header-wallet">
          <button className={`winter-audio-toggle ${musicEnabled ? "is-on" : ""}`} onClick={toggleWinterMusic} title={globalEvent?.event_name ? "Музыка текущего ивента" : "Фоновая зимняя музыка"}>{musicEnabled ? "♫ Музыка вкл." : "♫ Музыка"}</button>
          <button className={`winter-audio-toggle ${soundEnabled ? "is-on" : ""}`} onClick={() => setSoundEnabled((value) => !value)} title="Звуковые эффекты">{soundEnabled ? "🔊 Звуки" : "🔇 Звуки"}</button>
          <div className="balance">🪙 {player ? player.balance : 0} GG</div>
          <button className="topup-trigger" onClick={() => { setTopupMessage(""); setTopupOpen(true); }}>＋ Пополнить</button>
        </div>
      </header>

      {activeEventPresentation && (
        <section className={`global-event-banner global-event-${globalEvent.event_name}`} aria-live="polite">
          <span className="global-event-banner-icon">{activeEventPresentation.emoji}</span>
          <div><b>{activeEventPresentation.title}</b><small>{activeEventPresentation.subtitle}</small></div>
          <strong>{eventRemainingLabel}</strong>
        </section>
      )}
      {musicNotice && globalEvent?.event_name && (
        <button className="event-music-notice" type="button" onClick={() => { setMusicEnabled(true); startEventMusic(globalEvent.event_name); }}>{musicNotice} · Нажми, чтобы повторить</button>
      )}
      {globalMessage && (
        <aside className="global-message-toast" role="status" aria-live="assertive">
          <span>📣</span><div><b>Глобальное сообщение BrainGG</b><p>{globalMessage.message}</p></div><button type="button" aria-label="Закрыть сообщение" onClick={() => setGlobalMessage(null)}>×</button>
        </aside>
      )}

      {loading && (
        <div className="content">
          <p>Загружаем твой профиль...</p>
        </div>
      )}

      {!loading && authError && (
        <div className="content">
          <p>{authError}</p>
        </div>
      )}

      {!loading && !authError && (
        <>
          <nav className="navigation">
            {visiblePages.map((item) => (
              <button
                key={item}
                className={page === item ? "active" : ""}
                onClick={() => changePage(item)}
              >
                {item}
              </button>
            ))}
          </nav>

          {topupOpen && <div className="stars-modal-backdrop" onClick={() => !topupBusy && setTopupOpen(false)}>
            <section className="stars-modal" role="dialog" aria-modal="true" aria-labelledby="stars-modal-title" onClick={event => event.stopPropagation()}>
              <button className="stars-modal-close" onClick={() => setTopupOpen(false)} aria-label="Закрыть">×</button>
              <span className="stars-modal-kicker">BRAIN GG WALLET</span><h2 id="stars-modal-title">Пополнение баланса</h2>
              <div className="stars-method-card"><span className="stars-symbol">★</span><div><b>Telegram Stars</b><small>Безопасная оплата внутри Telegram</small></div><span className="stars-method-check">✓</span></div>
              <p className="stars-rate-note">Курс: 1 ⭐ = 1,25 GG. Минимальное пополнение — 25 ⭐.</p>
              <label className="stars-field-label" htmlFor="stars-amount">Количество Stars</label>
              <input id="stars-amount" className="stars-amount-input" type="number" min="25" max="10000" step="1" value={topupStars} onChange={event => setTopupStars(event.target.value)} />
              <div className="stars-presets">{[25,50,100,250,500,1000].map(value => <button key={value} className={Number(topupStars)===value?"selected":""} onClick={() => setTopupStars(value)}>{value} ⭐</button>)}</div>
              <div className="stars-conversion"><span>Ты получишь</span><b>🪙 {Number.isFinite(Number(topupStars)) ? (Math.round(Number(topupStars)*1.25*100)/100).toLocaleString("ru-RU") : 0} GG</b></div>
              <p className="stars-wager-note">GG будут зачислены автоматически после подтверждения платежа Telegram.</p>
              {topupMessage && <div className="stars-status" role="status">{topupMessage}</div>}
              <button className="stars-pay-button" disabled={topupBusy || Number(topupStars)<25 || Number(topupStars)>10000 || !Number.isSafeInteger(Number(topupStars))} onClick={startStarsTopup}>{topupBusy?"Создаём счёт...":`Оплатить ${topupStars || 0} ⭐`}</button>
            </section>
          </div>}

          <section className="live-drops-bar" aria-label="Live Drops">
            <div className="live-drops-heading"><span className="live-pulse" /> <b>LIVE DROPS</b><small>ПОСЛЕДНИЕ ВЫПАДЕНИЯ</small></div>
            <div className="live-drops-track">
              {liveDrops.length ? liveDrops.map((drop) => (
                <article className="live-drop-chip" key={drop.id}>
                  <div className="live-drop-art">{brainrotImage(drop) ? <img className={drop.mutation === "strawberry" ? "mutation-strawberry-image" : ""} src={brainrotImage(drop)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>❄</span>}</div>
                  <div><b>{drop.item_name}{drop.mutation === "strawberry" ? <span className="strawberry-mutation-pill">🍓 Клубничная</span> : null}</b><small>@{drop.username || "Игрок"} · {displayCaseName(drop.case_name)} · {drop.rarity || "Награда"}</small></div>
                  {drop.value_gg > 0 && <strong>{drop.value_gg.toLocaleString("ru-RU")} GG</strong>}
                </article>
              )) : <div className="live-drops-empty">Здесь появятся реальные выигрыши после открытия кейса</div>}
            </div>
          </section>

          {page === "Главная" && (
            <main className="content home-welcome">
              <div className="home-welcome-inner">
                <div className="home-welcome-emblem">❄</div>
                <p className="home-greeting">Привет, <b>{greetingLabel}!</b></p>
                <h2>Добро пожаловать в BrainGG!</h2>
                <p>Открывай кейсы, собирай персонажей и улучшай свою коллекцию.</p>
                <p className="home-luck">Удачи!</p>
                <button className="main-button" onClick={() => changePage("Кейсы")}>Смотреть кейсы 🎁</button>
                <section className="season-card daily-card">
                  <div><span className="season-kicker">ARCTIC DAILY</span><h3>Ежедневная награда</h3><p>Заходи каждый день и увеличивай серию посещений.</p></div>
                  <div className="daily-streak">❄ {gameHub.progress?.daily_streak || 0} дней подряд</div>
                  <button className="main-button" disabled={dailyClaimLoading || gameHub.dailyClaimed} onClick={claimDailyReward}>{dailyClaimLoading ? "Получаем..." : gameHub.dailyClaimed ? "Уже получено сегодня" : "Забрать награду"}</button>
                </section>
                {hubMessage && <p className="hub-feedback">{hubMessage}</p>}
              </div>
            </main>
          )}

          {page === "Кейсы" && (
            <main className="content cases-page">
              {selectedCase ? (
                <section className="case-detail-page">
                  <button
                    className="case-back-button"
                    onClick={() => { caseRewardsRequestRef.current += 1; setSelectedCase(null); setCaseRewards([]); setCaseRewardsFor(""); setCaseRewardsLoading(false); setLastRewards([]); setReelRows([]); setActionMessage(""); }}
                  >
                    ← Назад к кейсам
                  </button>

                  <div className={`case-detail-visual case-theme-${selectedCase.color}`}>
                    <CaseArtwork item={selectedCase} className="case-detail-art-frame" alt={selectedCase.name} />
                    {selectedCase.maxReward && (
                      <span className="case-detail-max">До {selectedCase.maxReward.toLocaleString("ru-RU")} GG</span>
                    )}
                  </div>

                  <div className="case-detail-name">
                    <span>Кейс: <b>{selectedCase.name}</b></span>
                  </div>

                  <div className="case-detail-controls">
                    <div className="opening-options">
                      {[1, 2, 3].map((count) => (
                        <button
                          key={count}
                          className={openCount === count ? "count-button active" : "count-button"}
                          disabled={opening}
                          onClick={() => setOpenCount(count)}
                        >
                          {count} {count === 1 ? "кейс" : "кейса"}
                        </button>
                      ))}
                    </div>
                    <label className="case-fast-toggle">
                      <input
                        type="checkbox"
                        checked={fastOpen}
                        onChange={(event) => setFastOpen(event.target.checked)}
                      />
                      <span>Быстрое открытие</span>
                    </label>
                  </div>

                  <div className={`case-roulette-stack ${opening ? "is-rolling" : ""}`} aria-live="polite">
                    {(reelRows.length ? reelRows : Array.from({ length: openCount }, (_, rowIndex) => ({
                      id: `preview-${rowIndex}`,
                      cards: Array.from({ length: 13 }, (_, index) => {
                        const item = upgradeTargets[index % Math.max(upgradeTargets.length, 1)];
                        return item ? { item_name: item.item_name, value_gg: item.value_gg, image: item.image || item.image_url } : { item_name: ["Noobini Pizzanini", "Lirili Larila", "Trippi Troppi", "Ballerina Cappuccina"][index % 4], value_gg: 0 };
                      }),
                      winnerIndex: -1, position: 0, revealed: false,
                    }))).map((row, rowIndex) => (
                      <div className={`case-roulette-viewport ${opening && !fastOpen ? "is-rolling" : ""} ${row.revealed && rowIndex === rareDropIndex ? "is-rare-winner" : ""}`} key={row.id} aria-label={`Рулетка ${rowIndex + 1}`}>
                        <div className="case-roulette-strip" style={{ "--reel-index": row.position, "--reel-duration": `${5.0 + rowIndex * 0.18}s` }}>
                          {row.cards.map((reward, index) => (
                            <div className={`case-roulette-item ${row.revealed && index === row.winnerIndex ? "is-winner" : ""}`} key={`${reward.item_name}-${rowIndex}-${index}`}>
                              {brainrotImage(reward) ? <img className={reward.mutation === "strawberry" ? "mutation-strawberry-image" : ""} src={brainrotImage(reward)} alt={reward.item_name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement.classList.add("has-image-error"); }} /> : <span>{["🧌", "🐉", "🐘", "🧟", "🐻", "🐲"][index % 6]}</span>}
                              <b>{reward.item_name}{reward.mutation === "strawberry" ? <span className="strawberry-mutation-pill">🍓 ×2.5</span> : null}</b>
                              {Number(reward.value_gg) > 0 && <small>{Number(reward.value_gg).toLocaleString("ru-RU")} GG</small>}
                            </div>
                          ))}
                        </div>
                        <i className="case-roulette-pointer" />
                        <div className="case-roulette-edge case-roulette-edge-left" />
                        <div className="case-roulette-edge case-roulette-edge-right" />
                        <span className="case-roulette-row-label">{openCount > 1 ? `Кейс ${rowIndex + 1}` : "Выпадение"}</span>
                      </div>
                    ))}
                  </div>
                  {opening && skipAvailable && <button className="case-skip-button" onClick={() => { skipRequestedRef.current = true; setSkipAvailable(false); }}>Пропустить анимацию ❯❯</button>}

                  {(() => {
                    const freeCount = Number(player?.free_case_credits?.find((credit) => credit.case_name === selectedCase.caseName)?.amount || 0);
                    const freeToUse = Math.min(freeCount, openCount);
                    const paidCount = Math.max(0, openCount - freeToUse);
                    return (
                      <div className="case-payment-summary">
                        <div><span>Бесплатно доступно</span><b>{freeCount}</b></div>
                        <div><span>Бесплатных открытий</span><b>{freeToUse}</b></div>
                        <div><span>К оплате</span><b>{(paidCount * selectedCase.price).toLocaleString("ru-RU")} GG</b></div>
                      </div>
                    );
                  })()}

                  <button
                    className="main-button case-open-main"
                    disabled={!player || opening || caseRewardsLoading || caseRewardsFor !== selectedCase.caseName || caseRewards.length === 0}
                    onClick={openSelectedCase}
                  >
                    {opening ? "Открываем..." : caseRewardsLoading || caseRewardsFor !== selectedCase.caseName ? "Загружаем дроп..." : (() => {
                      const freeCount = Number(player?.free_case_credits?.find((credit) => credit.case_name === selectedCase.caseName)?.amount || 0);
                      const paidCount = Math.max(0, openCount - Math.min(freeCount, openCount));
                      return `Крутить · ${(selectedCase.price * paidCount).toLocaleString("ru-RU")} GG`;
                    })()}
                  </button>

                  {actionMessage && <div className="upgrade-message" role="status">{actionMessage}</div>}

                  {lastRewards.length > 0 && (
                    <div className="rewards-list case-last-rewards">
                      <h3>🎉 Твои выпадения</h3>
                      {lastRewards.map((reward, index) => (
                        <div className="reward-item" key={`${reward.item_name}-${index}`}>
                          <b>{reward.item_name}{reward.mutation === "strawberry" ? <span className="strawberry-mutation-pill">🍓 ×2.5</span> : null}</b><span>{reward.rarity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <section className="case-contents-panel">
                    <h3>Содержимое кейса</h3>
                    <p className="case-contents-caption">Полный список наград именно из этого кейса · шанс рассчитан по весам дропа</p>
                    {globalEvent?.event_name === "lucky" && <p className="case-contents-event-note">🍀 LUCKY DAY: шансы всех редкостей выше обычной увеличены в 2 раза.</p>}
                    {globalEvent?.event_name === "strawberry" && <p className="case-contents-event-note">🍓 STRAWBERRY DAY: дополнительно действует 5% шанс клубничной мутации с ценой ×2.5.</p>}
                    <div className="case-contents-grid">
                      {caseRewardsLoading && caseRewardsFor === selectedCase.caseName && <p className="case-contents-caption">Загружаем полный список наград...</p>}
                      {caseRewardsFor === selectedCase.caseName && caseRewards.map((item, index) => (
                        <div className="case-content-item" key={`${item.item_name}-${index}`}>
                          {brainrotImage(item) ? <img className="brainrot-thumb" src={brainrotImage(item)} alt={item.item_name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>{["🧌", "🐉", "🐘", "🧟", "🐻", "🐲"][index % 6]}</span>}
                          <div className="case-content-info"><b>{item.item_name}</b><small>{item.rarity || "Награда"} · {Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</small><em>{Number(item.drop_chance_percent || 0).toFixed(2)}% шанс</em></div>
                        </div>
                      ))}
                      {!caseRewardsLoading && caseRewardsFor === selectedCase.caseName && caseRewards.length === 0 && <p className="case-contents-caption">Для этого кейса пока не настроен пул наград.</p>}
                    </div>
                  </section>
                </section>
              ) : (
                <>
                  <div className="cases-page-heading">
                    <div>
                      <span className="cases-eyebrow">BRAINROT CASER</span>
                      <h2>Кейсы</h2>
                      <p>Открывай кейсы, собирай коллекцию и забирай редкие награды</p>
                    </div>
                    <div className="cases-balance-chip">🟡 {Number(player?.balance || 0).toLocaleString("ru-RU")} GG</div>
                  </div>

                  {["Обычные кейсы", "Rich Cases 💎", "All In 🎲"].map((category) => (
                    <section className="case-category-section" key={category}>
                      <h3>{category}</h3>
                      <div className="case-grid case-grid-reference">
                        {cases.filter((item) => item.category === category).map((item) => (
                          <article className={`case-card case-card-reference case-theme-${item.color}`} key={item.id}>
                            {item.maxReward && <span className="case-max-badge">до {item.maxReward.toLocaleString("ru-RU")} 🟡</span>}
                            <button
                              type="button"
                              className="case-card-reference-button"
                              onClick={() => {
                                setSelectedCase(item);
                                setCaseRewards([]);
                                setCaseRewardsFor(item.caseName);
                                setLastRewards([]);
                                setOpenCount(1);
                                setActionMessage("");
                                if (upgradeTargets.length === 0) loadUpgradeTargets();
                              }}
                            >
                              <CaseArtwork item={item} className="case-card-art" alt={item.name} />
                              <div className="case-card-details">
                                <h4>{item.name}</h4>
                                <p>{item.description}</p>
                                <div className="case-price-row">
                                  <span>Цена:</span>
                                  {item.oldPrice && <del>{item.oldPrice.toLocaleString("ru-RU")}</del>}
                                  <b>{item.price.toLocaleString("ru-RU")} 🟡 GG</b>
                                  {item.discount && <em>-{item.discount}%</em>}
                                </div>
                                <span className="case-card-open-label">Открыть ›</span>
                              </div>
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
            </main>
          )}

          {page === "Апгрейдер" && (
            <main className="content upgrade-content">
              <div className="upgrade-heading">
                <div>
                  <h2>⚡ Апгрейдер BrainGG</h2>
                  <p>
                    Выбери своего брейнрота и цель, которую хочешь получить!
                  </p>
                </div>

                <div className="upgrade-badge">UPGRADE</div>
              </div>

              {inventoryLoading || targetsLoading ? (
                <div className="upgrade-empty">
                  <div className="loading-orb">⚡</div>
                  <p>Загружаем брейнротов...</p>
                </div>
              ) : inventory.length === 0 ? (
                <div className="upgrade-empty">
                  <div className="empty-brain">🧠</div>
                  <h3>У тебя пока нет брейнротов</h3>
                  <p>Открой кейс, чтобы получить первый предмет.</p>

                  <button
                    className="main-button"
                    onClick={() => changePage("Кейсы")}
                  >
                    Перейти к кейсам
                  </button>
                </div>
              ) : (
                <>
                  <div className="upgrade-arena">
                    <div className="upgrade-mobile-tabs" role="tablist" aria-label="Выбор брейнрота для апгрейда">
                      <button type="button" role="tab" aria-selected={mobileUpgradeList === "source"} className={mobileUpgradeList === "source" ? "active" : ""} onClick={() => setMobileUpgradeList("source")}>Мой брейнрот</button>
                      <button type="button" role="tab" aria-selected={mobileUpgradeList === "target"} className={mobileUpgradeList === "target" ? "active" : ""} onClick={() => setMobileUpgradeList("target")}>Цель апгрейда</button>
                    </div>
                    <section className={`upgrade-column upgrade-source-column ${mobileUpgradeList === "source" ? "" : "is-mobile-hidden"}`}>
                      <div className="upgrade-column-title">
                        <span>1</span>
                        <div>
                          <b>ТВОИ БРЕЙНРОТЫ</b>
                          <small>Выбери предмет, который отдаёшь</small>
                        </div>
                      </div>

                      <div className="upgrade-items-list">
                        {inventory.map((item) => (
                          <button
                            key={item.id}
                            className={
                              selectedUpgrade?.id === item.id
                                ? "upgrade-item selected"
                                : "upgrade-item"
                            }
                            disabled={upgradeLoading}
                            onClick={() => chooseSource(item)}
                          >
                            {brainrotImage(item) ? <img className={`upgrade-item-emoji-image ${item.mutation === "strawberry" ? "mutation-strawberry-image" : ""}`} src={brainrotImage(item)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="upgrade-item-emoji">🧠</span>}

                            <span className="upgrade-item-info">
                              <b>{item.item_name}{item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">🍓 Клубничная</span> : null}</b>

                              <small
                                style={{
                                  color: rarityColors[item.rarity],
                                }}
                              >
                                {item.rarity}
                              </small>

                              <small>{item.value_gg} GG</small>
                            </span>

                            {selectedUpgrade?.id === item.id && (
                              <span className="item-check">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="upgrade-middle">
                      <div className="upgrade-wheel-wrap">
                        <div className="wheel-glow" />

                        <div
                          className="upgrade-wheel-rotor"
                          style={{
                            background: `conic-gradient(#39e58b 0deg ${wheelAngle}deg, #292438 ${wheelAngle}deg 360deg)`,
                          }}
                        >
                          <div className="wheel-inner">
                            <span className="wheel-chance">
                              {selectedTarget
                                ? `${wheelChance.toFixed(1)}%`
                                : "—"}
                            </span>

                            <span className="wheel-label">
                              РЕАЛЬНЫЙ ШАНС
                            </span>
                          </div>
                        </div>

                        <div
                          className={`upgrade-pointer-alignment${upgradeWheelAnimating ? " is-aligning" : ""}`}
                          style={{ transform: `rotate(${upgradeRotation}deg)` }}
                          aria-hidden="true"
                        >
                          <div className={`upgrade-pointer-orbit${upgradeWheelAnimating ? " is-spinning" : ""}`}>
                            <svg className="upgrade-pointer" viewBox="0 0 270 270" focusable="false" aria-hidden="true">
                              <path d="M135 29 L121 3 L149 3 Z" fill="#f5fdff" stroke="#245c78" strokeWidth="2.5" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="chance-title">
                        ВЫБЕРИ ЖЕЛАЕМЫЙ ШАНС
                      </div>

                      <div className="chance-options">
                        {[75, 50, 25, 10].map((chance) => (
                          <button
                            key={chance}
                            className={
                              upgradeChance === chance
                                ? "chance-button active"
                                : "chance-button"
                            }
                            disabled={upgradeLoading}
                            onClick={() => chooseChance(chance)}
                          >
                            {chance}%
                          </button>
                        ))}
                      </div>

                      <p className="chance-explanation">
                        Кнопка подберёт брейнрота с наиболее близким
                        настоящим шансом. Вероятность зависит от стоимости
                        предметов.
                      </p>

                      {selectedTarget && (
                        <div className="actual-chance-info">
                          <span>Настоящий шанс:</span>
                          <b>{actualChance.toFixed(2)}%</b>
                        </div>
                      )}

                      <button
                        className="main-button upgrade-start-button"
                        disabled={
                          !selectedUpgrade ||
                          !targetItem ||
                          !selectedTarget ||
                          upgradeLoading ||
                          targetsLoading
                        }
                        onClick={performUpgrade}
                      >
                        {upgradeLoading ? "КРУТИМ..." : "⚡ УЛУЧШИТЬ"}
                      </button>

                      <div className="wheel-legend">
                        <span>
                          <i className="legend-green" /> Победа
                        </span>
                        <span>
                          <i className="legend-dark" /> Проигрыш
                        </span>
                      </div>
                    </section>

                    <section className={`upgrade-column upgrade-target-column ${mobileUpgradeList === "target" ? "" : "is-mobile-hidden"}`}>
                      <div className="upgrade-column-title target-title">
                        <span>2</span>
                        <div>
                          <b>БРЕЙНРОТЫ ДЛЯ ПОЛУЧЕНИЯ</b>
                          <small>Выбери желаемую цель</small>
                        </div>
                      </div>

                      <div className="upgrade-items-list">
                        {availableTargets.map((item) => (
                          <button
                            key={item.item_name}
                            className={
                              targetItem === item.item_name
                                ? "upgrade-item target-item selected"
                                : "upgrade-item target-item"
                            }
                            disabled={upgradeLoading}
                            onClick={() => {
                              setTargetItem(item.item_name);
                              setUpgradeVisualChance(null);
                              setUpgradeRotation(0);
                              setUpgradeWheelAnimating(false);
                              setUpgradeResult(null);
                              setActionMessage("");
                            }}
                          >
                            {brainrotImage(item) ? <img className="upgrade-item-emoji-image" src={brainrotImage(item)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="upgrade-item-emoji">🧠</span>}

                            <span className="upgrade-item-info">
                              <b>{item.item_name}</b>

                              <small
                                style={{
                                  color: rarityColors[item.rarity],
                                }}
                              >
                                {item.rarity}
                              </small>

                              <small>{item.value_gg} GG</small>

                              {selectedUpgrade && (
                                <small className="target-real-chance">
                                  Шанс: {item.actualChance.toFixed(2)}%
                                </small>
                              )}
                            </span>

                            {targetItem === item.item_name && (
                              <span className="item-check">✓</span>
                            )}
                          </button>
                        ))}

                        {availableTargets.length === 0 && (
                          <p className="no-targets">
                            Нет доступных целей.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="upgrade-selection-summary">
                    <div>
                      <small>ТВОЙ ПРЕДМЕТ</small>
                      <b>
                        {selectedUpgrade?.item_name || "Не выбран"}
                      </b>
                      {selectedUpgrade && (
                        <small>{selectedUpgrade.value_gg} GG</small>
                      )}
                    </div>

                    <div className="summary-arrow">➜</div>

                    <div>
                      <small>ТВОЯ ЦЕЛЬ</small>
                      <b>
                        {selectedTarget?.item_name || "Не выбрана"}
                      </b>
                      {selectedTarget && (
                        <small>{selectedTarget.value_gg} GG</small>
                      )}
                    </div>
                  </div>

                  {upgradeResult && (
                    <div
                      className={
                        upgradeResult.won
                          ? "upgrade-result win"
                          : "upgrade-result lose"
                      }
                    >
                      <div className="result-icon">
                        {upgradeResult.won ? "🏆" : "💔"}
                      </div>

                      <div>
                        <h3>
                          {upgradeResult.won
                            ? "ПОБЕДА! БРЕЙНРОТ ТВОЙ!"
                            : "НЕ ПОВЕЗЛО! БРЕЙНРОТ СГОРЕЛ"}
                        </h3>

                        <p>
                          {upgradeResult.won
                            ? `Ты получил ${upgradeResult.target_item}!`
                            : `Ты пытался получить ${upgradeResult.target_item}.`}
                        </p>

                        <small>
                          Настоящий шанс: {upgradeResult.chance}%
                        </small>
                      </div>
                    </div>
                  )}
                </>
              )}

              {actionMessage && (
                <div className="upgrade-message">
                  {actionMessage}
                </div>
              )}

              {inventoryError && (
                <div className="upgrade-message error">
                  {inventoryError}
                  <button onClick={loadInventory}>Повторить</button>
                </div>
              )}
            </main>
          )}

          {page === "Инвентарь" && (
            <main className="content inventory-page">
              <div className="inventory-hero"><div><span className="inventory-kicker">МОЯ КОЛЛЕКЦИЯ</span><h2>Ледяное хранилище</h2><p>Все твои брейнроты — в одном месте</p></div><div className="inventory-hero-icon">❄️</div></div>
              <div className="inventory-stats"><div><small>Предметов</small><b>{inventory.length}</b></div><div><small>Общая стоимость</small><b>{inventory.reduce((sum,item)=>sum+(Number(item.value_gg)||0),0).toLocaleString("ru-RU")} <i>GG</i></b></div><div><small>Средняя стоимость</small><b>{inventory.length?Math.round(inventory.reduce((sum,item)=>sum+(Number(item.value_gg)||0),0)/inventory.length).toLocaleString("ru-RU"):0} <i>GG</i></b></div></div>
              {inventoryLoading && <div className="inventory-state"><div className="inventory-loader">❄</div><b>Собираем коллекцию...</b></div>}
              {inventoryError && <div className="upgrade-message error">{inventoryError}<button onClick={loadInventory}>Повторить</button></div>}
              {!inventoryLoading && !inventoryError && inventory.length > 0 && (<>
                <div className="inventory-toolbar"><label className="inventory-search">⌕<input value={inventoryQuery} onChange={e=>setInventoryQuery(e.target.value)} placeholder="Найти предмет..." /></label><select value={inventoryRarity} onChange={e=>setInventoryRarity(e.target.value)}><option>Все</option>{[...new Set(inventory.map(x=>x.rarity).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select><select value={inventorySort} onChange={e=>setInventorySort(e.target.value)}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="priceHigh">Дорогие сначала</option><option value="priceLow">Дешёвые сначала</option></select><button className="inventory-sell-all" onClick={sellAllItems} disabled={sellingAll || sellingId !== null || upgradeLoading}>{sellingAll ? "Продаём всё..." : "Продать всё"}</button></div>
                <div className="inventory-results-label">КОЛЛЕКЦИЯ · {inventory.filter(item=>(!inventoryQuery||String(item.item_name||"").toLowerCase().includes(inventoryQuery.toLowerCase()))&&(inventoryRarity==="Все"||item.rarity===inventoryRarity)).length} / {inventory.length}</div>
                <div className="inventory-grid">{inventory.filter(item=>(!inventoryQuery||String(item.item_name||"").toLowerCase().includes(inventoryQuery.toLowerCase()))&&(inventoryRarity==="Все"||item.rarity===inventoryRarity)).sort((a,b)=>inventorySort==="priceHigh"?Number(b.value_gg)-Number(a.value_gg):inventorySort==="priceLow"?Number(a.value_gg)-Number(b.value_gg):inventorySort==="oldest"?new Date(a.created_at)-new Date(b.created_at):new Date(b.created_at)-new Date(a.created_at)).map((item,index)=>(
                  <article className="inventory-card" key={item.id}><div className="inventory-card-top"><span>#{String(index+1).padStart(2,"0")}</span><span className={`inventory-rarity ${item.rarity === "OG" ? "rarity-og" : ""}`}>{item.rarity||"Обычный"}</span></div><div className="inventory-art"><div className="inventory-art-glow"/>{brainrotImage(item) ? <img className={`brainrot-inventory-image ${item.mutation === "strawberry" ? "mutation-strawberry-image" : ""}`} src={brainrotImage(item)} alt={item.item_name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>🧠</span>}<i>✦</i></div><div className="inventory-card-info"><h3>{item.item_name} {item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">🍓 Клубничная ×2.5</span> : null}</h3><div className="inventory-value">{Number(item.value_gg||0).toLocaleString("ru-RU")} <small>GG</small></div><p>Получен {item.created_at?new Date(item.created_at).toLocaleDateString("ru-RU"):"—"}</p></div><div className="inventory-card-actions"><button className="main-button" disabled={sellingId===item.id||sellingAll||upgradeLoading} onClick={()=>sellItem(item)}>{sellingId===item.id?"Продаём...":`Продать · ${Number(item.value_gg||0).toLocaleString("ru-RU")} GG`}</button><button className="case-button" disabled={sellingId===item.id||sellingAll||upgradeLoading} onClick={()=>{setSelectedUpgrade(item);setTargetItem("");setUpgradeVisualChance(null);setUpgradeRotation(0);setUpgradeWheelAnimating(false);setUpgradeResult(null);setMobileUpgradeList("target");changePage("Апгрейдер");}}>⚡ Улучшить</button></div></article>
                ))}</div>
                {inventory.filter(item=>(!inventoryQuery||String(item.item_name||"").toLowerCase().includes(inventoryQuery.toLowerCase()))&&(inventoryRarity==="Все"||item.rarity===inventoryRarity)).length===0&&<div className="inventory-state"><span>🔎</span><b>Ничего не найдено</b><p>Измени запрос или фильтр.</p></div>}
              </>)}
              {!inventoryLoading&&!inventoryError&&inventory.length===0&&<div className="inventory-state"><div className="inventory-empty-icon">❄️</div><h3>Хранилище пока пустое</h3><p>Открой первый кейс — и здесь появится твоя коллекция.</p><button className="main-button" onClick={()=>changePage("Кейсы")}>Перейти к кейсам</button></div>}
            </main>
          )}

          {page === "Рейтинг" && (
            <main className="content season-page">
              <header className="season-page-heading"><span className="season-kicker">GLOBAL LEADERBOARD</span><h2>❄ Глобальный рейтинг</h2><p>Игроки с самым высоким опытом BrainGG.</p></header>
              <section className="season-panel"><div className="season-panel-title"><h3>Таблица лидеров</h3><button className="case-button" onClick={loadGameHub} disabled={hubLoading}>↻ Обновить</button></div>
                {hubLoading ? <p>Загружаем рейтинг...</p> : (gameHub.leaderboard || []).length ? <div className="leaderboard-list">{gameHub.leaderboard.map((entry,index)=><article className={`leaderboard-row ${index<3?"top-player":""}`} key={`${entry.game_id||entry.username}-${index}`}><b className="leaderboard-place">{index===0?"👑":`#${index+1}`}</b><div className="leaderboard-avatar">{index<3?"❄":"♙"}</div><div className="leaderboard-user"><b>@{entry.username}</b><small>Уровень {entry.level} · {Number(entry.total_cases_opened||0)} открытий</small></div><strong>{Number(entry.xp||0).toLocaleString("ru-RU")} XP</strong></article>)}</div> : <p className="season-empty">Рейтинг появится после накопления игрового опыта.</p>}
              </section>
            </main>
          )}

          {page === "Задания" && (
            <main className="content season-page">
              <header className="season-page-heading"><span className="season-kicker">ARCTIC MISSIONS</span><h2>❄ Задания и достижения</h2><p>Выполняй игровые цели, получай GG и опыт.</p></header>
              {hubMessage && <p className="hub-feedback">{hubMessage}</p>}
              <section className="season-panel"><h3>Текущие задания</h3>{(gameHub.tasks||[]).map((task)=><article className="mission-card" key={task.id}><div className="mission-icon">✦</div><div className="mission-info"><b>{task.title}</b><p>{task.description}</p><div className="mission-progress"><span style={{width:`${Math.min(100,Number(task.progress||0)/task.goal*100)}%`}}/></div><small>{Math.min(Number(task.progress||0),task.goal)} / {task.goal}</small></div><div className="mission-reward"><b>+{task.reward} GG</b><small>+{task.xp} XP</small><button className="case-button" disabled={!task.progress||task.progress<task.goal||task.claimed||taskClaimLoading===task.id} onClick={()=>claimTaskReward(task.id)}>{task.claimed?"Получено":taskClaimLoading===task.id?"...":"Забрать"}</button></div></article>)}</section>
              <section className="season-panel"><h3>Достижения</h3><div className="achievement-grid">{[{name:"Первый шаг",desc:"Открой первый кейс",ok:Number(gameHub.progress?.total_cases_opened||0)>=1},{name:"Коллекционер",desc:"Открой 10 кейсов",ok:Number(gameHub.progress?.total_cases_opened||0)>=10},{name:"Торговец",desc:"Продай первый предмет",ok:Number(gameHub.progress?.total_sales||0)>=1},{name:"Мастер улучшений",desc:"Улучши первый предмет",ok:Number(gameHub.progress?.total_upgrades||0)>=1}].map((a)=><article className={`achievement-card ${a.ok?"unlocked":""}`} key={a.name}><span>{a.ok?"🏆":"🔒"}</span><b>{a.name}</b><small>{a.desc}</small></article>)}</div></section>
            </main>
          )}

          {page === "Викторина" && (
            <main className="content season-page quiz-page">
              <header className="season-page-heading"><span className="season-kicker">BRAIN GG DAILY QUIZ</span><h2>❄ Викторина BrainGG</h2><p>Отвечай на вопросы, проверяй знания и получай монеты.</p></header>
              <section className="quiz-status-grid">
                <article><small>Попыток сегодня</small><b>{quizStatus.used || 0} / 3</b></article>
                <article><small>Осталось попыток</small><b>{quizStatus.remaining ?? 3}</b></article>
                <article><small>Правильных ответов</small><b>{quizStatus.correct || 0}</b></article>
              </section>
              <section className="season-panel quiz-card">
                <div className="quiz-reward-pill">✦ +5 GG за правильный ответ</div>
                {quizQuestion ? <>
                  <span className="season-kicker">ВОПРОС {Math.min((quizStatus.used || 0) + 1, 3)} ИЗ 3</span>
                  <h3 className="quiz-question-title">{quizQuestion.question}</h3>
                  <div className="quiz-options">{quizQuestion.options.map((option,index)=><button key={`${quizQuestion.id}-${index}`} className={`quiz-option ${quizSelected===index?"selected":""} ${quizAnswered&&index===quizQuestion.correctIndex?"correct":""} ${quizAnswered&&quizSelected===index&&index!==quizQuestion.correctIndex?"incorrect":""}`} disabled={quizAnswered||quizLoading} onClick={()=>setQuizSelected(index)}><span>{String.fromCharCode(65+index)}</span>{option}</button>)}</div>
                  {quizFeedback && <div className={`quiz-feedback ${quizFeedback.startsWith("Верно")?"success":""}`}>{quizFeedback}{quizQuestion.explanation&&quizAnswered?<small>{quizQuestion.explanation}</small>:null}</div>}
                  {!quizAnswered ? <button className="main-button quiz-action" disabled={quizSelected===null||quizLoading} onClick={submitQuizAnswer}>{quizLoading?"Проверяем...":"Ответить"}</button> : <button className="main-button quiz-action" disabled={quizStatus.remaining<=0||quizLoading} onClick={startQuizQuestion}>{quizStatus.remaining>0?"Следующий вопрос":"Попытки закончились"}</button>}
                </> : <div className="quiz-empty"><div className="quiz-crystal">❄</div><h3>{quizStatus.remaining<=0?"На сегодня всё!":"Готов проверить свои знания?"}</h3><p>{quizFeedback || "Каждый день доступны 3 попытки. За каждый правильный ответ начисляется 5 GG."}</p><button className="main-button quiz-action" disabled={quizLoading||quizStatus.remaining<=0} onClick={startQuizQuestion}>{quizLoading?"Загружаем...":quizStatus.remaining>0?"Начать викторину":"Возвращайся завтра"}</button></div>}
              </section>
              <p className="quiz-footnote">Попытка расходуется после отправки ответа. Награда начисляется сервером, максимум 15 GG в день.</p>
            </main>
          )}

          {page === "Профиль" && (
            <main className="content season-page"><header className="season-page-heading"><span className="season-kicker">PLAYER IDENTITY</span><h2>❄ Профиль игрока</h2><p>Твой путь в мире BrainGG.</p></header>
              <section className="season-profile-card"><div className="profile-avatar">❄</div><div className="profile-identity"><h2>@{player?.username||"игрок"}</h2><p>Game ID: {player?.game_id||"—"}</p><span>Уровень {gameHub.progress?.level||1}</span></div><div className="profile-xp"><b>{Number(gameHub.progress?.xp||0).toLocaleString("ru-RU")} XP</b><div className="mission-progress"><span style={{width:`${Math.min(100,Math.max(0,(Number(gameHub.progress?.xp||0)-Math.pow(Math.max(0,Number(gameHub.progress?.level||1)-1),2)*100)/Math.max(1,Number(gameHub.progress?.level||1)*Number(gameHub.progress?.level||1)*100-Math.pow(Math.max(0,Number(gameHub.progress?.level||1)-1),2)*100)*100))}%`}}/></div><small>До следующего уровня: {Math.max(0,Number(gameHub.progress?.next_level_xp||100)-Number(gameHub.progress?.xp||0))} XP</small></div></section>
              <div className="profile-stat-grid"><article><small>ОТКРЫТО КЕЙСОВ</small><b>{gameHub.progress?.total_cases_opened||0}</b></article><article><small>ПРОДАНО ПРЕДМЕТОВ</small><b>{gameHub.progress?.total_sales||0}</b></article><article><small>АПГРЕЙДОВ</small><b>{gameHub.progress?.total_upgrades||0}</b></article><article><small>СЕРИЯ ВХОДОВ</small><b>{gameHub.progress?.daily_streak||0} дней</b></article></div>
            </main>
          )}

          {page === "Админка" && isAdmin && (
            <main className="content admin-content">
              <div className="admin-heading">
                <div>
                  <span className="admin-kicker">CONTROL CENTER</span>
                  <h2>🛡️ BrainGG Admin Panel</h2>
                  <p>Управление игроками, балансом, кейсами и коллекциями.</p>
                </div>
                <div className="admin-secure-badge">● ЗАЩИЩЁННЫЙ ДОСТУП</div>
              </div>

              <nav className="admin-tabs" aria-label="Разделы админ-панели">
                {[
                  ["overview", "Обзор", "▦"],
                  ["players", "Игроки", "♙"],
                  ["history", "Журнал", "◷"],
                  ["events", "События", "✦"],
                ].map(([key, label, icon]) => (
                  <button
                    key={key}
                    type="button"
                    className={adminSection === key ? "active" : ""}
                    onClick={() => setAdminSection(key)}
                  >
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </nav>

              {adminSection === "overview" && (
                <>
                  <div className="admin-metrics-grid">
                    <article className="admin-metric-card">
                      <span className="admin-metric-icon">↗</span>
                      <small>ОПЕРАЦИЙ В ЖУРНАЛЕ</small>
                      <strong>{adminTotalOperations}</strong>
                      <em>Последние 100 записей</em>
                    </article>
                    <article className="admin-metric-card">
                      <span className="admin-metric-icon">◎</span>
                      <small>УНИКАЛЬНЫХ ИГРОКОВ</small>
                      <strong>{adminUniquePlayers}</strong>
                      <em>По журналу выдач</em>
                    </article>
                    <article className="admin-metric-card">
                      <span className="admin-metric-icon">◇</span>
                      <small>ВЫДАНО GG</small>
                      <strong>{adminTotalCoins.toLocaleString("ru-RU")}</strong>
                      <em>Сумма записей coins</em>
                    </article>
                    <article className="admin-metric-card admin-metric-info">
                      <span className="admin-metric-icon">❄</span>
                      <small>СОСТОЯНИЕ ДОСТУПА</small>
                      <strong>Активен</strong>
                      <em>Проверка прав на сервере</em>
                    </article>
                  </div>

                  <section className="admin-panel-card"><div className="admin-section-title"><span className="admin-section-icon">❄</span><div><h3>Arctic Season 2</h3><p>Состояние новых игровых модулей.</p></div><button className="admin-refresh-button" type="button" onClick={loadAdminGameStats}>↻</button></div><div className="admin-metrics-grid"><article className="admin-metric-card"><small>ВСЕ ИГРОКИ</small><strong>{adminGameStats?.players ?? "—"}</strong></article><article className="admin-metric-card"><small>ПРЕДМЕТОВ В ИНВЕНТАРЯХ</small><strong>{adminGameStats?.inventory_items ?? "—"}</strong></article><article className="admin-metric-card"><small>ПРОФИЛЕЙ С XP</small><strong>{adminGameStats?.active_profiles ?? "—"}</strong></article></div><p className="admin-data-note">Новые показатели доступны после применения миграции migrations_arctic_season2.sql.</p></section>
                  <section className="admin-panel-card admin-overview-card">
                    <div className="admin-section-title">
                      <span className="admin-section-icon">⌁</span>
                      <div><h3>Быстрые действия</h3><p>Переход к основным операциям администратора.</p></div>
                    </div>
                    <div className="admin-quick-actions">
                      <button type="button" onClick={() => setAdminSection("players")}><b>♙</b><span><strong>Найти игрока</strong><small>Профиль, баланс и инвентарь</small></span><i>→</i></button>
                      <button type="button" onClick={() => { setAdminSection("history"); loadAdminLogs(); }}><b>◷</b><span><strong>Журнал операций</strong><small>Проверить последние выдачи</small></span><i>→</i></button>
                    </div>
                  </section>

                  <section className="admin-panel-card">
                    <div className="admin-section-title"><span className="admin-section-icon">◷</span><div><h3>Последние операции</h3><p>Недавние действия из серверного журнала.</p></div><button className="admin-refresh-button" type="button" onClick={loadAdminLogs} disabled={adminLogsLoading}>{adminLogsLoading ? "..." : "↻ Обновить"}</button></div>
                    {adminLogs.slice(0, 5).length === 0 ? <p className="admin-muted">В журнале пока нет операций.</p> : (
                      <div className="admin-history-list">{adminLogs.slice(0, 5).map((log) => (
                        <div className="admin-history-row" key={log.id}>
                          <div className="admin-history-symbol">{log.action === "coins" ? "🪙" : log.action === "cases" ? "🎁" : "🧠"}</div>
                          <div className="admin-history-main"><b>{log.action === "coins" ? `+${log.amount} GG` : log.action === "cases" ? `+${log.amount} ${displayCaseName(log.case_name) || "кейсов"}` : `+${log.amount} ${log.item_name || "брейнрот"}`}</b><small>Game ID: {log.game_id}</small></div>
                          <time>{log.created_at ? new Date(log.created_at).toLocaleString("ru-RU") : "—"}</time>
                        </div>
                      ))}</div>
                    )}
                  </section>
                  <p className="admin-data-note">Статистика рассчитана по последним 100 административным выдачам. Данные платежей, оборота и всех игроков пока не подключены к API и здесь не имитируются.</p>
                </>
              )}

              {adminSection === "players" && (
                <>
              <section className="admin-panel-card">
                <div className="admin-section-title">
                  <span className="admin-section-icon">⌕</span>
                  <div>
                    <h3>Найти игрока</h3>
                    <p>Введи точный Game ID игрока.</p>
                  </div>
                </div>

                <form className="admin-search-row" onSubmit={searchAdminPlayer}>
                  <input
                    className="admin-input"
                    value={adminGameId}
                    onChange={(event) => setAdminGameId(event.target.value)}
                    placeholder="Например: 102938"
                    autoComplete="off"
                  />
                  <button
                    className="main-button admin-search-button"
                    type="submit"
                    disabled={adminSearchLoading}
                  >
                    {adminSearchLoading ? "Ищем..." : "Найти игрока"}
                  </button>
                </form>
              </section>

              {adminPlayer && (
                <>
                  <section className="admin-player-card">
                    <div className="admin-player-avatar">👤</div>
                    <div className="admin-player-details">
                      <span className="admin-kicker">PLAYER FOUND</span>
                      <h3>
                        {adminPlayer.username
                          ? `@${adminPlayer.username}`
                          : "Игрок BrainGG"}
                      </h3>
                      <p>Game ID: <b>{adminPlayer.game_id}</b></p>
                    </div>
                    <div className="admin-player-stats">
                      <div>
                        <small>БАЛАНС</small>
                        <b>🪙 {adminPlayer.balance ?? 0} GG</b>
                      </div>
                      <div>
                        <small>БЕСПЛАТНЫЕ КЕЙСЫ</small>
                        <b>🎁 {adminPlayer.free_cases_total ?? adminPlayer.free_cases ?? 0}</b>
                      </div>
                      <div>
                        <small>БРЕЙНРОТЫ</small>
                        <b>🧠 {adminInventory.length}</b>
                      </div>
                      <div>
                        <small>ОПЫТ ПРОФИЛЯ</small>
                        <b>❄ {adminPlayer.progress?.xp ?? 0} XP</b>
                      </div>
                    </div>
                  </section>

                  {Array.isArray(adminPlayer.free_case_credits) &&
                    adminPlayer.free_case_credits.length > 0 && (
                      <section className="admin-free-cases">
                        <b>Бесплатные кейсы по типам</b>
                        <div className="admin-free-case-list">
                          {adminPlayer.free_case_credits.map((credit) => (
                            <div className="admin-free-case-row" key={credit.case_name}>
                              <span className="admin-free-case-label">{cases.find((item) => item.caseName === credit.case_name) && <img src={caseImageSrc(cases.find((item) => item.caseName === credit.case_name))} alt="" />} {cases.find((item) => item.caseName === credit.case_name)?.name || displayCaseName(credit.case_name)}</span>
                              <strong>×{credit.amount}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                  <section className="admin-panel-card">
                    <div className="admin-section-title">
                      <span className="admin-section-icon">✦</span>
                      <div>
                        <h3>Выдать награду</h3>
                        <p>Выдача применяется сервером и записывается в историю.</p>
                      </div>
                    </div>

                    <form className="admin-grant-form" onSubmit={grantAdminReward}>
                      <label className="admin-field">
                        <span>Тип награды</span>
                        <select
                          className="admin-input"
                          value={adminGrantType}
                          onChange={(event) => {
                            setAdminGrantType(event.target.value);
                            setAdminMessage("");
                          }}
                        >
                          <option value="coins">🪙 Монеты GG</option>
                          <option value="cases">🎁 Бесплатные кейсы</option>
                          <option value="brainrot">🧠 Брейнрот</option>
                          <option value="xp">❄ Опыт профиля (XP)</option>
                        </select>
                      </label>

                      {adminGrantType === "cases" && (
                        <label className="admin-field admin-full-field">
                          <span>Какой кейс выдать бесплатно?</span>
                          <select
                            className="admin-input"
                            value={adminCaseName}
                            onChange={(event) => setAdminCaseName(event.target.value)}
                          >
                            {cases.map((item) => (
                              <option key={item.id} value={item.caseName}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {adminGrantType === "brainrot" && (
                        <label className="admin-field admin-full-field">
                          <span>Выбери брейнрота</span>
                          <select
                            className="admin-input"
                            value={adminItemName}
                            onChange={(event) => setAdminItemName(event.target.value)}
                          >
                            <option value="">Выбрать брейнрота...</option>
                            {upgradeTargets.map((item) => (
                              <option key={item.item_name} value={item.item_name}>
                                {item.item_name} · {item.value_gg} GG
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <label className="admin-field">
                        <span>Количество</span>
                        <input
                          className="admin-input"
                          type="number"
                          min="1"
                          max="1000000"
                          step="1"
                          value={adminAmount}
                          onChange={(event) => setAdminAmount(event.target.value)}
                        />
                      </label>

                      <button
                        className="main-button admin-grant-button"
                        type="submit"
                        disabled={adminGrantLoading}
                      >
                        {adminGrantLoading ? "Выполняем выдачу..." : "✦ ВЫДАТЬ НАГРАДУ"}
                      </button>
                    </form>
                  </section>

                  <section className="admin-panel-card">
                    <div className="admin-section-title">
                      <span className="admin-section-icon">🧠</span>
                      <div>
                        <h3>Инвентарь игрока</h3>
                        <p>Предметы, которые сейчас находятся у игрока.</p>
                      </div>
                    </div>

                    {adminInventory.length === 0 ? (
                      <p className="admin-muted">У игрока пока нет брейнротов.</p>
                    ) : (
                      <div className="admin-inventory-list">
                        {adminInventory.map((item) => (
                          <div className="admin-inventory-row" key={item.id}>
                            <span>🧠</span>
                            <b>{item.item_name}{item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">🍓 ×2.5</span> : null}</b>
                            <small>{item.rarity}</small>
                            <strong>{item.value_gg} GG</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {adminMessage && (
                <div className={`admin-feedback ${adminMessageError ? "error" : "success"}`}>
                  {adminMessage}
                </div>
              )}
                </>
              )}

              {adminSection === "events" && (
                <>
                  {isOwner ? (
                    <>
                      <section className="admin-panel-card global-message-admin-card">
                        <div className="admin-section-title"><span className="admin-section-icon">📣</span><div><h3>Глобальное сообщение</h3><p>Сообщение мгновенно появится у игроков, которые сейчас открыли BrainGG.</p></div></div>
                        <form className="global-message-form" onSubmit={sendGlobalMessage}>
                          <textarea className="admin-input global-message-textarea" maxLength={500} value={globalMessageDraft} onChange={(event) => setGlobalMessageDraft(event.target.value)} placeholder="Напиши сообщение всем игрокам онлайн..." />
                          <div className="global-message-form-footer"><small>{globalMessageDraft.length}/500 · Отправка только владельцем</small><button className="main-button" type="submit" disabled={globalMessageSending || !globalMessageDraft.trim()}>{globalMessageSending ? "Отправляем..." : "📣 Отправить всем онлайн"}</button></div>
                        </form>
                      </section>

                      <section className="admin-panel-card admin-events-card">
                        <div className="admin-section-title"><span className="admin-section-icon">🌍</span><div><h3>Глобальные админ-ивенты</h3><p>Один активный ивент на весь BrainGG. Каждый запуск длится 2 минуты 59 секунд.</p></div></div>
                        {globalEvent?.event_name && <div className="admin-active-event"><b>Сейчас активен: {globalEvent.event_name === "tacos" ? "🌮 It's Raining Tacos" : globalEvent.event_name === "lucky" ? "🍀 LUCKY DAY!" : "🍓 STRAWBERRY DAY!"}</b><span>Осталось {Math.floor(eventRemainingSeconds / 60)}:{String(eventRemainingSeconds % 60).padStart(2, "0")}</span></div>}
                        <div className="admin-event-grid">
                          {[
                            ["tacos", "🌮", "It's Raining Tacos", "Тако вместо снега, тёплый фон и музыка события."],
                            ["lucky", "🍀", "LUCKY DAY!", "Клеверы, золотисто-зелёная тема и x2 удача в кейсах и апгрейдере."],
                            ["strawberry", "🍓", "STRAWBERRY DAY!", "Клубничная тема, тихая музыка и 5% шанс мутации ×2.5."],
                          ].map(([key, icon, title, description]) => (
                            <article className={`admin-event-card admin-event-${key} ${globalEvent?.event_name === key ? "is-active" : ""}`} key={key}>
                              <div className="admin-event-icon">{icon}</div><h4>{title}</h4><p>{description}</p>
                              <button type="button" className="main-button" disabled={adminEventLoading} onClick={() => toggleAdminEvent(key)}>{adminEventLoading ? "Подождите..." : globalEvent?.event_name === key ? "Остановить ивент" : "Запустить на 2:59"}</button>
                            </article>
                          ))}
                        </div>
                        {globalEvent?.event_name && <button type="button" className="admin-event-stop-button" disabled={adminEventLoading} onClick={() => toggleAdminEvent(null)}>■ Остановить текущий ивент</button>}
                        <p className="admin-data-note">Доступ к запуску и остановке проверяется на сервере по Telegram ID владельца. Другие администраторы не могут запускать ивенты или отправлять глобальные сообщения.</p>
                      </section>
                    </>
                  ) : (
                    <section className="admin-panel-card"><h3>Управление событиями доступно только владельцу</h3><p className="admin-muted">Твоя учётная запись имеет доступ к обычной админ-панели, но не подтверждена как владелец BrainGG.</p></section>
                  )}
                  {adminMessage && <div className={`admin-feedback ${adminMessageError ? "error" : "success"}`}>{adminMessage}</div>}
                  {adminEventFeedback && <div className={`admin-feedback ${adminEventFeedbackError ? "error" : "success"}`}>{adminEventFeedback}</div>}
                </>
              )}

              {adminSection === "history" && (
              <section className="admin-panel-card admin-history-card">
                <div className="admin-section-title admin-history-heading">
                  <span className="admin-section-icon">◷</span>
                  <div>
                    <h3>История выдач</h3>
                    <p>Последние административные операции.</p>
                  </div>
                  <button
                    className="admin-refresh-button"
                    type="button"
                    onClick={loadAdminLogs}
                    disabled={adminLogsLoading}
                  >
                    {adminLogsLoading ? "..." : "↻ Обновить"}
                  </button>
                </div>

                <div className="admin-log-filters">
                  <input className="admin-input" value={adminLogQuery} onChange={(event) => setAdminLogQuery(event.target.value)} placeholder="Поиск по Game ID, предмету или админу" />
                  <select className="admin-input" value={adminLogAction} onChange={(event) => setAdminLogAction(event.target.value)}>
                    <option value="all">Все операции</option><option value="coins">Монеты GG</option><option value="cases">Бесплатные кейсы</option><option value="brainrot">Брейнроты</option>
                  </select>
                </div>
                {adminLogsLoading ? (
                  <p className="admin-muted">Загружаем историю...</p>
                ) : filteredAdminLogs.length === 0 ? (
                  <p className="admin-muted">По выбранным фильтрам операций нет.</p>
                ) : (
                  <div className="admin-history-list">
                    {filteredAdminLogs.map((log) => (
                      <div className="admin-history-row" key={log.id}>
                        <div className="admin-history-symbol">
                          {log.action === "coins" ? "🪙" : log.action === "cases" ? "🎁" : "🧠"}
                        </div>
                        <div className="admin-history-main">
                          <b>
                            {log.action === "coins"
                              ? `+${log.amount} GG`
                              : log.action === "cases"
                              ? `+${log.amount} бесплатных ${displayCaseName(log.case_name) || "кейсов"}`
                              : `+${log.amount} ${log.item_name || "брейнрот"}`}
                          </b>
                          <small>Game ID: {log.game_id}</small>
                        </div>
                        <time>
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString("ru-RU")
                            : "—"}
                        </time>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              )}
            </main>
          )}
        </>
      )}

      {showRewardModal && lastRewards.length > 0 && (
        <div className="reward-modal-backdrop" role="presentation" onClick={() => setShowRewardModal(false)}>
          <section className="reward-modal" role="dialog" aria-modal="true" aria-labelledby="case-reward-title" onClick={(event) => event.stopPropagation()}>
            <div className="reward-modal-sparkle" aria-hidden="true">✦ ❄ ✦</div>
            <span className="reward-modal-kicker">BRAIN GG · DROP CONFIRMED</span>
            <h2 id="case-reward-title">Твой выигрыш!</h2>
            <div className={`reward-modal-grid ${lastRewards.length > 1 ? "multi" : ""}`}>
              {lastRewards.map((reward, index) => (
                <article className="reward-modal-item" key={`${reward.item_name}-${index}`}>
                  <div className="reward-modal-art">{brainrotImage(reward) ? <img className={reward.mutation === "strawberry" ? "mutation-strawberry-image" : ""} src={brainrotImage(reward)} alt={reward.item_name} /> : <span>🧠</span>}</div>
                  <h3>{reward.item_name || reward.name}</h3>
                  <span className={`reward-modal-rarity ${reward.rarity === "OG" ? "rarity-og" : ""}`}>{reward.rarity || "Brainrot"}</span>
                  {reward.mutation === "strawberry" && <span className="strawberry-mutation-pill">🍓 Клубничная мутация · ×2.5</span>}
                  <strong>{Number(reward.value_gg || reward.sold_price || 0).toLocaleString("ru-RU")} GG</strong>
                </article>
              ))}
            </div>
            <p className="reward-modal-note">Предмет уже сохранён на сервере. Выбери, что делать дальше.</p>
            <div className="reward-modal-actions">
              <button className="main-button" onClick={() => { setShowRewardModal(false); setActionMessage("Награда сохранена в инвентаре!"); }}>✓ Забрать</button>
              <button className="case-button reward-upgrade-button" onClick={() => {
                const reward = lastRewards[0];
                const owned = rewardInventoryRows.find((item) => String(item.item_name).toLowerCase() === String(reward.item_name || reward.name).toLowerCase() && (item.mutation || null) === (reward.mutation || null));
                if (!owned) { setShowRewardModal(false); setActionMessage("Награда уже сохранена в инвентаре. Обнови инвентарь, чтобы выбрать её для апгрейда."); changePage("Инвентарь"); return; }
                setShowRewardModal(false); chooseSource(owned); changePage("Апгрейдер");
              }}>⚡ Апгрейд {lastRewards.length > 1 ? "первого предмета" : "предмета"}</button>
            </div>
            {lastRewards.length > 1 && <button className="reward-upgrade-all-note" onClick={() => { setShowRewardModal(false); changePage("Инвентарь"); }}>Посмотреть все предметы в инвентаре</button>}
          </section>
        </div>
      )}

      {customError && (
        <>
          <style>{`
            .braingg-error-overlay {
              position: fixed;
              inset: 0;
              z-index: 99999;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 22px;
              background: rgba(5, 3, 12, .78);
              backdrop-filter: blur(10px);
              animation: brainErrorFade .18s ease-out;
            }
            .braingg-error-card {
              width: min(100%, 360px);
              padding: 26px 22px 20px;
              border: 1px solid rgba(183, 112, 255, .38);
              border-radius: 22px;
              background: linear-gradient(145deg, #211532 0%, #100d1d 75%);
              box-shadow: 0 18px 70px rgba(0, 0, 0, .58), 0 0 34px rgba(155, 83, 255, .16);
              color: #f8f3ff;
              text-align: center;
              animation: brainErrorPop .22s ease-out;
            }
            .braingg-error-icon {
              width: 58px;
              height: 58px;
              margin: 0 auto 14px;
              display: grid;
              place-items: center;
              border-radius: 18px;
              background: linear-gradient(135deg, #9b5cff, #6234bb);
              box-shadow: 0 8px 28px rgba(142, 82, 255, .3);
              font-size: 29px;
            }
            .braingg-error-card h3 {
              margin: 0 0 9px;
              font-size: 21px;
              font-weight: 900;
            }
            .braingg-error-card p {
              margin: 0 0 21px;
              color: #c9bddb;
              font-size: 14px;
              line-height: 1.55;
            }
            .braingg-error-card button {
              width: 100%;
              min-height: 46px;
              border: 0;
              border-radius: 13px;
              color: white;
              background: linear-gradient(100deg, #9b5cff, #7040d5);
              font-weight: 800;
              font-size: 15px;
              box-shadow: 0 7px 22px rgba(126, 72, 225, .25);
              cursor: pointer;
            }
            @keyframes brainErrorFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes brainErrorPop { from { opacity: 0; transform: translateY(9px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>
          <div className="braingg-error-overlay" onClick={() => setCustomError("")}>
            <div
              className="braingg-error-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="braingg-error-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="braingg-error-icon">!</div>
              <h3 id="braingg-error-title">Что-то пошло не так</h3>
              <p>{customError}</p>
              <button onClick={() => setCustomError("")}>ПОНЯТНО</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
