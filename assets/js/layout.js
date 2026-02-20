/*
  Sistema de Controle de Documentos Ocupacionais
  Arquivo: assets/js/layout.js

  Objetivo:
  - Gerenciar comportamentos comuns do layout.
  - Alternar a exibição da barra lateral em dispositivos móveis.
  - Injetar dinamicamente o botão de menu (hamburger) e o overlay se não existirem.
*/

/**
 * Inicializa os controles da barra lateral para mobile.
 */
function initMobileNav() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  // 1. Injetar o overlay se não existir
  let overlay = document.querySelector(".sidebar-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    document.body.appendChild(overlay);
  }

  // 2. Injetar o botão de menu mobile se não existir
  let toggleBtn = document.querySelector(".mobile-nav-toggle");
  if (!toggleBtn) {
    toggleBtn = document.createElement("button");
    toggleBtn.className = "mobile-nav-toggle";
    toggleBtn.innerHTML = "☰";
    toggleBtn.setAttribute("aria-label", "Abrir menu");
    document.body.appendChild(toggleBtn);
  }

  /**
   * Abre/Fecha a barra lateral.
   */
  function toggleSidebar() {
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
    
    // Troca o ícone (☰ por ✕)
    if (sidebar.classList.contains("active")) {
      toggleBtn.innerHTML = "✕";
    } else {
      toggleBtn.innerHTML = "☰";
    }
  }

  // Eventos de clique
  toggleBtn.addEventListener("click", toggleSidebar);
  overlay.addEventListener("click", toggleSidebar);

  // Fecha ao clicar em um item do menu (opcional, mas bom para UX)
  const navItems = sidebar.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      if (sidebar.classList.contains("active")) {
        toggleSidebar();
      }
    });
  });
}

// Inicializa quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
});
