/*
  Visualizar Empresas
  Arquivo: /visualizar/visualizar.js

  MIGRAÇÃO SUPABASE:
  - Carregamento assíncrono de empresas
  - Uso de calcularStatusGeralEmpresa para status consolidado
*/

// Variáveis de estado para paginação e filtro
let paginaAtual = 1;
const itensPorPagina = 10;
let arvoreOriginal = [];
let arvoreFiltrada = [];

document.addEventListener("DOMContentLoaded", function () {
  const session = requireAuth();
  if (!session) return;

  fillSidebarUserInfo();
  registerLogoutButton();

  montarListaEmpresas(session);
  configurarFiltros(session);
  configurarModalPdf();
});

/**
 * Configura o listener do campo de pesquisa.
 */
function configurarFiltros(session) {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", function (e) {
    const termo = e.target.value.toLowerCase().trim();
    aplicarFiltro(termo, session);
  });
}

/**
 * Aplica o filtro na lista original e atualiza a view.
 */
function aplicarFiltro(termo, session) {
  if (!termo) {
    arvoreFiltrada = [...arvoreOriginal];
  } else {
    // Filtra empresas (matriz ou filiais) que correspondem ao termo
    arvoreFiltrada = arvoreOriginal.filter(grupo => {
      const matrizMatch = (grupo.principal.nome || "").toLowerCase().includes(termo) ||
                          (grupo.principal.cnpj || "").replace(/\D/g, "").includes(termo);
      
      // Verifica se alguma filial corresponde
      const filiaisMatch = (grupo.filiais || []).some(filial => 
        (filial.nome || "").toLowerCase().includes(termo) ||
        (filial.cnpj || "").replace(/\D/g, "").includes(termo)
      );

      return matrizMatch || filiaisMatch;
    });
  }

  paginaAtual = 1; // Reseta para a primeira página
  renderizarPagina(session);
}

/**
 * Busca a árvore de empresas e inicializa a listagem.
 */
async function montarListaEmpresas(session) {
  const container = document.getElementById("lista-empresas");
  container.innerHTML = "<p class='text-muted'>Carregando empresas...</p>";

  try {
    const arvore = await getCompanyTree();
    
    if (!arvore || !arvore.length) {
      arvoreOriginal = [];
      arvoreFiltrada = [];
      renderizarPagina(session); // Renderiza estado vazio
      return;
    }

    // Armazena dados globais
    arvoreOriginal = arvore;
    arvoreFiltrada = [...arvore];

    renderizarPagina(session);

  } catch (error) {
    console.error("Erro ao carregar empresas:", error);
    container.innerHTML = "<p class='error'>Erro ao carregar empresas. Verifique o console ou sua conexão.</p>";
  }
}

/**
 * Renderiza os itens da página atual e atualiza controles de paginação.
 */
function renderizarPagina(session) {
  const container = document.getElementById("lista-empresas");
  container.innerHTML = "";

  if (arvoreFiltrada.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-muted";
    empty.textContent = "Nenhuma empresa encontrada.";
    container.appendChild(empty);
    atualizarControlesPaginacao(0);
    return;
  }

  // Paginação
  const totalItens = arvoreFiltrada.length;
  const totalPaginas = Math.ceil(totalItens / itensPorPagina);

  // Garante que a página atual é válida
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
  if (paginaAtual < 1) paginaAtual = 1;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const itensPagina = arvoreFiltrada.slice(inicio, fim);

  // Renderiza itens
  itensPagina.forEach((grupo) => {
    const { principal, filiais } = grupo;

    const grupoWrapper = document.createElement("div");
    grupoWrapper.className = "empresa-grupo";

    const filiaisWrapper = document.createElement("div");
    filiaisWrapper.className = "empresa-filiais-list";

    const cardMatriz = criarCardEmpresa(principal, filiais, filiaisWrapper, session);

    if (filiais && filiais.length) {
      filiais.forEach((filial) => {
        const cardFilial = criarCardFilial(filial, session);
        filiaisWrapper.appendChild(cardFilial);
      });
    }

    grupoWrapper.appendChild(cardMatriz);
    grupoWrapper.appendChild(filiaisWrapper);
    container.appendChild(grupoWrapper);
  });

  atualizarControlesPaginacao(totalPaginas);
}

