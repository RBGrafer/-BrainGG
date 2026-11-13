
import React, { useEffect, useState } from "react";
import { cases } from "./data/cases.js";
import { supabase } from "./supabase.js";

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

function calculateUpgradeChance(source, target) {
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
    Math.max(0.1, (sourcePrice / targetPrice) * 100)
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

  const [sellingId, setSellingId] = useState(null);
  const [sellingAll, setSellingAll] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const pages = ["Главная", "Кейсы", "Апгрейдер", "Инвентарь", "Рейтинг", "Задания", "Профиль"];
  const [customError, setCustomError] = useState("");

  // Состояние защищённой админ-панели BrainGG
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [adminGameStats, setAdminGameStats] = useState(null);

  const initData = () => window.Telegram?.WebApp?.initData;

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

        // Сервер сам проверяет Telegram ID по ADMIN_TELEGRAM_IDS.
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
    const timer = window.setInterval(() => { loadGameHub(); }, 20000);
    return () => window.clearInterval(timer);
  }, [player?.telegram_id]);

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
    } catch (error) {
      console.error("Ошибка инвентаря:", error);
      setInventoryError(
        "Не удалось загрузить инвентарь. Попробуй ещё раз."
      );
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

      setUpgradeTargets(data.items || []);
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
        actualChance: calculateUpgradeChance(source, item),
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
    setUpgradeResult(null);
    setActionMessage("");

    const closest = findClosestTarget(item, upgradeChance);

    setTargetItem(closest?.item_name || "");
  }

  async function changePage(nextPage) {
    setPage(nextPage);
    setActionMessage("");

    if (nextPage === "Инвентарь" || nextPage === "Апгрейдер") {
      await loadInventory();
    }

    if (nextPage === "Апгрейдер" && upgradeTargets.length === 0) {
      await loadUpgradeTargets();
    }

    if (["Рейтинг", "Задания", "Профиль"].includes(nextPage)) await loadGameHub();

    if (nextPage === "Админка" && isAdmin) {
      await loadAdminGameStats();
      if (upgradeTargets.length === 0) {
        await loadUpgradeTargets();
      }
      await loadAdminLogs();
    }
  }

  async function openSelectedCase() {
    if (!selectedCase || !player || opening) return;

    setOpening(true);
    setLastRewards([]);
    setReelWinnerIndex(-1);
    setReelRows([]);
    setActionMessage("");
    const rewards = [];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const makeReel = (winner, rowIndex) => {
      const pool = upgradeTargets.length ? upgradeTargets : [];
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
          body: { initData: initData(), action: "open_case", caseName: selectedCase.name },
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
          created_at: new Date().toISOString(),
        }, ...previous].slice(0, 8));
        setPlayer((previous) => previous ? {
          ...previous,
          balance: reward.balance,
          ...(Array.isArray(data.free_case_credits) ? { free_case_credits: data.free_case_credits } : {}),
          ...(Number.isFinite(Number(data.free_cases_total)) ? { free_cases_total: Number(data.free_cases_total) } : {}),
        } : previous);
      }

      const rows = fastOpen
        ? rewards.map((reward, index) => ({ id: `reel-${index}`, cards: [reward], winnerIndex: 0, position: 0, revealed: true }))
        : rewards.map((reward, index) => makeReel(reward, index));
      setReelRows(rows);

      if (!fastOpen) {
        await nextFrame();
        setReelRows((current) => current.map((row) => ({ ...row, position: row.winnerIndex })));
        await wait(5450);
        setReelRows((current) => current.map((row) => ({ ...row, revealed: true })));
      }

      setLastRewards(rewards);
      await loadInventory();
      setActionMessage(`Готово! Открыто кейсов: ${rewards.length}`);
    } catch (error) {
      console.error("Ошибка открытия:", error);
      const message = error.message || "Не удалось открыть кейс. Попробуй ещё раз.";
      setActionMessage(rewards.length > 0 ? `Открыто кейсов: ${rewards.length}. ${message}` : message);
      if (rewards.length) {
        setReelRows(rewards.map((reward, index) => ({ id: `reel-${index}`, cards: [reward], winnerIndex: 0, position: 0, revealed: true })));
        setLastRewards(rewards);
      }
    } finally {
      setOpening(false);
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
      const actualChance = Number(result.chance);

      const greenCenter = actualChance * 1.8;
      const darkCenter = 180 + actualChance * 1.8;
      const sectorCenter = result.won ? greenCenter : darkCenter;

      setUpgradeRotation(
        (previous) => previous + 360 * 5 - sectorCenter
      );

      setActionMessage("Улучшение выполнено!");

      await new Promise((resolve) => setTimeout(resolve, 4200));

      setUpgradeResult(result);

      setPlayer((previous) => ({
        ...previous,
        balance: result.balance,
      }));

      await loadInventory();

      setSelectedUpgrade(null);
      setTargetItem("");
    } catch (error) {
      console.error("Ошибка апгрейда:", error);
      setActionMessage(
        await friendlyActionError(error, null, "Не удалось выполнить апгрейд. Попробуй ещё раз.")
      );
    } finally {
      setUpgradeLoading(false);
    }
  }

  const selectedTarget = upgradeTargets.find(
    (item) => item.item_name === targetItem
  );

  const actualChance = selectedUpgrade && selectedTarget
    ? calculateUpgradeChance(selectedUpgrade, selectedTarget)
    : 0;

  const availableTargets = upgradeTargets
    .filter((item) => item.item_name !== selectedUpgrade?.item_name)
    .map((item) => ({
      ...item,
      actualChance: selectedUpgrade
        ? calculateUpgradeChance(selectedUpgrade, item)
        : null,
    }));

  const wheelAngle = actualChance * 3.6;

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
    <div className="app">
      <div className="winter-snow" aria-hidden="true">
        {snowflakes.map((flake) => (
          <i
            className="snowflake"
            key={flake.id}
            style={{
              left: flake.left,
              animationDelay: flake.delay,
              animationDuration: flake.duration,
              width: flake.size,
              height: flake.size,
              opacity: flake.opacity,
              "--snow-drift": flake.drift,
            }}
          />
        ))}
      </div>
      <header className="header">
        <div className="logo"><span className="logo-heart">💜</span> BrainGG</div>
        <div className="balance">
          🪙 {player ? player.balance : 0} GG
        </div>
      </header>

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

          <section className="live-drops-bar" aria-label="Live Drops">
            <div className="live-drops-heading"><span className="live-pulse" /> <b>LIVE DROPS</b><small>ПОСЛЕДНИЕ ВЫПАДЕНИЯ</small></div>
            <div className="live-drops-track">
              {liveDrops.length ? liveDrops.map((drop) => (
                <article className="live-drop-chip" key={drop.id}>
                  <div className="live-drop-art">{brainrotImage(drop) ? <img src={brainrotImage(drop)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>❄</span>}</div>
                  <div><b>{drop.item_name}</b><small>@{drop.username || "Игрок"} · {drop.case_name || "Кейс"} · {drop.rarity || "Награда"}</small></div>
                  {drop.value_gg > 0 && <strong>{drop.value_gg.toLocaleString("ru-RU")} GG</strong>}
                </article>
              )) : <div className="live-drops-empty">Здесь появятся реальные выигрыши после открытия кейса</div>}
            </div>
          </section>

          {page === "Главная" && (
            <main className="content home-welcome">
              <div className="home-welcome-inner">
                <div className="home-welcome-emblem">❄</div>
                <p className="home-greeting">Привет, <b>@{player?.username || "игрок"}!</b></p>
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
                    onClick={() => { setSelectedCase(null); setLastRewards([]); setReelRows([]); setActionMessage(""); }}
                  >
                    ← Назад к кейсам
                  </button>

                  <div className={`case-detail-visual case-theme-${selectedCase.color}`}>
                    <div className="case-detail-art-frame">
                      {selectedCase.image ? (
                        <img src={selectedCase.image} alt={selectedCase.name} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling.style.display = "grid"; }} />
                      ) : null}
                      <span className="case-detail-art-fallback" style={{ display: selectedCase.image ? "none" : "grid" }}>{selectedCase.emoji}</span>
                    </div>
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
                      <div className={`case-roulette-viewport ${opening && !fastOpen ? "is-rolling" : ""}`} key={row.id} aria-label={`Рулетка ${rowIndex + 1}`}>
                        <div className="case-roulette-strip" style={{ "--reel-index": row.position, "--reel-duration": `${5.0 + rowIndex * 0.18}s` }}>
                          {row.cards.map((reward, index) => (
                            <div className={`case-roulette-item ${row.revealed && index === row.winnerIndex ? "is-winner" : ""}`} key={`${reward.item_name}-${rowIndex}-${index}`}>
                              {brainrotImage(reward) ? <img src={brainrotImage(reward)} alt={reward.item_name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement.classList.add("has-image-error"); }} /> : <span>{["🧌", "🐉", "🐘", "🧟", "🐻", "🐲"][index % 6]}</span>}
                              <b>{reward.item_name}</b>
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

                  {(() => {
                    const freeCount = Number(player?.free_case_credits?.find((credit) => credit.case_name === selectedCase.name)?.amount || 0);
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
                    disabled={!player || opening}
                    onClick={openSelectedCase}
                  >
                    {opening ? "Открываем..." : (() => {
                      const freeCount = Number(player?.free_case_credits?.find((credit) => credit.case_name === selectedCase.name)?.amount || 0);
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
                          <b>{reward.item_name}</b><span>{reward.rarity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <section className="case-contents-panel">
                    <h3>Содержимое кейса</h3>
                    <p className="case-contents-caption">Возможные награды из пула BrainGG</p>
                    <div className="case-contents-grid">
                      {(upgradeTargets.length ? upgradeTargets.slice(0, 12) : []).map((item, index) => (
                        <div className="case-content-item" key={`${item.item_name}-${index}`}>
                          {brainrotImage(item) ? <img className="brainrot-thumb" src={brainrotImage(item)} alt={item.item_name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>{["🧌", "🐉", "🐘", "🧟", "🐻", "🐲"][index % 6]}</span>}
                          <div><b>{item.item_name}</b><small>{Number(item.value_gg || 0).toLocaleString("ru-RU")} GG</small></div>
                        </div>
                      ))}
                      {!upgradeTargets.length && <p className="case-contents-caption">Список наград загружается при переходе в апгрейдер.</p>}
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
                                setLastRewards([]);
                                setOpenCount(1);
                                setActionMessage("");
                                if (upgradeTargets.length === 0) loadUpgradeTargets();
                              }}
                            >
                              <div className="case-card-art">
                                {item.image ? <img src={item.image} alt={item.name} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement.classList.add("has-image-error"); }} /> : <span>{item.emoji}</span>}
                              </div>
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
                    <section className="upgrade-column">
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
                                ? `${actualChance.toFixed(1)}%`
                                : "—"}
                            </span>

                            <span className="wheel-label">
                              РЕАЛЬНЫЙ ШАНС
                            </span>
                          </div>
                        </div>

                        <div
                          className="upgrade-pointer"
                          style={{
                            transform: `rotate(${upgradeRotation}deg)`,
                            transformOrigin: "50% 115px",
                            transition: upgradeLoading
                              ? "transform 4.2s cubic-bezier(0.12, 0.72, 0.12, 1)"
                              : "none",
                          }}
                        />
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

                    <section className="upgrade-column">
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
                  <article className="inventory-card" key={item.id}><div className="inventory-card-top"><span>#{String(index+1).padStart(2,"0")}</span><span className="inventory-rarity">{item.rarity||"Обычный"}</span></div><div className="inventory-art"><div className="inventory-art-glow"/>{brainrotImage(item) ? <img className="brainrot-inventory-image" src={brainrotImage(item)} alt={item.item_name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>🧠</span>}<i>✦</i></div><div className="inventory-card-info"><h3>{item.item_name}</h3><div className="inventory-value">{Number(item.value_gg||0).toLocaleString("ru-RU")} <small>GG</small></div><p>Получен {item.created_at?new Date(item.created_at).toLocaleDateString("ru-RU"):"—"}</p></div><div className="inventory-card-actions"><button className="main-button" disabled={sellingId===item.id||sellingAll||upgradeLoading} onClick={()=>sellItem(item)}>{sellingId===item.id?"Продаём...":`Продать · ${Number(item.value_gg||0).toLocaleString("ru-RU")} GG`}</button><button className="case-button" disabled={sellingId===item.id||sellingAll||upgradeLoading} onClick={()=>{setSelectedUpgrade(item);setTargetItem("");setUpgradeResult(null);changePage("Апгрейдер");}}>⚡ Улучшить</button></div></article>
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
                          <div className="admin-history-main"><b>{log.action === "coins" ? `+${log.amount} GG` : log.action === "cases" ? `+${log.amount} ${log.case_name || "кейсов"}` : `+${log.amount} ${log.item_name || "брейнрот"}`}</b><small>Game ID: {log.game_id}</small></div>
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
                              <span>{cases.find((item) => item.name === credit.case_name)?.emoji || "🎁"} {credit.case_name}</span>
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
                              <option key={item.id} value={item.name}>
                                {item.emoji} {item.name}
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
                            <b>{item.item_name}</b>
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
                              ? `+${log.amount} бесплатных ${log.case_name || "кейсов"}`
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
