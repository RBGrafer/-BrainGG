
import React, { useEffect, useState } from "react";
import { cases } from "./data/cases.js";
import { supabase } from "./supabase.js";

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

  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");

  const [upgradeTargets, setUpgradeTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [targetItem, setTargetItem] = useState("");
  const [upgradeChance, setUpgradeChance] = useState(50);
  const [upgradeResult, setUpgradeResult] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeRotation, setUpgradeRotation] = useState(0);

  const [sellingId, setSellingId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");

  const pages = ["Главная", "Кейсы", "Апгрейдер", "Инвентарь"];
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
            action: "admin_grant",
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

    if (nextPage === "Админка" && isAdmin) {
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
    setActionMessage("");
    const rewards = [];

    try {
      for (let i = 0; i < openCount; i++) {
        const { data, error } = await supabase.functions.invoke(
          "braingg-api",
          {
            body: {
              initData: initData(),
              action: "open_case",
              caseName: selectedCase.name,
            },
          }
        );

        if (error || !data?.success || !data?.result?.success) {
          const message = await friendlyActionError(
            error,
            data,
            "Не удалось открыть кейс. Попробуй ещё раз."
          );
          throw new Error(message);
        }

        rewards.push(data.result);

        setPlayer((previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            balance: data.result.balance,
            // Источник истины — остаток, который Edge Function перечитала из Supabase.
            ...(Array.isArray(data.free_case_credits)
              ? { free_case_credits: data.free_case_credits }
              : {}),
            ...(Number.isFinite(Number(data.free_cases_total))
              ? { free_cases_total: Number(data.free_cases_total) }
              : {}),
          };
        });

        setLastRewards([...rewards]);
        if (!fastOpen && i < openCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 650));
        }
      }

      await loadInventory();
      setActionMessage(`Готово! Открыто кейсов: ${rewards.length}`);
    } catch (error) {
      console.error("Ошибка открытия:", error);
      const message = error.message || "Не удалось открыть кейс. Попробуй ещё раз.";

      setActionMessage(
        rewards.length > 0
          ? `Открыто кейсов: ${rewards.length}. ${message}`
          : message
      );
    } finally {
      setOpening(false);
    }
  }

  async function sellItem(item) {
    if (sellingId || upgradeLoading) return;

    const price = Number(item.value_gg) || 0;

    if (!window.confirm(`Продать ${item.item_name} за ${price} GG?`)) {
      return;
    }

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
        <div className="logo">💜 BrainGG</div>
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

          {page === "Главная" && (
            <main className="content">
              <h2>Добро пожаловать в BrainGG!</h2>
              <p>
                Открывай кейсы, собирай персонажей и улучшай свою коллекцию.
              </p>

              {player && (
                <>
                  <p>
                    Привет,{" "}
                    <b>
                      {player.username ? `@${player.username}` : "игрок"}!
                    </b>
                  </p>
                  <p>
                    Твой игровой ID: <b>{player.game_id}</b>
                  </p>
                </>
              )}

              <button
                className="main-button"
                onClick={() => changePage("Кейсы")}
              >
                Смотреть кейсы 🎁
              </button>
            </main>
          )}

          {page === "Кейсы" && (
            <main className="content cases-page">
              {selectedCase ? (
                <section className="case-detail-page">
                  <button
                    className="case-back-button"
                    onClick={() => { setSelectedCase(null); setLastRewards([]); setActionMessage(""); }}
                  >
                    ← Назад к кейсам
                  </button>

                  <div className={`case-detail-visual case-theme-${selectedCase.color}`}>
                    {selectedCase.image ? (
                      <img src={selectedCase.image} alt={selectedCase.name} />
                    ) : (
                      <span>{selectedCase.emoji}</span>
                    )}
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

                  <div className="case-roulette-strip">
                    {(lastRewards.length ? lastRewards : Array.from({ length: 8 }, (_, i) => ({
                      item_name: upgradeTargets[i % Math.max(upgradeTargets.length, 1)]?.item_name || ["Fishino Clownino", "Los Dragons", "Elefanto Frigo", "Antonio"][i % 4],
                      value_gg: upgradeTargets[i % Math.max(upgradeTargets.length, 1)]?.value_gg || 0,
                    }))).map((reward, index) => (
                      <div className="case-roulette-item" key={`${reward.item_name}-${index}`}>
                        <span>{["🧌", "🐉", "🐘", "🧟", "🐻", "🐲"][index % 6]}</span>
                        <b>{reward.item_name}</b>
                        {Number(reward.value_gg) > 0 && <small>{Number(reward.value_gg).toLocaleString("ru-RU")} GG</small>}
                      </div>
                    ))}
                    <i className="case-roulette-pointer" />
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
                          <span>{["🧌", "🐉", "🐘", "🧟", "🐻", "🐲"][index % 6]}</span>
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
                                {item.image ? <img src={item.image} alt={item.name} /> : <span>{item.emoji}</span>}
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
                            <span className="upgrade-item-emoji">🧠</span>

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
                            <span className="upgrade-item-emoji">🧠</span>

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
            <main className="content">
              <h2>🎒 Мой инвентарь</h2>
              <p>Все твои полученные брейнроты в одном месте!</p>

              {inventoryLoading && <p>Загружаем инвентарь...</p>}

              {inventoryError && (
                <>
                  <p>{inventoryError}</p>

                  <button className="main-button" onClick={loadInventory}>
                    Повторить
                  </button>
                </>
              )}

              {!inventoryLoading && !inventoryError && (
                <>
                  <div className="inventory-count">
                    Всего предметов: <b>{inventory.length}</b>
                  </div>

                  {inventory.length === 0 ? (
                    <div className="opening-panel">
                      <div className="case-emoji">🎁</div>
                      <h3>Пока здесь пусто</h3>
                      <p>Открой свой первый кейс!</p>

                      <button
                        className="main-button"
                        onClick={() => changePage("Кейсы")}
                      >
                        Перейти к кейсам
                      </button>
                    </div>
                  ) : (
                    <div className="case-grid">
                      {inventory.map((item) => (
                        <div className="case-card" key={item.id}>
                          <div className="case-emoji">🧠</div>
                          <h3>{item.item_name}</h3>

                          <div
                            className="case-price"
                            style={{
                              color: rarityColors[item.rarity] || "#fff",
                            }}
                          >
                            {item.rarity}
                          </div>

                          <p>
                            Получен:{" "}
                            {new Date(item.created_at).toLocaleDateString(
                              "ru-RU"
                            )}
                          </p>

                          <div className="case-price">
                            🪙 {item.value_gg} GG
                          </div>

                          <button
                            className="main-button"
                            disabled={
                              sellingId === item.id || upgradeLoading
                            }
                            onClick={() => sellItem(item)}
                          >
                            {sellingId === item.id
                              ? "Продаём..."
                              : `Продать за ${item.value_gg} GG`}
                          </button>

                          <button
                            className="case-button"
                            disabled={
                              sellingId === item.id || upgradeLoading
                            }
                            onClick={() => {
                              setSelectedUpgrade(item);
                              setTargetItem("");
                              setUpgradeResult(null);
                              changePage("Апгрейдер");
                            }}
                          >
                            ⚡ Улучшить
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {actionMessage && <p>{actionMessage}</p>}

                  <button
                    className="main-button"
                    onClick={loadInventory}
                    disabled={sellingId !== null}
                  >
                    Обновить инвентарь ↻
                  </button>
                </>
              )}
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

                {adminLogsLoading ? (
                  <p className="admin-muted">Загружаем историю...</p>
                ) : adminLogs.length === 0 ? (
                  <p className="admin-muted">Пока выдач не было.</p>
                ) : (
                  <div className="admin-history-list">
                    {adminLogs.map((log) => (
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