/**
 * Cria os botões de paginação.
 */
function atualizarControlesPaginacao(totalPaginas) {
  const paginationContainer = document.getElementById("pagination-controls");
  if (!paginationContainer) return;

  paginationContainer.innerHTML = "";

  if (totalPaginas <= 1) return;

  // Botão Anterior
  const btnPrev = document.createElement("button");
  btnPrev.className = "btn btn-secondary btn-sm";
  btnPrev.textContent = "« Anterior";
  btnPrev.disabled = paginaAtual === 1;
  btnPrev.onclick = () => {
    if (paginaAtual > 1) {
      paginaAtual--;
      renderizarPagina(requireAuth()); // Re-renderiza com sessão
    }
  };
  paginationContainer.appendChild(btnPrev);

  // Indicador de página
  const indicador = document.createElement("span");
  indicador.className = "text-muted";
  indicador.style.margin = "0 10px";
  indicador.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
  paginationContainer.appendChild(indicador);

  // Botão Próximo
  const btnNext = document.createElement("button");
  btnNext.className = "btn btn-secondary btn-sm";
  btnNext.textContent = "Próximo »";
  btnNext.disabled = paginaAtual === totalPaginas;
  btnNext.onclick = () => {
    if (paginaAtual < totalPaginas) {
      paginaAtual++;
      renderizarPagina(requireAuth());
    }
  };
  paginationContainer.appendChild(btnNext);
}

/**
 * Cria o bloco visual de uma empresa principal (matriz).
 */
function criarCardEmpresa(empresa, filiais, filiaisWrapper, session) {
  const card = document.createElement("article");
  card.className = "empresa-card fade-in";

  const header = document.createElement("div");
  header.className = "empresa-header";

  const info = document.createElement("div");

  const nome = document.createElement("div");
  nome.className = "empresa-nome";
  nome.textContent = empresa.nome;

  const subinfo = document.createElement("div");
  subinfo.className = "empresa-subinfo";
  // DataInício/Término aqui pode ser confuso pois é por doc.
  // Vamos mostrar apenas CNPJ e Status Geral.
  subinfo.textContent = `CNPJ: ${empresa.cnpj}`;

  info.appendChild(nome);
  info.appendChild(subinfo);

  // Status Geral da Empresa (pior caso entre os documentos)
  const statusInfo = calcularStatusGeralEmpresa(empresa);
  
  const badge = document.createElement("div");
  badge.className = `badge ${statusInfo.cssClass}`;

  const dot = document.createElement("span");
  dot.className = "badge-dot";

  const label = document.createElement("span");
  label.textContent = statusInfo.label;

  badge.appendChild(dot);
  badge.appendChild(label);

  header.appendChild(info);
  header.appendChild(badge);

  const actions = document.createElement("div");
  actions.className = "empresa-actions";

  const btnFilial = document.createElement("button");
  btnFilial.type = "button";
  btnFilial.className = "btn btn-secondary";
  btnFilial.textContent = "Cadastrar filial";

  btnFilial.addEventListener("click", function (e) {
    e.stopPropagation();
    const params = new URLSearchParams({
      tipo: "filial",
      parentId: empresa.id,
      parentName: empresa.nome,
    });
    window.location.href = "../cadastro/index.html?" + params.toString();
  });

  actions.appendChild(btnFilial);

  // Botão de exclusão da empresa (apenas para administradores)
  if (session.perfil === "admin") {
    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "btn btn-danger";
    btnExcluir.textContent = "Excluir empresa";

    btnExcluir.addEventListener("click", function (e) {
      e.stopPropagation();

      const temFiliais = Array.isArray(filiais) && filiais.length > 0;
      const mensagemConfirmacao = temFiliais
        ? "Tem certeza que deseja excluir esta empresa e todas as filiais vinculadas? Esta ação não poderá ser desfeita."
        : "Tem certeza que deseja excluir esta empresa? Esta ação não poderá ser desfeita.";

      const confirmado = window.confirm(mensagemConfirmacao);
      if (!confirmado) return;

      const sucesso = deleteCompanyAndRelated(empresa.id);
      if (!sucesso) {
        alert("Não foi possível excluir a empresa. Tente novamente.");
        return;
      }

      // Recarrega a listagem para refletir a remoção
      montarListaEmpresas(session);
    });

    actions.appendChild(btnExcluir);
  }

  const detalhes = document.createElement("div");
  detalhes.className = "empresa-detalhes";

  const linha1 = document.createElement("div");
  linha1.textContent = `Status: ${empresa.statusEmpresa}`;

  const linha2 = document.createElement("div");
  linha2.textContent = `E-Social: ${empresa.esocial ? "Sim" : "Não"}`;

  const linha3 = document.createElement("div");
  linha3.textContent = empresa.observacoes
    ? `Observações: ${empresa.observacoes}`
    : "Sem observações adicionais.";

  detalhes.appendChild(linha1);
  detalhes.appendChild(linha2);
  detalhes.appendChild(linha3);

  // Botões de Documentos com Status Individual
  const docButtons = criarBotoesDocumentos(empresa, session);
  detalhes.appendChild(docButtons);

  card.appendChild(header);
  card.appendChild(actions);
  card.appendChild(detalhes);

  /* Lógica de clique (Simples vs Duplo) */
  let clickTimeout = null;

  card.addEventListener("click", function (e) {
    // Atalho: ALT + clique abre edição
    if (e.altKey && session.perfil === "admin") {
      const params = new URLSearchParams({ id: empresa.id });
      window.location.href = "../cadastro/index.html?" + params.toString();
      return;
    }

    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      card.classList.toggle("expandida");
      card.classList.toggle("mostra-filial");
    } else {
      clickTimeout = setTimeout(function () {
        clickTimeout = null;
        if (!filiais || !filiais.length || !filiaisWrapper) return;
        const aberta = filiaisWrapper.classList.contains("aberta");
        if (aberta) {
          filiaisWrapper.classList.remove("aberta");
        } else {
          filiaisWrapper.classList.add("aberta");
        }
      }, 220);
    }
  });

  return card;
}

