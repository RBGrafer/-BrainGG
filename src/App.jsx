
import React, { useState } from "react";

export default function App() {
  const [page, setPage] = useState("Главная");

  const pages = ["Главная", "Кейсы", "Апгрейдер", "Инвентарь"];

  return (
    <div className="app">
      <header className="header">
        <div className="logo">BrainGG</div>
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

      <main className="content">
        {page === "Главная" && (
          <>
            <h2>Добро пожаловать в BrainGG!</h2>
            <p>Открывай кейсы, получай персонажей и улучшай свою коллекцию.</p>
          </>
        )}

        {page === "Кейсы" && (
          <>
            <h2>Кейсы</h2>
            <p>Скоро здесь появятся наши кейсы!</p>
          </>
        )}

        {page === "Апгрейдер" && (
          <>
            <h2>Апгрейдер</h2>
            <p>Улучшай свои предметы и пробуй удачу!</p>
          </>
        )}

        {page === "Инвентарь" && (
          <>
            <h2>Инвентарь</h2>
            <p>Здесь будут храниться твои предметы.</p>
          </>
        )}
      </main>
    </div>
  );
}
