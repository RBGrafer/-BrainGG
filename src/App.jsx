
import React, { useState } from "react";
import { cases } from "./data/cases.js";

export default function App() {
  const [page, setPage] = useState("Главная");
  const [openCount, setOpenCount] = useState(1);
  const [selectedCase, setSelectedCase] = useState(null);

  const pages = ["Главная", "Кейсы", "Апгрейдер", "Инвентарь"];

  return (
    <div className="app">
      <header className="header">
        <div className="logo">💜 BrainGG</div>
        <div className="balance">🪙 0 GG</div>
      </header>

      <nav className="navigation">
        {pages.map((item) => (
          <button
            key={item}
            className={page === item ? "active" : ""}
            onClick={() => setPage(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {page === "Главная" && (
        <main className="content">
          <h2>Добро пожаловать в BrainGG!</h2>
          <p>Открывай кейсы, собирай персонажей и улучшай свою коллекцию.</p>
          <button
            className="main-button"
            onClick={() => setPage("Кейсы")}
          >
            Смотреть кейсы 🎁
          </button>
        </main>
      )}

      {page === "Кейсы" && (
        <main className="content">
          <h2>🎁 Кейсы BrainGG</h2>
          <p>Выбирай кейс и готовься испытать удачу!</p>

          <div className="case-grid">
            {cases.map((item) => (
              <div className="case-card" key={item.id}>
                <div className="case-emoji">{item.emoji}</div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="case-price">
                  🪙 {item.price} GG
                </div>

                <button
                  className={
                    selectedCase?.id === item.id
                      ? "case-button selected"
                      : "case-button"
                  }
                  onClick={() => setSelectedCase(item)}
                >
                  {selectedCase?.id === item.id
                    ? "Выбран ✓"
                    : "Выбрать кейс"}
                </button>
              </div>
            ))}
          </div>

          <div className="opening-panel">
            <h3>Количество открытий</h3>

            <div className="opening-options">
              {[1, 3, 5].map((count) => (
                <button
                  key={count}
                  className={
                    openCount === count ? "count-button active" : "count-button"
                  }
                  onClick={() => setOpenCount(count)}
                >
                  ×{count}
                </button>
              ))}
            </div>

            {selectedCase ? (
              <>
                <p>
                  Выбран: <b>{selectedCase.name}</b>
                </p>
                <p>
                  Стоимость:{" "}
                  <b>{selectedCase.price * openCount} GG</b>
                </p>
              </>
            ) : (
              <p>Сначала выбери кейс 👆</p>
            )}

            <button
              className="main-button open-button"
              disabled={!selectedCase}
              onClick={() =>
                alert("Открытие кейсов подключим на следующем этапе!")
              }
            >
              Открыть ×{openCount}
            </button>
          </div>
        </main>
      )}

      {page === "Апгрейдер" && (
        <main className="content">
          <h2>⚡ Апгрейдер</h2>
          <p>Скоро здесь появится система улучшения персонажей!</p>
        </main>
      )}

      {page === "Инвентарь" && (
        <main className="content">
          <h2>🎒 Инвентарь</h2>
          <p>Здесь будут храниться твои персонажи.</p>
        </main>
      )}
    </div>
  );
}