/**
 * Cria o card visual de uma FILIAL.
 */
function criarCardFilial(empresa, session) {
  const card = document.createElement("article");
  card.className = "empresa-card empresa-card-filial fade-in";

  const header = document.createElement("div");
  header.className = "empresa-header";

  const info = document.createElement("div");

  const nome = document.createElement("div");
  nome.className = "empresa-nome";
  nome.textContent = empresa.nome;

  const subinfo = document.createElement("div");
  subinfo.className = "empresa-subinfo";
  subinfo.textContent = `Filial · CNPJ: ${empresa.cnpj}`;

  info.appendChild(nome);
  info.appendChild(subinfo);

  // Status Geral (Pior caso)
  const statusInfo = calcularStatusGeralEmpresa(empresa);
  
  const badge = document.createElement("div");
  badge.className = `badge ${statusInfo.cssClass}`;

  const dot = document.createElement("span");
  dot.className = "badge-dot";

  const label = document.createElement("span");
  label.textContent = statusInfo.label;

  badge.appendChild(dot);
  badge.appendChild(label);

  header.appendChild(info);
  header.appendChild(badge);

  const detalhes = document.createElement("div");
  detalhes.className = "empresa-detalhes";

  const linha1 = document.createElement("div");
  linha1.textContent = `Status: ${empresa.statusEmpresa}`;

  const linha2 = document.createElement("div");
  linha2.textContent = `E-Social: ${empresa.esocial ? "Sim" : "Não"}`;

  const linha3 = document.createElement("div");
  linha3.textContent = empresa.observacoes
    ? `Observações: ${empresa.observacoes}`
    : "Sem observações adicionais.";

  detalhes.appendChild(linha1);
  detalhes.appendChild(linha2);
  detalhes.appendChild(linha3);

  // Botões de Documentos
  const docButtons = criarBotoesDocumentos(empresa, session);
  detalhes.appendChild(docButtons);

  card.appendChild(header);
  card.appendChild(detalhes);

  // Área de ações da filial (apenas para administradores)
  if (session.perfil === "admin") {
    const actions = document.createElement("div");
    actions.className = "empresa-actions";

    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "btn btn-danger";
    btnExcluir.textContent = "Excluir filial";

    btnExcluir.addEventListener("click", function (e) {
      e.stopPropagation();

      const confirmado = window.confirm(
        "Tem certeza que deseja excluir esta filial? Esta ação não poderá ser desfeita."
      );
      if (!confirmado) return;

      const sucesso = deleteCompanyAndRelated(empresa.id);
      if (!sucesso) {
        alert("Não foi possível excluir a filial. Tente novamente.");
        return;
      }

      // Recarrega a listagem para refletir a remoção
      montarListaEmpresas(session);
    });

    actions.appendChild(btnExcluir);
    card.appendChild(actions);
  }

  // Clique simples na FILIAL: mostra/oculta detalhes completos.
  card.addEventListener("click", function (e) {
    if (e.altKey && session.perfil === "admin") {
      const params = new URLSearchParams({ id: empresa.id });
      window.location.href = "../cadastro/index.html?" + params.toString();
      return;
    }
    card.classList.toggle("expandida");
  });

  return card;
}

