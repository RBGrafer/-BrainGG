// BrainGG — каталог кейсов. Идентификаторы caseName сохраняют совместимость
// с уже существующими пулами наград в Supabase.
import iceCaseArt from "../assets/cases/v18/ice-case.webp";
import snowCaseArt from "../assets/cases/v18/snow-case.webp";
import crystalCaseArt from "../assets/cases/v18/crystal-case.webp";
import moonCaseArt from "../assets/cases/v18/moon-case.webp";
import referralCaseArt from "../assets/cases/v18/referral-case.webp";
import freeCaseArt from "../assets/cases/v18/free-case.webp";
import anniversaryCaseArt from "../assets/cases/v18/anniversary-case.webp";
import nickCaseArt from "../assets/cases/v18/nick-case.webp";
import seaCaseArt from "../assets/cases/v18/sea-case.webp";
import darkCaseArt from "../assets/cases/v18/dark-case-new.webp";
import headlessAllInArt from "../assets/cases/v18/headless-horseman-all-in.webp";
import strawberryAllInArt from "../assets/cases/v18/strawberry-elephant-all-in.webp";
import cheapCaseArt from "../assets/cases/v18/cheap-case.webp";

export const cases = [
  {
    id: 1, name: "Ледяной кейс", caseName: "Truckini Case",
    description: "Ледяной мир BrainGG с зимними сокровищами", price: 141,
    oldPrice: 211, discount: 33, color: "ice",
    image: iceCaseArt, category: "Обычные кейсы",
  },
  {
    id: 2, name: "Снежный кейс", caseName: "Summer Case",
    description: "Снежный кейс с праздничным персонажем", price: 396,
    oldPrice: 594, discount: 33, color: "snow",
    image: snowCaseArt, category: "Обычные кейсы",
  },
  {
    id: 3, name: "Кристальный кейс", caseName: "Bloody Case",
    description: "Кристаллы, энергия и редкие находки", price: 425,
    oldPrice: 637, discount: 33, color: "crystal",
    image: crystalCaseArt, category: "Обычные кейсы",
  },
  {
    id: 4, name: "Лунный кейс", caseName: "Crafting Case",
    description: "Тайны лунного мира и фиолетовая энергия", price: 425,
    oldPrice: 637, discount: 33, color: "moon",
    image: moonCaseArt, category: "Обычные кейсы",
  },
  {
    id: 5, name: "CHEAP CASE", caseName: "Truckini Case",
    description: "Доступный кейс с неожиданными находками", price: 9,
    color: "orange", image: cheapCaseArt, category: "Обычные кейсы",
  },
  {
    id: 6, name: "Юбилейный кейс", caseName: "All In Strawberry Elephant",
    description: "Праздничный золотой кейс BrainGG", price: 209,
    color: "anniversary", image: anniversaryCaseArt,
    category: "All In", maxReward: 24000,
  },
  {
    id: 7, name: "Headless Horseman All-In", caseName: "All In Headless Horseman",
    description: "Мистический всадник и редкие награды", price: 59,
    color: "horseman", image: headlessAllInArt, category: "All In",
  },
  {
    id: 8, name: "Strawberry Elephant All-In", caseName: "All In Strawberry Elephant",
    description: "Яркая клубничная коллекция и ценные находки", price: 39,
    color: "strawberry", image: strawberryAllInArt, category: "All In",
  },
  {
    id: 9, name: "Морской кейс", caseName: "Legend Case",
    description: "Морское приключение за редкими сокровищами", price: 1133,
    oldPrice: 1700, discount: 33, color: "sea",
    image: seaCaseArt, category: "Премиум", maxReward: 10860,
  },
  {
    id: 10, name: "DARK кейс", caseName: "Elite Case",
    description: "Тёмная коллекция для самых смелых", price: 99,
    color: "dark", image: darkCaseArt, category: "Премиум", maxReward: 120000,
  },
];

// Специальные кейсы отделены от платного каталога: их доступ бесплатный
// и определяется серверными условиями Telegram/Supabase.
export const specialCases = [
  {
    id: "referral-case", name: "Реферальный кейс", caseName: "BrainGG Case",
    rewardCaseName: "Summer Case", specialType: "deposit",
    description: "Временно работает на прежнем условии BrainGG CASE: пополнение минимум на 60 GG за последние 7 дней, одно открытие в неделю. Реферальные условия можно подключить отдельно.",
    requirementShort: "60 GG пополнений за 7 дней · 1 открытие / 7 дней",
    price: 0, color: "special-referral", image: referralCaseArt,
    category: "Специальные кейсы",
  },
  {
    id: "free-case", name: "Бесплатный кейс", caseName: "Free Case",
    rewardCaseName: "Summer Case", specialType: "free",
    description: "Одно бесплатное открытие раз в 12 часов для подписчиков Telegram-канала @Brainrot_GG.",
    requirementShort: "Подписка на @Brainrot_GG · 1 открытие / 12 ч",
    price: 0, color: "special-green", image: freeCaseArt,
    category: "Специальные кейсы",
  },
  {
    id: "nick-case", name: "Ник кейс", caseName: "Nick Case",
    rewardCaseName: "Truckini Case", specialType: "nick",
    description: "Одно бесплатное открытие раз в 12 часов, пока @Brain_GG_Bot указан в имени или фамилии Telegram.",
    requirementShort: "@Brain_GG_Bot в имени/фамилии · 1 открытие / 12 ч",
    price: 0, color: "special-blue", image: nickCaseArt,
    category: "Специальные кейсы",
  },
];
