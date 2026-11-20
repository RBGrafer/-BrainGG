
import React, { useEffect, useRef, useState } from "react";
import { cases, specialCases } from "./data/cases.js";
import { supabase } from "./supabase.js";
import redHomeBackground from "./assets/braingg-red-home.svg";
import partyHomeBackground from "./assets/braingg-party-home.png";
import artCappuccinoBallerina from "./assets/brainrots/v17/cappuccino-ballerina.webp";
import artCrocodileAviator from "./assets/brainrots/v17/crocodile-aviator.webp";
import artNinjaEspresso from "./assets/brainrots/v17/ninja-espresso.webp";
import artSlimeSquad from "./assets/brainrots/v17/slime-squad.webp";
import artPizzaGolem from "./assets/brainrots/v17/pizza-golem.webp";
import artIceDragon from "./assets/brainrots/v17/ice-dragon.webp";
import artRollerShrimp from "./assets/brainrots/v17/roller-shrimp.webp";
import artStrawberryRhino from "./assets/brainrots/v17/strawberry-rhino.webp";
import artMushroomKnight from "./assets/brainrots/v17/mushroom-knight.webp";
import artMaskedCoffeeBean from "./assets/brainrots/v17/masked-coffee-bean.webp";
import artElectricSheep from "./assets/brainrots/v17/electric-sheep.webp";
import artToastCrab from "./assets/brainrots/v17/toast-crab.webp";
import artPineappleElephant from "./assets/brainrots/v17/pineapple-elephant.webp";
import artCactusJellyfish from "./assets/brainrots/v17/cactus-jellyfish.webp";
import artGeckoPilot from "./assets/brainrots/v17/gecko-pilot.webp";
import artRaccoonVendor from "./assets/brainrots/v17/raccoon-vendor.webp";
import caseFallbackArt from "./assets/cases/v17/case-fallback.svg";
import depCookieBatter from "./assets/brainrots/deposits/cookie-batter.webp";
import depMonocycleRider from "./assets/brainrots/deposits/monocycle-rider.webp";
import depBlueLetterSquad from "./assets/brainrots/deposits/blue-letter-squad.webp";
import depTuffToucan from "./assets/brainrots/deposits/tuff-toucan.webp";
import depPizzaSauceDuo from "./assets/brainrots/deposits/pizza-sauce-duo.webp";
import depRoseAndBear from "./assets/brainrots/deposits/rose-and-bear.webp";
import depHauntedHouse from "./assets/brainrots/deposits/haunted-house.webp";
import depRicoDinero from "./assets/brainrots/deposits/rico-dinero.webp";
import depGhostPumpkin from "./assets/brainrots/deposits/ghost-pumpkin.webp";
import depGoldenDragon from "./assets/brainrots/deposits/golden-dragon.webp";
import depIceYetiAtm from "./assets/brainrots/deposits/ice-yeti-atm.webp";
import depBoneCageMonster from "./assets/brainrots/deposits/bone-cage-monster.webp";
import depArcadeMonster from "./assets/brainrots/deposits/arcade-monster.webp";
import depFlyingClockCharacter from "./assets/brainrots/deposits/flying-clock-character.webp";
import depPixelDuo from "./assets/brainrots/deposits/pixel-duo.webp";

const STREAMER_MODE_STORAGE_KEY = "braingg-streamer-mode-v1";
const SITE_THEME_STORAGE_KEY = "braingg-site-theme-v1";
const DISABLED_PAGES = new Set(["Коллекция", "Достижения", "Глобальные события"]);
const STREAMER_RESTRICTED_PAGES = new Set(["Кейсы", "Апгрейдер", "Мины", "Live Drops", "Глобальные события", "История", "Промокод", "Задания", "Достижения", "Админка"]);

// Human-readable case titles. Backend identifiers intentionally stay unchanged.
const CASE_DISPLAY_NAMES = {
  "Truckini Case": "Red Starter",
  "Summer Case": "Scarlet Drop",
  "Bloody Case": "Bloodline",
  "Crafting Case": "Crimson Vault",
  "Legend Case": "Royal Red",
  "Elite Case": "White Crown",
  "All In Strawberry Elephant": "All In: Strawberry",
  "All In Headless Horseman": "All In: Headless",
  "Nick Case": "NICK CASE",
  "Free Case": "FREE CASE",
  "BrainGG Case": "BrainGG CASE",
};
function displayCaseName(value) {
  const key = String(value || "");
  return CASE_DISPLAY_NAMES[key] || key || "Кейс";
}

function getCaseRewardPoolName(item) {
  return String(item?.rewardCaseName || item?.caseName || "");
}

// Keep upgrade-wheel geometry in this module so Vercel cannot fail on a missing
// optional helper file in deployments that upload only the src tree.
function normalizeUpgradeChance(value, fallback = 0.1) {
  const parsed = Number(value);
  const fallbackValue = Number(fallback);
  const safeValue = Number.isFinite(parsed)
    ? parsed
    : Number.isFinite(fallbackValue)
      ? fallbackValue
      : 0.1;
  return Math.min(90, Math.max(0.1, safeValue));
}