/**
 * Função auxiliar para criar os botões de documentos (reusada em Matriz e Filial).
 */
function criarBotoesDocumentos(empresa, session) {
  const docButtons = document.createElement("div");
  docButtons.className = "empresa-doc-buttons";
  docButtons.style.display = "flex";
  docButtons.style.flexWrap = "wrap";
  docButtons.style.gap = "8px";

  const docs = empresa.documentos || {};
  
  ["pcmso", "ltcat", "pgr"].forEach((tipo) => {
    const doc = docs[tipo];
    
    // Grupo de botões e info
    const docWrapper = document.createElement("div");
    docWrapper.style.display = "flex";
    docWrapper.style.flexDirection = "column";
    docWrapper.style.gap = "4px";
    docWrapper.style.marginBottom = "8px";
    docWrapper.style.padding = "10px";
    docWrapper.style.border = "1px solid rgba(0,0,0,0.1)";
    docWrapper.style.borderRadius = "8px";
    docWrapper.style.backgroundColor = "rgba(0,0,0,0.02)";
    docWrapper.style.minWidth = "220px";

    const docTypeLabel = document.createElement("div");
    docTypeLabel.style.fontWeight = "bold";
    docTypeLabel.style.fontSize = "0.9rem";
    docTypeLabel.textContent = tipo.toUpperCase();
    
    // Calcula status para cor do label (se o documento existe)
    if (doc) {
        const dataFim = doc.dataTermino || empresa.dataTermino;
        const statusDoc = calcularStatusPorDataTermino(dataFim);
        if (statusDoc.status === "vencido") docTypeLabel.style.color = "#e74c3c";
        else if (statusDoc.status === "aviso") docTypeLabel.style.color = "#f1c40f";
    }

    docWrapper.appendChild(docTypeLabel);

    const docGroup = document.createElement("div");
    docGroup.className = "btn-group";
    docGroup.style.display = "inline-flex";
    docGroup.style.alignItems = "center";
    
    if (doc) {
        // Info do responsável
        const respInfo = document.createElement("div");
        respInfo.style.fontSize = "0.8rem";
        respInfo.style.color = "var(--text-muted)";
        const labelResp = tipo === "pcmso" ? "Médico coordenador" : "Responsável técnico";
        respInfo.textContent = `${labelResp}: ${doc.responsavel || "-"}`;
        docWrapper.appendChild(respInfo);

        // Calcula status individual deste documento
        const dataFim = doc.dataTermino || empresa.dataTermino; // Fallback
        const statusDoc = calcularStatusPorDataTermino(dataFim);
        
        // Define cor do texto/icone baseada no status
        let statusColor = ""; // Padrão
        if (statusDoc.status === "vencido") statusColor = "#e74c3c"; // Vermelho
        else if (statusDoc.status === "aviso") statusColor = "#f1c40f"; // Amarelo
        
        // 1. Botão de Visualizar
        const btnView = document.createElement("button");
        btnView.type = "button";
        btnView.className = "btn btn-secondary";
        
        // Mostra data de vencimento no tooltip
        const validadeTexto = dataFim ? `Vence em: ${formatDateToBR(dataFim)}` : "Sem data";
        btnView.title = `${doc.nomeArquivo || "PDF"} (${validadeTexto})`;
        
        // Texto do botão
        btnView.innerHTML = `Visualizar`;
        
        // Se for admin, remove bordas direitas
        if (session.perfil === "admin") {
            btnView.style.borderTopRightRadius = "0";
            btnView.style.borderBottomRightRadius = "0";
            btnView.style.borderRight = "1px solid rgba(255,255,255,0.2)";
        }

        btnView.addEventListener("click", function (e) {
          e.stopPropagation();
          abrirModalPdf(empresa.nome, tipo.toUpperCase(), doc.dataUrl, doc.nomeArquivo);
        });
        docGroup.appendChild(btnView);

        // 2. Botão de Excluir (Apenas Admin)
        if (session.perfil === "admin") {
            const btnDel = document.createElement("button");
            btnDel.type = "button";
            btnDel.className = "btn btn-danger";
            btnDel.textContent = "🗑";
            btnDel.title = "Excluir documento";
            
            btnDel.style.borderTopLeftRadius = "0";
            btnDel.style.borderBottomLeftRadius = "0";
            btnDel.style.paddingLeft = "8px";
            btnDel.style.paddingRight = "8px";

            btnDel.addEventListener("click", async function (e) {
                e.stopPropagation();
                if (!confirm(`Deseja realmente excluir o documento ${tipo.toUpperCase()}?`)) return;

                const novosDocs = { ...empresa.documentos };
                delete novosDocs[tipo];

                const resultado = await updateCompany(empresa.id, { documentos: novosDocs });
                if (resultado) {
                    montarListaEmpresas(session);
                } else {
                    alert("Erro ao excluir documento.");
                }
            });
            docGroup.appendChild(btnDel);
        }
    } else {
        // 3. Botão de Adicionar (Disponível para todos que podem criar)
        const btnAdd = document.createElement("button");
        btnAdd.type = "button";
        btnAdd.className = "btn";
        btnAdd.style.border = "1px dashed currentColor";
        btnAdd.style.opacity = "0.7";
        btnAdd.textContent = `Adicionar PDF`;
        btnAdd.title = "Adicionar documento faltando";
        
        btnAdd.addEventListener("click", function(e) {
            e.stopPropagation();
            const params = new URLSearchParams({ id: empresa.id });
            window.location.href = `../cadastro/index.html?${params.toString()}`;
        });
        docGroup.appendChild(btnAdd);
    }
    
    if (docGroup.children.length > 0) {
        docWrapper.appendChild(docGroup);
        docButtons.appendChild(docWrapper);
    }
  });
  
  return docButtons;
}

/**
 * Configura o comportamento básico do modal de PDF.
 */
function configurarModalPdf() {
  const modal = document.getElementById("pdf-modal");
  const closers = modal.querySelectorAll("[data-modal-close]");

  closers.forEach((el) => {
    el.addEventListener("click", function () {
      fecharModalPdf();
    });
  });
}

/**
 * Abre o modal com o PDF em iframe.
 */
function abrirModalPdf(empresaNome, tipoDoc, dataUrl, nomeArquivo) {
  const modal = document.getElementById("pdf-modal");
  const title = document.getElementById("pdf-modal-title");
  const subtitle = document.getElementById("pdf-modal-subtitle");
  const viewer = document.getElementById("pdf-viewer");

  title.textContent = `${tipoDoc} - ${empresaNome}`;
  subtitle.textContent = nomeArquivo || "";
  viewer.src = dataUrl || "";

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

/**
 * Fecha o modal de visualização de PDF.
 */
function fecharModalPdf() {
  const modal = document.getElementById("pdf-modal");
  const viewer = document.getElementById("pdf-viewer");

  viewer.src = "about:blank";
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
