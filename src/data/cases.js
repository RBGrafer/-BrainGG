import redStarterArt from "../assets/cases/v17/red-starter.webp";
import scarletDropArt from "../assets/cases/v17/scarlet-drop.webp";
import bloodlineArt from "../assets/cases/v17/bloodline.webp";
import crimsonVaultArt from "../assets/cases/v17/crimson-vault.webp";
import royalRedArt from "../assets/cases/v17/royal-red.webp";
import whiteCrownArt from "../assets/cases/v17/white-crown.webp";
import strawberryAllInArt from "../assets/cases/v17/strawberry-all-in.webp";
import headlessAllInArt from "../assets/cases/v17/headless-all-in.webp";
import nickCaseArt from "../assets/cases/v17/nick-case.webp";
import freeCaseArt from "../assets/cases/v17/free-case.webp";

// BrainGG v17 case art. Backend caseName values stay stable for existing rewards.
export const cases = [
  {
    id: 1, name: "Red Starter", caseName: "Truckini Case",
    description: "Первый шаг в коллекцию BrainGG — яркие базовые находки", price: 141,
    oldPrice: 211, discount: 33, color: "red",
    image: redStarterArt, category: "Обычные кейсы",
  },
  {
    id: 2, name: "Scarlet Drop", caseName: "Summer Case",
    description: "Алый кейс с редкими и неожиданными персонажами", price: 396,
    oldPrice: 594, discount: 33, color: "scarlet",
    image: scarletDropArt, category: "Обычные кейсы",
  },
  {
    id: 3, name: "Bloodline", caseName: "Bloody Case",
    description: "Охота за эпическими и легендарными брейнротами", price: 425,
    oldPrice: 637, discount: 33, color: "blood",
    image: bloodlineArt, category: "Обычные кейсы",
  },
  {
    id: 4, name: "Crimson Vault", caseName: "Crafting Case",
    description: "Сбалансированный набор для прокачки коллекции", price: 425,
    oldPrice: 637, discount: 33, color: "vault",
    image: crimsonVaultArt, category: "Обычные кейсы",
  },
  {
    id: 5, name: "Royal Red", caseName: "Legend Case",
    description: "Премиальная подборка с шансом на топовые дропы", price: 1133,
    oldPrice: 1700, discount: 33, color: "royal",
    image: royalRedArt, category: "Премиум", maxReward: 10860,
  },
  {
    id: 6, name: "White Crown", caseName: "Elite Case",
    description: "Элитный кейс для охотников за OG-предметами", price: 4250,
    oldPrice: 6375, discount: 33, color: "crown",
    image: whiteCrownArt, category: "Премиум", maxReward: 120000,
  },
  {
    id: 7, name: "All In: Strawberry", caseName: "All In Strawberry Elephant",
    description: "Рискни всем ради редкого клубничного джекпота", price: 26,
    oldPrice: 39, discount: 33, color: "strawberry",
    image: strawberryAllInArt, category: "All In", maxReward: 24000,
  },
  {
    id: 8, name: "All In: Headless", caseName: "All In Headless Horseman",
    description: "Один бросок — шанс забрать легендарную награду", price: 59,
    oldPrice: 89, discount: 33, color: "headless",
    image: headlessAllInArt, category: "All In", maxReward: 14830,
  },
];


// Special cases are displayed separately from the paid case catalogue.
// Their reward pools reuse existing database case names so no new reward rows are required.
export const specialCases = [
  {
    id: "nick-case",
    name: "NICK CASE",
    caseName: "Nick Case",
    rewardCaseName: "Truckini Case",
    specialType: "nick",
    description: "Синий специальный кейс. Одно бесплатное открытие раз в 12 часов, пока @Brain_GG_Bot указан в имени или фамилии Telegram.",
    requirementShort: "@Brain_GG_Bot в имени/фамилии · 1 открытие / 12 ч",
    price: 0,
    color: "special-blue",
    image: nickCaseArt,
    category: "Специальные кейсы",
  },
  {
    id: "free-case",
    name: "FREE CASE",
    caseName: "Free Case",
    rewardCaseName: "Summer Case",
    specialType: "free",
    description: "Зелёный специальный кейс. Одно бесплатное открытие раз в 12 часов для подписчиков Telegram-канала @Brainrot_GG.",
    requirementShort: "Подписка на @Brainrot_GG · 1 открытие / 12 ч",
    price: 0,
    color: "special-green",
    image: freeCaseArt,
    category: "Специальные кейсы",
  },
];