function formatUpgradeChance(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function getSpecialCaseRemainingSeconds(access, now = Date.now()) {
  const cooldownUntil = Date.parse(String(access?.cooldownUntil || ""));
  return Number.isFinite(cooldownUntil)
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : Math.max(0, Number(access?.remainingSeconds || 0));
}

function formatCooldownCountdown(seconds) {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const pad = (value) => String(value).padStart(2, "0");
  if (days > 0) return `${days}д ${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
}

function csvField(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsvFile(filename, headers, rows) {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined" || typeof URL.createObjectURL !== "function") return false;
  let url = "";
  try {
    const content = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvField).join(";")).join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    return true;
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    console.warn("BrainGG CSV export failed:", error);
    return false;
  }
}

// Keep the case reel's winning card centered under the fixed pointer.
// The item widths intentionally match the responsive CSS breakpoints below.
function getCaseReelItemWidth() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return 132;
  if (window.matchMedia("(max-width: 600px)").matches) return 104;
  if (window.matchMedia("(max-width: 620px)").matches) return 118;
  return 132;
}

function getCaseReelOffset(position) {
  const itemWidth = getCaseReelItemWidth();
  const safePosition = Math.max(0, Number(position) || 0);
  return -(safePosition * itemWidth + itemWidth / 2);
}

// All brainrot artwork is imported from src/assets. Vite bundles these files,
// so Vercel cannot silently omit images from a public/ folder during deployment.
const BRAINROT_ART = [
  { match: ["ballerina cappuccina", "cappuccina"], image: artCappuccinoBallerina },
  { match: ["bombardiro crocodilo", "bombardiro"], image: artCrocodileAviator },
  { match: ["cappuccino assassino", "assassino"], image: artNinjaEspresso },
  { match: ["los tralaleritos", "tralaleritos"], image: artSlimeSquad },
  { match: ["noobini pizzanini", "pizzanini"], image: artPizzaGolem },
  { match: ["tralalero tralala", "dragon cannelloni", "dragon canneloni"], image: artIceDragon },
  { match: ["trippi troppi"], image: artRollerShrimp },
  { match: ["strawberry elephant"], image: artStrawberryRhino },
  { match: ["headless horseman"], image: artMushroomKnight },
  { match: ["john pork"], image: artMaskedCoffeeBean },
  { match: ["meowl"], image: artElectricSheep },
  { match: ["skibidi toilet"], image: artToastCrab },
  { match: ["la grande combinasion"], image: artPineappleElephant },
  { match: ["lirili larila", "brr brr patapim"], image: artCactusJellyfish },
  { match: ["arcadragon", "dragon"], image: artGeckoPilot },
  { match: ["fishino clownino", "shrimp"], image: artRollerShrimp },
  { match: ["tuff toucan"], image: depTuffToucan },
  { match: ["rico dinero"], image: depRicoDinero },
  { match: ["бисквит с битой", "cookie batter"], image: depCookieBatter },
  { match: ["наездник на моноцикле", "monocycle rider"], image: depMonocycleRider },
  { match: ["отряд синих букв", "blue letter squad"], image: depBlueLetterSquad },
  { match: ["пицца и соус", "pizza and sauce"], image: depPizzaSauceDuo },
  { match: ["розочка и медвежонок", "rose and bear"], image: depRoseAndBear },
  { match: ["дом монстр", "haunted house"], image: depHauntedHouse },
  { match: ["призрак и тыквенный голем", "ghost pumpkin"], image: depGhostPumpkin },
  { match: ["золотой дракон", "golden dragon"], image: depGoldenDragon },
  { match: ["ледяной йети банкомат", "ice yeti atm"], image: depIceYetiAtm },
  { match: ["красный монстр в костяной клетке", "bone cage monster"], image: depBoneCageMonster },
  { match: ["аркадный монстр", "arcade monster"], image: depArcadeMonster },
  { match: ["персонаж с летающими часами", "flying clock"], image: depFlyingClockCharacter },
  { match: ["два пиксельных персонажа", "pixel duo"], image: depPixelDuo },
];
const BRAINROT_FALLBACK_ART = [
  artCappuccinoBallerina, artCrocodileAviator, artNinjaEspresso, artPineappleElephant,
  artIceDragon, artCactusJellyfish, artPizzaGolem, artGeckoPilot,
  artRollerShrimp, artSlimeSquad, artMaskedCoffeeBean, artMushroomKnight,
  artStrawberryRhino, artToastCrab, artRaccoonVendor, artElectricSheep,
];
const DEPOSIT_BRAINROT_DISPLAY_NAMES = {
  "cookie-batter": "Tang Tang Keletang",
  "monocycle-rider": "Tic Tac Sahur",
  "blue-letter-squad": "Los 67",
  "tuff-toucan": "Tuff Toucan",
  "pizza-sauce-duo": "Pizza And Ranch",
  "rose-and-bear": "Rosey And Teddy",
  "haunted-house": "La Casa Boo",
  "rico-dinero": "Rico Dinero",
  "ghost-pumpkin": "Spooky And Pumpkin",
  "golden-dragon": "Dragon Cannelloni",
  "ice-yeti-atm": "Yetimatic",
  "bone-cage-monster": "Dug Dug Dug",
  "arcade-monster": "Arcadopus",
  "flying-clock-character": "La Grande Combinasion",
  "pixel-duo": "Garama And Madungdung",
};

function depositBrainrotName(item, fallback = "Брейнрот") {
  const key = String(item?.image_key || item?.item_key || item?.brainrot_key || "");
  return DEPOSIT_BRAINROT_DISPLAY_NAMES[key] || item?.display_name || item?.brainrot_name || fallback;
}

const DEPOSIT_BRAINROT_IMAGES = {
  "cookie-batter": depCookieBatter,
  "monocycle-rider": depMonocycleRider,
  "blue-letter-squad": depBlueLetterSquad,
  "tuff-toucan": depTuffToucan,
  "pizza-sauce-duo": depPizzaSauceDuo,
  "rose-and-bear": depRoseAndBear,
  "haunted-house": depHauntedHouse,
  "rico-dinero": depRicoDinero,
  "ghost-pumpkin": depGhostPumpkin,
  "golden-dragon": depGoldenDragon,
  "ice-yeti-atm": depIceYetiAtm,
  "bone-cage-monster": depBoneCageMonster,
  "arcade-monster": depArcadeMonster,
  "flying-clock-character": depFlyingClockCharacter,
  "pixel-duo": depPixelDuo,
};

function brainrotImage(item) {
  const name = String(item?.item_name || item?.name || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  const local = BRAINROT_ART.find((entry) => entry.match.some((key) => name.includes(key)))?.image;
  if (local) return local;
  const hash = [...name].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
  return BRAINROT_FALLBACK_ART[hash % BRAINROT_FALLBACK_ART.length] || BRAINROT_FALLBACK_ART[0];
}

function depositBrainrotImage(item) {
  return DEPOSIT_BRAINROT_IMAGES[String(item?.image_key || item?.item_key || "")] || artCappuccinoBallerina;
}

function handleBrainrotImageError(event) {
  if (event?.currentTarget && event.currentTarget.src !== artCappuccinoBallerina) {
    event.currentTarget.onerror = null;
    event.currentTarget.src = artCappuccinoBallerina;
  }
}

function caseImageSrc(item) {
  return item?.image || caseFallbackArt;
}

function CaseArtwork({ item, className = "", alt }) {
  const image = caseImageSrc(item);
  return (
    <div className={`${className} case-artwork`}>
      <img
        src={image}
        alt={alt || item?.name || "Изображение кейса"}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = caseFallbackArt;
        }}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

function rarityClassName(value) {
  const rarity = String(value || "common").toLowerCase();
  if (rarity.includes("og")) return "rarity-og";
  if (rarity.includes("secret") || rarity.includes("секрет")) return "rarity-secret";
  if (rarity.includes("mythic") || rarity.includes("мифик") || rarity.includes("мифич")) return "rarity-mythic";
  if (rarity.includes("legend") || rarity.includes("легендар")) return "rarity-legendary";
  if (rarity.includes("epic") || rarity.includes("эпич")) return "rarity-epic";
  if (rarity.includes("rare") || rarity.includes("редк")) return "rarity-rare";
  return "rarity-common";
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
    Math.max(0.1, Math.sqrt(sourcePrice / targetPrice) * 100 * Math.max(1, Number(luckMultiplier) || 1))
  );
}

function upgradeEventMultiplier(eventName) {
  if (eventName === "lucky") return 2;
  if (eventName === "power_upgrade") return 1.5;
  return 1;
}

function effectiveCasePrice(item, eventName) {
  const base = Math.max(1, Number(item?.price || 0));
  return eventName === "case_sale" ? Math.max(1, Math.floor(base * 0.75)) : base;
}

function formatAdminEventDuration(value) {
  const safe = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}


// Дополнительные Admin Abuse события. Это глобальные визуальные/атмосферные темы;
// экономические множители применяются только для явно поддержанных игровых событий.
const ADMIN_ABUSE_EXTRA_EVENTS = [
  { key: "meteor_rain", icon: "☄️", title: "METEOR RAIN", category: "chaos", description: "Метеоритный дождь и огненные вспышки по всему BrainGG." },
  { key: "glitch_storm", icon: "🌀", title: "GLITCH STORM", category: "chaos", description: "Глитч-шторм, цифровые помехи и неоновая атмосфера." },
  { key: "void_portal", icon: "🕳️", title: "VOID PORTAL", category: "visual", description: "Открывается портал в пустоту с тёмной аурой." },
  { key: "rainbow_burst", icon: "🌈", title: "RAINBOW BURST", category: "visual", description: "Радужные вспышки и яркая праздничная тема." },
  { key: "thunder_chaos", icon: "🌩️", title: "THUNDER CHAOS", category: "chaos", description: "Грозовые вспышки и электрическая атмосфера." },
  { key: "neon_overload", icon: "💡", title: "NEON OVERLOAD", category: "visual", description: "Неоновые огни и насыщенное свечение интерфейса." },
  { key: "pixel_invasion", icon: "👾", title: "PIXEL INVASION", category: "chaos", description: "Пиксельное вторжение и ретро-аркадная тема." },
  { key: "shadow_realm", icon: "🌑", title: "SHADOW REALM", category: "visual", description: "Мрачная теневая атмосфера и затемнённая сцена." },
  { key: "crystal_rain", icon: "💎", title: "CRYSTAL RAIN", category: "visual", description: "Кристаллические частицы и холодное сияние." },
  { key: "volcano_mode", icon: "🌋", title: "VOLCANO MODE", category: "chaos", description: "Вулканическая тема с лавовыми вспышками." },
  { key: "frostbite", icon: "🥶", title: "FROSTBITE", category: "seasonal", description: "Ледяная атмосфера, иней и снежные частицы." },
  { key: "blizzard", icon: "🌨️", title: "BLIZZARD", category: "seasonal", description: "Сильная метель и зимнее оформление." },
  { key: "candy_world", icon: "🍬", title: "CANDY WORLD", category: "seasonal", description: "Сладкая конфетная тема с яркими цветами." },
  { key: "spooky_night", icon: "🎃", title: "SPOOKY NIGHT", category: "seasonal", description: "Хэллоуинская ночь, тыквы и жуткая атмосфера." },
  { key: "winter_magic", icon: "❄️", title: "WINTER MAGIC", category: "seasonal", description: "Зимнее волшебство и мерцающий снег." },
  { key: "summer_wave", icon: "🏖️", title: "SUMMER WAVE", category: "seasonal", description: "Летняя пляжная тема и солнечные вспышки." },
  { key: "spring_bloom", icon: "🌸", title: "SPRING BLOOM", category: "seasonal", description: "Весеннее цветение и лепестки сакуры." },
  { key: "love_storm", icon: "💗", title: "LOVE STORM", category: "seasonal", description: "Розовая романтическая тема с сердцами." },
  { key: "halloween_carnival", icon: "🕸️", title: "HALLOWEEN CARNIVAL", category: "seasonal", description: "Карнавал ужасов с паутиной и свечением." },
  { key: "new_year_countdown", icon: "🎆", title: "NEW YEAR COUNTDOWN", category: "seasonal", description: "Новогодние огни, салюты и праздничный фон." },
  { key: "easter_party", icon: "🐣", title: "EASTER PARTY", category: "seasonal", description: "Пасхальная тема с весенними украшениями." },
  { key: "anniversary_blast", icon: "🎂", title: "ANNIVERSARY BLAST", category: "seasonal", description: "Праздничный режим дня рождения BrainGG." },
  { key: "toxic_waste", icon: "☢️", title: "TOXIC WASTE", category: "chaos", description: "Токсичная зелёная тема с предупреждающими сигналами." },
  { key: "matrix_rush", icon: "💻", title: "MATRIX RUSH", category: "chaos", description: "Падающий цифровой код и матричная атмосфера." },
  { key: "earthquake", icon: "🌍", title: "EARTHQUAKE", category: "chaos", description: "Тема землетрясения с визуальными импульсами." },
  { key: "blackout", icon: "🔦", title: "BLACKOUT", category: "chaos", description: "Затемнение и аварийные световые акценты." },
  { key: "laser_show", icon: "🔴", title: "LASER SHOW", category: "visual", description: "Лазерное шоу и динамические цветные лучи." },
  { key: "cosmic_rift", icon: "🌌", title: "COSMIC RIFT", category: "visual", description: "Космический разлом, звёзды и фиолетовое свечение." },
  { key: "underwater", icon: "🫧", title: "UNDERWATER", category: "visual", description: "Подводная тема с пузырьками и синими оттенками." },
  { key: "desert_dust", icon: "🏜️", title: "DESERT DUST", category: "visual", description: "Песчаная буря и пустынная цветовая тема." },
  { key: "cyber_city", icon: "🌃", title: "CYBER CITY", category: "visual", description: "Киберпанк-город, неон и ночные огни." },
  { key: "pirate_raid", icon: "🏴‍☠️", title: "PIRATE RAID", category: "chaos", description: "Пиратский налёт и морская атмосфера." },
  { key: "alien_contact", icon: "🛸", title: "ALIEN CONTACT", category: "chaos", description: "Первый контакт с пришельцами и НЛО." },
  { key: "robot_revolt", icon: "🤖", title: "ROBOT REVOLT", category: "chaos", description: "Восстание роботов и механическая тема." },
  { key: "dragon_awakening", icon: "🐉", title: "DRAGON AWAKENING", category: "chaos", description: "Пробуждение дракона и огненная аура." },
  { key: "haunted_mansion", icon: "👻", title: "HAUNTED MANSION", category: "seasonal", description: "Особняк с привидениями и призрачный туман." },
  { key: "golden_hour", icon: "🌅", title: "GOLDEN HOUR", category: "visual", description: "Тёплая золотая цветовая тема заката." },
  { key: "moon_eclipse", icon: "🌘", title: "MOON ECLIPSE", category: "visual", description: "Лунное затмение и глубокая ночная палитра." },
  { key: "starfall", icon: "🌠", title: "STARFALL", category: "visual", description: "Звездопад и мерцающие космические частицы." },
  { key: "party_confetti", icon: "🎊", title: "PARTY CONFETTI", category: "seasonal", description: "Конфетти, праздничные огни и вечеринка." },
  { key: "admin_mayhem", icon: "💥", title: "ADMIN MAYHEM", category: "chaos", description: "Финальная хаотичная тема с яркими визуальными вспышками." },
];

export default function App() {
  const [page, setPage] = useState("Главная");
  const [minesBet, setMinesBet] = useState("10");
  const [minesCount, setMinesCount] = useState(3);
  const [minesGame, setMinesGame] = useState(null);
  const [minesBusy, setMinesBusy] = useState(false);
  const [minesMessage, setMinesMessage] = useState("");
  const [minesMessageError, setMinesMessageError] = useState(false);
  const [streamerMode, setStreamerMode] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(STREAMER_MODE_STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [streamerModeFeedback, setStreamerModeFeedback] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openCount, setOpenCount] = useState(1);
  const [fastOpen, setFastOpen] = useState(false);
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
  const [siteTheme, setSiteTheme] = useState(() => {
    if (typeof window === "undefined") return "party";
    try {
      const saved = window.localStorage.getItem(SITE_THEME_STORAGE_KEY);
      return saved === "red" || saved === "party" ? saved : "party";
    } catch { return "party"; }
  });
  const [musicNotice, setMusicNotice] = useState("");

  const [globalEvent, setGlobalEvent] = useState(null);
  const [globalMessage, setGlobalMessage] = useState(null);
  const [globalActivities, setGlobalActivities] = useState([]);
  const [globalActivityLoading, setGlobalActivityLoading] = useState(false);
  const [globalActivityError, setGlobalActivityError] = useState("");
  const [eventClock, setEventClock] = useState(Date.now());
  const [specialCaseClock, setSpecialCaseClock] = useState(Date.now());
  const [caseRewards, setCaseRewards] = useState([]);
  const [caseRewardsFor, setCaseRewardsFor] = useState("");
  const [caseRewardsLoading, setCaseRewardsLoading] = useState(false);
  const [specialCaseAccess, setSpecialCaseAccess] = useState({
    loading: false,
    nick: { allowed: false, reason: "Проверь условие доступа.", cooldownUntil: null, remainingSeconds: 0 },
    free: { allowed: false, reason: "Проверь подписку на канал.", cooldownUntil: null, remainingSeconds: 0 },
    deposit: { allowed: false, reason: "Проверь пополнения за последние 7 дней.", cooldownUntil: null, remainingSeconds: 0 },
  });
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
  const [upgradeWheelAnimating, setUpgradeWheelAnimating] = useState(false);
  const [upgradeAnimatedChance, setUpgradeAnimatedChance] = useState(0);
  const [upgradeSpinWon, setUpgradeSpinWon] = useState(null);
  // The fixed green sector stays at 12 o'clock. Only this outer pointer
  // position changes so a single 360-degree orbit can finish on win or loss.
  const [upgradePointerAngle, setUpgradePointerAngle] = useState(0);
  const [upgradePointerVisible, setUpgradePointerVisible] = useState(true);
  const upgradeChanceAnimationRef = useRef(null);

  const [sellingId, setSellingId] = useState(null);
  const [sellingAll, setSellingAll] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const menuGroups = [
    { title: "ИГРАТЬ", items: [
      { label: "Кейсы", page: "Кейсы", icon: "🎁", description: "Открывай кейсы и лови редкие дропы" },
      { label: "Мины", page: "Мины", icon: "💣", description: "Ищи безопасные клетки и забирай выигрыш" },
      { label: "Апгрейдер", page: "Апгрейдер", icon: "⚡", description: "Улучшай предметы из инвентаря" },
      { label: "Викторина", page: "Викторина", icon: "🧠", description: "Отвечай и зарабатывай GG" },
      { label: "Коллекция", page: "Коллекция", icon: "📚", description: "Все твои брейнроты в одном альбоме" },
    ]},
    { title: "ПРОГРЕСС", items: [
      { label: "Главная", page: "Главная", icon: "🏠", description: "Перейти на главную страницу BrainGG" },
      { label: "Квесты", page: "Задания", icon: "📋", description: "Выполняй миссии и забирай награды" },
      { label: "Достижения", page: "Достижения", icon: "🏆", description: "Открывай новые значки" },
      { label: "Рекорды", page: "Рейтинг", icon: "🥇", description: "Сравнивай свой XP с игроками" },
      { label: "Live Drops", page: "Live Drops", icon: "🔥", description: "Смотри последние выпадения" },
      { label: "Глобальные события", page: "Глобальные события", icon: "🌍", description: "Все действия игроков в реальном времени" },
    ]},
    { title: "АККАУНТ", items: [
      { label: "Профиль", page: "Профиль", icon: "👤", description: "Уровень, XP и твоя статистика" },
      { label: "Инвентарь", page: "Инвентарь", icon: "🎒", description: "Храни и продавай предметы" },
      { label: "История", page: "История", icon: "🕒", description: "Вспоминай все открытия" },
      { label: "Промокод", page: "Промокод", icon: "🎫", description: "Активируй бонусы" },
      { label: "Настройки", page: "Настройки", icon: "⚙", description: "Музыка и звуки" },
      { label: "Обучение", page: "Обучение", icon: "🎓", description: "Как играть и что делать" },
    ]},
  ];
  const visibleMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !DISABLED_PAGES.has(item.page) && !(streamerMode && STREAMER_RESTRICTED_PAGES.has(item.page))),
    }))
    .filter((group) => group.items.length > 0);
  const [customError, setCustomError] = useState("");

  // Состояние защищённой админ-панели BrainGG
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [globalMessageDraft, setGlobalMessageDraft] = useState("");
  const [globalMessageSending, setGlobalMessageSending] = useState(false);
  const [promoCodeDraft, setPromoCodeDraft] = useState("");
  const [promoRedeemLoading, setPromoRedeemLoading] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState("");
  const [promoFeedbackError, setPromoFeedbackError] = useState(false);
  const [adminPromoCode, setAdminPromoCode] = useState("");
  const [adminPromoRewardType, setAdminPromoRewardType] = useState("coins");
  const [adminPromoRewardAmount, setAdminPromoRewardAmount] = useState("100");
  const [adminPromoCaseName, setAdminPromoCaseName] = useState("Truckini Case");
  const [adminPromoItemName, setAdminPromoItemName] = useState("");
  const [adminPromoMaxUses, setAdminPromoMaxUses] = useState("100");
  const [adminPromoExpiresAt, setAdminPromoExpiresAt] = useState("");
  const [adminPromoCodes, setAdminPromoCodes] = useState([]);
  const [adminPromoBusy, setAdminPromoBusy] = useState(false);
  const [adminPromoLoading, setAdminPromoLoading] = useState(false);
  const [adminPromoFeedback, setAdminPromoFeedback] = useState("");
  const [adminPromoFeedbackError, setAdminPromoFeedbackError] = useState(false);
  const [adminEventLoading, setAdminEventLoading] = useState(false);
  const [adminEventFeedback, setAdminEventFeedback] = useState("");
  const [adminEventFeedbackError, setAdminEventFeedbackError] = useState(false);
  const [adminEventDuration, setAdminEventDuration] = useState("179");
  const [adminAbuseTab, setAdminAbuseTab] = useState("all");
  const [adminEventQuery, setAdminEventQuery] = useState("");
  const [adminEventCategory, setAdminEventCategory] = useState("all");
  const [adminEventSort, setAdminEventSort] = useState("default");
  const [adminEventFavoritesOnly, setAdminEventFavoritesOnly] = useState(false);
  const [adminEventFavorites, setAdminEventFavorites] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("braingg-admin-event-favorites") || "[]");
      return Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : [];
    } catch { return []; }
  });
  const [adminEventPreview, setAdminEventPreview] = useState("");
  const [adminEventCompareA, setAdminEventCompareA] = useState("lucky");
  const [adminEventCompareB, setAdminEventCompareB] = useState("gold_rush");
  const [adminEventHistory, setAdminEventHistory] = useState([]);
  const [adminEventHistoryLoading, setAdminEventHistoryLoading] = useState(false);
  const [adminEventHistoryQuery, setAdminEventHistoryQuery] = useState("");
  const [adminEventHistoryType, setAdminEventHistoryType] = useState("all");
  const [adminEventHistoryPeriod, setAdminEventHistoryPeriod] = useState("7d");
  const [adminEventHistorySort, setAdminEventHistorySort] = useState("newest");
  const [adminEventRefreshing, setAdminEventRefreshing] = useState(false);
  const [adminGameId, setAdminGameId] = useState("");

  useEffect(() => {
    if (DISABLED_PAGES.has(page)) setPage("Главная");
  }, [page]);
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
  const [adminInventoryQuery, setAdminInventoryQuery] = useState("");
  const [adminInventoryRarity, setAdminInventoryRarity] = useState("all");
  const [adminInventorySort, setAdminInventorySort] = useState("value_desc");
  const [adminDepositQuery, setAdminDepositQuery] = useState("");
  const [adminDepositStatus, setAdminDepositStatus] = useState("all");
  const [adminPromoQuery, setAdminPromoQuery] = useState("");
  const [adminPromoStatus, setAdminPromoStatus] = useState("all");
  const [adminToolFeedback, setAdminToolFeedback] = useState("");
  const [adminToolsRefreshing, setAdminToolsRefreshing] = useState(false);
  const [adminLastRefreshAt, setAdminLastRefreshAt] = useState("");
  const [gameHub, setGameHub] = useState({ progress: null, tasks: [], leaderboard: [], liveDrops: [], dailyClaimed: false });
  const [hubLoading, setHubLoading] = useState(false);
  const [dailyClaimLoading, setDailyClaimLoading] = useState(false);
  const [taskClaimLoading, setTaskClaimLoading] = useState("");
  const [hubMessage, setHubMessage] = useState("");
  const [playerHistory, setPlayerHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [quizStatus, setQuizStatus] = useState({ used: 0, remaining: 3, correct: 0 });
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [adminGameStats, setAdminGameStats] = useState(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupTab, setTopupTab] = useState("stars");
  const [topupStars, setTopupStars] = useState(100);
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupMessage, setTopupMessage] = useState("");
  const [depositStep, setDepositStep] = useState(1);
  const [depositCatalog, setDepositCatalog] = useState([]);
  const [depositMutations, setDepositMutations] = useState([]);
  const [depositTraits, setDepositTraits] = useState([]);
  const [depositSelectedItemKey, setDepositSelectedItemKey] = useState("");
  const [depositMutationKey, setDepositMutationKey] = useState("normal");
  const [depositRobloxUsername, setDepositRobloxUsername] = useState("");
  const [depositRequest, setDepositRequest] = useState(null);
  const [depositRequests, setDepositRequests] = useState([]);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMessage, setDepositMessage] = useState("");
  const [depositError, setDepositError] = useState("");
  const [adminDepositCatalog, setAdminDepositCatalog] = useState([]);
  const [adminDepositTraits, setAdminDepositTraits] = useState([]);
  const [adminDepositRequests, setAdminDepositRequests] = useState([]);
  const [adminDepositTraitDrafts, setAdminDepositTraitDrafts] = useState({});
  const [adminDepositPriceDrafts, setAdminDepositPriceDrafts] = useState({});
  const [adminDepositLoading, setAdminDepositLoading] = useState(false);
  const [adminDepositBusy, setAdminDepositBusy] = useState(false);
  const [adminDepositFeedback, setAdminDepositFeedback] = useState("");

  const initData = () => window.Telegram?.WebApp?.initData;
  const telegramIdentity = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
  const isMobileAdminDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

  useEffect(() => {
    if (!isAdmin || isMobileAdminDevice) return undefined;
    const handleDesktopAdminShortcut = (event) => {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const sections = {
        Digit1: "overview",
        Digit2: "players",
        Digit3: "events",
        Digit4: "history",
        Digit5: "tools",
      };
      const nextSection = sections[event.code];
      if (!nextSection) return;
      event.preventDefault();
      setAdminSection(nextSection);
      if (nextSection === "events") {
        loadGlobalState().catch(() => {});
        if (isOwner) loadAdminEventHistory().catch(() => {});
      }
      if (nextSection === "history") loadAdminLogs();
    };
    window.addEventListener("keydown", handleDesktopAdminShortcut);
    return () => window.removeEventListener("keydown", handleDesktopAdminShortcut);
  }, [isAdmin, isMobileAdminDevice, isOwner]);
  const greetingLabel = streamerMode
    ? "Стример"
    : (telegramIdentity.username ? `@${telegramIdentity.username}` : (telegramIdentity.first_name || player?.username || "друг"));

  useEffect(() => {
    try { window.localStorage.setItem(STREAMER_MODE_STORAGE_KEY, streamerMode ? "1" : "0"); } catch (error) { console.warn("Could not persist streamer mode preference:", error); }
  }, [streamerMode]);

  useEffect(() => {
    try { window.localStorage.setItem("braingg-admin-event-favorites", JSON.stringify(adminEventFavorites)); } catch { /* Local favorites are optional. */ }
  }, [adminEventFavorites]);

  useEffect(() => {
    try { window.localStorage.setItem(SITE_THEME_STORAGE_KEY, siteTheme); } catch (error) { console.warn("Could not persist BrainGG theme preference:", error); }
    if (typeof document !== "undefined") {
      document.body.dataset.brainggTheme = siteTheme;
      document.documentElement.dataset.brainggTheme = siteTheme;
    }
  }, [siteTheme]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    try {
      tg.ready?.();
      tg.expand?.();
      const telegramThemeColor = siteTheme === "party" ? "#170d25" : "#2a0710";
      tg.setHeaderColor?.(telegramThemeColor);
      tg.setBackgroundColor?.(telegramThemeColor);
    } catch (error) {
      console.warn("Telegram WebApp viewport setup failed:", error);
    }
  }, [siteTheme]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  // Keep Telegram's native Back button in sync with the in-app navigation.
  // This avoids trapping mobile users inside nested pages or the drawer.
  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) return;
    const shouldShow = menuOpen || page !== "Главная";
    const handleBack = () => {
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      if (page !== "Главная") {
        setPage("Главная");
        setSelectedCase(null);
        setActionMessage("");
      }
    };
    try {
      if (shouldShow) backButton.show?.();
      else backButton.hide?.();
      backButton.onClick?.(handleBack);
    } catch (error) {
      console.warn("Telegram BackButton setup failed:", error);
    }
    return () => {
      try {
        backButton.offClick?.(handleBack);
        if (!shouldShow) backButton.hide?.();
      } catch (error) {
        console.warn("Telegram BackButton cleanup failed:", error);
      }
    };
  }, [menuOpen, page]);

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
      // Original playful taco-event loop synthesized locally with Web Audio.
      // It does not depend on a missing MP3 or use the copyrighted song recording.
      const ctx = getAudioContext();
      if (!ctx) { setMusicNotice("Браузер не поддерживает Web Audio."); return; }
      const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5, 880, 783.99, 659.25, 587.33];
      const bass = [130.81, 130.81, 164.81, 164.81, 196, 196, 164.81, 164.81];
      let step = 0;
      const tone = (frequency, when, duration, volume, wave = "square") => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = wave === "square" ? 2400 : 1800;
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(frequency, when);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.00015, volume), when + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
        oscillator.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        oscillator.start(when); oscillator.stop(when + duration + 0.025);
      };
      const playStep = () => {
        if (ctx.state !== "running") return;
        const now = ctx.currentTime + 0.02;
        const note = melody[step % melody.length];
        tone(note, now, 0.13, 0.026, "square");
        if (step % 2 === 0) tone(note * 2, now + 0.012, 0.09, 0.008, "triangle");
        if (step % 4 === 0) {
          tone(bass[Math.floor(step / 2) % bass.length], now, 0.34, 0.025, "triangle");
          const kick = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kick.type = "sine";
          kick.frequency.setValueAtTime(145, now);
          kick.frequency.exponentialRampToValueAtTime(48, now + 0.12);
          kickGain.gain.setValueAtTime(0.08, now);
          kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
          kick.connect(kickGain); kickGain.connect(ctx.destination);
          kick.start(now); kick.stop(now + 0.16);
        }
        step += 1;
      };
      ctx.resume().then(() => { setMusicNotice(""); playStep(); }).catch(() => setMusicNotice("Нажми «♫ Музыка», чтобы разрешить воспроизведение."));
      eventMusicTimerRef.current = window.setInterval(playStep, 150);
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) return;
    const tracks = {
      lucky: { notes: [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5], bass: [130.81, 164.81, 196, 164.81], stepMs: 330, volume: 0.022, bassVolume: 0.009, wave: "triangle" },
      strawberry: { notes: [392, 493.88, 587.33, 493.88, 440, 523.25, 587.33, 440], bass: [98, 123.47, 146.83, 123.47], stepMs: 560, volume: 0.009, bassVolume: 0.004, wave: "sine" },
      red_fever: { notes: [440, 523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 659.25], bass: [110, 130.81, 164.81, 130.81], stepMs: 250, volume: 0.018, bassVolume: 0.008, wave: "sawtooth" },
      gold_rush: { notes: [783.99, 987.77, 1174.66, 987.77, 880, 1046.5, 1318.5, 1046.5], bass: [98, 123.47, 146.83, 123.47], stepMs: 300, volume: 0.018, bassVolume: 0.008, wave: "triangle" },
      case_sale: { notes: [659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25, 783.99], bass: [130.81, 146.83, 164.81, 146.83], stepMs: 340, volume: 0.016, bassVolume: 0.007, wave: "sine" },
      power_upgrade: { notes: [329.63, 493.88, 659.25, 783.99, 987.77, 783.99, 659.25, 987.77], bass: [82.41, 98, 123.47, 98], stepMs: 230, volume: 0.02, bassVolume: 0.009, wave: "triangle" },
      jackpot_hunt: { notes: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1046.5, 1567.98, 1318.5], bass: [65.41, 98, 130.81, 98], stepMs: 280, volume: 0.021, bassVolume: 0.01, wave: "triangle" },
      night_shift: { notes: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23], bass: [65.41, 73.42, 82.41, 73.42], stepMs: 520, volume: 0.008, bassVolume: 0.006, wave: "sine" },
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

  function toggleStreamerMode() {
    if (opening || upgradeLoading || topupBusy || sellingId || sellingAll) {
      setStreamerModeFeedback("Дождись завершения текущего действия, затем включи режим стримера.");
      return;
    }
    const next = !streamerMode;
    setStreamerMode(next);
    setStreamerModeFeedback(next
      ? "Режим стримера включён. Случайные игровые действия, продажи и платежи отключены на этом устройстве."
      : "Обычный режим BrainGG восстановлен.");
    if (next) {
      caseRewardsRequestRef.current += 1;
      setPage("Главная");
      setMenuOpen(false);
      setSelectedCase(null);
      setCaseRewards([]);
      setCaseRewardsFor("");
      setCaseRewardsLoading(false);
      setLastRewards([]);
      setReelRows([]);
      setShowRewardModal(false);
      setTopupOpen(false);
      setTopupMessage("");
      setSelectedUpgrade(null);
      setTargetItem("");
      setUpgradeResult(null);
      setInventorySort("newest");
    }
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
    if (globalEvent?.event_name && !streamerMode) startEventMusic(globalEvent.event_name);
    else startWinterMusic();
  }

  useEffect(() => () => {
    stopWinterMusic();
    stopEventMusic();
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch((error) => console.warn("Audio context cleanup failed:", error));
    }
    const backButton = window.Telegram?.WebApp?.BackButton;
    try { backButton?.hide?.(); } catch (error) { console.warn("Telegram BackButton cleanup failed:", error); }
  }, []);


  async function startStarsTopup() {
    if (streamerMode) { setTopupMessage("Пополнение отключено в режиме стримера."); return; }
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

  async function callBrainrotDepositApi(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke("braingg-api", {
      body: { initData: initData(), action, ...payload },
    });
    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Не удалось выполнить операцию с пополнением.");
    }
    return data;
  }

  async function loadDepositCatalog() {
    setDepositLoading(true);
    setDepositError("");
    try {
      const data = await callBrainrotDepositApi("get_brainrot_deposit_catalog");
      setDepositCatalog(data.items || []);
      setDepositMutations(data.mutations || []);
      setDepositTraits(data.traits || []);
    } catch (error) {
      setDepositError(error?.message || "Не удалось загрузить каталог брейнротов.");
    } finally {
      setDepositLoading(false);
    }
  }

  async function loadMyDepositRequests() {
    setDepositLoading(true);
    setDepositError("");
    try {
      const data = await callBrainrotDepositApi("get_my_brainrot_deposit_requests");
      const requests = data.requests || [];
      setDepositRequests(requests);
      setDepositRequest(requests[0] || null);
      return requests;
    } catch (error) {
      setDepositError(error?.message || "Не удалось загрузить статус пополнения.");
      return [];
    } finally {
      setDepositLoading(false);
    }
  }

  async function submitBrainrotDeposit() {
    if (depositLoading) return;
    const username = String(depositRobloxUsername || "").trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      setDepositError("Укажи именно Roblox @username: 3–20 латинских букв, цифр или подчёркиваний.");
      return;
    }
    if (!selectedDepositItem || Number(selectedDepositItem.base_value_gg || 0) <= 0) {
      setDepositError("Для этого брейнрота ещё не настроена базовая цена. Обратись к администратору.");
      return;
    }
    setDepositLoading(true);
    setDepositError("");
    setDepositMessage("");
    try {
      const data = await callBrainrotDepositApi("create_brainrot_deposit_request", {
        robloxUsername: username,
        brainrotKey: selectedDepositItem.item_key,
        mutationKey: depositMutationKey,
        traitKeys: [],
      });
      const request = data.request || data;
      setDepositRequest(request);
      setDepositRequests((previous) => [request, ...previous.filter((item) => item.id !== request.id)]);
      setDepositStep(4);
      setDepositMessage("Заявка создана. Дождись своей очереди — бот сообщит, когда можно отправлять трейд.");
    } catch (error) {
      setDepositError(error?.message || "Не удалось создать заявку на пополнение.");
    } finally {
      setDepositLoading(false);
    }
  }

  async function refreshDepositStatus() {
    const requests = await loadMyDepositRequests();
    if (requests.length) setDepositRequest(requests[0]);
  }

  async function loadAdminDepositData() {
    setAdminDepositLoading(true);
    setAdminDepositFeedback("");
    try {
      const data = await callBrainrotDepositApi("admin_get_brainrot_deposits");
      setAdminDepositCatalog(data.items || []);
      setAdminDepositTraits(data.traits || []);
      setAdminDepositRequests(data.requests || []);
      setAdminDepositTraitDrafts(Object.fromEntries((data.requests || []).map((request) => [request.id, Array.isArray(request.trait_keys) ? request.trait_keys : []])));
      setAdminDepositPriceDrafts(Object.fromEntries((data.items || []).map((item) => [item.item_key, String(item.base_value_gg ?? 0)])));
    } catch (error) {
      setAdminDepositFeedback(error?.message || "Не удалось загрузить очередь пополнений.");
    } finally {
      setAdminDepositLoading(false);
    }
  }

  async function saveAdminDepositPrice(itemKey) {
    const value = Number(adminDepositPriceDrafts[itemKey]);
    if (!Number.isFinite(value) || value < 0 || value > 100000000) {
      setAdminDepositFeedback("Цена должна быть числом от 0 до 100 000 000 GG.");
      return;
    }
    setAdminDepositBusy(true);
    setAdminDepositFeedback("");
    try {
      await callBrainrotDepositApi("admin_set_brainrot_deposit_price", { itemKey, baseValueGg: value });
      setAdminDepositFeedback(`Базовая цена сохранена: ${value.toLocaleString("ru-RU")} GG.`);
      await loadAdminDepositData();
    } catch (error) {
      setAdminDepositFeedback(error?.message || "Не удалось сохранить цену.");
    } finally {
      setAdminDepositBusy(false);
    }
  }

  async function assignNextBrainrotDeposit() {
    setAdminDepositBusy(true);
    setAdminDepositFeedback("");
    try {
      const data = await callBrainrotDepositApi("admin_assign_next_brainrot_deposit");
      setAdminDepositFeedback(data.empty ? "Очередь пока пуста." : `Игрок вызван. Отправка трейда: ${data.request?.assigned_storage_account || "аккаунт назначен"}.`);
      await loadAdminDepositData();
    } catch (error) {
      setAdminDepositFeedback(error?.message || "Не удалось вызвать следующего игрока.");
    } finally {
      setAdminDepositBusy(false);
    }
  }

  async function markBrainrotDepositReceived(requestId) {
    setAdminDepositBusy(true);
    setAdminDepositFeedback("");
    try {
      const traitKeys = adminDepositTraitDrafts[requestId] || [];
      await callBrainrotDepositApi("admin_mark_brainrot_deposit_received", { requestId, traitKeys });
      setAdminDepositFeedback("Предмет и выбранные traits подтверждены. Сервер пересчитал сумму; игроку отправлена инструкция по Ready и Accept.");
      await loadAdminDepositData();
    } catch (error) {
      setAdminDepositFeedback(error?.message || "Не удалось изменить статус заявки.");
    } finally {
      setAdminDepositBusy(false);
    }
  }

  async function completeBrainrotDeposit(requestId) {
    setAdminDepositBusy(true);
    setAdminDepositFeedback("");
    try {
      const data = await callBrainrotDepositApi("admin_complete_brainrot_deposit", { requestId });
      if (data.balance != null) setPlayer((current) => current ? { ...current, balance: data.balance } : current);
      setAdminDepositFeedback(`Пополнение подтверждено. Начислено ${Number(data.amount_gg || 0).toLocaleString("ru-RU")} GG.`);
      await loadAdminDepositData();
    } catch (error) {
      setAdminDepositFeedback(error?.message || "Не удалось завершить пополнение.");
    } finally {
      setAdminDepositBusy(false);
    }
  }

  async function rejectBrainrotDeposit(requestId) {
    const reason = window.prompt("Причина отказа (необязательно):", "Трейд не завершён или предмет не совпадает");
    if (reason === null) return;
    setAdminDepositBusy(true);
    setAdminDepositFeedback("");
    try {
      await callBrainrotDepositApi("admin_reject_brainrot_deposit", { requestId, reason });
      setAdminDepositFeedback("Заявка отклонена. Игроку отправлено сообщение «Пополнение не удалось :(».");
      await loadAdminDepositData();
    } catch (error) {
      setAdminDepositFeedback(error?.message || "Не удалось отклонить заявку.");
    } finally {
      setAdminDepositBusy(false);
    }
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

  const rarityColors = siteTheme === "party" ? {
    "Обычный": "#c5bbd3",
    "Редкий": "#76bce8",
    "Эпический": "#bd91e8",
    "Легендарный": "#f2c978",
    "Мифический": "#8bd3c9",
    "OG": "#ffe1a0",
  } : {
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
        loadSpecialCaseAccess();
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_global_activity" }, (payload) => {
        if (!mounted || !payload.new?.id) return;
        setGlobalActivities((current) => [payload.new, ...current.filter((entry) => String(entry.id) !== String(payload.new.id))].slice(0, 60));
      })
      .subscribe();
    loadGlobalState().catch((error) => console.warn("Global BrainGG state unavailable:", error));
    loadGlobalActivity().catch((error) => console.warn("Global BrainGG activity unavailable:", error));
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
    if (page !== "Кейсы") return undefined;
    const timer = window.setInterval(() => setSpecialCaseClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (!globalMessage?.id) return undefined;
    const timer = window.setTimeout(() => setGlobalMessage(null), 12000);
    return () => window.clearTimeout(timer);
  }, [globalMessage?.id]);

  useEffect(() => {
    const eventName = globalEvent?.event_name || "";
    if (eventName && !streamerMode) {
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
  }, [globalEvent?.event_name, streamerMode]);

  useEffect(() => {
    const eventName = globalEvent?.event_name || "";
    const colors = { tacos: "#4a0a1b", lucky: "#5d0c20", strawberry: "#7a0e2a", red_fever: "#6a0a1f", gold_rush: "#5a0b1d", case_sale: "#820d29", power_upgrade: "#6e0d24", jackpot_hunt: "#7d0b29", night_shift: "#15050b" };
    if (eventName && !streamerMode) {
      document.body.dataset.brainggEvent = eventName;
      try { window.Telegram?.WebApp?.setBackgroundColor?.(colors[eventName] || (eventName.includes("frost") || eventName.includes("winter") || eventName.includes("blizzard") ? "#102b49" : eventName.includes("gold") || eventName.includes("anniversary") ? "#4a2b08" : eventName.includes("void") || eventName.includes("shadow") || eventName.includes("eclipse") ? "#170d2d" : "#2a102b")); } catch { /* Telegram theme is optional. */ }
    } else {
      delete document.body.dataset.brainggEvent;
      try { window.Telegram?.WebApp?.setBackgroundColor?.("#2a0710"); } catch { /* Telegram theme is optional. */ }
    }
    return () => { delete document.body.dataset.brainggEvent; };
  }, [globalEvent?.event_name, streamerMode]);

  useEffect(() => {
    const rewardPoolName = getCaseRewardPoolName(selectedCase);
    if (!streamerMode && rewardPoolName) loadCaseRewards(rewardPoolName);
  }, [globalEvent?.event_name, selectedCase?.caseName, selectedCase?.rewardCaseName, streamerMode]);

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

  async function loadGlobalActivity() {
    setGlobalActivityLoading(true);
    setGlobalActivityError("");
    try {
      const { data, error } = await supabase.from("game_global_activity")
        .select("id, username, event_type, title, description, item_name, case_name, rarity, value_gg, success, created_at")
        .order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      setGlobalActivities((current) => {
        const merged = new Map((data || []).map((entry) => [String(entry.id), entry]));
        current.forEach((entry) => { if (!merged.has(String(entry.id))) merged.set(String(entry.id), entry); });
        return [...merged.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 60);
      });
      return data || [];
    } catch (error) {
      console.error("Global activity loading failed:", error);
      setGlobalActivityError("Глобальная лента пока не настроена. Примени миграцию global community events в Supabase.");
      throw error;
    } finally {
      setGlobalActivityLoading(false);
    }
  }

  async function loadSpecialCaseAccess() {
    if (!initData()) return null;
    setSpecialCaseAccess((current) => ({ ...current, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "get_special_case_access" },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Не удалось проверить специальные кейсы.");
      const next = {
        loading: false,
        nick: data.access?.nick || { allowed: false, reason: "Не удалось проверить имя Telegram.", cooldownUntil: null, remainingSeconds: 0 },
        free: data.access?.free || { allowed: false, reason: "Не удалось проверить подписку.", cooldownUntil: null, remainingSeconds: 0 },
        deposit: data.access?.deposit || { allowed: false, reason: "Не удалось проверить пополнения за последние 7 дней.", cooldownUntil: null, remainingSeconds: 0 },
      };
      setSpecialCaseAccess(next);
      return next;
    } catch (error) {
      console.warn("Special case access check failed:", error);
      const next = {
        loading: false,
        nick: { allowed: false, reason: "Не удалось проверить имя Telegram. Обнови BrainGG и попробуй ещё раз.", cooldownUntil: null, remainingSeconds: 0 },
        free: { allowed: false, reason: "Не удалось проверить подписку. Проверь, что бот BrainGG добавлен администратором канала.", cooldownUntil: null, remainingSeconds: 0 },
        deposit: { allowed: false, reason: "Не удалось проверить историю пополнений. Попробуй ещё раз позже.", cooldownUntil: null, remainingSeconds: 0 },
      };
      setSpecialCaseAccess(next);
      return next;
    }
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

  async function redeemPromoCode(event) {
    event?.preventDefault();
    if (promoRedeemLoading) return;
    const code = promoCodeDraft.trim().toUpperCase();
    if (!code) {
      setPromoFeedback("Введи промокод.");
      setPromoFeedbackError(true);
      return;
    }
    setPromoRedeemLoading(true);
    setPromoFeedback("");
    setPromoFeedbackError(false);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "redeem_promo_code", code },
      });
      if (error) throw error;
      if (!data?.success || !data?.result) throw new Error(data?.error || "Не удалось активировать промокод.");
      const reward = data.result;
      setPlayer((current) => current ? {
        ...current,
        balance: reward.balance ?? current.balance,
        free_cases: reward.free_cases_total ?? current.free_cases,
        free_cases_total: reward.free_cases_total ?? current.free_cases_total,
        free_case_credits: reward.free_case_credits ?? current.free_case_credits,
      } : current);
      if (reward.reward_type === "coins") {
        setPromoFeedback(`Промокод активирован! На баланс начислено ${Number(reward.reward_amount).toLocaleString("ru-RU")} GG. 🎉`);
      } else if (reward.reward_type === "cases") {
        setPromoFeedback(`Промокод активирован! Получено ${reward.reward_amount} бесплатных кейсов «${displayCaseName(reward.case_name)}». 🎁`);
      } else {
        setPromoFeedback(`Промокод активирован! В инвентарь добавлено: ${reward.item_name} ×${reward.reward_amount}. 🧠`);
        await loadInventory();
      }
      setPromoCodeDraft("");
      setPromoFeedbackError(false);
    } catch (error) {
      setPromoFeedback(error?.message || "Не удалось активировать промокод.");
      setPromoFeedbackError(true);
    } finally {
      setPromoRedeemLoading(false);
    }
  }

  async function loadAdminPromoCodes() {
    if (!isOwner) return;
    setAdminPromoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "admin_list_promo_codes" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось загрузить промокоды.");
      setAdminPromoCodes(data.promoCodes || []);
    } catch (error) {
      setAdminPromoFeedback(error?.message || "Не удалось загрузить промокоды.");
      setAdminPromoFeedbackError(true);
    } finally {
      setAdminPromoLoading(false);
    }
  }

  async function createAdminPromoCode(event) {
    event?.preventDefault();
    if (!isOwner || adminPromoBusy) return;
    const code = adminPromoCode.trim().toUpperCase();
    const rewardAmount = Number(adminPromoRewardAmount);
    const maxUses = adminPromoMaxUses.trim() === "" ? null : Number(adminPromoMaxUses);
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
      setAdminPromoFeedback("Код: 3–24 символа, только латинские буквы, цифры, дефис и подчёркивание.");
      setAdminPromoFeedbackError(true);
      return;
    }
    if (!Number.isSafeInteger(rewardAmount) || rewardAmount < 1) {
      setAdminPromoFeedback("Укажи корректное количество награды.");
      setAdminPromoFeedbackError(true);
      return;
    }
    if (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1)) {
      setAdminPromoFeedback("Лимит активаций должен быть положительным целым числом или пустым.");
      setAdminPromoFeedbackError(true);
      return;
    }
    if (adminPromoRewardType === "brainrot" && !adminPromoItemName) {
      setAdminPromoFeedback("Выбери брейнрота для награды.");
      setAdminPromoFeedbackError(true);
      return;
    }
    if (adminPromoRewardType === "cases" && !adminPromoCaseName) {
      setAdminPromoFeedback("Выбери кейс для награды.");
      setAdminPromoFeedbackError(true);
      return;
    }

    setAdminPromoBusy(true);
    setAdminPromoFeedback("");
    setAdminPromoFeedbackError(false);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: {
          initData: initData(),
          action: "admin_create_promo_code",
          code,
          rewardType: adminPromoRewardType,
          rewardAmount,
          caseName: adminPromoRewardType === "cases" ? adminPromoCaseName : null,
          itemName: adminPromoRewardType === "brainrot" ? adminPromoItemName : null,
          maxUses,
          expiresAt: adminPromoExpiresAt ? new Date(adminPromoExpiresAt).toISOString() : null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось создать промокод.");
      setAdminPromoCode("");
      setAdminPromoFeedback(`Промокод ${data.promoCode.code} создан. Награда: ${rewardAmount} ${adminPromoRewardType === "coins" ? "GG" : adminPromoRewardType === "cases" ? "кейсов" : "брейнротов"}.`);
      setAdminPromoFeedbackError(false);
      await loadAdminPromoCodes();
    } catch (error) {
      setAdminPromoFeedback(error?.message || "Не удалось создать промокод.");
      setAdminPromoFeedbackError(true);
    } finally {
      setAdminPromoBusy(false);
    }
  }

  async function deactivateAdminPromoCode(promoId) {
    if (!isOwner || adminPromoBusy) return;
    setAdminPromoBusy(true);
    setAdminPromoFeedback("");
    setAdminPromoFeedbackError(false);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "admin_deactivate_promo_code", promoId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось отключить промокод.");
      setAdminPromoFeedback(`Промокод ${data.promoCode.code} отключён.`);
      await loadAdminPromoCodes();
    } catch (error) {
      setAdminPromoFeedback(error?.message || "Не удалось отключить промокод.");
      setAdminPromoFeedbackError(true);
    } finally {
      setAdminPromoBusy(false);
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

  async function loadAdminEventHistory() {
    if (!isOwner) return [];
    setAdminEventHistoryLoading(true);
    try {
      const { data, error } = await supabase.from("game_global_activity")
        .select("id, username, event_type, title, description, created_at, success")
        .in("event_type", ["event_started", "event_ended"])
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      setAdminEventHistory(data || []);
      return data || [];
    } catch (error) {
      console.error("Admin event history loading failed:", error);
      setAdminEventFeedback(error?.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0438\u0432\u0435\u043d\u0442\u043e\u0432.");
      setAdminEventFeedbackError(true);
      throw error;
    } finally {
      setAdminEventHistoryLoading(false);
    }
  }

  async function refreshAdminEvents() {
    if (adminEventRefreshing) return;
    setAdminEventRefreshing(true);
    setAdminEventFeedback("");
    setAdminEventFeedbackError(false);
    const results = await Promise.allSettled([loadGlobalState(), loadAdminEventHistory()]);
    const failed = results.some((result) => result.status === "rejected");
    if (failed) {
      setAdminEventFeedback("\u041d\u0435 \u0432\u0441\u0435 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.");
      setAdminEventFeedbackError(true);
    } else {
      setAdminEventFeedback("\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0432\u0435\u043d\u0442\u043e\u0432 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b.");
      setAdminEventFeedbackError(false);
    }
    setAdminEventRefreshing(false);
  }

  function toggleAdminEventFavorite(eventName) {
    setAdminEventFavorites((current) => current.includes(eventName)
      ? current.filter((key) => key !== eventName)
      : [...current, eventName]);
  }

  function copyAdminEventDetails(eventName) {
    const event = adminEventCatalog.find((item) => item.key === eventName);
    if (!event) return;
    const presentation = eventPresentation[eventName] || {};
    copyAdminText([
      presentation.title || event.title,
      "\u0422\u0438\u043f: " + event.category,
      presentation.subtitle || event.description,
      "\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0437\u0430\u043f\u0443\u0441\u043a\u0430: " + formatAdminEventDuration(Number(adminEventDuration)),
      "\u0421\u0442\u0430\u0442\u0443\u0441: " + (globalEvent?.event_name === eventName ? "\u0430\u043a\u0442\u0438\u0432\u0435\u043d" : "\u043d\u0435 \u0430\u043a\u0442\u0438\u0432\u0435\u043d"),
    ].join("\n"), "\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u0438\u0432\u0435\u043d\u0442\u0430");
  }

  function copyAdminEventStatus() {
    if (!globalEvent?.event_name) {
      setAdminToolFeedback("\u0421\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0433\u043e \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0438\u0432\u0435\u043d\u0442\u0430.");
      return;
    }
    const presentation = eventPresentation[globalEvent.event_name] || {};
    copyAdminText([
      "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0438\u0432\u0435\u043d\u0442: " + (presentation.title || globalEvent.event_name),
      "\u041d\u0430\u0447\u0430\u043b\u043e: " + (globalEvent.event_started_at ? new Date(globalEvent.event_started_at).toLocaleString("ru-RU") : "—"),
      "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435: " + (globalEvent.event_ends_at ? new Date(globalEvent.event_ends_at).toLocaleString("ru-RU") : "—"),
      "\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c: " + eventRemainingLabel,
      "\u042d\u0444\u0444\u0435\u043a\u0442: " + (presentation.subtitle || "—"),
    ].join("\n"), "\u0421\u0442\u0430\u0442\u0443\u0441 \u0438\u0432\u0435\u043d\u0442\u0430");
  }

  function exportAdminEventHistoryCsv() {
    if (!filteredAdminEventHistory.length) return;
    const rows = filteredAdminEventHistory.map((entry) => [
      entry.created_at ? new Date(entry.created_at).toLocaleString("ru-RU") : "",
      entry.event_type === "event_started" ? "\u0421\u0442\u0430\u0440\u0442" : "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435",
      entry.title || "",
      entry.description || "",
      entry.username || "",
    ]);
    const ok = downloadCsvFile("braingg-global-event-history.csv", ["\u0414\u0430\u0442\u0430", "\u0422\u0438\u043f", "\u0421\u043e\u0431\u044b\u0442\u0438\u0435", "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435", "\u0418\u0433\u0440\u043e\u043a"], rows);
    setAdminToolFeedback(ok ? "\u042d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u043e \u0437\u0430\u043f\u0438\u0441\u0435\u0439 \u0438\u0432\u0435\u043d\u0442\u043e\u0432: " + rows.length + "." : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c CSV-\u0444\u0430\u0439\u043b \u0432 \u044d\u0442\u043e\u043c WebView.");
  }

  function copyAdminLatestEventHistory() {
    const entry = filteredAdminEventHistory[0];
    if (!entry) return;
    copyAdminText([
      entry.title || "BrainGG event",
      entry.description || "",
      "\u0422\u0438\u043f: " + (entry.event_type === "event_started" ? "\u0417\u0430\u043f\u0443\u0441\u043a" : "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435"),
      "\u0414\u0430\u0442\u0430: " + (entry.created_at ? new Date(entry.created_at).toLocaleString("ru-RU") : "—"),
    ].join("\n"), "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0438\u0432\u0435\u043d\u0442");
  }

  function prepareAdminEventMessage(eventName, stage) {
    const presentation = eventPresentation[eventName] || {};
    const title = presentation.title || eventName;
    const effect = presentation.subtitle || "BrainGG global event";
    const messages = {
      started: "\u{1F30D} " + title + " \u0437\u0430\u043f\u0443\u0449\u0435\u043d \u0434\u043b\u044f \u0432\u0441\u0435\u0445 \u0438\u0433\u0440\u043e\u043a\u043e\u0432! " + effect,
      ending: "\u{23F3} " + title + ": \u0441\u043e\u0431\u044b\u0442\u0438\u0435 \u0441\u043a\u043e\u0440\u043e \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0441\u044f. \u0423\u0441\u043f\u0435\u0439 \u0432\u043e\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c\u0441\u044f \u0431\u043e\u043d\u0443\u0441\u043e\u043c!",
      ended: "\u{1F3C1} " + title + " \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d. \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0432\u0441\u0435\u043c, \u043a\u0442\u043e \u0443\u0447\u0430\u0441\u0442\u0432\u043e\u0432\u0430\u043b \u0432 \u0441\u043e\u0431\u044b\u0442\u0438\u0438 BrainGG!",
    };
    setGlobalMessageDraft(messages[stage] || messages.started);
    setAdminEventFeedback("\u0428\u0430\u0431\u043b\u043e\u043d \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d \u0432 \u043f\u043e\u043b\u0435 \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0442\u0435\u043a\u0441\u0442 \u0438 \u043d\u0430\u0436\u043c\u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0443 \u0432\u0440\u0443\u0447\u043d\u0443\u044e.");
    setAdminEventFeedbackError(false);
  }

  async function toggleAdminEvent(eventName, options = {}) {
    if (!isOwner || adminEventLoading) return;
    const durationSeconds = Number(adminEventDuration);
    if (eventName && (!Number.isSafeInteger(durationSeconds) || durationSeconds < 30 || durationSeconds > 1800)) {
      setAdminEventFeedback("\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u0446\u0435\u043b\u044b\u043c \u0447\u0438\u0441\u043b\u043e\u043c \u043e\u0442 30 \u0434\u043e 1800 \u0441\u0435\u043a\u0443\u043d\u0434.");
      setAdminEventFeedbackError(true);
      return;
    }
    setAdminEventLoading(true);
    setAdminEventFeedback("");
    setAdminEventFeedbackError(false);
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: {
          initData: initData(),
          action: "admin_set_event",
          eventName,
          durationSeconds: eventName ? durationSeconds : undefined,
          forceRestart: options.forceRestart === true,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Не удалось изменить ивент");
      setGlobalEvent(data.event || null);
      setAdminEventFeedback(data.event
        ? "\u0418\u0432\u0435\u043d\u0442 \u0437\u0430\u043f\u0443\u0449\u0435\u043d \u043d\u0430 " + formatAdminEventDuration(durationSeconds) + ". \u0422\u0430\u0439\u043c\u0435\u0440 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438."
        : "\u0418\u0432\u0435\u043d\u0442 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d. \u041e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0435 \u0438 \u0431\u043e\u043d\u0443\u0441\u044b \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d\u044b \u043a \u043e\u0431\u044b\u0447\u043d\u044b\u043c.");
      setAdminEventFeedbackError(false);
      loadAdminEventHistory().catch(() => {});
    } catch (error) {
      setAdminEventFeedback(error?.message || "Не удалось изменить ивент.");
      setAdminEventFeedbackError(true);
    } finally {
      setAdminEventLoading(false);
    }
  }

  async function loadPlayerHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: { initData: initData(), action: "get_player_history" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "History unavailable");
      setPlayerHistory(data.history || []);
    } catch (error) {
      console.error("Player history loading failed:", error);
      setHistoryError("Не удалось загрузить историю. Попробуй ещё раз.");
    } finally {
      setHistoryLoading(false);
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

  async function copyAdminText(value, label = "Текст") {
    const text = String(value ?? "").trim();
    if (!text) {
      setAdminToolFeedback("Нет данных для копирования.");
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      setAdminToolFeedback(`${label}: скопировано в буфер обмена.`);
    } catch {
      setAdminToolFeedback(`${label}: открой поле ниже и скопируй текст вручную.`);
      try { window.prompt(`Скопируй: ${label}`, text); } catch { /* Clipboard fallback is optional in embedded WebViews. */ }
    }
  }

  function copyAdminPlayerSummary() {
    if (!adminPlayer) return;
    const summary = [
      `Игрок: ${adminPlayer.username ? `@${adminPlayer.username}` : "BrainGG"}`,
      `Game ID: ${adminPlayer.game_id || "—"}`,
      `Баланс: ${Number(adminPlayer.balance || 0).toLocaleString("ru-RU")} GG`,
      `Бесплатные кейсы: ${Number(adminPlayer.free_cases_total ?? adminPlayer.free_cases ?? 0).toLocaleString("ru-RU")}`,
      `Брейнроты: ${adminInventory.length}`,
      `XP: ${Number(adminPlayer.progress?.xp || 0).toLocaleString("ru-RU")}`,
      `Открыто кейсов: ${Number(adminPlayer.progress?.total_cases_opened || 0).toLocaleString("ru-RU")}`,
      `Продано предметов: ${Number(adminPlayer.progress?.total_sales || 0).toLocaleString("ru-RU")}`,
      `Апгрейдов: ${Number(adminPlayer.progress?.total_upgrades || 0).toLocaleString("ru-RU")}`,
      `Серия входов: ${Number(adminPlayer.progress?.daily_streak || 0)} дней`,
    ].join("\n");
    copyAdminText(summary, "Профиль игрока");
  }

  function copyAdminInventoryText() {
    const rows = filteredAdminInventory.map((item) => `${item.item_name} · ${item.rarity || "без редкости"} · ${Number(item.value_gg || 0).toLocaleString("ru-RU")} GG${item.mutation ? ` · ${item.mutation}` : ""}`);
    copyAdminText(rows.join("\n"), "Инвентарь игрока");
  }

  function exportAdminInventoryCsv() {
    if (!adminPlayer || !filteredAdminInventory.length) return;
    const rows = filteredAdminInventory.map((item) => [item.item_name, item.rarity, item.value_gg, item.mutation, item.created_at]);
    const ok = downloadCsvFile(`braingg-inventory-${String(adminPlayer.username || "player").replace(/[^a-z0-9_-]/gi, "_")}.csv`, ["Предмет", "Редкость", "Стоимость GG", "Мутация", "Дата получения"], rows);
    setAdminToolFeedback(ok ? `Экспортировано предметов: ${rows.length}.` : "Не удалось создать CSV-файл в этом WebView.");
  }

  function exportAdminLogsCsv() {
    if (!filteredAdminLogs.length) return;
    const rows = filteredAdminLogs.map((log) => [log.created_at ? new Date(log.created_at).toLocaleString("ru-RU") : "", log.game_id, log.action, log.amount, log.item_name || log.case_name || ""]);
    const ok = downloadCsvFile("braingg-admin-history.csv", ["Дата", "Игрок", "Операция", "Количество", "Предмет или кейс"], rows);
    setAdminToolFeedback(ok ? `Экспортировано операций: ${rows.length}.` : "Не удалось создать CSV-файл в этом WebView.");
  }

  function exportAdminDepositsCsv() {
    if (!filteredAdminDepositRequests.length) return;
    const rows = filteredAdminDepositRequests.map((request) => [request.queue_number, request.roblox_username, depositBrainrotName(request, request.brainrot_name), request.status, request.mutation_key, (request.trait_labels || request.trait_keys || []).join(", "), request.amount_gg, request.assigned_storage_account || ""]);
    const ok = downloadCsvFile("braingg-deposit-queue.csv", ["Номер очереди", "Roblox username", "Предмет", "Статус", "Мутация", "Traits", "К начислению GG", "Аккаунт хранения"], rows);
    setAdminToolFeedback(ok ? `Экспортировано заявок: ${rows.length}.` : "Не удалось создать CSV-файл в этом WebView.");
  }

  function exportAdminPromosCsv() {
    if (!isOwner || !filteredAdminPromoCodes.length) return;
    const rows = filteredAdminPromoCodes.map((promo) => {
      const expired = promo.expires_at && Date.parse(promo.expires_at) <= Date.now();
      const exhausted = promo.max_uses != null && Number(promo.uses_count) >= Number(promo.max_uses);
      const active = Boolean(promo.active && !expired && !exhausted);
      return [promo.code, promo.reward_type, promo.reward_amount, promo.case_name || promo.item_name || "", promo.uses_count, promo.max_uses ?? "∞", promo.expires_at || "", active ? "Да" : "Нет"];
    });
    const ok = downloadCsvFile("braingg-promo-codes.csv", ["Код", "Тип награды", "Количество", "Награда", "Использовано", "Лимит", "Истекает", "Активен"], rows);
    setAdminToolFeedback(ok ? `Экспортировано промокодов: ${rows.length}.` : "Не удалось создать CSV-файл в этом WebView.");
  }

  function copyAdminLatestLog() {
    const log = filteredAdminLogs[0];
    if (!log) return;
    const actionLabel = log.action === "coins" ? "Монеты GG" : log.action === "cases" ? "Бесплатные кейсы" : "Брейнрот";
    copyAdminText([`Операция: ${actionLabel}`, `Игрок: ${log.game_id || "—"}`, `Количество: ${log.amount ?? "—"}`, `Предмет/кейс: ${log.item_name || log.case_name || "—"}`, `Дата: ${log.created_at ? new Date(log.created_at).toLocaleString("ru-RU") : "—"}`].join("\n"), "Последняя операция");
  }

  function copyAdminDiagnostics() {
    const telegram = window.Telegram?.WebApp;
    const diagnostics = [
      "BrainGG desktop + mobile diagnostics",
      `Telegram WebApp: ${telegram ? "available" : "not detected"}`,
      `Signed initData: ${initData() ? "present" : "missing"}`,
      `Network: ${navigator.onLine ? "online" : "offline"}`,
      `Supabase URL configured: ${Boolean(import.meta.env.VITE_SUPABASE_URL) ? "yes" : "no"}`,
      `Supabase public key configured: ${Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) ? "yes" : "no"}`,
      `Screen: ${window.screen?.width || "?"}x${window.screen?.height || "?"}`,
      `Viewport: ${window.innerWidth || "?"}x${window.innerHeight || "?"}`,
      `User agent: ${navigator.userAgent}`,
    ].join("\n");
    copyAdminText(diagnostics, "Диагностика");
  }

  function copyAdminControlSnapshot() {
    const activeEvent = globalEvent?.event_name
      ? `${eventPresentation[globalEvent.event_name]?.title || globalEvent.event_name} · ${eventRemainingLabel}`
      : "Нет активного события";
    const snapshot = [
      "BrainGG · единая админ-панель",
      "Сборка интерфейса: ADMIN CONSOLE 3.2",
      `Права: ${isOwner ? "Владелец" : "Администратор"}`,
      `Сеть: ${navigator.onLine ? "Подключена" : "Нет соединения"}`,
      `Telegram WebApp: ${window.Telegram?.WebApp ? "Подключён" : "Не обнаружен"}`,
      `Устройство: ${isMobileAdminDevice ? "Телефон / планшет" : "ПК / ноутбук"}`,
      `Окно: ${window.innerWidth} × ${window.innerHeight}`,
      `Активный ивент: ${activeEvent}`,
      `Операций в журнале: ${adminTotalOperations}`,
      `Уникальных игроков в журнале: ${adminUniquePlayers}`,
      `Выдано GG по журналу: ${adminTotalCoins.toLocaleString("ru-RU")}`,
      `Последнее обновление: ${adminLastRefreshAt ? new Date(adminLastRefreshAt).toLocaleString("ru-RU") : "ещё не обновлялось"}`,
    ].join("\n");
    copyAdminText(snapshot, "Сводка админ-панели");
  }

  async function refreshAdminTools() {
    if (adminToolsRefreshing) return;
    setAdminToolsRefreshing(true);
    setAdminToolFeedback("");
    const tasks = [loadAdminGameStats(), loadAdminLogs(), loadAdminDepositData(), loadGlobalState()];
    if (isOwner) {
      tasks.push(loadAdminPromoCodes());
      tasks.push(loadAdminEventHistory());
    }
    const results = await Promise.allSettled(tasks);
    const failed = results.filter((result) => result.status === "rejected").length;
    setAdminLastRefreshAt(new Date().toISOString());
    setAdminToolFeedback(failed
      ? `Обновление завершено: ${tasks.length - failed} из ${tasks.length} источников доступны. Проверь разделы с ошибками.`
      : "Все доступные данные админ-панели обновлены.");
    setAdminToolsRefreshing(false);
  }

  async function searchAdminPlayer(event, navigateOnSuccess = false) {
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
        throw new Error(data?.error || "Игрок с таким Telegram username не найден.");
      }

      setAdminPlayer(data.player);
      setAdminInventory(data.inventory || data.items || []);
      if (navigateOnSuccess) setAdminSection("players");
      setAdminMessage("Игрок найден. Проверь профиль перед выдачей.");
      setAdminMessageError(false);

      if (upgradeTargets.length === 0) {
        await loadUpgradeTargets();
      }
    } catch (error) {
      console.error("Ошибка поиска игрока:", error);
      setAdminMessage(
        error?.message || "Не удалось найти игрока. Проверь Telegram username."
      );
      setAdminMessageError(true);
    } finally {
      setAdminSearchLoading(false);
    }
  }

  async function grantAdminReward(event) {
    event?.preventDefault();

    if (!adminPlayer?.game_id) {
      setAdminMessage("Сначала найди игрока по Telegram username.");
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
        actualChance: calculateUpgradeChance(source, item, upgradeEventMultiplier(globalEvent?.event_name)),
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
    setUpgradeSpinWon(null);
    setUpgradeWheelAnimating(false);
    setUpgradePointerVisible(true);
    setUpgradePointerAngle(0);
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
    if (selectedUpgrade?.id !== item.id) setUpgradeAnimatedChance(0);
    setSelectedUpgrade(item);
    setUpgradeSpinWon(null);
    setUpgradeWheelAnimating(false);
    setUpgradePointerVisible(true);
    setUpgradePointerAngle(0);
    setMobileUpgradeList("target");
    setUpgradeResult(null);
    setActionMessage("");

    const closest = findClosestTarget(item, upgradeChance);

    setTargetItem(closest?.item_name || "");
  }

  async function callMinesApi(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke("braingg-api", {
      body: { initData: initData(), action, ...payload },
    });
    if (error || !data?.success) throw new Error(data?.error || error?.message || "Режим «Мины» временно недоступен.");
    return data;
  }

  async function loadMinesGame() {
    try {
      const data = await callMinesApi("mines_get_active_game");
      setMinesGame(data.game || null);
      setMinesMessage(data.game ? "Продолжай текущую игру — ставка уже зарезервирована." : "Выбери ставку и количество мин, чтобы начать.");
      setMinesMessageError(false);
    } catch (error) {
      setMinesMessage(error.message || "Не удалось загрузить игру.");
      setMinesMessageError(true);
    }
  }

  async function startMinesGame() {
    const bet = Math.round(Number(minesBet) * 100) / 100;
    if (!Number.isFinite(bet) || bet < 1 || bet > 100000) {
      setMinesMessage("Ставка должна быть от 1 до 100 000 GG.");
      setMinesMessageError(true);
      return;
    }
    if (bet > Number(player?.balance || 0)) {
      setMinesMessage("Недостаточно GG для этой ставки.");
      setMinesMessageError(true);
      return;
    }
    setMinesBusy(true);
    setMinesMessage("");
    try {
      const data = await callMinesApi("mines_start_game", { bet, mineCount: minesCount });
      setMinesGame(data.game);
      setPlayer((current) => current ? { ...current, balance: data.game.balance } : current);
      setMinesMessage("Игра началась! Открывай клетки и забирай выигрыш до попадания на мину.");
      setMinesMessageError(false);
      playUiSound("success");
    } catch (error) {
      setMinesMessage(error.message || "Не удалось начать игру.");
      setMinesMessageError(true);
    } finally { setMinesBusy(false); }
  }

  async function revealMinesCell(cell) {
    if (!minesGame || minesGame.status !== "active" || minesBusy || minesGame.revealedCells?.includes(cell)) return;
    setMinesBusy(true);
    try {
      const data = await callMinesApi("mines_reveal_cell", { gameId: minesGame.id, cell });
      setMinesGame((current) => ({ ...current, ...data.game }));
      if (data.game?.balance != null) setPlayer((current) => current ? { ...current, balance: data.game.balance } : current);
      setMinesMessage(data.game?.status === "lost"
        ? `Бум! Ты нашёл мину. Ставка ${Number(minesGame.bet).toLocaleString("ru-RU")} GG потеряна. Попробуй ещё раз!`
        : `Чисто! Текущий коэффициент ×${Number(data.game?.multiplier || 1).toFixed(2)}. Можешь продолжить или забрать выигрыш.`);
      setMinesMessageError(data.game?.status === "lost");
      playUiSound(data.game?.status === "lost" ? "error" : "success");
    } catch (error) {
      setMinesMessage(error.message || "Не удалось открыть клетку.");
      setMinesMessageError(true);
    } finally { setMinesBusy(false); }
  }

  async function cashoutMinesGame() {
    if (!minesGame || minesGame.status !== "active" || !(minesGame.revealedCells?.length > 0) || minesBusy) return;
    setMinesBusy(true);
    try {
      const data = await callMinesApi("mines_cashout", { gameId: minesGame.id });
      setMinesGame((current) => ({ ...current, ...data.game }));
      setPlayer((current) => current ? { ...current, balance: data.game.balance } : current);
      setMinesMessage(`Забрал ${Number(data.game.payout || 0).toLocaleString("ru-RU")} GG! Отличная игра.`);
      setMinesMessageError(false);
      playUiSound("success");
    } catch (error) {
      setMinesMessage(error.message || "Не удалось забрать выигрыш.");
      setMinesMessageError(true);
    } finally { setMinesBusy(false); }
  }

  async function changePage(nextPage) {
    if (streamerMode && STREAMER_RESTRICTED_PAGES.has(nextPage)) {
      setMenuOpen(false);
      setStreamerModeFeedback("Этот раздел отключён в режиме стримера. Выключи режим в настройках, чтобы вернуться к обычной игре.");
      return;
    }
    if (nextPage !== page) playUiSound("tab");
    setPage(nextPage);
    setMenuOpen(false);
    setActionMessage("");

    if (["Инвентарь", "Коллекция", "Апгрейдер"].includes(nextPage)) {
      await loadInventory();
    }
    if (nextPage === "Кейсы") await loadSpecialCaseAccess();
    if (nextPage === "Мины") await loadMinesGame();

    if (nextPage === "Апгрейдер" && upgradeTargets.length === 0) {
      await loadUpgradeTargets();
    }

    if (["Рейтинг", "Задания", "Достижения", "Профиль", "Live Drops"].includes(nextPage)) await loadGameHub();
    if (nextPage === "Глобальные события") await loadGlobalActivity().catch(() => {});
    if (nextPage === "История") await loadPlayerHistory();
    if (nextPage === "Промокод") {
      setPromoFeedback("");
      setPromoFeedbackError(false);
    }
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
      if (isOwner) await loadAdminPromoCodes();
    }
  }

  async function openSelectedCase() {
    if (streamerMode) { setActionMessage("Открытие кейсов отключено в режиме стримера."); return; }
    const rewardPoolName = getCaseRewardPoolName(selectedCase);
    if (!selectedCase || !player || opening || caseRewardsLoading || caseRewardsFor !== rewardPoolName || caseRewards.length === 0) return;

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
    // Special cases are strictly single-open actions even if the regular case
    // quantity state was changed before this case was selected.
    const casesToOpen = selectedCase.specialType ? 1 : openCount;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const makeReel = (winner, rowIndex) => {
      const pool = caseRewards.length ? caseRewards : [];
      const fallback = ["Noobini Pizzanini", "Lirili Larila", "Trippi Troppi", "Ballerina Cappuccina", "Cappuccino Assassino", "Bombardiro Crocodilo"];
      const cards = Array.from({ length: 53 }, (_, index) => {
        const source = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        return source
          ? {
              item_name: source.item_name,
              value_gg: source.value_gg,
              rarity: source.rarity,
              mutation: source.mutation || null,
              image: source.image || source.image_url || source.photo_url,
            }
          : { item_name: fallback[(index + rowIndex) % fallback.length], value_gg: 0, rarity: "Обычный" };
      });
      // Each purchased case has its own winner position and slightly staggered stop.
      const winnerIndex = 40 + (rowIndex * 2);
      cards[winnerIndex] = { ...winner, image: winner.image || winner.image_url || winner.photo_url };
      return { id: `reel-${rowIndex}`, cards, winnerIndex, position: 0, revealed: false };
    };

    try {
      // Ask the server for every result first. The animation never chooses or changes a reward.
      for (let i = 0; i < casesToOpen; i++) {
        const requestBody = selectedCase.specialType
          ? { initData: initData(), action: "open_special_case", specialCaseType: selectedCase.specialType }
          : { initData: initData(), action: "open_case", caseName: selectedCase.caseName };
        const { data, error } = await supabase.functions.invoke("braingg-api", { body: requestBody });
        if (error || !data?.success || !data?.result?.success) {
          const message = await friendlyActionError(error, data, "Не удалось открыть кейс. Попробуй ещё раз.");
          if (selectedCase.specialType) await loadSpecialCaseAccess();
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

      if (selectedCase.specialType) await loadSpecialCaseAccess();
      playUiSound("spin");
      const rows = fastOpen
        ? rewards.map((reward, index) => ({ id: `reel-${index}`, cards: [reward], winnerIndex: 0, position: 0, revealed: true }))
        : rewards.map((reward, index) => makeReel(reward, index));
      setReelRows(rows);

      if (!fastOpen) {
        setSkipAvailable(true);
        await nextFrame();
        setReelRows((current) => current.map((row) => ({ ...row, position: row.winnerIndex })));
        const maxSpinMs = 6700 + Math.max(0, rewards.length - 1) * 240;
        for (let elapsed = 0; elapsed < maxSpinMs && !skipRequestedRef.current; elapsed += 100) await wait(100);
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
    if (streamerMode) { setActionMessage("Продажа предметов отключена в режиме стримера."); return; }
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
    if (streamerMode) { setActionMessage("Продажа предметов отключена в режиме стримера."); return; }
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
    if (streamerMode) { setActionMessage("Апгрейдер отключён в режиме стримера."); return; }
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
    setUpgradeSpinWon(null);
    setUpgradePointerAngle(0);
    setUpgradePointerVisible(true);
    playUiSound("upgrade");
    setUpgradeResult(null);
    setActionMessage("Проверяем апгрейд на сервере...");

    try {
      const { data, error } = await supabase.functions.invoke("braingg-api", {
        body: {
          initData: initData(),
          action: "upgrade_item",
          inventoryId: selectedUpgrade.id,
          targetItem,
        },
      });

      if (error) {
        let details = error.message || "Ошибка сервера";
        if (error.context) {
          try {
            const response = error.context.clone();
            const body = await response.json();
            details = body.error || body.message || JSON.stringify(body);
          } catch { /* keep the original message */ }
        }
        throw new Error(details);
      }
      if (!data?.success || !data?.result?.success) {
        throw new Error(data?.error || data?.result?.error || data?.message || "Сервер не подтвердил улучшение");
      }

      const result = data.result;
      const won = result.won === true;
      if (won && (result.inventory_verified !== true || !result.awarded_inventory_id)) {
        throw new Error("Сервер сообщил о победе, но не подтвердил выдачу предмета. Проверь SQL-миграцию BrainGG v16.");
      }
      const serverChance = normalizeUpgradeChance(result.chance, actualChance);
      const stopAngle = Number(result.spin_angle);
      if (!Number.isFinite(stopAngle) || stopAngle < 0 || stopAngle >= 360) {
        throw new Error("Сервер не вернул корректный случайный угол апгрейдера. Обнови SQL-миграцию BrainGG v16.");
      }

      const confirmedResult = {
        ...result,
        won,
        chance: Number(serverChance.toFixed(2)),
        target_item: result.target_item || targetItem,
      };

      // The server has already made the roll from this exact angle. The UI keeps
      // the outcome hidden for ten seconds, then the pointer settles at that angle.
      setUpgradeAnimatedChance(serverChance);
      setUpgradePointerAngle(stopAngle);
      setActionMessage("Стрелка уже получила честный результат сервера. Ждём остановки — 10 секунд...");
      setUpgradeWheelAnimating(true);
      await new Promise((resolve) => window.setTimeout(resolve, 10000));
      setUpgradeWheelAnimating(false);
      setUpgradeSpinWon(won);
      setUpgradeResult(confirmedResult);
      setActionMessage(won ? "Есть! Сервер подтвердил победу — предмет добавлен в инвентарь." : "В этот раз не повезло. Результат определён случайным углом сервера.");
      playUiSound(won ? "win" : "lose");

      setPlayer((previous) => previous ? { ...previous, balance: result.balance ?? previous.balance } : previous);
      await loadInventory();
      setSelectedUpgrade(null);
      setTargetItem("");
      setMobileUpgradeList("source");
    } catch (error) {
      console.error("Ошибка апгрейда:", error);
      setActionMessage(await friendlyActionError(error, null, "Не удалось выполнить апгрейд. Попробуй ещё раз."));
    } finally {
      setUpgradeLoading(false);
      setUpgradeWheelAnimating(false);
      setUpgradePointerVisible(true);
    }
  }

  const selectedTarget = upgradeTargets.find(
    (item) => item.item_name === targetItem
  );

  const actualChance = selectedUpgrade && selectedTarget
    ? calculateUpgradeChance(selectedUpgrade, selectedTarget, upgradeEventMultiplier(globalEvent?.event_name))
    : 0;

  useEffect(() => {
    if (upgradeChanceAnimationRef.current !== null) {
      cancelAnimationFrame(upgradeChanceAnimationRef.current);
      upgradeChanceAnimationRef.current = null;
    }

    if (!selectedUpgrade || !selectedTarget || actualChance <= 0) {
      setUpgradeAnimatedChance(0);
      setUpgradeSpinWon(null);
      return undefined;
    }

    setUpgradeAnimatedChance(0);
    setUpgradeSpinWon(null);

    const startTime = performance.now();
    const duration = 560;
    const animateChance = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      // Fast ease-out: the sector fills quickly, then settles softly on the exact chance.
      const eased = 1 - Math.pow(1 - progress, 3);
      setUpgradeAnimatedChance(actualChance * eased);

      if (progress < 1) {
        upgradeChanceAnimationRef.current = requestAnimationFrame(animateChance);
      } else {
        setUpgradeAnimatedChance(actualChance);
        upgradeChanceAnimationRef.current = null;
      }
    };

    upgradeChanceAnimationRef.current = requestAnimationFrame(animateChance);

    return () => {
      if (upgradeChanceAnimationRef.current !== null) {
        cancelAnimationFrame(upgradeChanceAnimationRef.current);
        upgradeChanceAnimationRef.current = null;
      }
    };
  }, [selectedUpgrade?.id, targetItem, actualChance]);

  const availableTargets = upgradeTargets
    .filter((item) => item.item_name !== selectedUpgrade?.item_name)
    .map((item) => ({
      ...item,
      actualChance: selectedUpgrade
        ? calculateUpgradeChance(selectedUpgrade, item, upgradeEventMultiplier(globalEvent?.event_name))
        : null,
    }));

  const wheelChance = selectedTarget
    ? Math.min(90, Math.max(0, upgradeAnimatedChance))
    : 0;
  const wheelAngle = wheelChance * 3.6;
  // The green sector is always centered at 12 o'clock and never rotates or
  // relocates when the server reports a win/loss. Its width alone reflects chance.
  const wheelGradientStart = 360 - wheelAngle / 2;
  const wheelChanceLabel = !selectedTarget
    ? "—"
    : upgradeSpinWon !== null || wheelChance >= actualChance - 0.001
      ? formatUpgradeChance(wheelChance)
      : actualChance >= 1
        ? `${Math.min(Math.ceil(actualChance), Math.max(1, Math.floor(wheelChance)))}%`
        : `${Math.max(0.1, Math.floor(wheelChance * 10) / 10).toFixed(1)}%`;

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

  const adminInventoryRarities = [...new Set(adminInventory.map((item) => String(item.rarity || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  const filteredAdminInventory = adminInventory
    .filter((item) => {
      const query = adminInventoryQuery.trim().toLowerCase();
      const matchesQuery = !query || [item.item_name, item.rarity, item.mutation].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesRarity = adminInventoryRarity === "all" || String(item.rarity || "") === adminInventoryRarity;
      return matchesQuery && matchesRarity;
    })
    .sort((a, b) => {
      if (adminInventorySort === "value_asc") return Number(a.value_gg || 0) - Number(b.value_gg || 0);
      if (adminInventorySort === "newest") return Date.parse(b.created_at || "") - Date.parse(a.created_at || "");
      if (adminInventorySort === "name") return String(a.item_name || "").localeCompare(String(b.item_name || ""), "ru");
      return Number(b.value_gg || 0) - Number(a.value_gg || 0);
    });
  const adminInventoryFilteredValue = filteredAdminInventory.reduce((sum, item) => sum + Number(item.value_gg || 0), 0);

  const filteredAdminDepositRequests = adminDepositRequests.filter((request) => {
    const query = adminDepositQuery.trim().toLowerCase();
    const matchesQuery = !query || [request.roblox_username, request.brainrot_name, request.brainrot_key, request.queue_number, request.assigned_storage_account]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = adminDepositStatus === "all" || request.status === adminDepositStatus;
    return matchesQuery && matchesStatus;
  });
  const adminDepositQueueCounts = {
    all: adminDepositRequests.length,
    queued: adminDepositRequests.filter((request) => request.status === "queued").length,
    waiting_trade: adminDepositRequests.filter((request) => request.status === "waiting_trade").length,
    trade_received: adminDepositRequests.filter((request) => request.status === "trade_received").length,
  };

  const filteredAdminPromoCodes = adminPromoCodes.filter((promo) => {
    const query = adminPromoQuery.trim().toLowerCase();
    const matchesQuery = !query || [promo.code, promo.reward_type, promo.case_name, promo.item_name].some((value) => String(value || "").toLowerCase().includes(query));
    const expired = promo.expires_at && Date.parse(promo.expires_at) <= Date.now();
    const exhausted = promo.max_uses != null && Number(promo.uses_count) >= Number(promo.max_uses);
    const active = Boolean(promo.active && !expired && !exhausted);
    const matchesStatus = adminPromoStatus === "all" || (adminPromoStatus === "active" ? active : !active);
    return matchesQuery && matchesStatus;
  });

  const eventRemainingSeconds = globalEvent?.event_ends_at
    ? Math.max(0, Math.ceil((Date.parse(globalEvent.event_ends_at) - eventClock) / 1000))
    : 0;
  const eventRemainingLabel = `${Math.floor(eventRemainingSeconds / 60)}:${String(eventRemainingSeconds % 60).padStart(2, "0")}`;
  const eventPresentation = {
    tacos: { title: "IT'S RAINING TACOS", subtitle: "Тако падают с неба · оригинальная музыка события", emoji: "🌮", particle: "🌮" },
    lucky: { title: "LUCKY DAY!", subtitle: "Удача ×2 в кейсах и апгрейдере", emoji: "🍀", particle: "🍀" },
    strawberry: { title: "STRAWBERRY DAY!", subtitle: "5% шанс клубничной мутации · цена ×2.5", emoji: "🍓", particle: "🍓" },
    red_fever: { title: "RED FEVER", subtitle: "Шанс редких и выше редких дропов ×1.5", emoji: "🔥", particle: "✦" },
    gold_rush: { title: "GOLD RUSH", subtitle: "Продавай брейнротов и получай ×2 GG", emoji: "💰", particle: "✦" },
    case_sale: { title: "CASE SALE", subtitle: "Все кейсы дешевле на 25%", emoji: "🏷️", particle: "✦" },
    power_upgrade: { title: "POWER UPGRADE", subtitle: "Шанс апгрейда увеличен в 1.5 раза", emoji: "⚡", particle: "⚡" },
    jackpot_hunt: { title: "JACKPOT HUNT", subtitle: "Легендарные, мифические и OG дропы ×3 по весу", emoji: "👑", particle: "✦" },
    night_shift: { title: "NIGHT SHIFT", subtitle: "Ночная атмосфера и отдельный саундтрек", emoji: "🌙", particle: "✦" },
    ...Object.fromEntries(ADMIN_ABUSE_EXTRA_EVENTS.map((event) => [event.key, { title: event.title, subtitle: event.description, emoji: event.icon, particle: event.icon }])),
  };
  const adminEventCatalog = [
    { key: "tacos", icon: "\u{1F32E}", title: "It's Raining Tacos", category: "visual", description: "\u0422\u0451\u043f\u043b\u044b\u0439 \u0444\u043e\u043d, \u043f\u0430\u0434\u0430\u044e\u0449\u0438\u0435 \u0442\u0430\u043a\u043e \u0438 \u043e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u0430\u044f \u043c\u0443\u0437\u044b\u043a\u0430." },
    { key: "lucky", icon: "\u{1F340}", title: "LUCKY DAY!", category: "gameplay", description: "\u0428\u0430\u043d\u0441 \u0440\u0435\u0434\u043a\u0438\u0445 \u0434\u0440\u043e\u043f\u043e\u0432 \u0438 \u0430\u043f\u0433\u0440\u0435\u0439\u0434\u0430 \u00d72." },
    { key: "strawberry", icon: "\u{1F353}", title: "STRAWBERRY DAY!", category: "gameplay", description: "5% \u0448\u0430\u043d\u0441 \u043a\u043b\u0443\u0431\u043d\u0438\u0447\u043d\u043e\u0439 \u043c\u0443\u0442\u0430\u0446\u0438\u0438 \u00d72.5." },
    { key: "red_fever", icon: "\u{1F525}", title: "RED FEVER", category: "gameplay", description: "\u0412\u0435\u0441 \u0440\u0435\u0434\u043a\u0438\u0445 \u0438 \u0432\u044b\u0448\u0435 \u0440\u0435\u0434\u043a\u0438\u0445 \u043d\u0430\u0433\u0440\u0430\u0434 \u00d71.5." },
    { key: "gold_rush", icon: "\u{1F4B0}", title: "GOLD RUSH", category: "economy", description: "\u041f\u0440\u043e\u0434\u0430\u0436\u0430 \u0431\u0440\u0435\u0439\u043d\u0440\u043e\u0442\u043e\u0432 \u043f\u0440\u0438\u043d\u043e\u0441\u0438\u0442 \u0432 2 \u0440\u0430\u0437\u0430 \u0431\u043e\u043b\u044c\u0448\u0435 GG." },
    { key: "case_sale", icon: "\u{1F3F7}\u{FE0F}", title: "CASE SALE", category: "economy", description: "\u0421\u043a\u0438\u0434\u043a\u0430 25% \u043d\u0430 \u0432\u0441\u0435 \u043e\u0442\u043a\u0440\u044b\u0442\u0438\u044f \u043a\u0435\u0439\u0441\u043e\u0432." },
    { key: "power_upgrade", icon: "\u{26A1}", title: "POWER UPGRADE", category: "gameplay", description: "\u0428\u0430\u043d\u0441 \u0430\u043f\u0433\u0440\u0435\u0439\u0434\u0430 \u0443\u0432\u0435\u043b\u0438\u0447\u0435\u043d \u0432 1.5 \u0440\u0430\u0437\u0430." },
    { key: "jackpot_hunt", icon: "\u{1F451}", title: "JACKPOT HUNT", category: "gameplay", description: "\u0412\u0435\u0441 \u043b\u0435\u0433\u0435\u043d\u0434\u0430\u0440\u043d\u044b\u0445, \u043c\u0438\u0444\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u0438 OG \u043d\u0430\u0433\u0440\u0430\u0434 \u00d73." },
    { key: "night_shift", icon: "\u{1F319}", title: "NIGHT SHIFT", category: "visual", description: "\u041d\u043e\u0447\u043d\u0430\u044f \u0442\u0435\u043c\u0430 \u0438 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u043c\u0443\u0437\u044b\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043b\u0443\u043f." },
    ...ADMIN_ABUSE_EXTRA_EVENTS,
  ];
  const filteredAdminEventCatalog = adminEventCatalog
    .filter((event) => {
      const query = adminEventQuery.trim().toLowerCase();
      const matchesQuery = !query || [event.key, event.title, event.description, event.category].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesCategory = adminEventCategory === "all" || event.category === adminEventCategory;
      const matchesFavorites = !adminEventFavoritesOnly || adminEventFavorites.includes(event.key);
      const matchesAbuseTab = adminAbuseTab === "all"
        || (adminAbuseTab === "favorites" ? adminEventFavorites.includes(event.key) : event.category === adminAbuseTab);
      return matchesQuery && matchesCategory && matchesFavorites && matchesAbuseTab;
    })
    .sort((a, b) => adminEventSort === "name" ? a.title.localeCompare(b.title, "ru") : adminEventSort === "category" ? a.category.localeCompare(b.category, "ru") || a.title.localeCompare(b.title, "ru") : 0);
  const adminEventHistoryPeriodMs = adminEventHistoryPeriod === "24h" ? 24 * 60 * 60 * 1000 : adminEventHistoryPeriod === "7d" ? 7 * 24 * 60 * 60 * 1000 : adminEventHistoryPeriod === "30d" ? 30 * 24 * 60 * 60 * 1000 : null;
  const filteredAdminEventHistory = adminEventHistory
    .filter((entry) => {
      const query = adminEventHistoryQuery.trim().toLowerCase();
      const matchesQuery = !query || [entry.title, entry.description, entry.username, entry.event_type].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesType = adminEventHistoryType === "all" || entry.event_type === (adminEventHistoryType === "started" ? "event_started" : "event_ended");
      const timestamp = Date.parse(entry.created_at || "");
      const matchesPeriod = !adminEventHistoryPeriodMs || !Number.isFinite(timestamp) || Date.now() - timestamp <= adminEventHistoryPeriodMs;
      return matchesQuery && matchesType && matchesPeriod;
    })
    .sort((a, b) => adminEventHistorySort === "oldest" ? Date.parse(a.created_at || "") - Date.parse(b.created_at || "") : Date.parse(b.created_at || "") - Date.parse(a.created_at || ""));
  const adminEventHistoryStarts = filteredAdminEventHistory.filter((entry) => entry.event_type === "event_started").length;
  const adminEventHistoryEnds = filteredAdminEventHistory.filter((entry) => entry.event_type === "event_ended").length;
  const adminEventTopLaunch = adminEventCatalog.map((event) => ({
    ...event,
    launches: filteredAdminEventHistory.filter((entry) => entry.event_type === "event_started" && String(entry.description || "").toLowerCase().includes(event.key)).length,
  })).sort((a, b) => b.launches - a.launches)[0];
  const adminEventPreviewDetails = adminEventCatalog.find((event) => event.key === adminEventPreview);
  const adminEventCompareLeft = adminEventCatalog.find((event) => event.key === adminEventCompareA);
  const adminEventCompareRight = adminEventCatalog.find((event) => event.key === adminEventCompareB);
  const adminEventDurationValue = Math.min(1800, Math.max(30, Number(adminEventDuration) || 179));
  const adminEventProgressPercent = globalEvent?.event_started_at && globalEvent?.event_ends_at
    ? Math.max(0, Math.min(100, (eventRemainingSeconds / Math.max(1, (Date.parse(globalEvent.event_ends_at) - Date.parse(globalEvent.event_started_at)) / 1000)) * 100))
    : 0;
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
  const featuredInventory = [...inventory].sort((a, b) => Number(b.value_gg || 0) - Number(a.value_gg || 0)).slice(0, 4);
  const homeActionCards = streamerMode
    ? [
        { page: "Задания", title: "Задания", description: "Забирай награды за активность", metric: `${gameHub.tasks?.length || 0} миссий` },
        { page: "Викторина", title: "Викторина", description: "Отвечай быстро и зарабатывай GG", metric: `${quizStatus.remaining || 0} попыток` },
        { page: "Настройки", title: "Настройки", description: "Управляй звуком и режимами", metric: musicEnabled ? "Музыка включена" : "Музыка выключена" },
      ]
    : [
        { page: "Кейсы", title: "Кейсы", description: "Открывай обновлённые кейсы с плавной рулеткой", metric: `${cases.length} кейсов` },
        { page: "Апгрейдер", title: "Апгрейдер", description: "Честный 10-секундный апгрейдер без подкрутов", metric: selectedUpgrade ? "Выбран предмет" : "Готов к запуску" },
        { page: "Мины", title: "Мины", description: "Открывай клетки, повышай множитель и забирай выигрыш", metric: "25 клеток · риск" },
        { page: "Инвентарь", title: "Инвентарь", description: "Смотри лучшие брейнроты в красивых карточках", metric: `${inventory.length} предметов` },
      ];
  const totalCaseMaxReward = cases.reduce((max, item) => Math.max(max, Number(item.maxReward || 0)), 0);
  const selectedCaseRewardPoolName = getCaseRewardPoolName(selectedCase);
  const selectedSpecialCaseAccess = selectedCase?.specialType ? specialCaseAccess[selectedCase.specialType] : null;
  const selectedSpecialCaseRemainingSeconds = getSpecialCaseRemainingSeconds(selectedSpecialCaseAccess, specialCaseClock);
  const selectedSpecialCaseCoolingDown = selectedSpecialCaseRemainingSeconds > 0;
  const selectedDepositItem = depositCatalog.find((item) => item.item_key === depositSelectedItemKey) || null;
  const selectedDepositMutation = depositMutations.find((item) => item.mutation_key === depositMutationKey) || depositMutations[0] || null;
  // Traits are not self-reported by the player. The administrator verifies the actual
  // traits visible in the Roblox trade; the server then recalculates the final payout.
  const depositEstimatedAmount = selectedDepositItem && selectedDepositMutation
    ? Math.round(Number(selectedDepositItem.base_value_gg || 0) * Number(selectedDepositMutation.multiplier || 1) * 100) / 100
    : 0;
  const depositStatusLabels = {
    queued: "В очереди",
    waiting_trade: "Ожидаем трейд",
    trade_received: "Предмет и traits проверены · ожидаем Accept",
    completed: "Пополнение успешно",
    rejected: "Пополнение не удалось",
  };

  return (
    <div className={`app theme-${siteTheme} ${!streamerMode && globalEvent?.event_name ? `event-theme-${globalEvent.event_name}` : ""}`}>
      <div className={`winter-snow ${!streamerMode && globalEvent?.event_name ? `event-particles event-particles-${globalEvent.event_name}` : ""}`} aria-hidden="true">
        {!streamerMode && globalEvent?.event_name && activeEventPresentation ? eventParticles.map((particle) => (
          <i className="event-particle" key={particle.id} style={{ left: particle.left, animationDelay: particle.delay, animationDuration: particle.duration, fontSize: particle.size, opacity: particle.opacity, "--particle-drift": particle.drift }}>{activeEventPresentation.particle}</i>
        )) : snowflakes.map((flake) => (
          <i className="snowflake" key={flake.id} style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size, opacity: flake.opacity, "--snow-drift": flake.drift }} />
        ))}
      </div>
      <header className="header">
        <div className="header-brand">
          <button className="menu-trigger" type="button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню" aria-expanded={menuOpen} aria-controls="braingg-navigation">
            <span aria-hidden="true">☰</span>
          </button>
          <div className="header-brand-copy">
            <div className="logo"><span className="logo-heart">✦</span> BrainGG</div>
            <span className="header-page-name">{page === "Главная" ? "Игровой центр" : page}</span>
          </div>
        </div>
        <div className="header-wallet">
          <button className={`winter-audio-toggle ${musicEnabled ? "is-on" : ""}`} onClick={toggleWinterMusic} title={globalEvent?.event_name ? "Музыка текущего ивента" : "Фоновая музыка BrainGG"}>{musicEnabled ? "♫ Музыка вкл." : "♫ Музыка"}</button>
          <button className={`winter-audio-toggle ${soundEnabled ? "is-on" : ""}`} onClick={() => setSoundEnabled((value) => !value)} title="Звуковые эффекты">{soundEnabled ? "🔊 Звуки" : "🔇 Звуки"}</button>
          {!streamerMode && <>
            <div className="balance">🪙 {player ? player.balance : 0} GG</div>
            <button className="topup-trigger" onClick={() => { setTopupMessage(""); setDepositMessage(""); setDepositError(""); setTopupTab("stars"); setTopupOpen(true); }}>＋ Пополнить</button>
          </>}
        </div>
      </header>

      {streamerMode && <aside className="streamer-mode-banner" role="status" aria-live="polite"><b>📡 РЕЖИМ СТРИМЕРА</b><span>{streamerModeFeedback || "Отключены случайные открытия, апгрейды, продажи и платежи. Баланс, личные данные и ленты выпадений скрыты."}</span></aside>}

      {menuOpen && <>
        <button className="menu-backdrop" type="button" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />
        <aside className="menu-drawer" id="braingg-navigation" aria-label="BrainGG navigation">
          <div className="menu-drawer-head">
            <div className="menu-drawer-brand"><span>✦</span><div><b>BrainGG</b><small>Все режимы и разделы</small></div></div>
            <button className="menu-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Закрыть">×</button>
          </div>
          <div className="menu-player-card">
            <div className="menu-player-avatar">{streamerMode ? "S" : String(player?.username || telegramIdentity.first_name || "B").slice(0, 1).toUpperCase()}</div>
            <div className="menu-player-identity"><b>{streamerMode ? "Стример BrainGG" : (player?.username ? `@${player.username}` : (telegramIdentity.first_name || "Игрок BrainGG"))}</b><small>{streamerMode ? "Личные данные скрыты" : `Game ID: ${player?.game_id || "нет username"}`}</small></div>
            {!streamerMode && <span className="menu-player-balance">{Number(player?.balance || 0).toLocaleString("ru-RU")} GG</span>}
          </div>
          <nav className="menu-navigation" aria-label="Разделы BrainGG">
            {visibleMenuGroups.map((group) => <section className="menu-group" key={group.title}>
              <h3>{group.title}</h3>
              <div className="menu-items">
                {group.items.map((item) => <button key={`${group.title}-${item.label}`} type="button" className={`menu-item ${page === item.page ? "active" : ""}`} onClick={() => changePage(item.page)}>
                  <span className="menu-item-icon" aria-hidden="true">{item.icon}</span>
                  <span className="menu-item-copy"><b>{item.label}</b><small>{item.description}</small></span>
                  <span className="menu-item-arrow" aria-hidden="true">›</span>
                </button>)}
              </div>
            </section>)}
            {isAdmin && !streamerMode && <section className="menu-group">
              <h3>УПРАВЛЕНИЕ</h3>
              <div className="menu-items"><button type="button" className={`menu-item ${page === "Админка" ? "active" : ""}`} onClick={() => changePage("Админка")}><span className="menu-item-icon">🛠</span><span className="menu-item-copy"><b>Админка</b><small>Инструменты управления</small></span><span className="menu-item-arrow">›</span></button></div>
            </section>}
          </nav>
          <div className="menu-drawer-footer"><span>✦ RED & WHITE SEASON</span><small>BrainGG · Игровой центр</small></div>
        </aside>
      </>}

      {!streamerMode && activeEventPresentation && (
        <section className={`global-event-banner global-event-${globalEvent.event_name}`} aria-live="polite">
          <span className="global-event-banner-icon">{activeEventPresentation.emoji}</span>
          <div><b>{activeEventPresentation.title}</b><small>{activeEventPresentation.subtitle}</small></div>
          <strong>{eventRemainingLabel}</strong>
        </section>
      )}
      {!streamerMode && musicNotice && globalEvent?.event_name && (
        <button className="event-music-notice" type="button" onClick={() => { setMusicEnabled(true); startEventMusic(globalEvent.event_name); }}>{musicNotice} · Нажми, чтобы повторить</button>
      )}
      {!streamerMode && globalMessage && (
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
          {topupOpen && !streamerMode && <div className="stars-modal-backdrop" onClick={() => !topupBusy && !depositLoading && setTopupOpen(false)}>
            <section className="stars-modal deposit-modal" role="dialog" aria-modal="true" aria-labelledby="stars-modal-title" onClick={event => event.stopPropagation()}>
              <button className="stars-modal-close" onClick={() => setTopupOpen(false)} aria-label="Закрыть">×</button>
              <span className="stars-modal-kicker">BRAIN GG WALLET</span>
              <h2 id="stars-modal-title">Пополнение баланса</h2>
              <div className="deposit-method-tabs" role="tablist" aria-label="Способ пополнения">
                <button type="button" className={topupTab === "stars" ? "active" : ""} onClick={() => setTopupTab("stars")}>Telegram Stars</button>
                <button type="button" className={topupTab === "brainrots" ? "active" : ""} onClick={() => { setTopupTab("brainrots"); setDepositError(""); loadDepositCatalog(); loadMyDepositRequests(); }}>Брейнротами</button>
              </div>

              {topupTab === "stars" ? <>
                <div className="stars-method-card"><span className="stars-symbol">★</span><div><b>Telegram Stars</b><small>Безопасная оплата внутри Telegram</small></div><span className="stars-method-check">✓</span></div>
                <p className="stars-rate-note">Курс: 1 ⭐ = 1,25 GG. Минимальное пополнение — 25 ⭐.</p>
                <label className="stars-field-label" htmlFor="stars-amount">Количество Stars</label>
                <input id="stars-amount" className="stars-amount-input" type="number" min="25" max="10000" step="1" value={topupStars} onChange={event => setTopupStars(event.target.value)} />
                <div className="stars-presets">{[25,50,100,250,500,1000].map(value => <button key={value} className={Number(topupStars)===value?"selected":""} onClick={() => setTopupStars(value)}>{value} ⭐</button>)}</div>
                <div className="stars-conversion"><span>Ты получишь</span><b>🪙 {Number.isFinite(Number(topupStars)) ? (Math.round(Number(topupStars)*1.25*100)/100).toLocaleString("ru-RU") : 0} GG</b></div>
                <p className="stars-wager-note">GG будут зачислены автоматически после подтверждения платежа Telegram.</p>
                {topupMessage && <div className="stars-status" role="status">{topupMessage}</div>}
                <button className="stars-pay-button" disabled={topupBusy || Number(topupStars)<25 || Number(topupStars)>10000 || !Number.isSafeInteger(Number(topupStars))} onClick={startStarsTopup}>{topupBusy?"Создаём счёт...":`Оплатить ${topupStars || 0} ⭐`}</button>
              </> : <section className="brainrot-deposit-flow">
                <div className="deposit-stepper" aria-label="Этапы пополнения">
                  {["Брейнрот", "Мутация и traits", "Roblox username", "Очередь"].map((label, index) => <div key={label} className={depositStep >= index + 1 ? "active" : ""}><i>{index + 1}</i><span>{label}</span></div>)}
                </div>
                {depositError && <div className="deposit-feedback error" role="alert">{depositError}</div>}
                {depositMessage && <div className="deposit-feedback" role="status">{depositMessage}</div>}

                {depositStep === 1 && <>
                  <div className="deposit-section-heading"><b>1. Выбери брейнрота</b><small>Выбери предмет, который передашь через трейд в Steal a Brainrot.</small></div>
                  {depositLoading && depositCatalog.length === 0 ? <div className="deposit-loading">Загружаем каталог...</div> : <div className="deposit-brainrot-grid">
                    {depositCatalog.map((item) => <button type="button" key={item.item_key} className={`deposit-brainrot-card ${depositSelectedItemKey === item.item_key ? "active" : ""}`} disabled={!item.enabled} onClick={() => { setDepositSelectedItemKey(item.item_key); setDepositError(""); }}>
                      <img src={depositBrainrotImage(item)} onError={handleBrainrotImageError} alt={depositBrainrotName(item)} />
                      <b>{depositBrainrotName(item)}</b>
                      <small>{Number(item.base_value_gg || 0) > 0 ? `${Number(item.base_value_gg).toLocaleString("ru-RU")} GG · база` : "Цена ещё не задана"}</small>
                      {depositSelectedItemKey === item.item_key && <span className="deposit-selected-mark">✓</span>}
                    </button>)}
                  </div>}
                  <button className="main-button deposit-next-button" disabled={!selectedDepositItem || Number(selectedDepositItem.base_value_gg || 0) <= 0 || depositLoading} onClick={() => { setDepositStep(2); setDepositError(""); }}>Далее →</button>
                  {depositCatalog.length > 0 && depositCatalog.every((item) => Number(item.base_value_gg || 0) <= 0) && <p className="deposit-muted">Администратор ещё не установил базовые цены. Заявки станут доступны после настройки цен в админ-панели.</p>}
                </>}

                {depositStep === 2 && <>
                  <div className="deposit-section-heading"><b>2. Выбери мутацию</b><small>Traits не нужно выбирать вручную: администратор сверит их с предметом в Roblox-трейде, а сервер применит множители автоматически.</small></div>
                  <div className="deposit-choice-block"><b>Мутация</b><div className="deposit-mutation-grid">{depositMutations.map((mutation) => <button type="button" key={mutation.mutation_key} className={depositMutationKey === mutation.mutation_key ? "active" : ""} onClick={() => setDepositMutationKey(mutation.mutation_key)}><span>{mutation.label}</span><small>{mutation.display_value}</small></button>)}</div></div>
                  <div className="deposit-trait-preview">
                    <div className="deposit-traits-heading"><b>Traits, которые учитываются при проверке</b><small>Их наличие проверяется администратором в трейде</small></div>
                    <div className="deposit-traits-grid">{depositTraits.map((trait) => <div key={trait.trait_key} className="deposit-trait-option"><span>{trait.label}</span><b>{trait.display_value}</b></div>)}</div>
                    <p className="deposit-muted">Tung пока не участвует в расчёте: для него не задан множитель. Taco (−1.25x) и Crab (−1.5x) уменьшают итоговую стоимость делением на 1.25 и 1.5 соответственно.</p>
                  </div>
                  <div className="deposit-estimate"><span>Предварительная стоимость без traits</span><b>{depositEstimatedAmount.toLocaleString("ru-RU")} GG</b><small>База {Number(selectedDepositItem?.base_value_gg || 0).toLocaleString("ru-RU")} × мутация {Number(selectedDepositMutation?.multiplier || 1)}. Финальная сумма будет пересчитана после проверки трейда.</small></div>
                  <div className="deposit-actions-row"><button className="case-button" onClick={() => setDepositStep(1)}>← Назад</button><button className="main-button" onClick={() => setDepositStep(3)}>Далее →</button></div>
                </>}

                {depositStep === 3 && <>
                  <div className="deposit-section-heading"><b>3. Укажи Roblox @username</b><small>Нужен именно логин Roblox, не отображаемое имя.</small></div>
                  <label className="deposit-username-label" htmlFor="deposit-roblox-username">Roblox username</label>
                  <div className="deposit-username-input-wrap"><span>@</span><input id="deposit-roblox-username" value={depositRobloxUsername} onChange={(event) => setDepositRobloxUsername(event.target.value.replace(/^@/, ""))} placeholder="your_username" maxLength={20} autoComplete="off" /></div>
                  <div className="deposit-review-card"><img src={depositBrainrotImage(selectedDepositItem)} onError={handleBrainrotImageError} alt={depositBrainrotName(selectedDepositItem)} /><div><b>{depositBrainrotName(selectedDepositItem)}</b><small>{selectedDepositMutation?.label} · traits проверит администратор в трейде</small><strong>от {depositEstimatedAmount.toLocaleString("ru-RU")} GG</strong></div></div>
                  <p className="deposit-muted">После создания заявки ты попадёшь в очередь. Не отправляй трейд, пока бот не сообщит назначенный аккаунт хранения.</p>
                  <div className="deposit-actions-row"><button className="case-button" onClick={() => setDepositStep(2)}>← Назад</button><button className="main-button" disabled={depositLoading || !/^[A-Za-z0-9_]{3,20}$/.test(depositRobloxUsername.replace(/^@/, "")) || depositEstimatedAmount <= 0} onClick={submitBrainrotDeposit}>{depositLoading ? "Создаём заявку..." : "Создать заявку"}</button></div>
                </>}

                {depositStep === 4 && <>
                  <div className="deposit-section-heading"><b>4. Статус пополнения</b><small>Следи за очередью и инструкциями прямо здесь. Бот также отправит уведомление в Telegram.</small></div>
                  {depositRequest ? <article className={`deposit-request-status status-${depositRequest.status}`}>
                    <div className="deposit-request-status-top"><span>{depositStatusLabels[depositRequest.status] || depositRequest.status}</span><b>#{depositRequest.queue_number || "—"}</b></div>
                    <div className="deposit-request-summary"><img src={depositBrainrotImage({ image_key: depositRequest.image_key || depositRequest.brainrot_key })} onError={handleBrainrotImageError} alt={depositBrainrotName(depositRequest, depositRequest.brainrot_name)} /><div><b>{depositBrainrotName(depositRequest, depositRequest.brainrot_name)}</b><small>@{depositRequest.roblox_username} · {depositRequest.mutation_key}</small><strong>+{Number(depositRequest.amount_gg || 0).toLocaleString("ru-RU")} GG</strong></div></div>
                    {depositRequest.status === "queued" && <p>Заявка в очереди. Перед отправкой трейда дождись назначения одного из аккаунтов BrainGG_Storage.</p>}
                    {depositRequest.status === "waiting_trade" && <div className="deposit-trade-instructions"><b>Твоя очередь! Отправь трейд на аккаунт:</b><strong>@{depositRequest.assigned_storage_account}</strong><ol><li>Зайди в Steal a Brainrot.</li><li>Отправь запрос на трейд указанному аккаунту.</li><li>После принятия положи выбранного брейнрота с выбранной мутацией.</li><li>Нажми Ready и дождись проверки предмета и traits администратором.</li><li>Когда администратор тоже нажмёт Ready и сообщит об этом, нажми Accept.</li></ol></div>}
                    {depositRequest.status === "trade_received" && <div className="deposit-trade-instructions"><b>Предмет и traits проверены!</b><p>Финальная сумма пересчитана: <strong>{Number(depositRequest.amount_gg || 0).toLocaleString("ru-RU")} GG</strong>. Дождись, пока администратор нажмёт Ready, затем нажми Accept. После полного завершения трейда администратор подтвердит начисление.</p>{(depositRequest.trait_labels || []).length > 0 && <small>Учтённые traits: {depositRequest.trait_labels.join(", ")}</small>}</div>}
                    {depositRequest.status === "completed" && <div className="deposit-success-message">Пополнение удалось :) Начислено {Number(depositRequest.amount_gg || 0).toLocaleString("ru-RU")} GG.</div>}
                    {depositRequest.status === "rejected" && <div className="deposit-failed-message">Пополнение не удалось :( {depositRequest.admin_note || "Трейд отклонён или не завершён."}</div>}
                    <button className="case-button deposit-refresh-button" disabled={depositLoading} onClick={refreshDepositStatus}>{depositLoading ? "Обновляем..." : "↻ Обновить статус"}</button>
                  </article> : <div className="deposit-empty-status"><b>Активной заявки пока нет</b><p>Вернись к первому шагу и выбери брейнрота для пополнения.</p><button className="main-button" onClick={() => setDepositStep(1)}>Выбрать брейнрота</button></div>}
                </>}
              </section>}
            </section>
          </div>}

          {!streamerMode && <section className="live-drops-bar" aria-label="Live Drops">
            <div className="live-drops-heading"><span className="live-pulse" /> <b>LIVE DROPS</b><small>ПОСЛЕДНИЕ ВЫПАДЕНИЯ</small></div>
            <div className="live-drops-track">
              {liveDrops.length ? liveDrops.map((drop) => (
                <article className={`live-drop-chip ${rarityClassName(drop.rarity)}`} key={drop.id}>
                  <div className="live-drop-art"><img className={drop.mutation === "strawberry" ? "mutation-strawberry-image" : ""} src={brainrotImage(drop)} onError={handleBrainrotImageError} alt={drop.item_name || "Brainrot"} loading="lazy" /></div>
                  <div><b>{drop.item_name}{drop.mutation === "strawberry" ? <span className="strawberry-mutation-pill">STRAWBERRY</span> : null}</b><small>{drop.username ? `@${drop.username}` : "Игрок"} · {displayCaseName(drop.case_name)} · {drop.rarity || "Награда"}</small></div>
                  {drop.value_gg > 0 && <strong>{drop.value_gg.toLocaleString("ru-RU")} GG</strong>}
                </article>
              )) : <div className="live-drops-empty">Здесь появятся реальные выигрыши после открытия кейса</div>}
            </div>
          </section>}

          {streamerMode && STREAMER_RESTRICTED_PAGES.has(page) && <main className="content season-page"><section className="season-panel streamer-blocked-panel"><span className="settings-icon">📡</span><h2>Раздел временно скрыт</h2><p>В режиме стримера этот раздел отключён, чтобы случайные игровые механики и платёжные действия не попадали в трансляцию.</p><button className="main-button" onClick={() => changePage("Настройки")}>Открыть настройки</button></section></main>}

          {page === "Главная" && (
            <main className="content home-welcome">
              <div className="home-welcome-backdrop" aria-hidden="true">
                <img src={siteTheme === "party" ? partyHomeBackground : redHomeBackground} alt="" fetchPriority="high" decoding="async" />
              </div>
              <div className="home-welcome-inner">
                <div className="home-welcome-emblem">✦</div>
                <p className="home-greeting">Привет, <b>{greetingLabel}!</b></p>
                <h2>Добро пожаловать в BrainGG!</h2>
                <p>{streamerMode ? "Собирай коллекцию, проходи викторины и выполняй задания сообщества." : "Открывай кейсы, собирай персонажей и улучшай свою коллекцию."}</p>
                <p className="home-luck">{streamerMode ? "Трансляция в безопасном режиме просмотра" : siteTheme === "party" ? "Party Neon — праздничный сезон BrainGG уже активен" : "Обновлённый Red & White сезон уже активен"}</p>
                <div className="home-cta-row">
                  <button className="main-button" onClick={() => changePage(streamerMode ? "Инвентарь" : "Кейсы")}>{streamerMode ? "Открыть коллекцию" : "Смотреть кейсы"}</button>
                  {!streamerMode && <button className="case-button" onClick={() => changePage("Апгрейдер")}>Перейти в апгрейдер</button>}
                </div>
                <section className="home-stats-grid">
                  <article><small>Баланс</small><b>{Number(player?.balance || 0).toLocaleString("ru-RU")} GG</b></article>
                  <article><small>Инвентарь</small><b>{inventory.length} предметов</b></article>
                  <article><small>Стрик</small><b>{gameHub.progress?.daily_streak || 0} дней</b></article>
                  <article><small>Топ-кейс</small><b>{totalCaseMaxReward ? `${totalCaseMaxReward.toLocaleString("ru-RU")} GG` : "—"}</b></article>
                </section>
                <section className="home-actions-panel">
                  <div className="home-panel-heading"><span className="season-kicker">QUICK ACTIONS</span><h3>Главные режимы</h3></div>
                  <div className="home-actions-grid">
                    {homeActionCards.map((item) => (
                      <button key={item.page} className="home-action-card" onClick={() => changePage(item.page)}>
                        <div><b>{item.title}</b><p>{item.description}</p></div>
                        <span>{item.metric}</span>
                      </button>
                    ))}
                  </div>
                </section>
                {!streamerMode && featuredInventory.length > 0 && (
                  <section className="home-featured-panel">
                    <div className="home-panel-heading"><span className="season-kicker">HOT BRAINROTS</span><h3>Лучшие предметы в инвентаре</h3></div>
                    <div className="home-featured-grid">
                      {featuredInventory.map((item) => (
                        <article key={item.id} className={`home-featured-card ${rarityClassName(item.rarity)}`}>
                          <img src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" />
                          <div><b>{item.item_name}</b><small>{item.rarity || "Обычный"}</small></div>
                          <strong>{Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</strong>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                <section className="season-card daily-card">
                  <div><span className="season-kicker">DAILY REWARD</span><h3>Ежедневная награда</h3><p>Заходи каждый день и увеличивай серию посещений.</p></div>
                  <div className="daily-streak">✦ {gameHub.progress?.daily_streak || 0} дней подряд</div>
                  <button className="main-button" disabled={dailyClaimLoading || gameHub.dailyClaimed} onClick={claimDailyReward}>{dailyClaimLoading ? "Получаем..." : gameHub.dailyClaimed ? "Уже получено сегодня" : "Забрать награду"}</button>
                </section>
                {hubMessage && <p className="hub-feedback">{hubMessage}</p>}
              </div>
            </main>
          )}

          {page === "Мины" && !streamerMode && (
            <main className="content mines-page">
              <section className="mines-hero">
                <div className="mines-hero-copy"><span className="season-kicker">BRAINGG ARCADE · HIGH RISK</span><h2>Мины</h2><p>Открывай безопасные клетки, повышай множитель и забирай выигрыш в любой момент. Одна мина — и раунд окончен.</p></div>
                <div className="mines-hero-icon" aria-hidden="true">💣</div>
              </section>
              <section className="mines-stats">
                <article><small>Твой баланс</small><b>{Number(player?.balance || 0).toLocaleString("ru-RU")} GG</b></article>
                <article><small>Ставка раунда</small><b>{minesGame ? `${Number(minesGame.bet).toLocaleString("ru-RU")} GG` : `${Number(minesBet || 0).toLocaleString("ru-RU")} GG`}</b></article>
                <article><small>Текущий множитель</small><b>×{Number(minesGame?.multiplier || 1).toFixed(2)}</b></article>
                <article><small>Можно забрать</small><b>{minesGame?.status === "active" ? `${Number(minesGame.payout || 0).toLocaleString("ru-RU")} GG` : "—"}</b></article>
              </section>
              <section className="mines-game-panel">
                <div className="mines-controls">
                  <label className="mines-field"><span>Ставка, GG</span><input type="number" min="1" max="100000" step="0.01" value={minesBet} onChange={(event) => setMinesBet(event.target.value)} disabled={minesBusy || minesGame?.status === "active"}/></label>
                  <div className="mines-field"><span>Количество мин</span><div className="mines-count-options">{[1, 3, 5, 8, 10, 15, 20, 24].map((count) => <button type="button" key={count} className={minesCount === count ? "active" : ""} onClick={() => setMinesCount(count)} disabled={minesBusy || minesGame?.status === "active"}>{count}</button>)}</div></div>
                </div>
                <div className="mines-board-head"><div><b>Игровое поле</b><small>{minesGame?.status === "active" ? `Безопасных клеток: ${minesGame.revealedCells?.length || 0}` : "Поле 5 × 5 · 25 клеток"}</small></div><span className="mines-risk-pill">💣 {minesGame?.mineCount || minesCount} мин</span></div>
                <div className={`mines-board ${minesGame?.status === "lost" ? "is-lost" : ""}`}>
                  {Array.from({ length: 25 }, (_, cell) => {
                    const revealed = minesGame?.revealedCells?.includes(cell);
                    const isMine = minesGame?.minePositions?.includes(cell);
                    const showMine = minesGame?.status === "lost" && isMine;
                    const showSafe = revealed && !isMine;
                    return <button type="button" key={cell} className={`mines-cell ${showMine ? "mine" : ""} ${showSafe ? "safe" : ""} ${revealed && isMine ? "hit" : ""}`} onClick={() => revealMinesCell(cell)} disabled={!minesGame || minesGame.status !== "active" || minesBusy || revealed} aria-label={`Клетка ${cell + 1}${showMine ? ", мина" : showSafe ? ", безопасно" : ""}`}>
                      {showMine ? "💣" : showSafe ? "💎" : minesGame?.status === "cashed_out" && isMine ? "💣" : minesGame?.status === "cashed_out" && revealed ? "💎" : "✦"}
                    </button>;
                  })}
                </div>
                <div className="mines-actions">
                  {!minesGame || minesGame.status !== "active" ? <button type="button" className="main-button" onClick={startMinesGame} disabled={minesBusy || loading}>{minesBusy ? "Подожди..." : minesGame ? "Начать новый раунд" : "Начать игру"}</button> : <button type="button" className="mines-cashout-button" onClick={cashoutMinesGame} disabled={minesBusy || !(minesGame.revealedCells?.length > 0)}>{minesBusy ? "Обрабатываем..." : `Забрать ${Number(minesGame.payout || 0).toLocaleString("ru-RU")} GG`}</button>}
                </div>
                {minesMessage && <p className={`mines-feedback ${minesMessageError ? "error" : ""}`} role="status">{minesMessage}</p>}
                <p className="mines-footnote">Ставка списывается при старте. Выигрыш рассчитывается и начисляется сервером. Игра использует внутренние GG.</p>
              </section>
            </main>
          )}

          {page === "Кейсы" && !streamerMode && (
            <main className="content cases-page">
              {selectedCase ? (
                <section className="case-detail-page">
                  <button
                    className="case-back-button"
                    onClick={() => { caseRewardsRequestRef.current += 1; setSelectedCase(null); setCaseRewards([]); setCaseRewardsFor(""); setCaseRewardsLoading(false); setLastRewards([]); setReelRows([]); setActionMessage(""); }}
                  >
                    ← Назад к кейсам
                  </button>

                  <div className="case-detail-hero">
                    <div className={`case-detail-visual case-theme-${selectedCase.color} ${selectedCase.specialType ? `case-detail-special-${selectedCase.specialType}` : ""}`}>
                    <CaseArtwork item={selectedCase} className="case-detail-art-frame" alt={selectedCase.name} />
                      {selectedCase.maxReward && (
                        <span className="case-detail-max">До {selectedCase.maxReward.toLocaleString("ru-RU")} GG</span>
                      )}
                    </div>
                    <div className="case-detail-summary">
                      <span className="case-detail-kicker">BrainGG</span>
                      <h2>{selectedCase.name}</h2>
                      <p>{selectedCase.description}{selectedCase.specialType ? "" : ". Обновлённая рулетка работает плавно, быстро и с акцентом на картинках брейнротов."}</p>
                      <div className="case-detail-quick-stats">
                        {selectedCase.specialType ? <>
                          <div><small>Стоимость</small><b>Бесплатно</b></div>
                          <div><small>Категория</small><b>Специальный</b></div>
                          <div><small>Доступ</small><b>{specialCaseAccess.loading ? "Проверяем..." : !selectedSpecialCaseAccess?.allowed ? "Закрыт" : selectedSpecialCaseCoolingDown ? `Через ${formatCooldownCountdown(selectedSpecialCaseRemainingSeconds)}` : "Открыт"}</b></div>
                        </> : <>
                          <div><small>Цена</small><b>{effectiveCasePrice(selectedCase, globalEvent?.event_name).toLocaleString("ru-RU")} GG</b></div>
                          <div><small>Категория</small><b>{selectedCase.category}</b></div>
                          <div><small>Макс. награда</small><b>{selectedCase.maxReward ? `${selectedCase.maxReward.toLocaleString("ru-RU")} GG` : "—"}</b></div>
                        </>}
                      </div>
                    </div>
                  </div>

                  {selectedCase.specialType && (
                    <section className={`special-case-access-panel special-case-access-${selectedCase.specialType}`}>
                      <div className="special-case-access-heading">
                        <div><span>УСЛОВИЕ ОТКРЫТИЯ</span><b>{selectedCase.name}</b></div>
                        <strong className={selectedSpecialCaseAccess?.allowed ? (selectedSpecialCaseCoolingDown ? "is-cooldown" : "is-available") : "is-locked"}>
                          {specialCaseAccess.loading ? "ПРОВЕРЯЕМ" : !selectedSpecialCaseAccess?.allowed ? "ДОСТУП ЗАКРЫТ" : selectedSpecialCaseCoolingDown ? "ПЕРЕЗАРЯДКА" : "ДОСТУП ОТКРЫТ"}
                        </strong>
                      </div>
                      {selectedCase.specialType === "nick" ? (
                        <>
                          <p>Добавь <b>@Brain_GG_Bot</b> в имя или фамилию своего Telegram-профиля. После изменения закрой и заново открой BrainGG, чтобы Telegram передал обновлённое имя. Пока отметка есть в имени или фамилии, кейс доступен для открытия — одно бесплатное открытие раз в 12 часов.</p>
                          <a className="special-case-link" href="https://t.me/Brain_GG_Bot" target="_blank" rel="noreferrer">Открыть @Brain_GG_Bot ↗</a>
                        </>
                      ) : selectedCase.specialType === "free" ? (
                        <>
                          <p>Подпишись на Telegram-канал <b>@Brainrot_GG</b>. Кейс доступен, пока ты остаёшься подписанным на канал — одно бесплатное открытие раз в 12 часов.</p>
                          <a className="special-case-link" href="https://t.me/Brainrot_GG" target="_blank" rel="noreferrer">Открыть Telegram-канал ↗</a>
                        </>
                      ) : (
                        <p>Пополнения суммируются за последние <b>7 дней</b>. Когда сумма достигнет <b>60 GG</b>, кейс станет доступен. После открытия повторное получение будет доступно через 7 дней. <b>Учитываются успешные пополнения Telegram Stars и завершённые пополнения брейнротами.</b></p>
                      )}
                      {selectedSpecialCaseAccess?.allowed && selectedSpecialCaseCoolingDown && (
                        <div className="special-case-cooldown" role="status">
                          <span>Следующее бесплатное открытие через</span>
                          <b>{formatCooldownCountdown(selectedSpecialCaseRemainingSeconds)}</b>
                        </div>
                      )}
                      <div className="special-case-access-footer">
                        <span role="status">{specialCaseAccess.loading ? "Проверяем условие на сервере..." : selectedSpecialCaseAccess?.reason || "Нажми «Проверить доступ», чтобы обновить статус."}</span>
                        <button type="button" className="case-button" onClick={loadSpecialCaseAccess} disabled={specialCaseAccess.loading}>
                          {specialCaseAccess.loading ? "Проверяем..." : "Проверить доступ"}
                        </button>
                      </div>
                    </section>
                  )}

                  <div className="case-detail-controls">
                    {!selectedCase.specialType && <div className="opening-options">
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
                    </div>}
                    <label className="case-fast-toggle">
                      <input
                        type="checkbox"
                        checked={fastOpen}
                        onChange={(event) => setFastOpen(event.target.checked)}
                      />
                      <span>Быстрое открытие</span>
                    </label>
                  </div>

                  <div className={`case-opening-stage ${opening && !fastOpen ? "is-spinning" : ""}`}>
                    <div className="case-opening-stage-header">
                      <span>{opening ? "ОТКРЫВАЕМ КЕЙС..." : "ГОТОВО К ПРОКРУТКЕ"}</span>
                      <b>{openCount === 1 ? "1 линия" : `${openCount} линии`}</b>
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
                        <div
                          className="case-roulette-strip"
                          style={{
                            "--reel-offset": `${getCaseReelOffset(row.position)}px`,
                            "--reel-duration": `${6.1 + rowIndex * 0.22}s`,
                            transitionDelay: `${rowIndex * 110}ms`,
                          }}
                        >
                          {row.cards.map((reward, index) => {
                            const isWinner = index === row.winnerIndex;
                            return (
                              <div
                                className={`case-roulette-item ${rarityClassName(reward.rarity)} ${row.revealed && isWinner ? "is-winner" : ""}`}
                                key={`${reward.item_name}-${rowIndex}-${index}`}
                                data-drop-name={isWinner ? reward.item_name : undefined}
                                aria-label={isWinner ? `Фактический дроп: ${reward.item_name}` : undefined}
                              >
                                <img className={reward.mutation === "strawberry" ? "mutation-strawberry-image" : ""} src={brainrotImage(reward)} onError={handleBrainrotImageError} alt={reward.item_name} loading="lazy" />
                                <b>{reward.item_name}{reward.mutation === "strawberry" ? <span className="strawberry-mutation-pill">STRAWBERRY ×2.5</span> : null}</b>
                                {Number(reward.value_gg) > 0 && <small>{Number(reward.value_gg).toLocaleString("ru-RU")} GG</small>}
                              </div>
                            );
                          })}
                        </div>
                        <i className="case-roulette-pointer" />
                        <div className="case-roulette-edge case-roulette-edge-left" />
                        <div className="case-roulette-edge case-roulette-edge-right" />
                        <span className="case-roulette-row-label">{openCount > 1 ? `Кейс ${rowIndex + 1}` : "Выпадение"}</span>
                      </div>
                    ))}
                  </div>
                  </div>
                  {opening && skipAvailable && <button className="case-skip-button" onClick={() => { skipRequestedRef.current = true; setSkipAvailable(false); }}>Пропустить анимацию</button>}

                  {!selectedCase.specialType && (() => {
                    const freeCount = Number(player?.free_case_credits?.find((credit) => credit.case_name === selectedCase.caseName)?.amount || 0);
                    const freeToUse = Math.min(freeCount, openCount);
                    const paidCount = Math.max(0, openCount - freeToUse);
                    return (
                      <div className="case-payment-summary">
                        <div><span>Бесплатно доступно</span><b>{freeCount}</b></div>
                        <div><span>Бесплатных открытий</span><b>{freeToUse}</b></div>
                        <div><span>К оплате</span><b>{(paidCount * effectiveCasePrice(selectedCase, globalEvent?.event_name)).toLocaleString("ru-RU")} GG</b></div>
                      </div>
                    );
                  })()}

                  <button
                    className={`main-button case-open-main ${selectedCase.specialType ? `special-case-open-${selectedCase.specialType}` : ""}`}
                    disabled={!player || opening || caseRewardsLoading || caseRewardsFor !== selectedCaseRewardPoolName || caseRewards.length === 0 || (Boolean(selectedCase.specialType) && (specialCaseAccess.loading || !selectedSpecialCaseAccess?.allowed || selectedSpecialCaseCoolingDown))}
                    onClick={openSelectedCase}
                  >
                    {opening ? "Открываем..." : caseRewardsLoading || caseRewardsFor !== selectedCaseRewardPoolName ? "Загружаем дроп..." : selectedCase.specialType
                      ? (specialCaseAccess.loading ? "ПРОВЕРЯЕМ ДОСТУП..." : !selectedSpecialCaseAccess?.allowed ? "ВЫПОЛНИ УСЛОВИЕ ДЛЯ ОТКРЫТИЯ" : selectedSpecialCaseCoolingDown ? `СЛЕДУЮЩЕЕ ОТКРЫТИЕ ЧЕРЕЗ ${formatCooldownCountdown(selectedSpecialCaseRemainingSeconds)}` : `ОТКРЫТЬ ${selectedCase.name} · БЕСПЛАТНО`)
                      : (() => {
                        const freeCount = Number(player?.free_case_credits?.find((credit) => credit.case_name === selectedCase.caseName)?.amount || 0);
                        const paidCount = Math.max(0, openCount - Math.min(freeCount, openCount));
                        return `ОТКРЫТЬ КЕЙС · ${(effectiveCasePrice(selectedCase, globalEvent?.event_name) * paidCount).toLocaleString("ru-RU")} GG`;
                      })()}
                  </button>

                  {actionMessage && <div className="upgrade-message" role="status">{actionMessage}</div>}

                  {lastRewards.length > 0 && (
                    <div className="rewards-list case-last-rewards">
                      <h3>🎉 Твои выпадения</h3>
                      {lastRewards.map((reward, index) => (
                        <div className={`reward-item ${rarityClassName(reward.rarity)}`} key={`${reward.item_name}-${index}`}>
                          <b>{reward.item_name}{reward.mutation === "strawberry" ? <span className="strawberry-mutation-pill">STRAWBERRY ×2.5</span> : null}</b><span>{reward.rarity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <section className="case-contents-panel">
                    <h3>Содержимое кейса</h3>
                    <p className="case-contents-caption">Полный список наград именно из этого кейса · шанс рассчитан по весам дропа</p>
                    {globalEvent?.event_name === "lucky" && <p className="case-contents-event-note">🍀 LUCKY DAY: шансы всех редкостей выше обычной увеличены в 2 раза.</p>}
                    {globalEvent?.event_name === "strawberry" && <p className="case-contents-event-note">🍓 STRAWBERRY DAY: дополнительно действует 5% шанс клубничной мутации с ценой ×2.5.</p>}
                    {globalEvent?.event_name === "red_fever" && <p className="case-contents-event-note">🔥 RED FEVER: вес всех редкостей выше обычной увеличен в 1.5 раза.</p>}
                    {globalEvent?.event_name === "jackpot_hunt" && <p className="case-contents-event-note">👑 JACKPOT HUNT: вес легендарных, мифических и OG наград увеличен в 3 раза.</p>}
                    {globalEvent?.event_name === "case_sale" && <p className="case-contents-event-note">🏷️ CASE SALE: цена каждого открытия снижена на 25%.</p>}
                    <div className="case-contents-grid">
                      {caseRewardsLoading && caseRewardsFor === selectedCaseRewardPoolName && <p className="case-contents-caption">Загружаем полный список наград...</p>}
                      {caseRewardsFor === selectedCaseRewardPoolName && caseRewards.map((item, index) => (
                        <div className={`case-content-item ${rarityClassName(item.rarity)}`} key={`${item.item_name}-${index}`}>
                          <img className="brainrot-thumb" src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" />
                          <div className="case-content-info"><b>{item.item_name}</b><small>{item.rarity || "Награда"} · {Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</small><em>{Number(item.drop_chance_percent || 0).toFixed(2)}% шанс</em></div>
                        </div>
                      ))}
                      {!caseRewardsLoading && caseRewardsFor === selectedCaseRewardPoolName && caseRewards.length === 0 && <p className="case-contents-caption">Для этого кейса пока не настроен пул наград.</p>}
                    </div>
                  </section>
                </section>
              ) : (
                <>
                  <div className="cases-page-heading">
                    <div>
                      <span className="cases-eyebrow">RED & WHITE CASES</span>
                      <h2>Кейсы BrainGG</h2>
                      <p>Полностью обновлённое открытие кейсов: плавная рулетка, большие карточки и брейнроты с нормальными картинками без эмодзи.</p>
                    </div>
                    <div className="cases-balance-chip">Баланс · {Number(player?.balance || 0).toLocaleString("ru-RU")} GG</div>
                  </div>
                  <section className="cases-overview-grid">
                    <article><small>Всего кейсов</small><b>{cases.length + specialCases.length}</b><p>Обычные и специальные кейсы BrainGG.</p></article>
                    <article><small>Макс. награда</small><b>{totalCaseMaxReward.toLocaleString("ru-RU")} GG</b><p>Топовый потенциальный дроп сезона.</p></article>
                    <article><small>Открытие</small><b>Плавная рулетка</b><p>С фокусом на карточках, дропах и честном финале.</p></article>
                  </section>

                  {["Специальные кейсы", "Обычные кейсы", "Премиум", "All In"].map((category) => {
                    const categoryItems = category === "Специальные кейсы"
                      ? specialCases
                      : cases.filter((item) => item.category === category);
                    if (!categoryItems.length) return null;
                    return (
                      <section className="case-category-section" key={category}>
                        <h3>{category}</h3>
                        <div className="case-grid case-grid-reference">
                          {categoryItems.map((item) => {
                            const isSpecial = Boolean(item.specialType);
                            const access = isSpecial ? specialCaseAccess[item.specialType] : null;
                            return (
                              <article className={`case-card case-card-reference case-theme-${item.color} ${isSpecial ? `case-card-special case-card-special-${item.specialType}` : ""}`} key={item.id}>
                                {item.maxReward && <span className="case-max-badge">до {item.maxReward.toLocaleString("ru-RU")} GG</span>}
                                {isSpecial && (() => {
                                  const remaining = getSpecialCaseRemainingSeconds(access, specialCaseClock);
                                  return <span className={`special-case-status ${access?.allowed && remaining === 0 ? "is-available" : ""} ${access?.allowed && remaining > 0 ? "is-cooldown" : ""}`}>
                                    {specialCaseAccess.loading ? "ПРОВЕРКА" : !access?.allowed ? "УСЛОВИЕ" : remaining > 0 ? `ЧЕРЕЗ ${formatCooldownCountdown(remaining)}` : "ДОСТУП ОТКРЫТ"}
                                  </span>;
                                })()}
                                <button
                                  type="button"
                                  className="case-card-reference-button"
                                  onClick={() => {
                                    setSelectedCase(item);
                                    setCaseRewards([]);
                                    setCaseRewardsFor(getCaseRewardPoolName(item));
                                    setLastRewards([]);
                                    setOpenCount(1);
                                    setActionMessage("");
                                    if (isSpecial) loadSpecialCaseAccess();
                                    if (upgradeTargets.length === 0) loadUpgradeTargets();
                                  }}
                                >
                                  <CaseArtwork item={item} className="case-card-art" alt={item.name} />
                                  <div className="case-card-details">
                                    <h4>{item.name}</h4>
                                    <p>{item.description}</p>
                                    {isSpecial ? (
                                      <div className="special-case-requirement">{item.requirementShort}</div>
                                    ) : (
                                      <div className="case-price-row">
                                        <span>Цена:</span>
                                        {item.oldPrice && <del>{item.oldPrice.toLocaleString("ru-RU")}</del>}
                                        <b>{effectiveCasePrice(item, globalEvent?.event_name).toLocaleString("ru-RU")} GG</b>{globalEvent?.event_name === "case_sale" && <em className="event-sale-pill">ИВЕНТ −25%</em>}
                                        {item.discount && <em>-{item.discount}%</em>}
                                      </div>
                                    )}
                                    <span className="case-card-open-label">{isSpecial ? (access?.allowed ? "Открыть бесплатно ›" : "Проверить условие ›") : "Открыть ›"}</span>
                                  </div>
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </>
              )}
            </main>
          )}

          {page === "Апгрейдер" && !streamerMode && (
            <main className="content upgrade-content">
              <div className="upgrade-heading">
                <div>
                  <h2>Апгрейдер BrainGG</h2>
                  <p>
                    Выбери свой брейнрот, задай цель и запусти честную 10-секундную анимацию со случайной стрелкой без подкрутов.
                  </p>
                </div>

                <div className="upgrade-badge">10 SEC FAIR SPIN</div>
              </div>
              <section className="upgrade-overview-grid">
                <article><small>Твой инвентарь</small><b>{inventory.length}</b><p>Любой предмет можно отправить на апгрейд.</p></article>
                <article><small>Доступно целей</small><b>{availableTargets.length}</b><p>Система подбирает все возможные цели выше или рядом по стоимости.</p></article>
                <article><small>Принцип</small><b>Честная стрелка</b><p>Сервер отдаёт результат, а UI красиво доводит его до финала за 10 секунд.</p></article>
              </section>

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
                            className={`upgrade-item ${rarityClassName(item.rarity)} ${selectedUpgrade?.id === item.id ? "selected" : ""}`}
                            disabled={upgradeLoading}
                            onClick={() => chooseSource(item)}
                          >
                            <img className={`upgrade-item-emoji-image ${item.mutation === "strawberry" ? "mutation-strawberry-image" : ""}`} src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" />

                            <span className="upgrade-item-info">
                              <b>{item.item_name}{item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">STRAWBERRY</span> : null}</b>

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
                            background: `conic-gradient(from ${wheelGradientStart}deg, #39e58b 0deg ${wheelAngle}deg, #292438 ${wheelAngle}deg 360deg)`,
                          }}
                        >
                          <div className="wheel-inner">
                            <span className="wheel-chance">
                              {wheelChanceLabel}
                            </span>

                            <span className="wheel-label">
                              РЕАЛЬНЫЙ ШАНС
                            </span>
                          </div>
                        </div>

                        <div
                          className={`upgrade-pointer-positioner${upgradePointerVisible ? "" : " is-hidden"}`}
                          style={{ transform: "rotate(0deg)" }}
                          aria-hidden="true"
                        >
                          <div className={`upgrade-pointer-rotator${upgradeWheelAnimating ? " is-spinning" : ""}`} style={{ "--upgrade-stop-angle": `${upgradePointerAngle}deg`, transform: upgradeWheelAnimating ? undefined : `rotate(${upgradePointerAngle}deg)` }}>
                            <svg className="upgrade-pointer-head" viewBox="0 0 36 44" focusable="false" aria-hidden="true">
                              <path d="M18 41 L3 5 Q18 -2 33 5 Z" fill="#f5fdff" stroke="#245c78" strokeWidth="2.5" strokeLinejoin="round" />
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
                        Шанс рассчитывается по стоимости предметов и серверному коэффициенту события.
                        После запуска сервер выбирает случайный угол, а стрелка показывает исход за 10 секунд.
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
                            className={`upgrade-item target-item ${rarityClassName(item.rarity)} ${targetItem === item.item_name ? "selected" : ""}`}
                            disabled={upgradeLoading}
                            onClick={() => {
                              if (targetItem !== item.item_name) setUpgradeAnimatedChance(0);
                              setTargetItem(item.item_name);
                              setUpgradeSpinWon(null);
                              setUpgradeWheelAnimating(false);
                              setUpgradePointerVisible(true);
                              setUpgradePointerAngle(0);
                              setUpgradeResult(null);
                              setActionMessage("");
                            }}
                          >
                            <img className="upgrade-item-emoji-image" src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" />

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
                          Шанс победы: {upgradeResult.chance}% · случайный угол: {Number(upgradeResult.spin_angle).toFixed(1)}°
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
              <div className="inventory-hero"><div><span className="inventory-kicker">МОЯ КОЛЛЕКЦИЯ</span><h2>Моя коллекция</h2><p>{streamerMode ? "Просматривай свою коллекцию в режиме трансляции" : "Все твои брейнроты — в одном месте"}</p></div><div className="inventory-hero-icon">{featuredInventory[0] ? <img src={brainrotImage(featuredInventory[0])} onError={handleBrainrotImageError} alt={featuredInventory[0].item_name} loading="lazy" /> : <span>✦</span>}</div></div>
              <div className="inventory-stats">{streamerMode ? <><div><small>Предметов в коллекции</small><b>{inventory.length}</b></div><div><small>Видов редкости</small><b>{new Set(inventory.map((item) => item.rarity || "Обычный")).size}</b></div><div><small>Режим</small><b>Просмотр</b></div></> : <><div><small>Предметов</small><b>{inventory.length}</b></div><div><small>Общая стоимость</small><b>{inventory.reduce((sum,item)=>sum+(Number(item.value_gg)||0),0).toLocaleString("ru-RU")} <i>GG</i></b></div><div><small>Средняя стоимость</small><b>{inventory.length?Math.round(inventory.reduce((sum,item)=>sum+(Number(item.value_gg)||0),0)/inventory.length).toLocaleString("ru-RU"):0} <i>GG</i></b></div></>}</div>
              {inventoryLoading && <div className="inventory-state"><div className="inventory-loader">✦</div><b>Собираем коллекцию...</b></div>}
              {inventoryError && <div className="upgrade-message error">{inventoryError}<button onClick={loadInventory}>Повторить</button></div>}
              {!inventoryLoading && !inventoryError && inventory.length > 0 && (<>
                <div className="inventory-toolbar"><label className="inventory-search">⌕<input value={inventoryQuery} onChange={e=>setInventoryQuery(e.target.value)} placeholder="Найти предмет..." /></label><select value={inventoryRarity} onChange={e=>setInventoryRarity(e.target.value)}><option>Все</option>{[...new Set(inventory.map(x=>x.rarity).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select><select value={inventorySort} onChange={e=>setInventorySort(e.target.value)}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option>{!streamerMode && <><option value="priceHigh">Дорогие сначала</option><option value="priceLow">Дешёвые сначала</option></>}</select>{!streamerMode && <button className="inventory-sell-all" onClick={sellAllItems} disabled={sellingAll || sellingId !== null || upgradeLoading}>{sellingAll ? "Продаём всё..." : "Продать всё"}</button>}</div>
                <div className="inventory-results-label">КОЛЛЕКЦИЯ · {inventory.filter(item=>(!inventoryQuery||String(item.item_name||"").toLowerCase().includes(inventoryQuery.toLowerCase()))&&(inventoryRarity==="Все"||item.rarity===inventoryRarity)).length} / {inventory.length}</div>
                <div className="inventory-grid">{inventory.filter(item=>(!inventoryQuery||String(item.item_name||"").toLowerCase().includes(inventoryQuery.toLowerCase()))&&(inventoryRarity==="Все"||item.rarity===inventoryRarity)).sort((a,b)=>inventorySort==="priceHigh"?Number(b.value_gg)-Number(a.value_gg):inventorySort==="priceLow"?Number(a.value_gg)-Number(b.value_gg):inventorySort==="oldest"?new Date(a.created_at)-new Date(b.created_at):new Date(b.created_at)-new Date(a.created_at)).map((item,index)=>(
                  <article className={`inventory-card ${rarityClassName(item.rarity)}`} key={item.id}><div className="inventory-card-top"><span>#{String(index+1).padStart(2,"0")}</span><span className={`inventory-rarity ${item.rarity === "OG" ? "rarity-og" : ""}`}>{item.rarity||"Обычный"}</span></div><div className="inventory-art"><div className="inventory-art-glow"/><img className={`brainrot-inventory-image ${item.mutation === "strawberry" ? "mutation-strawberry-image" : ""}`} src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" /><i>✦</i></div><div className="inventory-card-info"><h3>{item.item_name} {item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">{streamerMode ? "STRAWBERRY" : "STRAWBERRY ×2.5"}</span> : null}</h3>{!streamerMode && <div className="inventory-value">{Number(item.value_gg||0).toLocaleString("ru-RU")} <small>GG</small></div>}<p>Получен {item.created_at?new Date(item.created_at).toLocaleDateString("ru-RU"):"—"}</p></div>{!streamerMode ? <div className="inventory-card-actions"><button className="main-button" disabled={sellingId===item.id||sellingAll||upgradeLoading} onClick={()=>sellItem(item)}>{sellingId===item.id?"Продаём...":`Продать · ${(Number(item.value_gg||0) * (globalEvent?.event_name === "gold_rush" ? 2 : 1)).toLocaleString("ru-RU")} GG`}</button><button className="case-button" disabled={sellingId===item.id||sellingAll||upgradeLoading} onClick={()=>{setSelectedUpgrade(item);setTargetItem("");setUpgradeAnimatedChance(0);setUpgradeSpinWon(null);setUpgradeWheelAnimating(false);setUpgradePointerVisible(true);setUpgradePointerAngle(0);setUpgradeResult(null);setMobileUpgradeList("target");changePage("Апгрейдер");}}>⚡ Улучшить</button></div> : <div className="streamer-readonly-label">Только просмотр во время трансляции</div>}</article>
                ))}</div>
                {inventory.filter(item=>(!inventoryQuery||String(item.item_name||"").toLowerCase().includes(inventoryQuery.toLowerCase()))&&(inventoryRarity==="Все"||item.rarity===inventoryRarity)).length===0&&<div className="inventory-state"><span>🔎</span><b>Ничего не найдено</b><p>Измени запрос или фильтр.</p></div>}
              </>)}
              {!inventoryLoading&&!inventoryError&&inventory.length===0&&<div className="inventory-state"><div className="inventory-empty-icon">✦</div><h3>Хранилище пока пустое</h3><p>{streamerMode ? "Продолжай собирать коллекцию через задания и викторину." : "Открой первый кейс — и здесь появится твоя коллекция."}</p><button className="main-button" onClick={()=>changePage(streamerMode ? "Задания" : "Кейсы")}>{streamerMode ? "Перейти к заданиям" : "Перейти к кейсам"}</button></div>}
            </main>
          )}

          {page === "Коллекция" && (
            <main className="content season-page collection-page">
              <header className="season-page-heading"><span className="season-kicker">BRAINROT ALBUM</span><h2>📚 Альбом коллекционера</h2><p>{streamerMode ? "Просматривай свою коллекцию во время трансляции." : "Собирай редких брейнротов и следи за ценностью своей коллекции."}</p></header>
              <div className="collection-summary">
                <article><small>Уникальных предметов</small><b>{inventory.length}</b></article>
                {!streamerMode && <article><small>Общая стоимость</small><b>{inventory.reduce((sum, item) => sum + Number(item.value_gg || 0), 0).toLocaleString("ru-RU")} GG</b></article>}
                <article><small>Видов редкости</small><b>{new Set(inventory.map((item) => item.rarity || "Обычный")).size}</b></article>
              </div>
              {inventoryLoading ? <div className="inventory-state"><div className="inventory-loader">✦</div><b>Загружаем альбом...</b></div> : inventoryError ? <div className="upgrade-message error">{inventoryError}<button onClick={loadInventory}>Повторить</button></div> : inventory.length ? <div className="collection-grid">
                {inventory.map((item) => <article className="collection-card" key={`${item.item_name}-${item.mutation || "normal"}`}>
                  <div className="collection-card-art"><img src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" /></div>
                  <div className="collection-card-info"><b>{item.item_name}</b><small>{item.rarity || "Обычный"}{item.mutation === "strawberry" ? " · STRAWBERRY" : ""}</small>{!streamerMode && <strong>{Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</strong>}</div>
                </article>)}
              </div> : <div className="inventory-state"><div className="inventory-empty-icon">📚</div><h3>Альбом пока пуст</h3><p>{streamerMode ? "Выполняй задания и участвуй в викторине, чтобы развивать профиль." : "Открой первый кейс, чтобы добавить первого брейнрота."}</p><button className="main-button" onClick={() => changePage(streamerMode ? "Задания" : "Кейсы")}>{streamerMode ? "К заданиям" : "К кейсам"}</button></div>}
            </main>
          )}

          {page === "Рейтинг" && (
            <main className="content season-page">
              <header className="season-page-heading"><span className="season-kicker">GLOBAL LEADERBOARD</span><h2>✦ Глобальный рейтинг</h2><p>Игроки с самым высоким опытом BrainGG.</p></header>
              <section className="season-panel"><div className="season-panel-title"><h3>Таблица лидеров</h3><button className="case-button" onClick={loadGameHub} disabled={hubLoading}>↻ Обновить</button></div>
                {hubLoading ? <p>Загружаем рейтинг...</p> : (gameHub.leaderboard || []).length ? <div className="leaderboard-list">{gameHub.leaderboard.map((entry,index)=><article className={`leaderboard-row ${index<3?"top-player":""}`} key={`${entry.game_id||entry.username}-${index}`}><b className="leaderboard-place">{index===0?"👑":`#${index+1}`}</b><div className="leaderboard-avatar">{index<3?"✦":"♙"}</div><div className="leaderboard-user"><b>{streamerMode ? `Игрок #${index + 1}` : `@${entry.username}`}</b><small>Уровень {entry.level}{streamerMode ? "" : ` · ${Number(entry.total_cases_opened || 0)} открытий`}</small></div><strong>{Number(entry.xp||0).toLocaleString("ru-RU")} XP</strong></article>)}</div> : <p className="season-empty">Рейтинг появится после накопления игрового опыта.</p>}
              </section>
            </main>
          )}

          {page === "Live Drops" && !streamerMode && (
            <main className="content season-page drops-page">
              <header className="season-page-heading"><span className="season-kicker">COMMUNITY FEED</span><h2>🔥 Live Drops</h2><p>Последние подтверждённые выпадения игроков BrainGG.</p></header>
              <section className="season-panel"><div className="season-panel-title"><h3>Лента выпадений</h3><button className="case-button" onClick={loadGameHub} disabled={hubLoading}>{hubLoading ? "..." : "↻ Обновить"}</button></div>
                {hubLoading ? <p>Загружаем ленту...</p> : liveDrops.length ? <div className="drops-list">{liveDrops.map((drop) => <article className="drops-row" key={drop.id}>
                  <div className="drops-art"><img src={brainrotImage(drop)} onError={handleBrainrotImageError} alt={drop.item_name || "Brainrot"} loading="lazy" /></div>
                  <div className="drops-info"><b>{drop.item_name}</b><small>@{drop.username || "Игрок"} · {displayCaseName(drop.case_name)} · {drop.rarity || "Награда"}</small><time>{drop.created_at ? new Date(drop.created_at).toLocaleString("ru-RU") : ""}</time></div>
                  <strong>{Number(drop.value_gg || 0).toLocaleString("ru-RU")} GG</strong>
                </article>)}</div> : <div className="season-empty">Пока нет выпадений. Открой кейс и стань первым в ленте!</div>}
              </section>
            </main>
          )}

          {page === "Глобальные события" && !streamerMode && (
            <main className="content season-page global-activity-page">
              <header className="season-page-heading global-activity-heading">
                <span className="season-kicker">ONE COMMUNITY · LIVE</span>
                <h2>🌍 Глобальные события BrainGG</h2>
                <p>Единая лента для всех игроков. Открытия кейсов, продажи, апгрейды, награды и запуски событий появляются здесь у всех одновременно.</p>
              </header>
              <section className="season-panel global-activity-panel">
                <div className="season-panel-title">
                  <h3>События сообщества</h3>
                  <button className="case-button" onClick={() => loadGlobalActivity().catch(() => {})} disabled={globalActivityLoading}>{globalActivityLoading ? "Загружаем..." : "↻ Обновить"}</button>
                </div>
                <div className="global-activity-live-note"><span className="global-activity-live-dot" /> Обновляется автоматически в реальном времени для всех игроков</div>
                {globalActivityError ? <div className="season-empty">{globalActivityError}</div> : globalActivityLoading && !globalActivities.length ? <div className="season-empty">Загружаем общую ленту BrainGG...</div> : globalActivities.length ? (
                  <div className="global-activity-list">
                    {globalActivities.map((activity) => {
                      const icons = { case_opened: "🎁", item_sold: "💰", upgrade_won: "⚡", upgrade_failed: "🧊", daily_reward: "🎄", task_reward: "📋", quiz_correct: "🧠", quiz_answered: "❔", promo_redeemed: "🎟️", event_started: "🌍", event_ended: "🏁", global_message: "📣", admin_reward: "🎁" };
                      const actor = activity.username ? `@${activity.username}` : "Игрок BrainGG";
                      return <article className={`global-activity-row ${activity.success === false ? "is-unsuccessful" : ""}`} key={activity.id}>
                        <span className="global-activity-icon">{icons[activity.event_type] || "✨"}</span>
                        <div className="global-activity-copy">
                          <div className="global-activity-title-line"><b>{activity.title}</b><small>{actor}</small></div>
                          {activity.description && <p>{activity.description}</p>}
                          <time>{activity.created_at ? new Date(activity.created_at).toLocaleString("ru-RU") : "Только что"}</time>
                        </div>
                        {Number(activity.value_gg || 0) > 0 && <strong className="global-activity-value">{Number(activity.value_gg).toLocaleString("ru-RU")} GG</strong>}
                      </article>;
                    })}
                  </div>
                ) : <div className="season-empty">Пока нет событий. Первые действия игроков появятся здесь автоматически!</div>}
              </section>
            </main>
          )}

          {page === "Задания" && !streamerMode && (
            <main className="content season-page">
              <header className="season-page-heading"><span className="season-kicker">BRAIN GG MISSIONS</span><h2>✦ Задания и достижения</h2><p>Выполняй игровые цели, получай GG и опыт.</p></header>
              {hubMessage && <p className="hub-feedback">{hubMessage}</p>}
              <section className="season-panel"><h3>Текущие задания</h3>{(gameHub.tasks||[]).map((task)=><article className="mission-card" key={task.id}><div className="mission-icon">✦</div><div className="mission-info"><b>{task.title}</b><p>{task.description}</p><div className="mission-progress"><span style={{width:`${Math.min(100,Number(task.progress||0)/task.goal*100)}%`}}/></div><small>{Math.min(Number(task.progress||0),task.goal)} / {task.goal}</small></div><div className="mission-reward"><b>+{task.reward} GG</b><small>+{task.xp} XP</small><button className="case-button" disabled={!task.progress||task.progress<task.goal||task.claimed||taskClaimLoading===task.id} onClick={()=>claimTaskReward(task.id)}>{task.claimed?"Получено":taskClaimLoading===task.id?"...":"Забрать"}</button></div></article>)}</section>
              <section className="season-panel"><h3>Достижения</h3><div className="achievement-grid">{[{name:"Первый шаг",desc:"Открой первый кейс",ok:Number(gameHub.progress?.total_cases_opened||0)>=1},{name:"Коллекционер",desc:"Открой 10 кейсов",ok:Number(gameHub.progress?.total_cases_opened||0)>=10},{name:"Торговец",desc:"Продай первый предмет",ok:Number(gameHub.progress?.total_sales||0)>=1},{name:"Мастер улучшений",desc:"Улучши первый предмет",ok:Number(gameHub.progress?.total_upgrades||0)>=1}].map((a)=><article className={`achievement-card ${a.ok?"unlocked":""}`} key={a.name}><span>{a.ok?"🏆":"🔒"}</span><b>{a.name}</b><small>{a.desc}</small></article>)}</div></section>
            </main>
          )}

          {page === "Достижения" && !streamerMode && (
            <main className="content season-page achievements-page">
              <header className="season-page-heading"><span className="season-kicker">PLAYER MILESTONES</span><h2>🏆 Достижения</h2><p>Выполняй игровые цели и собирай значки BrainGG.</p></header>
              <div className="achievement-overview"><b>{[
                Number(gameHub.progress?.total_cases_opened || 0) >= 1,
                Number(gameHub.progress?.total_cases_opened || 0) >= 10,
                Number(gameHub.progress?.total_cases_opened || 0) >= 100,
                Number(gameHub.progress?.total_sales || 0) >= 1,
                Number(gameHub.progress?.total_sales || 0) >= 10,
                Number(gameHub.progress?.total_upgrades || 0) >= 1,
                Number(gameHub.progress?.total_upgrades || 0) >= 10,
                Number(gameHub.progress?.daily_streak || 0) >= 7,
              ].filter(Boolean).length} / 8</b><span>открыто достижений</span></div>
              <div className="achievement-grid">{[
                { name: "Первый шаг", desc: "Открой первый кейс", icon: "🎁", ok: Number(gameHub.progress?.total_cases_opened || 0) >= 1 },
                { name: "Коллекционер", desc: "Открой 10 кейсов", icon: "📚", ok: Number(gameHub.progress?.total_cases_opened || 0) >= 10 },
                { name: "Легенда", desc: "Открой 100 кейсов", icon: "👑", ok: Number(gameHub.progress?.total_cases_opened || 0) >= 100 },
                { name: "Торговец", desc: "Продай первый предмет", icon: "💰", ok: Number(gameHub.progress?.total_sales || 0) >= 1 },
                { name: "Бизнесмен", desc: "Продай 10 предметов", icon: "💼", ok: Number(gameHub.progress?.total_sales || 0) >= 10 },
                { name: "Мастер апгрейда", desc: "Улучши первый предмет", icon: "⚡", ok: Number(gameHub.progress?.total_upgrades || 0) >= 1 },
                { name: "Апгрейд-про", desc: "Сделай 10 апгрейдов", icon: "🚀", ok: Number(gameHub.progress?.total_upgrades || 0) >= 10 },
                { name: "Непрерывная серия", desc: "Заходи 7 дней подряд", icon: "🔥", ok: Number(gameHub.progress?.daily_streak || 0) >= 7 },
              ].map((achievement) => <article className={`achievement-card ${achievement.ok ? "unlocked" : ""}`} key={achievement.name}><span>{achievement.ok ? achievement.icon : "🔒"}</span><b>{achievement.name}</b><small>{achievement.desc}</small><em>{achievement.ok ? "Открыто" : "Не открыто"}</em></article>)}</div>
            </main>
          )}

          {page === "История" && !streamerMode && (
            <main className="content season-page history-page">
              <header className="season-page-heading"><span className="season-kicker">YOUR ACTIVITY</span><h2>🕒 История открытий</h2><p>Твои последние кейсы и выпавшие предметы.</p></header>
              <section className="season-panel"><div className="season-panel-title"><h3>Последние 100 открытий</h3><button className="case-button" onClick={loadPlayerHistory} disabled={historyLoading}>{historyLoading ? "..." : "↻ Обновить"}</button></div>
                {historyLoading ? <p>Загружаем историю...</p> : historyError ? <div className="season-empty">{historyError}</div> : playerHistory.length ? <div className="player-history-list">{playerHistory.map((entry, index) => <article className="player-history-row" key={`${entry.created_at || "entry"}-${index}`}><span className="player-history-icon">🎁</span><div className="player-history-info"><b>{entry.item_name || "Предмет"}</b><small>{displayCaseName(entry.case_name)} · {entry.created_at ? new Date(entry.created_at).toLocaleString("ru-RU") : "Дата не указана"}</small></div><strong>{Number(entry.price || 0).toLocaleString("ru-RU")} GG</strong></article>)}</div> : <div className="season-empty">История пока пуста. Открой кейс, и здесь появится первая запись.</div>}
              </section>
            </main>
          )}

          {page === "Настройки" && (
            <main className="content season-page settings-page">
              <header className="season-page-heading"><span className="season-kicker">YOUR EXPERIENCE</span><h2>⚙ Настройки</h2><p>Настрой BrainGG под себя.</p></header>
              <section className="season-panel settings-theme-panel">
                <div className="settings-theme-heading"><div><b>Дизайн сайта</b><small>Выбери оформление BrainGG. Настройка сохраняется на этом устройстве.</small></div><span className="settings-theme-current">{siteTheme === "party" ? "Вечеринка" : "Red & White"}</span></div>
                <div className="settings-theme-grid" role="group" aria-label="Выбор дизайна сайта">
                  <button type="button" className={`settings-theme-option ${siteTheme === "party" ? "active" : ""}`} aria-pressed={siteTheme === "party"} onClick={() => setSiteTheme("party")}>
                    <span className="settings-theme-preview theme-preview-party" aria-hidden="true"><i className="preview-light"/><i className="preview-logo">BrainGG</i><i className="preview-card-row"><b/><b/><b/></i><i className="preview-action"/></span>
                    <span className="settings-theme-option-copy"><b>Party Neon</b><small>Фиолетовый, золото и неон — как на первой картинке</small></span>
                    <span className="settings-theme-check">{siteTheme === "party" ? "✓ Выбрано" : "Выбрать"}</span>
                  </button>
                  <button type="button" className={`settings-theme-option ${siteTheme === "red" ? "active" : ""}`} aria-pressed={siteTheme === "red"} onClick={() => setSiteTheme("red")}>
                    <span className="settings-theme-preview theme-preview-red" aria-hidden="true"><i className="preview-light"/><i className="preview-logo">BrainGG</i><i className="preview-card-row"><b/><b/><b/></i><i className="preview-action"/></span>
                    <span className="settings-theme-option-copy"><b>Red & White</b><small>Красно-чёрное оформление — как на второй картинке</small></span>
                    <span className="settings-theme-check">{siteTheme === "red" ? "✓ Выбрано" : "Выбрать"}</span>
                  </button>
                </div>
              </section>
              <section className="season-panel settings-list">
                <article className="settings-row"><span className="settings-icon">🎵</span><div><b>Фоновая музыка</b><small>Музыка BrainGG и активных ивентов</small></div><button className={`settings-switch ${musicEnabled ? "active" : ""}`} type="button" onClick={toggleWinterMusic}>{musicEnabled ? "Вкл." : "Выкл."}</button></article>
                <article className="settings-row"><span className="settings-icon">🔊</span><div><b>Звуковые эффекты</b><small>Звуки кнопок и игровых действий</small></div><button className={`settings-switch ${soundEnabled ? "active" : ""}`} type="button" onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? "Вкл." : "Выкл."}</button></article>
                <article className="settings-row settings-streamer-row"><span className="settings-icon">📡</span><div><b>Режим стримера</b><small>Скрывает личные данные, баланс и ленты выпадений; отключает кейсы, апгрейды, продажи и платежи в интерфейсе трансляции.</small></div><button className={`settings-switch ${streamerMode ? "active" : ""}`} type="button" aria-pressed={streamerMode} disabled={opening || upgradeLoading || topupBusy || Boolean(sellingId) || sellingAll} onClick={toggleStreamerMode}>{streamerMode ? "Вкл." : "Выкл."}</button></article>
              </section>
              {streamerModeFeedback && <p className="streamer-mode-feedback" role="status">{streamerModeFeedback}</p>}
              <p className="settings-note">Режим сохраняется в этом браузере на этом устройстве. Он действительно отключает перечисленные действия в интерфейсе, но не меняет правила соцсетей и не гарантирует отсутствие модерации. Правила каждой площадки нужно соблюдать отдельно.</p>
            </main>
          )}

          {page === "Обучение" && (
            <main className="content season-page tutorial-page">
              <header className="season-page-heading"><span className="season-kicker">BRAIN GG GUIDE</span><h2>🎓 Обучение</h2><p>Коротко о том, как развивать свой аккаунт.</p></header>
              <div className="tutorial-grid">
                {streamerMode ? <>
                  <article><span>📚</span><b>1. Просматривай инвентарь</b><p>Смотри всех собранных персонажей в виде красивых карточек с картинками.</p><button onClick={() => changePage("Инвентарь")}>К инвентарю →</button></article>
                  <article><span>🧠</span><b>2. Играй в викторину</b><p>Проверяй знания и отвечай на вопросы.</p><button onClick={() => changePage("Викторина")}>К викторине →</button></article>
                  <article><span>📋</span><b>3. Выполняй задания</b><p>Развивай игровой профиль через задания и ежедневную активность.</p><button onClick={() => changePage("Задания")}>К заданиям →</button></article>
                  <article><span>🏆</span><b>4. Смотри рейтинг</b><p>Показывай прогресс и место в сообществе.</p><button onClick={() => changePage("Рейтинг")}>Открыть рейтинг →</button></article>
                </> : <>
                  <article><span>🎁</span><b>1. Открывай кейсы</b><p>Выбери кейс, посмотри состав наград и открой его. Выигрыш появится в инвентаре.</p><button onClick={() => changePage("Кейсы")}>К кейсам →</button></article>
                  <article><span>⚡</span><b>2. Улучшай предметы</b><p>В апгрейдере выбери свой брейнрот и цель. Шанс победы показан до запуска.</p><button onClick={() => changePage("Апгрейдер")}>К апгрейдеру →</button></article>
                  <article><span>📋</span><b>3. Забирай награды</b><p>Заходи каждый день, выполняй задания и получай GG и XP.</p><button onClick={() => changePage("Задания")}>К квестам →</button></article>
                  <article><span>🏆</span><b>4. Попадай в топ</b><p>Опыт даёт уровни. Сравнивай свои рекорды с другими игроками.</p><button onClick={() => changePage("Рейтинг")}>Открыть рейтинг →</button></article>
                </>}
              </div>
            </main>
          )}

          {page === "Викторина" && (
            <main className="content season-page quiz-page">
              <header className="season-page-heading"><span className="season-kicker">BRAIN GG DAILY QUIZ</span><h2>✦ Викторина BrainGG</h2><p>Отвечай на вопросы, проверяй знания и получай монеты.</p></header>
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
                </> : <div className="quiz-empty"><div className="quiz-crystal">✦</div><h3>{quizStatus.remaining<=0?"На сегодня всё!":"Готов проверить свои знания?"}</h3><p>{quizFeedback || "Каждый день доступны 3 попытки. За каждый правильный ответ начисляется 5 GG."}</p><button className="main-button quiz-action" disabled={quizLoading||quizStatus.remaining<=0} onClick={startQuizQuestion}>{quizLoading?"Загружаем...":quizStatus.remaining>0?"Начать викторину":"Возвращайся завтра"}</button></div>}
              </section>
              <p className="quiz-footnote">Попытка расходуется после отправки ответа. Награда начисляется сервером, максимум 15 GG в день.</p>
            </main>
          )}

          {page === "Профиль" && (
            <main className="content season-page"><header className="season-page-heading"><span className="season-kicker">PLAYER IDENTITY</span><h2>✦ Профиль игрока</h2><p>Твой путь в мире BrainGG.</p></header>
              <section className="season-profile-card"><div className="profile-avatar">🧠</div><div className="profile-identity"><h2>{streamerMode ? "Стример BrainGG" : (player?.username ? `@${player.username}` : (telegramIdentity.first_name || "Игрок"))}</h2><p>{streamerMode ? "Личные данные скрыты в режиме трансляции" : `Game ID: ${player?.game_id || "Не задан — добавь username в Telegram"}`}</p><span>Уровень {gameHub.progress?.level||1}</span></div><div className="profile-xp"><b>{Number(gameHub.progress?.xp||0).toLocaleString("ru-RU")} XP</b><div className="mission-progress"><span style={{width:`${Math.min(100,Math.max(0,(Number(gameHub.progress?.xp||0)-Math.pow(Math.max(0,Number(gameHub.progress?.level||1)-1),2)*100)/Math.max(1,Number(gameHub.progress?.level||1)*Number(gameHub.progress?.level||1)*100-Math.pow(Math.max(0,Number(gameHub.progress?.level||1)-1),2)*100)*100))}%`}}/></div><small>До следующего уровня: {Math.max(0,Number(gameHub.progress?.next_level_xp||100)-Number(gameHub.progress?.xp||0))} XP</small></div></section>
              <div className="profile-stat-grid">{streamerMode ? <><article><small>УРОВЕНЬ</small><b>{gameHub.progress?.level || 1}</b></article><article><small>ОПЫТ</small><b>{Number(gameHub.progress?.xp || 0).toLocaleString("ru-RU")} XP</b></article><article><small>СЕРИЯ ВХОДОВ</small><b>{gameHub.progress?.daily_streak || 0} дней</b></article><article><small>РЕЖИМ</small><b>Трансляция</b></article></> : <><article><small>ОТКРЫТО КЕЙСОВ</small><b>{gameHub.progress?.total_cases_opened||0}</b></article><article><small>ПРОДАНО ПРЕДМЕТОВ</small><b>{gameHub.progress?.total_sales||0}</b></article><article><small>АПГРЕЙДОВ</small><b>{gameHub.progress?.total_upgrades||0}</b></article><article><small>СЕРИЯ ВХОДОВ</small><b>{gameHub.progress?.daily_streak||0} дней</b></article></>}</div>
            </main>
          )}

          {page === "Промокод" && !streamerMode && (
            <main className="content season-page promo-page">
              <header className="season-page-heading">
                <span className="season-kicker">BRAIN GG REWARDS</span>
                <h2>🎟️ Активация промокода</h2>
                <p>Введи промокод от BrainGG и забери свою награду.</p>
              </header>
              <section className="promo-redeem-card">
                <div className="promo-card-emblem">🎁</div>
                <h3>Есть промокод?</h3>
                <p>Каждый код можно активировать один раз на аккаунт. Награда сразу поступит на баланс или в инвентарь.</p>
                <form className="promo-redeem-form" onSubmit={redeemPromoCode}>
                  <label htmlFor="promo-code-input">ТВОЙ ПРОМОКОД</label>
                  <input
                    id="promo-code-input"
                    className="admin-input promo-code-input"
                    value={promoCodeDraft}
                    maxLength={24}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setPromoCodeDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                    placeholder="ВВЕДИ-КОД"
                  />
                  <button className="main-button promo-redeem-button" type="submit" disabled={promoRedeemLoading || !promoCodeDraft.trim()}>
                    {promoRedeemLoading ? "Проверяем код..." : "🎉 Активировать промокод"}
                  </button>
                </form>
                {promoFeedback && <div className={`promo-feedback ${promoFeedbackError ? "error" : "success"}`} role="status">{promoFeedback}</div>}
                <div className="promo-rules"><span>✓</span> Одно использование на игрока <span>•</span> Награда выдаётся сервером <span>•</span> Повторная активация невозможна</div>
              </section>
            </main>
          )}

          {page === "Админка" && isAdmin && !streamerMode && (
            <main className={`content admin-content ${isMobileAdminDevice ? "admin-mobile-device" : ""}`}>
              <div className="admin-heading">
                <div>
                  <span className="admin-kicker">CONTROL CENTER</span>
                  <h2>🛡️ BrainGG Admin Panel</h2>
                  <p>Управление игроками, балансом, кейсами и коллекциями.</p>
                  <span className="admin-mobile-build-stamp">ADMIN CONSOLE · BUILD 3.3</span>
                </div>
                <div className="admin-secure-badge">● ЗАЩИЩЁННЫЙ ДОСТУП</div>
              </div>

              <nav className="admin-tabs" aria-label="Разделы админ-панели">
                {[
                  ["overview", "Обзор", "▦"],
                  ["players", "Игроки", "♙"],
                  ["history", "Журнал", "◷"],
                  ["events", "События", "✦"],
                  ["deposits", "Пополнения", "🧠"],
                  ...(isOwner ? [["promocodes", "Промокоды", "🎟"]] : []),
                  ["tools", "Инструменты", "⌘"],
                ].map(([key, label, icon]) => (
                  <button
                    key={key}
                    type="button"
                    className={adminSection === key ? "active" : ""}
                    onClick={() => {
                      setAdminSection(key);
                      if (key === "promocodes") loadAdminPromoCodes();
                      if (key === "deposits") loadAdminDepositData();
                      if (key === "events") { loadGlobalState().catch(() => {}); if (isOwner) loadAdminEventHistory().catch(() => {}); }
                    }}
                  >
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </nav>

              {adminToolFeedback && <div className="admin-mobile-global-feedback" role="status">{adminToolFeedback}</div>}

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
                      <span className="admin-metric-icon">✦</span>
                      <small>СОСТОЯНИЕ ДОСТУПА</small>
                      <strong>Активен</strong>
                      <em>Проверка прав на сервере</em>
                    </article>
                  </div>

                  <section className="admin-mobile-quick-panel">
                    <div className="admin-mobile-quick-heading">
                      <div><span>ADMIN CONSOLE · BUILD 3.3</span><h3>Центр управления</h3><p>Единая панель управления для ПК и телефона: быстрый поиск, события, мониторинг и инструменты.</p></div>
                      <span className={`admin-mobile-live-dot ${navigator.onLine ? "" : "is-offline"}`}>{navigator.onLine ? "● ONLINE" : "● OFFLINE"}</span>
                    </div>
                    <div className="admin-mobile-control-meta">
                      <div><small>РОЛЬ</small><b>{isOwner ? "Владелец" : "Администратор"}</b></div>
                      <div><small>TELEGRAM</small><b>{window.Telegram?.WebApp ? "Подключён" : "Браузер"}</b></div>
                      <div><small>ГЛОБАЛЬНЫЙ ИВЕНТ</small><b>{globalEvent?.event_name ? (eventPresentation[globalEvent.event_name]?.title || globalEvent.event_name) : "Не активен"}</b></div>
                    </div>
                    <form className="admin-mobile-player-search" onSubmit={(event) => searchAdminPlayer(event, true)}>
                      <label htmlFor="admin-mobile-player-search-input">Быстрый поиск игрока</label>
                      <div><input id="admin-mobile-player-search-input" className="admin-input" value={adminGameId} onChange={(event) => setAdminGameId(event.target.value)} placeholder="@username в Telegram" autoComplete="off" /><button className="main-button" type="submit" disabled={adminSearchLoading}>{adminSearchLoading ? "Ищем…" : "Найти"}</button></div>
                    </form>
                    {adminMessage && <div className={`admin-feedback ${adminMessageError ? "error" : "success"}`} role="status">{adminMessage}</div>}
                    <div className="admin-mobile-quick-grid">
                      <button type="button" onClick={() => setAdminSection("players")}><b>⌕</b><span><strong>Найти игрока</strong><small>Профиль и баланс</small></span></button>
                      <button type="button" onClick={() => { setAdminGrantType("coins"); setAdminSection("players"); }}><b>🪙</b><span><strong>Выдать GG</strong><small>Пополнить баланс</small></span></button>
                      <button type="button" onClick={() => { setAdminGrantType("cases"); setAdminSection("players"); }}><b>🎁</b><span><strong>Выдать кейсы</strong><small>Бесплатные открытия</small></span></button>
                      <button type="button" onClick={() => { setAdminGrantType("brainrot"); setAdminSection("players"); }}><b>🧠</b><span><strong>Выдать брейнрот</strong><small>Предмет в инвентарь</small></span></button>
                      <button type="button" onClick={() => { setAdminGrantType("xp"); setAdminSection("players"); }}><b>✦</b><span><strong>Начислить XP</strong><small>Опыт профиля</small></span></button>
                      <button type="button" onClick={() => setAdminSection("tools")}><b>🎒</b><span><strong>Инвентарь</strong><small>Поиск и экспорт</small></span></button>
                      <button type="button" onClick={() => { setAdminSection("history"); loadAdminLogs(); }}><b>◷</b><span><strong>Журнал</strong><small>История операций</small></span></button>
                      <button type="button" onClick={() => { setAdminSection("deposits"); loadAdminDepositData(); }}><b>🔁</b><span><strong>Очередь</strong><small>Заявки пополнений</small></span></button>
                      <button type="button" onClick={() => { setAdminSection("deposits"); loadAdminDepositData(); }}><b>💎</b><span><strong>Цены предметов</strong><small>Каталог и стоимость</small></span></button>
                      <button type="button" onClick={() => { setAdminSection("events"); loadGlobalState().catch(() => {}); if (isOwner) loadAdminEventHistory().catch(() => {}); }}><b>🌍</b><span><strong>Глобальные ивенты</strong><small>Мониторинг и управление</small></span></button>
                      {isOwner && <button type="button" onClick={() => { setAdminSection("events"); loadGlobalState().catch(() => {}); loadAdminEventHistory().catch(() => {}); }}><b>📣</b><span><strong>Сообщение всем</strong><small>Объявление игрокам</small></span></button>}
                      {isOwner && <button type="button" onClick={() => { setAdminSection("promocodes"); loadAdminPromoCodes(); }}><b>🎟️</b><span><strong>Промокоды</strong><small>Создать и отключить</small></span></button>}
                      <button type="button" onClick={() => { setAdminSection("tools"); }}><b>⌘</b><span><strong>Инструменты админки</strong><small>Копирование, фильтры и CSV</small></span></button>
                      <button type="button" onClick={exportAdminLogsCsv} disabled={!filteredAdminLogs.length}><b>⇩</b><span><strong>Экспорт журнала</strong><small>Скачать CSV</small></span></button>
                      <button type="button" onClick={refreshAdminTools} disabled={adminToolsRefreshing}><b>↻</b><span><strong>Обновить всё</strong><small>{adminToolsRefreshing ? "Обновляем..." : "Журнал, очередь, события"}</small></span></button>
                      <button type="button" onClick={copyAdminControlSnapshot}><b>⧉</b><span><strong>Сводка админки</strong><small>Скопировать статус и цифры</small></span></button>
                    </div>
                    <div className="admin-mobile-control-footer"><span>Последнее обновление: {adminLastRefreshAt ? new Date(adminLastRefreshAt).toLocaleTimeString("ru-RU") : "ещё не выполнялось"}</span><span className="admin-desktop-shortcuts">ПК: Alt+Shift+1-5 — переход между разделами</span><button type="button" onClick={copyAdminDiagnostics}>Диагностика устройства</button></div>
                  </section>

                  <section className="admin-panel-card"><div className="admin-section-title"><span className="admin-section-icon">🧠</span><div><h3>BrainGG v16 · Red & White</h3><p>Состояние новых игровых модулей.</p></div><button className="admin-refresh-button" type="button" onClick={loadAdminGameStats}>↻</button></div><div className="admin-metrics-grid"><article className="admin-metric-card"><small>ВСЕ ИГРОКИ</small><strong>{adminGameStats?.players ?? "—"}</strong></article><article className="admin-metric-card"><small>ПРЕДМЕТОВ В ИНВЕНТАРЯХ</small><strong>{adminGameStats?.inventory_items ?? "—"}</strong></article><article className="admin-metric-card"><small>ПРОФИЛЕЙ С XP</small><strong>{adminGameStats?.active_profiles ?? "—"}</strong></article></div><p className="admin-data-note">Показатели доступны после применения SQL-миграций из папки supabase/migrations и migrations_arctic_season2.sql.</p></section>
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
                    <p>Введи Telegram username игрока, например @username.</p>
                  </div>
                </div>

                <form className="admin-search-row" onSubmit={searchAdminPlayer}>
                  <input
                    className="admin-input"
                    value={adminGameId}
                    onChange={(event) => setAdminGameId(event.target.value)}
                    placeholder="@username в Telegram"
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
                        <b>✦ {adminPlayer.progress?.xp ?? 0} XP</b>
                      </div>
                    </div>
                    <div className="admin-mobile-player-actions">
                      <button type="button" onClick={() => copyAdminText(adminPlayer.game_id, "Game ID")}>⧉ Скопировать ID</button>
                      <button type="button" onClick={copyAdminPlayerSummary}>▤ Профиль</button>
                      <button type="button" onClick={() => searchAdminPlayer()} disabled={adminSearchLoading}>↻ Обновить</button>
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
                          <option value="xp">✦ Опыт профиля (XP)</option>
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
                      <>
                        <div className="admin-mobile-inventory-manager">
                          <div className="admin-tools-filters">
                            <input className="admin-input" value={adminInventoryQuery} onChange={(event) => setAdminInventoryQuery(event.target.value)} placeholder="Найти предмет или мутацию" aria-label="Поиск в инвентаре игрока" />
                            <select className="admin-input" value={adminInventoryRarity} onChange={(event) => setAdminInventoryRarity(event.target.value)} aria-label="Фильтр редкости">
                              <option value="all">Все редкости</option>
                              {adminInventoryRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                            </select>
                            <select className="admin-input" value={adminInventorySort} onChange={(event) => setAdminInventorySort(event.target.value)} aria-label="Сортировка инвентаря">
                              <option value="value_desc">Сначала дорогие</option><option value="value_asc">Сначала дешёвые</option><option value="newest">Сначала новые</option><option value="name">По названию</option>
                            </select>
                          </div>
                          <div className="admin-tools-summary-row"><span>{filteredAdminInventory.length} из {adminInventory.length} предметов</span><strong>{adminInventoryFilteredValue.toLocaleString("ru-RU")} GG</strong></div>
                          {filteredAdminInventory.length ? <div className="admin-inventory-list admin-tools-inventory-list">
                            {filteredAdminInventory.map((item) => <div className="admin-inventory-row" key={item.id}>
                              <img className="admin-inventory-thumb" src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" />
                              <b>{item.item_name}{item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">STRAWBERRY ×2.5</span> : null}</b>
                              <small>{item.rarity || "—"}</small><strong>{Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</strong>
                            </div>)}
                          </div> : <p className="admin-muted">По этим фильтрам предметов не найдено.</p>}
                          <div className="admin-tool-actions-grid admin-tool-actions-compact">
                            <button type="button" onClick={exportAdminInventoryCsv} disabled={!filteredAdminInventory.length}>⇩ Скачать CSV</button>
                            <button type="button" onClick={copyAdminInventoryText} disabled={!filteredAdminInventory.length}>⧉ Скопировать</button>
                          </div>
                        </div>
                        <div className="admin-inventory-list admin-desktop-inventory-list">
                          {adminInventory.map((item) => (
                            <div className="admin-inventory-row" key={item.id}>
                              <img className="admin-inventory-thumb" src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" />
                              <b>{item.item_name}{item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">STRAWBERRY ×2.5</span> : null}</b>
                              <small>{item.rarity}</small>
                              <strong>{item.value_gg} GG</strong>
                            </div>
                          ))}
                        </div>
                      </>
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
                        <div className="admin-event-message-templates admin-event-message-templates-inline">
                          <div className="admin-event-tool-heading"><b>{'\u0428\u0430\u0431\u043b\u043e\u043d\u044b \u0430\u043d\u043e\u043d\u0441\u043e\u0432'}</b><small>{'\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u044c \u0442\u0435\u043a\u0441\u0442 \u043e \u0438\u0432\u0435\u043d\u0442\u0435; \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e \u043d\u0430\u0436\u0430\u0442\u0438\u044e.'}</small></div>
                          <div className="admin-event-mobile-actions"><button type="button" onClick={() => prepareAdminEventMessage(globalEvent?.event_name || 'lucky', 'started')}>{'📣 \u0421\u0442\u0430\u0440\u0442'}</button><button type="button" onClick={() => prepareAdminEventMessage(globalEvent?.event_name || 'lucky', 'ending')}>{'⏳ \u0421\u043a\u043e\u0440\u043e \u0444\u0438\u043d\u0438\u0448'}</button><button type="button" onClick={() => prepareAdminEventMessage(globalEvent?.event_name || 'lucky', 'ended')}>{'🏁 \u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d'}</button></div>
                        </div>
                      </section>

                      <section className="admin-panel-card admin-event-mobile-tools">
                        <div className="admin-section-title">
                          <span className="admin-section-icon">🧭</span>
                          <div><h3>{'\u041f\u0443\u043b\u044c\u0442 \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0438\u0432\u0435\u043d\u0442\u0430\u043c\u0438'}</h3><p>{'\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438, \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 \u0438 \u0431\u044b\u0441\u0442\u0440\u044b\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u043d\u0430 \u041f\u041a \u0438 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0435.'}</p></div>
                          <button className="admin-refresh-button" type="button" onClick={refreshAdminEvents} disabled={adminEventRefreshing || adminEventLoading}>{adminEventRefreshing ? '...' : '↻'}</button>
                        </div>

                        <div className="admin-event-mobile-status">
                          {globalEvent?.event_name ? (
                            <>
                              <div className="admin-event-mobile-status-head"><span className="admin-event-live-dot" /><div><small>{'\u0413\u041b\u041e\u0411\u0410\u041b\u042c\u041d\u042b\u0419 \u0418\u0412\u0415\u041d\u0422 \u0410\u041a\u0422\u0418\u0412\u0415\u041d'}</small><b>{eventPresentation[globalEvent.event_name]?.title || globalEvent.event_name}</b></div><strong>{eventRemainingLabel}</strong></div>
                              <div className="admin-event-progress-track"><span style={{ width: `${adminEventProgressPercent}%` }} /></div>
                              <div className="admin-event-mobile-status-meta"><span>{'\u0421\u0442\u0430\u0440\u0442: '}{globalEvent.event_started_at ? new Date(globalEvent.event_started_at).toLocaleTimeString('ru-RU') : '—'}</span><span>{'\u0424\u0438\u043d\u0438\u0448: '}{globalEvent.event_ends_at ? new Date(globalEvent.event_ends_at).toLocaleTimeString('ru-RU') : '—'}</span></div>
                              <div className="admin-event-mobile-actions admin-event-status-actions">
                                <button type="button" onClick={copyAdminEventStatus}>{'⧉ \u0421\u0442\u0430\u0442\u0443\u0441'}</button>
                                <button type="button" disabled={adminEventLoading} onClick={() => toggleAdminEvent(globalEvent.event_name, { forceRestart: true })}>{'↻ \u041f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c'}</button>
                                <button type="button" disabled={adminEventLoading} onClick={() => toggleAdminEvent(null)}>{'■ \u0421\u0442\u043e\u043f'}</button>
                              </div>
                            </>
                          ) : <div className="admin-event-no-active"><span>🌐</span><div><b>{'\u041d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0433\u043e \u0438\u0432\u0435\u043d\u0442\u0430'}</b><small>{'\u0412\u044b\u0431\u0435\u0440\u0438 \u043e\u0434\u0438\u043d \u0438\u0437 9 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043d\u0438\u0436\u0435, \u0447\u0442\u043e\u0431\u044b \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0435\u0433\u043e \u0434\u043b\u044f \u0432\u0441\u0435\u0445.'}</small></div></div>}
                        </div>

                        <div className="admin-event-duration-box">
                          <div className="admin-event-tool-heading"><b>{'\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u043d\u043e\u0432\u043e\u0433\u043e \u0437\u0430\u043f\u0443\u0441\u043a\u0430'}</b><strong>{formatAdminEventDuration(adminEventDurationValue)}</strong></div>
                          <div className="admin-event-duration-presets">
                            {[[60, '1:00'], [179, '2:59'], [300, '5:00'], [600, '10:00'], [900, '15:00'], [1800, '30:00']].map(([seconds, label]) => <button key={seconds} type="button" className={Number(adminEventDuration) === seconds ? 'active' : ''} onClick={() => setAdminEventDuration(String(seconds))}>{label}</button>)}
                          </div>
                          <label className="admin-event-custom-duration"><span>{'\u0421\u0432\u043e\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a.'}</span><input className="admin-input" type="number" min="30" max="1800" step="1" value={adminEventDuration} onChange={(event) => setAdminEventDuration(event.target.value)} /><small>{'\u041e\u0442 30 \u0441\u0435\u043a\u0443\u043d\u0434 \u0434\u043e 30 \u043c\u0438\u043d\u0443\u0442. \u0422\u0430\u0439\u043c\u0435\u0440 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435.'}</small></label>
                        </div>

                        <div className="admin-abuse-tabs" role="tablist" aria-label="Вкладки Admin Abuse">
                          {[
                            ["all", "Все события", "✦"],
                            ["gameplay", "Игровые", "🎮"],
                            ["economy", "Экономика", "💰"],
                            ["visual", "Визуал", "✨"],
                            ["seasonal", "Сезонные", "🎉"],
                            ["chaos", "Хаос", "💥"],
                            ["favorites", "Избранное", "★"],
                          ].map(([key, label, icon]) => (
                            <button key={key} type="button" role="tab" aria-selected={adminAbuseTab === key} className={adminAbuseTab === key ? "active" : ""} onClick={() => { setAdminAbuseTab(key); setAdminEventCategory("all"); setAdminEventFavoritesOnly(false); }}>
                              <span>{icon}</span>{label}{key === "all" ? ` (${adminEventCatalog.length})` : key === "favorites" ? ` (${adminEventFavorites.length})` : ` (${adminEventCatalog.filter((event) => event.category === key).length})`}
                            </button>
                          ))}
                        </div>
                        <div className="admin-event-catalog-filters">
                          <input className="admin-input" value={adminEventQuery} onChange={(event) => setAdminEventQuery(event.target.value)} placeholder={'\u041f\u043e\u0438\u0441\u043a \u0438\u0432\u0435\u043d\u0442\u0430 \u0438\u043b\u0438 \u0431\u043e\u043d\u0443\u0441\u0430'} aria-label="Search events" />
                          <select className="admin-input" value={adminEventCategory} onChange={(event) => setAdminEventCategory(event.target.value)} aria-label="Event category"><option value="all">{'\u0412\u0441\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438'}</option><option value="gameplay">{'\u0418\u0433\u0440\u043e\u0432\u044b\u0435 \u0431\u043e\u043d\u0443\u0441\u044b'}</option><option value="economy">{'\u042d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430'}</option><option value="visual">{'\u041e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0435'}</option><option value="seasonal">Сезонные</option><option value="chaos">Хаос / Admin Abuse</option></select>
                          <select className="admin-input" value={adminEventSort} onChange={(event) => setAdminEventSort(event.target.value)} aria-label="Sort events"><option value="default">{'\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u044b\u0439 \u043f\u043e\u0440\u044f\u0434\u043e\u043a'}</option><option value="name">{'\u041f\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044e'}</option><option value="category">{'\u041f\u043e \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438'}</option></select>
                          <button type="button" className={`admin-event-favorite-filter ${adminEventFavoritesOnly ? 'active' : ''}`} onClick={() => setAdminEventFavoritesOnly((value) => !value)}>{adminEventFavoritesOnly ? '★ ' : '☆ '}{'\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435'} ({adminEventFavorites.length})</button>
                          <button type="button" className="admin-event-reset-filter" onClick={() => { setAdminEventQuery(''); setAdminEventCategory('all'); setAdminEventSort('default'); setAdminEventFavoritesOnly(false); }}>{'\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b'}</button>
                        </div>
                        <div className="admin-event-filter-count">{'\u041d\u0430\u0439\u0434\u0435\u043d\u043e'}: <b>{filteredAdminEventCatalog.length}</b> / {adminEventCatalog.length}</div>

                        <div className="admin-event-compare">
                          <div className="admin-event-tool-heading"><b>{'\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u0438\u0432\u0435\u043d\u0442\u043e\u0432'}</b><small>{'\u0412\u044b\u0431\u0435\u0440\u0438 \u0434\u0432\u0430 \u0438 \u0441\u0440\u0430\u0432\u043d\u0438 \u0438\u0445 \u044d\u0444\u0444\u0435\u043a\u0442\u044b.'}</small></div>
                          <div className="admin-event-compare-selects"><select className="admin-input" value={adminEventCompareA} onChange={(event) => setAdminEventCompareA(event.target.value)}>{adminEventCatalog.map((event) => <option key={event.key} value={event.key}>{event.title}</option>)}</select><select className="admin-input" value={adminEventCompareB} onChange={(event) => setAdminEventCompareB(event.target.value)}>{adminEventCatalog.map((event) => <option key={event.key} value={event.key}>{event.title}</option>)}</select></div>
                          <div className="admin-event-compare-cards">{[adminEventCompareLeft, adminEventCompareRight].filter(Boolean).map((event) => <article key={event.key}><span>{event.icon}</span><b>{event.title}</b><small>{event.category === 'visual' ? '\u0412\u0438\u0437\u0443\u0430\u043b' : event.category === 'economy' ? '\u042d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430' : '\u0418\u0433\u0440\u043e\u0432\u043e\u0439 \u0431\u043e\u043d\u0443\u0441'}</small><p>{event.description}</p></article>)}</div>
                        </div>

                      </section>

                      <section className="admin-panel-card admin-events-card">
                        <div className="admin-section-title"><span className="admin-section-icon">🌍</span><div><h3>Глобальные админ-ивенты</h3><p>Один активный ивент на весь BrainGG; каталог расширен до 49+ событий. <span className="admin-event-desktop-duration-copy">Каждый запуск длится 2 минуты 59 секунд.</span><span className="admin-event-mobile-duration-copy">Длительность настраивается в пульте управления.</span></p></div></div>
                        {globalEvent?.event_name && <div className="admin-active-event"><b>Сейчас активен: {eventPresentation[globalEvent.event_name]?.title || globalEvent.event_name}</b><span>Осталось {Math.floor(eventRemainingSeconds / 60)}:{String(eventRemainingSeconds % 60).padStart(2, "0")}</span></div>}
                        <div className="admin-event-grid">
                          {filteredAdminEventCatalog.map(({ key, icon, title, description }) => (
                            <article className={`admin-event-card admin-event-${key} ${globalEvent?.event_name === key ? "is-active" : ""}`} key={key}>
                              <div className="admin-event-icon">{icon}</div><h4>{title}</h4><p>{description}</p>
                              <button type="button" className="main-button" disabled={adminEventLoading} onClick={() => toggleAdminEvent(key)}>{adminEventLoading ? "Подождите..." : globalEvent?.event_name === key ? "Остановить ивент" : "Запустить на " + formatAdminEventDuration(adminEventDurationValue)}</button>
                              <div className="admin-event-mobile-actions">
                                <button type="button" onClick={() => setAdminEventPreview(key)}>{'▶ Превью'}</button>
                                <button type="button" onClick={() => toggleAdminEventFavorite(key)}>{adminEventFavorites.includes(key) ? '★ ' : '☆ '}{'В избранное'}</button>
                                <button type="button" onClick={() => copyAdminEventDetails(key)}>{'⧉ Копировать'}</button>
                              </div>
                            </article>
                          ))}
                        </div>
                        {!filteredAdminEventCatalog.length && <p className="admin-muted admin-event-empty">{'Нет ивентов по выбранным фильтрам. Сбрось фильтры или добавь событие в избранное.'}</p>}
                        {adminEventPreviewDetails && <section className={`admin-event-preview admin-event-preview-${adminEventPreviewDetails.key}`}>
                          <div className="admin-event-preview-head"><span>{adminEventPreviewDetails.icon}</span><div><small>{'ЛОКАЛЬНЫЙ ПРЕДПРОСМОТР'}</small><b>{adminEventPreviewDetails.title}</b></div><button type="button" onClick={() => setAdminEventPreview("")}>×</button></div>
                          <p>{adminEventPreviewDetails.description}</p>
                          <div className="admin-event-mobile-actions"><button type="button" onClick={() => copyAdminEventDetails(adminEventPreviewDetails.key)}>{'⧉ Копировать параметры'}</button><button type="button" disabled={adminEventLoading} onClick={() => toggleAdminEvent(adminEventPreviewDetails.key)}>{'▶ Запустить этот ивент'}</button></div>
                        </section>}
                        {globalEvent?.event_name && <button type="button" className="admin-event-stop-button" disabled={adminEventLoading} onClick={() => toggleAdminEvent(null)}>■ Остановить текущий ивент</button>}
                        <p className="admin-data-note">Доступ к запуску и остановке проверяется на сервере по Telegram ID владельца. Другие администраторы не могут запускать ивенты или отправлять глобальные сообщения.</p>
                      </section>
                      <section className="admin-panel-card admin-event-history-mobile">
                        <div className="admin-section-title"><span className="admin-section-icon">📈</span><div><h3>{'Аналитика и история'}</h3><p>{'До 200 последних серверных записей о стартах и завершениях.'}</p></div><button className="admin-refresh-button" type="button" onClick={loadAdminEventHistory} disabled={adminEventHistoryLoading}>{adminEventHistoryLoading ? '...' : '↻'}</button></div>
                        <div className="admin-event-analytics-grid">
                          <article><small>{'ЗАПУСКИ'}</small><b>{adminEventHistoryStarts}</b></article>
                          <article><small>{'ЗАВЕРШЕНИЯ'}</small><b>{adminEventHistoryEnds}</b></article>
                          <article><small>{'В ВЫБРАННОМ ПЕРИОДЕ'}</small><b>{filteredAdminEventHistory.length}</b></article>
                          <article><small>{'ЧАЩЕ ЗАПУСКАЛИ'}</small><b>{adminEventTopLaunch?.launches ? adminEventTopLaunch.title : '—'}</b></article>
                        </div>
                        <div className="admin-event-history-filters">
                          <input className="admin-input" value={adminEventHistoryQuery} onChange={(event) => setAdminEventHistoryQuery(event.target.value)} placeholder={'Поиск по истории'} aria-label="Search event history" />
                          <select className="admin-input" value={adminEventHistoryType} onChange={(event) => setAdminEventHistoryType(event.target.value)}><option value="all">{'Все записи'}</option><option value="started">{'Только старты'}</option><option value="ended">{'Только завершения'}</option></select>
                          <select className="admin-input" value={adminEventHistoryPeriod} onChange={(event) => setAdminEventHistoryPeriod(event.target.value)}><option value="24h">{'За 24 часа'}</option><option value="7d">{'За 7 дней'}</option><option value="30d">{'За 30 дней'}</option><option value="all">{'За всё время из загруженных'}</option></select>
                          <select className="admin-input" value={adminEventHistorySort} onChange={(event) => setAdminEventHistorySort(event.target.value)}><option value="newest">{'Сначала новые'}</option><option value="oldest">{'Сначала старые'}</option></select>
                        </div>
                        <div className="admin-event-mobile-actions"><button type="button" onClick={exportAdminEventHistoryCsv} disabled={!filteredAdminEventHistory.length}>{'⇩ CSV'}</button><button type="button" onClick={copyAdminLatestEventHistory} disabled={!filteredAdminEventHistory.length}>{'⧉ Крайняя запись'}</button><button type="button" onClick={() => { setAdminEventHistoryQuery(''); setAdminEventHistoryType('all'); setAdminEventHistoryPeriod('7d'); setAdminEventHistorySort('newest'); }}>{'Сбросить'}</button></div>
                        {adminEventHistoryLoading && !adminEventHistory.length ? <p className="admin-muted">{'Загружаем историю...'}</p> : filteredAdminEventHistory.length ? <div className="admin-event-history-list">{filteredAdminEventHistory.map((entry) => <article key={entry.id}><span className={entry.event_type === 'event_started' ? 'started' : 'ended'}>{entry.event_type === 'event_started' ? '▶' : '■'}</span><div><b>{entry.title || 'BrainGG event'}</b><p>{entry.description || ''}</p><small>{entry.created_at ? new Date(entry.created_at).toLocaleString('ru-RU') : '—'}</small></div><button type="button" onClick={() => copyAdminText([entry.title, entry.description, entry.created_at].filter(Boolean).join('\n'), 'Event log')}>⧉</button></article>)}</div> : <p className="admin-muted">{'Записей по этим фильтрам нет.'}</p>}
                        <p className="admin-data-note">{'Аналитика считает только загруженные сервером записи. Это не полная история за всё время, если записей больше 200.'}</p>
                      </section>
                    </>
                  ) : (
                    <>
                      <section className="admin-panel-card admin-events-readonly-mobile">
                        <div className="admin-section-title"><span className="admin-section-icon">🌍</span><div><h3>Монитор глобальных ивентов</h3><p>Просмотр состояния и каталога событий без права запускать их.</p></div><button className="admin-refresh-button" type="button" onClick={() => loadGlobalState().catch(() => {})}>↻</button></div>
                        <div className="admin-event-readonly-status">
                          <small>ТЕКУЩЕЕ СОСТОЯНИЕ</small>
                          <b>{globalEvent?.event_name ? (eventPresentation[globalEvent.event_name]?.title || globalEvent.event_name) : "Нет активного события"}</b>
                          {globalEvent?.event_name && <span>Осталось {eventRemainingLabel}</span>}
                        </div>
                        <div className="admin-event-catalog-filters">
                          <input className="admin-input" value={adminEventQuery} onChange={(event) => setAdminEventQuery(event.target.value)} placeholder="Поиск события или эффекта" aria-label="Поиск ивентов" />
                          <select className="admin-input" value={adminEventCategory} onChange={(event) => setAdminEventCategory(event.target.value)} aria-label="Категория ивента"><option value="all">Все категории</option><option value="gameplay">Игровые бонусы</option><option value="economy">Экономика</option><option value="visual">Оформление</option><option value="seasonal">Сезонные</option><option value="chaos">Хаос / Admin Abuse</option></select>
                        </div>
                        <div className="admin-events-readonly-list">
                          {filteredAdminEventCatalog.map((event) => <article key={event.key}><span>{event.icon}</span><div><b>{event.title}</b><small>{event.description}</small></div><button type="button" onClick={() => copyAdminEventDetails(event.key)}>⧉</button></article>)}
                        </div>
                        <div className="admin-event-readonly-history">
                          <b>Последняя активность</b>
                          {globalActivities.filter((entry) => ["event_started", "event_ended"].includes(entry.event_type)).slice(0, 5).map((entry) => <div key={entry.id}><span>{entry.event_type === "event_started" ? "▶" : "■"}</span><div><strong>{entry.title || "Глобальный ивент"}</strong><small>{entry.created_at ? new Date(entry.created_at).toLocaleString("ru-RU") : "—"}</small></div></div>)}
                          {!globalActivities.some((entry) => ["event_started", "event_ended"].includes(entry.event_type)) && <p className="admin-muted">Пока нет записей о запуске и завершении событий.</p>}
                        </div>
                        <p className="admin-data-note">Запуск, остановка и глобальные объявления остаются доступны только подтверждённому владельцу. Это ограничение проверяется сервером.</p>
                      </section>
                      <section className="admin-panel-card admin-events-readonly-desktop"><h3>Управление событиями доступно только владельцу</h3><p className="admin-muted">Твоя учётная запись имеет доступ к обычной админ-панели, но не подтверждена как владелец BrainGG.</p></section>
                    </>
                  )}
                  {adminMessage && <div className={`admin-feedback ${adminMessageError ? "error" : "success"}`}>{adminMessage}</div>}
                  {adminEventFeedback && <div className={`admin-feedback ${adminEventFeedbackError ? "error" : "success"}`}>{adminEventFeedback}</div>}
                </>
              )}

              {adminSection === "deposits" && (
                <>
                  <section className="admin-panel-card deposit-admin-queue-card">
                    <div className="admin-section-title">
                      <span className="admin-section-icon">🔁</span>
                      <div><h3>Очередь пополнений брейнротами</h3><p>Проверяй трейд вручную. GG начисляются только после финального подтверждения.</p></div>
                      <button className="admin-refresh-button" type="button" onClick={loadAdminDepositData} disabled={adminDepositLoading}>{adminDepositLoading ? "..." : "↻ Обновить"}</button>
                    </div>
                    <div className="deposit-admin-actions"><button className="main-button" type="button" disabled={adminDepositBusy || adminDepositLoading} onClick={assignNextBrainrotDeposit}>{adminDepositBusy ? "Обрабатываем..." : "Вызвать следующего из очереди"}</button><span>Аккаунты распределяются по кругу: BrainGG_Storage1–5.</span></div>
                    <div className="admin-mobile-deposit-filters">
                      <input className="admin-input" value={adminDepositQuery} onChange={(event) => setAdminDepositQuery(event.target.value)} placeholder="Поиск по игроку, предмету, номеру" aria-label="Поиск в очереди пополнений" />
                      <select className="admin-input" value={adminDepositStatus} onChange={(event) => setAdminDepositStatus(event.target.value)} aria-label="Фильтр статуса пополнения">
                        <option value="all">Все этапы · {adminDepositQueueCounts.all}</option><option value="queued">В очереди · {adminDepositQueueCounts.queued}</option><option value="waiting_trade">Ожидает трейд · {adminDepositQueueCounts.waiting_trade}</option><option value="trade_received">Трейд получен · {adminDepositQueueCounts.trade_received}</option>
                      </select>
                      <button type="button" className="admin-mobile-export-button" onClick={exportAdminDepositsCsv} disabled={!filteredAdminDepositRequests.length}>⇩ Скачать CSV</button>
                    </div>
                    {adminDepositFeedback && <div className="admin-feedback success" role="status">{adminDepositFeedback}</div>}
                    {adminDepositLoading ? <p className="admin-muted">Загружаем очередь...</p> : adminDepositRequests.length === 0 ? <p className="admin-muted">Активных заявок пока нет.</p> : filteredAdminDepositRequests.length === 0 ? <p className="admin-muted">По выбранным фильтрам заявок нет.</p> : <div className="deposit-admin-request-list">
                      {filteredAdminDepositRequests.map((request) => <article className="deposit-admin-request" key={request.id}>
                        <div className="deposit-admin-request-head"><b>{depositBrainrotName(request, request.brainrot_name)}</b><span className={`deposit-admin-status status-${request.status}`}>{depositStatusLabels[request.status] || request.status}</span></div>
                        <div className="deposit-admin-request-meta"><span>Игрок: @{request.roblox_username}</span><span>Telegram ID: {request.telegram_id}</span><span>Заявка #{request.queue_number}</span></div>
                        <div className="deposit-admin-request-meta"><span>Мутация: {request.mutation_key}</span><span>Traits: {(request.trait_labels || request.trait_keys || []).join(", ") || "нет"}</span><span>База: {Number(request.base_value_gg || 0).toLocaleString("ru-RU")} GG</span></div>
                        <div className="deposit-admin-request-total">К начислению: <b>{Number(request.amount_gg || 0).toLocaleString("ru-RU")} GG</b>{request.assigned_storage_account && <span> · Аккаунт: @{request.assigned_storage_account}</span>}</div>
                        {request.status === "waiting_trade" && <div className="deposit-admin-trait-check"><b>Отметь traits, которые реально видны на предмете в Roblox-трейде</b><div className="deposit-traits-grid">{adminDepositTraits.map((trait) => <label key={trait.trait_key} className={`deposit-trait-option ${(adminDepositTraitDrafts[request.id] || []).includes(trait.trait_key) ? "active" : ""} ${!trait.enabled || !trait.multiplier ? "disabled" : ""}`} title={trait.effect_note || trait.label}><input type="checkbox" checked={(adminDepositTraitDrafts[request.id] || []).includes(trait.trait_key)} disabled={!trait.enabled || !trait.multiplier} onChange={(event) => setAdminDepositTraitDrafts((current) => ({ ...current, [request.id]: event.target.checked ? [...new Set([...(current[request.id] || []), trait.trait_key])] : (current[request.id] || []).filter((key) => key !== trait.trait_key) }))} /><span>{trait.label}</span><b>{trait.display_value}</b></label>)}</div><small>Сумма будет пересчитана сервером при подтверждении предмета. Не отмечай traits, которых нет на предмете.</small></div>}
                        {request.status === "trade_received" && <div className="deposit-admin-verified-traits"><b>Проверенные traits:</b> {(request.trait_labels || []).join(", ") || "нет"}</div>}
                        <div className="deposit-admin-request-actions">
                          {request.status === "waiting_trade" && <button type="button" className="case-button" disabled={adminDepositBusy} onClick={() => markBrainrotDepositReceived(request.id)}>Подтвердить предмет и traits</button>}
                          {request.status === "trade_received" && <button type="button" className="main-button" disabled={adminDepositBusy} onClick={() => completeBrainrotDeposit(request.id)}>Трейд завершён · начислить GG</button>}
                          {request.status !== "completed" && request.status !== "rejected" && <button type="button" className="deposit-reject-button" disabled={adminDepositBusy} onClick={() => rejectBrainrotDeposit(request.id)}>Отклонить</button>}
                          <button type="button" className="admin-mobile-copy-action" onClick={() => copyAdminText([`Заявка #${request.queue_number}`, `Игрок: @${request.roblox_username}`, `Предмет: ${depositBrainrotName(request, request.brainrot_name)}`, `Статус: ${request.status}`, `К начислению: ${request.amount_gg} GG`, `Аккаунт: ${request.assigned_storage_account || "не назначен"}`].join("\n"), "Заявка пополнения")}>⧉ Копировать</button>
                        </div>
                      </article>)}
                    </div>}
                    <p className="admin-data-note">Важно: Roblox не предоставляет этому боту подтверждение Ready/Accept. Проверь трейд вручную: сначала отметь реальные traits и предмет, затем после полного завершения обмена нажми «Трейд завершён · начислить GG». Повторное нажатие не начислит монеты дважды.</p>
                  </section>

                  <section className="admin-panel-card deposit-admin-prices-card">
                    <div className="admin-section-title"><span className="admin-section-icon">🪙</span><div><h3>Базовые цены брейнротов</h3><p>Задай цену каждого предмета в GG. Мутации и выбранные traits будут применяться автоматически.</p></div></div>
                    <div className="deposit-admin-price-grid">
                      {adminDepositCatalog.map((item) => <div className="deposit-admin-price-row" key={item.item_key}>
                        <img src={depositBrainrotImage(item)} onError={handleBrainrotImageError} alt={depositBrainrotName(item)} />
                        <div><b>{depositBrainrotName(item)}</b><small>{item.item_key}</small></div>
                        <input className="admin-input" type="number" min="0" step="0.01" value={adminDepositPriceDrafts[item.item_key] ?? item.base_value_gg ?? 0} onChange={(event) => setAdminDepositPriceDrafts((current) => ({ ...current, [item.item_key]: event.target.value }))} aria-label={`Базовая цена ${depositBrainrotName(item)}`} />
                        <button type="button" className="case-button" disabled={adminDepositBusy} onClick={() => saveAdminDepositPrice(item.item_key)}>Сохранить</button>
                      </div>)}
                    </div>
                    <p className="admin-data-note">Пока цена равна 0 GG, игрок не сможет создать заявку на этот предмет. Установи реальные базовые цены перед открытием пополнений.</p>
                  </section>
                </>
              )}

              {adminSection === "promocodes" && isOwner && (
                <>
                  <section className="admin-panel-card promo-admin-card">
                    <div className="admin-section-title">
                      <span className="admin-section-icon">🎟️</span>
                      <div>
                        <h3>Создать промокод</h3>
                        <p>Создание доступно только владельцу. Каждый игрок сможет активировать один код один раз.</p>
                      </div>
                    </div>
                    <form className="promo-admin-form" onSubmit={createAdminPromoCode}>
                      <label className="admin-field">
                        <span>Код промокода</span>
                        <input className="admin-input promo-admin-code-input" value={adminPromoCode} maxLength={24} autoComplete="off" spellCheck={false} onChange={(event) => setAdminPromoCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="Например, BRAIN2026" />
                      </label>
                      <label className="admin-field">
                        <span>Тип награды</span>
                        <select className="admin-input" value={adminPromoRewardType} onChange={(event) => {
                            setAdminPromoRewardType(event.target.value);
                            if (event.target.value === "brainrot") setAdminPromoRewardAmount("1");
                          }}>
                          <option value="coins">🪙 Монеты GG</option>
                          <option value="cases">🎁 Бесплатные кейсы</option>
                          <option value="brainrot">🧠 Брейнрот в инвентарь</option>
                        </select>
                      </label>
                      {adminPromoRewardType === "cases" && (
                        <label className="admin-field promo-admin-full">
                          <span>Какой кейс выдать?</span>
                          <select className="admin-input" value={adminPromoCaseName} onChange={(event) => setAdminPromoCaseName(event.target.value)}>
                            {cases.map((item) => <option key={item.id} value={item.caseName}>{item.name}</option>)}
                          </select>
                        </label>
                      )}
                      {adminPromoRewardType === "brainrot" && (
                        <label className="admin-field promo-admin-full">
                          <span>Какого брейнрота выдать?</span>
                          <select className="admin-input" value={adminPromoItemName} onChange={(event) => setAdminPromoItemName(event.target.value)}>
                            <option value="">Выбери брейнрота...</option>
                            {upgradeTargets.map((item) => <option key={item.item_name} value={item.item_name}>{item.item_name} · {Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</option>)}
                          </select>
                        </label>
                      )}
                      <label className="admin-field">
                        <span>{adminPromoRewardType === "coins" ? "Количество GG" : adminPromoRewardType === "cases" ? "Количество кейсов" : "Количество брейнротов"}</span>
                        <input className="admin-input" type="number" min="1" max={adminPromoRewardType === "brainrot" ? "1" : "1000000"} step="1" value={adminPromoRewardAmount} onChange={(event) => setAdminPromoRewardAmount(event.target.value)} />
                      </label>
                      <label className="admin-field">
                        <span>Максимум активаций</span>
                        <input className="admin-input" type="number" min="1" max="1000000" step="1" value={adminPromoMaxUses} onChange={(event) => setAdminPromoMaxUses(event.target.value)} placeholder="Пусто — без лимита" />
                      </label>
                      <label className="admin-field promo-admin-full">
                        <span>Срок действия (необязательно)</span>
                        <input className="admin-input" type="datetime-local" value={adminPromoExpiresAt} onChange={(event) => setAdminPromoExpiresAt(event.target.value)} />
                      </label>
                      <button className="main-button promo-admin-submit promo-admin-full" type="submit" disabled={adminPromoBusy}>
                        {adminPromoBusy ? "Сохраняем..." : "🎟️ Создать промокод"}
                      </button>
                    </form>
                    {adminPromoFeedback && <div className={`admin-feedback ${adminPromoFeedbackError ? "error" : "success"}`}>{adminPromoFeedback}</div>}
                    <p className="admin-data-note">Промокоды создаются на сервере. Проверка владельца выполняется по Telegram ID; скрытие этой формы не является защитой само по себе.</p>
                  </section>

                  <section className="admin-panel-card promo-admin-list-card">
                    <div className="admin-section-title">
                      <span className="admin-section-icon">📋</span>
                      <div><h3>Созданные промокоды</h3><p>Лимиты, количество активаций и статус каждого кода.</p></div>
                      <button className="admin-refresh-button" type="button" onClick={loadAdminPromoCodes} disabled={adminPromoLoading}>{adminPromoLoading ? "..." : "↻ Обновить"}</button>
                    </div>
                    <div className="admin-mobile-promo-filters">
                      <input className="admin-input" value={adminPromoQuery} onChange={(event) => setAdminPromoQuery(event.target.value)} placeholder="Поиск кода или награды" aria-label="Поиск промокодов" />
                      <select className="admin-input" value={adminPromoStatus} onChange={(event) => setAdminPromoStatus(event.target.value)} aria-label="Фильтр статуса промокодов"><option value="all">Все статусы</option><option value="active">Активные</option><option value="inactive">Неактивные / истёкшие</option></select>
                      <button type="button" className="admin-mobile-export-button" onClick={exportAdminPromosCsv} disabled={!filteredAdminPromoCodes.length}>⇩ Скачать CSV</button>
                    </div>
                    {adminPromoLoading ? <p className="admin-muted">Загружаем промокоды...</p> : adminPromoCodes.length === 0 ? <p className="admin-muted">Пока нет созданных промокодов.</p> : filteredAdminPromoCodes.length === 0 ? <p className="admin-muted">По выбранным фильтрам промокодов нет.</p> : (
                      <div className="promo-admin-list">
                        {filteredAdminPromoCodes.map((promo) => {
                          const rewardLabel = promo.reward_type === "coins"
                            ? `${Number(promo.reward_amount).toLocaleString("ru-RU")} GG`
                            : promo.reward_type === "cases"
                              ? `${promo.reward_amount} × ${displayCaseName(promo.case_name)}`
                              : `${promo.item_name} ×${promo.reward_amount}`;
                          const expired = promo.expires_at && Date.parse(promo.expires_at) <= Date.now();
                          const exhausted = promo.max_uses != null && Number(promo.uses_count) >= Number(promo.max_uses);
                          const active = promo.active && !expired && !exhausted;
                          return (
                            <article className="promo-admin-row" key={promo.id}>
                              <div className="promo-admin-main">
                                <b>{promo.code}</b>
                                <span>{rewardLabel}</span>
                                <small>Использовано: {promo.uses_count} / {promo.max_uses == null ? "∞" : promo.max_uses}{promo.expires_at ? ` · до ${new Date(promo.expires_at).toLocaleString("ru-RU")}` : " · без срока"}</small>
                              </div>
                              <div className={`promo-admin-status ${active ? "active" : "inactive"}`}>{active ? "Активен" : expired ? "Истёк" : exhausted ? "Лимит исчерпан" : "Отключён"}</div>
                              <button type="button" className="admin-mobile-copy-action" onClick={() => copyAdminText(promo.code, "Промокод")}>⧉ Копировать</button>
                              {promo.active && <button type="button" className="promo-admin-disable" disabled={adminPromoBusy} onClick={() => deactivateAdminPromoCode(promo.id)}>Отключить</button>}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
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
                  <button type="button" className="admin-mobile-export-button" onClick={exportAdminLogsCsv} disabled={!filteredAdminLogs.length}>⇩ CSV</button>
                </div>

                <div className="admin-log-filters">
                  <input className="admin-input" value={adminLogQuery} onChange={(event) => setAdminLogQuery(event.target.value)} placeholder="Поиск по username, предмету или админу" />
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

              {adminSection === "tools" && (
                <div className="admin-tools-view">
                  <section className="admin-tools-hero">
                    <div className="admin-tools-hero-icon">⌘</div>
                    <div className="admin-tools-hero-copy">
                      <span>ADMIN COMMAND CENTER · BUILD 3.2</span>
                      <h3>Центр инструментов</h3>
                      <p>Быстрые действия, фильтры, история, инвентарь, экспорт и диагностика — на ПК и телефоне.</p>
                    </div>
                    <button type="button" onClick={refreshAdminTools} disabled={adminToolsRefreshing} aria-label="Обновить все данные">{adminToolsRefreshing ? "…" : "↻"}</button>
                  </section>

                  <section className="admin-panel-card admin-tools-card">
                    <div className="admin-section-title">
                      <span className="admin-section-icon">👤</span>
                      <div><h3>Карточка игрока</h3><p>{adminPlayer ? "Действия с найденным профилем." : "Сначала найди игрока, чтобы открыть инструменты профиля."}</p></div>
                    </div>
                    {adminPlayer ? (
                      <div className="admin-tools-player-card">
                        <div className="admin-tools-player-heading"><b>{adminPlayer.username ? `@${adminPlayer.username}` : "Игрок BrainGG"}</b><span>{Number(adminPlayer.balance || 0).toLocaleString("ru-RU")} GG</span></div>
                        <small>Game ID: {adminPlayer.game_id || "—"} · {adminInventory.length} предметов · {Number(adminPlayer.progress?.xp || 0).toLocaleString("ru-RU")} XP</small>
                        <div className="admin-tool-actions-grid">
                          <button type="button" onClick={() => copyAdminText(adminPlayer.game_id, "Game ID")}>⧉ Скопировать ID</button>
                          <button type="button" onClick={copyAdminPlayerSummary}>▤ Скопировать профиль</button>
                          <button type="button" onClick={() => searchAdminPlayer()} disabled={adminSearchLoading}>↻ Обновить профиль</button>
                          <button type="button" onClick={() => setAdminSection("players")}>✎ К выдаче наград</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="admin-tools-empty-action" onClick={() => setAdminSection("players")}>⌕ Открыть поиск игрока</button>
                    )}
                  </section>

                  <section className="admin-panel-card admin-tools-card">
                    <div className="admin-section-title"><span className="admin-section-icon">⚡</span><div><h3>Экспресс-действия</h3><p>Экспортируй нужные данные или скопируй сводку.</p></div></div>
                    <div className="admin-tool-actions-grid">
                      <button type="button" onClick={copyAdminInventoryText} disabled={!filteredAdminInventory.length}>⧉ Скопировать инвентарь</button>
                      <button type="button" onClick={exportAdminInventoryCsv} disabled={!filteredAdminInventory.length}>⇩ Инвентарь CSV</button>
                      <button type="button" onClick={exportAdminLogsCsv} disabled={!filteredAdminLogs.length}>⇩ Журнал CSV</button>
                      <button type="button" onClick={copyAdminLatestLog} disabled={!filteredAdminLogs.length}>⧉ Последняя операция</button>
                      <button type="button" onClick={exportAdminDepositsCsv} disabled={!filteredAdminDepositRequests.length}>⇩ Очередь CSV</button>
                      {isOwner && <button type="button" onClick={exportAdminPromosCsv} disabled={!filteredAdminPromoCodes.length}>⇩ Промокоды CSV</button>}
                      <button type="button" onClick={copyAdminDiagnostics}>⌘ Диагностика WebView</button>
                      <button type="button" onClick={refreshAdminTools} disabled={adminToolsRefreshing}>↻ Обновить всё</button>
                    </div>
                  </section>

                  <section className="admin-panel-card admin-tools-card">
                    <div className="admin-section-title"><span className="admin-section-icon">🎒</span><div><h3>Умный просмотр инвентаря</h3><p>Поиск, фильтр редкости, сортировка и экспорт выбранного списка.</p></div></div>
                    {adminPlayer ? (
                      <>
                        <div className="admin-tools-filters">
                          <input className="admin-input" value={adminInventoryQuery} onChange={(event) => setAdminInventoryQuery(event.target.value)} placeholder="Поиск по предмету или мутации" aria-label="Поиск в инвентаре" />
                          <select className="admin-input" value={adminInventoryRarity} onChange={(event) => setAdminInventoryRarity(event.target.value)} aria-label="Фильтр редкости">
                            <option value="all">Все редкости</option>
                            {adminInventoryRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                          </select>
                          <select className="admin-input" value={adminInventorySort} onChange={(event) => setAdminInventorySort(event.target.value)} aria-label="Сортировка инвентаря">
                            <option value="value_desc">Сначала дорогие</option><option value="value_asc">Сначала дешёвые</option><option value="newest">Сначала новые</option><option value="name">По названию</option>
                          </select>
                        </div>
                        <div className="admin-tools-summary-row"><span>Показано: <b>{filteredAdminInventory.length}</b> из {adminInventory.length}</span><strong>{adminInventoryFilteredValue.toLocaleString("ru-RU")} GG</strong></div>
                        {filteredAdminInventory.length ? (
                          <div className="admin-inventory-list admin-tools-inventory-list">
                            {filteredAdminInventory.map((item) => <div className="admin-inventory-row" key={item.id}>
                              <img className="admin-inventory-thumb" src={brainrotImage(item)} onError={handleBrainrotImageError} alt={item.item_name} loading="lazy" />
                              <b>{item.item_name}{item.mutation === "strawberry" ? <span className="strawberry-mutation-pill">STRAWBERRY ×2.5</span> : null}</b>
                              <small>{item.rarity || "—"}</small><strong>{Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</strong>
                            </div>)}
                          </div>
                        ) : <p className="admin-muted">По этим фильтрам предметов не найдено.</p>}
                        <div className="admin-tool-actions-grid admin-tool-actions-compact">
                          <button type="button" onClick={exportAdminInventoryCsv} disabled={!filteredAdminInventory.length}>⇩ Скачать этот список</button>
                          <button type="button" onClick={copyAdminInventoryText} disabled={!filteredAdminInventory.length}>⧉ Скопировать список</button>
                        </div>
                      </>
                    ) : <p className="admin-muted">Найди игрока в разделе «Игроки», чтобы просматривать его инвентарь.</p>}
                  </section>

                  <section className="admin-panel-card admin-tools-card">
                    <div className="admin-section-title"><span className="admin-section-icon">◷</span><div><h3>Контроль журнала</h3><p>Те же серверные записи, но с быстрым экспортом и копированием.</p></div><button className="admin-refresh-button" type="button" onClick={loadAdminLogs} disabled={adminLogsLoading}>{adminLogsLoading ? "…" : "↻"}</button></div>
                    <div className="admin-tools-summary-row"><span>Найдено записей</span><strong>{filteredAdminLogs.length} / {adminLogs.length}</strong></div>
                    <div className="admin-tool-actions-grid">
                      <button type="button" onClick={exportAdminLogsCsv} disabled={!filteredAdminLogs.length}>⇩ Экспортировать фильтр</button>
                      <button type="button" onClick={copyAdminLatestLog} disabled={!filteredAdminLogs.length}>⧉ Скопировать последнюю</button>
                      <button type="button" onClick={() => { setAdminSection("history"); loadAdminLogs(); }}>☷ Открыть полный журнал</button>
                    </div>
                  </section>

                  <section className="admin-panel-card admin-tools-card">
                    <div className="admin-section-title"><span className="admin-section-icon">🔁</span><div><h3>Монитор очереди пополнений</h3><p>Фильтруй заявки по игроку, предмету и этапу трейда.</p></div><button className="admin-refresh-button" type="button" onClick={loadAdminDepositData} disabled={adminDepositLoading}>{adminDepositLoading ? "…" : "↻"}</button></div>
                    <div className="admin-tools-filters">
                      <input className="admin-input" value={adminDepositQuery} onChange={(event) => setAdminDepositQuery(event.target.value)} placeholder="Игрок, предмет или номер заявки" aria-label="Поиск заявок" />
                      <select className="admin-input" value={adminDepositStatus} onChange={(event) => setAdminDepositStatus(event.target.value)} aria-label="Статус заявки">
                        <option value="all">Все этапы · {adminDepositQueueCounts.all}</option>
                        <option value="queued">В очереди · {adminDepositQueueCounts.queued}</option>
                        <option value="waiting_trade">Ожидает трейд · {adminDepositQueueCounts.waiting_trade}</option>
                        <option value="trade_received">Трейд получен · {adminDepositQueueCounts.trade_received}</option>
                      </select>
                    </div>
                    <div className="admin-tools-summary-row"><span>Совпадений</span><strong>{filteredAdminDepositRequests.length} / {adminDepositRequests.length}</strong></div>
                    <div className="admin-tool-actions-grid">
                      <button type="button" onClick={exportAdminDepositsCsv} disabled={!filteredAdminDepositRequests.length}>⇩ Экспортировать очередь</button>
                      <button type="button" onClick={() => { setAdminSection("deposits"); loadAdminDepositData(); }}>☷ Управлять заявками</button>
                      <button type="button" onClick={() => filteredAdminDepositRequests[0] && copyAdminText([`Заявка #${filteredAdminDepositRequests[0].queue_number}`, `Игрок: @${filteredAdminDepositRequests[0].roblox_username}`, `Предмет: ${depositBrainrotName(filteredAdminDepositRequests[0], filteredAdminDepositRequests[0].brainrot_name)}`, `Статус: ${filteredAdminDepositRequests[0].status}`, `К начислению: ${filteredAdminDepositRequests[0].amount_gg} GG`].join("\n"), "Заявка пополнения")} disabled={!filteredAdminDepositRequests.length}>⧉ Скопировать первую заявку</button>
                    </div>
                  </section>

                  {isOwner && <section className="admin-panel-card admin-tools-card">
                    <div className="admin-section-title"><span className="admin-section-icon">🎟️</span><div><h3>Контроль промокодов</h3><p>Найди код, проверь статус или выгрузи список.</p></div><button className="admin-refresh-button" type="button" onClick={loadAdminPromoCodes} disabled={adminPromoLoading}>{adminPromoLoading ? "…" : "↻"}</button></div>
                    <div className="admin-tools-filters">
                      <input className="admin-input" value={adminPromoQuery} onChange={(event) => setAdminPromoQuery(event.target.value)} placeholder="Поиск промокода или награды" aria-label="Поиск промокодов" />
                      <select className="admin-input" value={adminPromoStatus} onChange={(event) => setAdminPromoStatus(event.target.value)} aria-label="Статус промокода"><option value="all">Все статусы</option><option value="active">Активные</option><option value="inactive">Неактивные / истёкшие</option></select>
                    </div>
                    <div className="admin-tools-summary-row"><span>Совпадений</span><strong>{filteredAdminPromoCodes.length} / {adminPromoCodes.length}</strong></div>
                    <div className="admin-tool-actions-grid"><button type="button" onClick={exportAdminPromosCsv} disabled={!filteredAdminPromoCodes.length}>⇩ Экспортировать промокоды</button><button type="button" onClick={() => { setAdminSection("promocodes"); loadAdminPromoCodes(); }}>✎ Управлять промокодами</button><button type="button" onClick={() => filteredAdminPromoCodes[0] && copyAdminText(filteredAdminPromoCodes[0].code, "Промокод")} disabled={!filteredAdminPromoCodes.length}>⧉ Скопировать первый код</button></div>
                  </section>}

                  <section className="admin-panel-card admin-tools-card admin-tools-diagnostics">
                    <div className="admin-section-title"><span className="admin-section-icon">📡</span><div><h3>Состояние приложения</h3><p>Проверка браузера, Telegram WebView, сети и размера окна.</p></div></div>
                    <div className="admin-diagnostic-list">
                      <div><span>Telegram WebApp</span><b>{window.Telegram?.WebApp ? "Обнаружен" : "Не обнаружен"}</b></div>
                      <div><span>Подписанные данные</span><b>{initData() ? "Получены" : "Не получены"}</b></div>
                      <div><span>Интернет</span><b>{navigator.onLine ? "Подключён" : "Нет соединения"}</b></div>
                      <div><span>Supabase config</span><b>{import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? "Настроен" : "Не настроен"}</b></div>
                      <div><span>Устройство</span><b>{isMobileAdminDevice ? "Телефон / планшет" : "ПК / ноутбук"}</b></div>
                      <div><span>Размер окна</span><b>{window.innerWidth} × {window.innerHeight}</b></div>
                      <div><span>Разрешение экрана</span><b>{window.screen?.width || "—"} × {window.screen?.height || "—"}</b></div>
                      <div><span>Последняя синхронизация</span><b>{adminLastRefreshAt ? new Date(adminLastRefreshAt).toLocaleTimeString("ru-RU") : "Ещё не выполнялась"}</b></div>
                    </div>
                    <button type="button" className="admin-tools-empty-action" onClick={copyAdminDiagnostics}>⧉ Скопировать диагностику для поддержки</button>
                  </section>
                </div>
              )}
            </main>
          )}
        </>
      )}

      {showRewardModal && lastRewards.length > 0 && (
        <div className="reward-modal-backdrop" role="presentation" onClick={() => setShowRewardModal(false)}>
          <section className="reward-modal" role="dialog" aria-modal="true" aria-labelledby="case-reward-title" onClick={(event) => event.stopPropagation()}>
            <div className="reward-modal-sparkle" aria-hidden="true">✦ ✧ ✦</div>
            <span className="reward-modal-kicker">BRAINGG · DROP CONFIRMED</span>
            <h2 id="case-reward-title">Твой выигрыш!</h2>
            <div className={`reward-modal-grid ${lastRewards.length > 1 ? "multi" : ""}`}>
              {lastRewards.map((reward, index) => (
                <article className={`reward-modal-item ${rarityClassName(reward.rarity)}`} key={`${reward.item_name}-${index}`}>
                  <div className="reward-modal-art"><img className={reward.mutation === "strawberry" ? "mutation-strawberry-image" : ""} src={brainrotImage(reward)} onError={handleBrainrotImageError} alt={reward.item_name} /></div>
                  <h3>{reward.item_name || reward.name}</h3>
                  <span className={`reward-modal-rarity ${reward.rarity === "OG" ? "rarity-og" : ""}`}>{reward.rarity || "Brainrot"}</span>
                  {reward.mutation === "strawberry" && <span className="strawberry-mutation-pill">STRAWBERRY мутация · ×2.5</span>}
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
