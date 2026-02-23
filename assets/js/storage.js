/*
  Sistema de Controle de Documentos Ocupacionais
  Arquivo: assets/js/storage.js
  
  MIGRAÇÃO SUPABASE:
  - Substitui LocalStorage por chamadas ao Supabase Database.
  - Funções assíncronas (async/await) agora são obrigatórias.
  
  Tabela: 'empresas'
*/

/**
 * Busca todas as empresas cadastradas no Supabase.
 * Retorna um array de objetos.
 */
async function getCompanies() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error("Erro ao buscar empresas:", error);
    return [];
  }
  
  // Normaliza o campo 'id' se necessário (Supabase usa UUID, que é string também)
  return (data || []).map(mapSnakeToCamel);
}

/**
 * Adiciona uma nova empresa/filial ao Supabase.
 */
async function addCompany(companyData) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('empresas')
    .insert([{
      tipo: companyData.tipo || "principal",
      parent_company_id: companyData.parentCompanyId || null,
      nome: companyData.nome,
      cnpj: companyData.cnpj,
      status_empresa: companyData.statusEmpresa,
      data_inicio: companyData.dataInicio,
      data_termino: companyData.dataTermino,
      esocial: !!companyData.esocial,
      medico_coordenador: companyData.medicoCoordenador,
      observacoes: companyData.observacoes || "",
      documentos: companyData.documentos || {}
    }])
    .select()
    .single();

  if (error) {
    console.error("Erro ao adicionar empresa:", error);
    return null;
  }

  // Mapeia de volta para o formato esperado pelo frontend (camelCase)
  return mapSnakeToCamel(data);
}

/**
 * Atualiza uma empresa/filial existente.
 */
async function updateCompany(id, partialData) {
  if (!supabase) return null;

  // Prepara objeto para update (converte camelCase para snake_case se necessário)
  const updatePayload = {};
  if (partialData.nome) updatePayload.nome = partialData.nome;
  if (partialData.cnpj) updatePayload.cnpj = partialData.cnpj;
  if (partialData.statusEmpresa) updatePayload.status_empresa = partialData.statusEmpresa;
  if (partialData.dataInicio) updatePayload.data_inicio = partialData.dataInicio;
  if (partialData.dataTermino) updatePayload.data_termino = partialData.dataTermino;
  if (partialData.esocial !== undefined) updatePayload.esocial = partialData.esocial;
  if (partialData.medicoCoordenador) updatePayload.medico_coordenador = partialData.medicoCoordenador;
  if (partialData.observacoes) updatePayload.observacoes = partialData.observacoes;
  if (partialData.documentos) updatePayload.documentos = partialData.documentos;
  
  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('empresas')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar empresa:", error);
    return null;
  }

  return mapSnakeToCamel(data);
}

/**
 * Busca uma empresa específica pelo ID.
 */
async function getCompanyById(id) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("Erro ao buscar empresa por ID:", error);
    return null;
  }

  return mapSnakeToCamel(data);
}

/**
 * Remove uma empresa e, se for matriz, suas filiais.
 * No Supabase, se configurarmos 'ON DELETE CASCADE' na FK,
 * remover a matriz já remove as filiais automaticamente.
 */
async function deleteCompanyAndRelated(id) {
  if (!supabase) return false;

  const { error } = await supabase
    .from('empresas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Erro ao deletar empresa:", error);
    return false;
  }

  return true;
}

/**
 * Retorna a árvore de empresas (Matriz -> Filiais).
 * Faz uma única query e processa no cliente.
 */
async function getCompanyTree() {
  // getCompanies agora já retorna os dados normalizados (camelCase)
  const normalized = await getCompanies();

  const principals = normalized.filter((c) => c.tipo === "principal");
  const filiais = normalized.filter((c) => c.tipo === "filial");

  return principals.map((principal) => ({
    principal,
    filiais: filiais.filter((f) => f.parentCompanyId === principal.id),
  }));
}

/**
 * Salva um registro na tabela historico_arquivos.
 * Deve ser chamado ao salvar um documento.
 */
async function saveToHistory(dados) {
  if (!supabase) return null;
  
  const payload = {
    empresa_nome: dados.nomeUnidade,       // Nome da unidade (Matriz ou Filial)
    empresa_cnpj: dados.cnpj,
    tipo_empresa: dados.tipo,              // 'principal' ou 'filial'
    nome_grupo: dados.nomeGrupo,           // Nome da Matriz (para agrupar)
    
    tipo_documento: dados.tipoDoc,         // 'PCMSO', etc.
    ano_referencia: dados.ano,
    nome_arquivo: dados.nomeArquivo,
    url_arquivo: dados.url,
    
    usuario_responsavel: dados.usuario || null
  };

  const { error } = await supabase
    .from('historico_arquivos')
    .insert([payload]);

  if (error) {
    console.error("Erro ao salvar histórico:", error);
    return false;
  }
  return true;
}

/**
 * Busca e estrutura a árvore de histórico a partir da tabela historico_arquivos.
 * Substitui a lógica antiga que dependía da existência da empresa.
 */
async function getHistoryTree() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('historico_arquivos')
    .select('*')
    .order('nome_grupo', { ascending: true }); // Ordena pelo grupo (Matriz)

  if (error) {
    console.error("Erro ao buscar histórico:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Agrupamento manual:
  // Estrutura desejada: [ { principal: {nome: "Grupo X"}, filiais: [ {nome: "Unidade A", documentos: [...]}, ... ] } ]
  
  const gruposMap = {}; // Chave: nome_grupo

  data.forEach(item => {
    const grupoNome = item.nome_grupo || item.empresa_nome; // Fallback
    
    if (!gruposMap[grupoNome]) {
      gruposMap[grupoNome] = {
        principal: { nome: grupoNome, documentos: {} }, // Mock do objeto principal
        unidadesMap: {} // Mapa temporário de unidades dentro do grupo
      };
    }
    
    // Identifica a unidade (pode ser a própria matriz ou uma filial)
    const unidadeNome = item.empresa_nome;
    const isMatriz = (item.tipo_empresa === 'principal');
    
    let unidadeRef;
    
    if (isMatriz) {
      // Se o registro é da matriz, associamos à "principal" do grupo
      unidadeRef = gruposMap[grupoNome].principal;
    } else {
      // Se é filial, cria entrada no mapa de unidades se não existir
      if (!gruposMap[grupoNome].unidadesMap[unidadeNome]) {
        gruposMap[grupoNome].unidadesMap[unidadeNome] = {
          nome: unidadeNome,
          tipo: 'filial',
          documentos: {}
        };
      }
      unidadeRef = gruposMap[grupoNome].unidadesMap[unidadeNome];
    }
    
    // Adiciona o documento na estrutura da unidade
    const tipoDocKey = item.tipo_documento.toLowerCase();
    
    // A estrutura de documentos esperada pelo frontend é:
    // documentos: { "pcmso": { ... }, "ltcat": { ... } }
    // Mas aqui temos MÚLTIPLOS documentos do mesmo tipo (histórico).
    // O frontend atual (historico.js) agrupa por ANO.
    // Vamos adaptar: O frontend espera `documentos[tipo]` com um único objeto?
    // Não, `historico.js` chama `agruparDocumentosPorAno(empresa)`.
    // Lá ele itera sobre `["pcmso", "ltcat", "pgr"]` e pega `docs[tipo]`.
    // Isso é um problema: O código original suportava APENAS 1 documento por tipo (o atual).
    // O histórico DEVE suportar múltiplos.
    // SOLUÇÃO: Vamos retornar uma estrutura diferente e adaptar o historico.js também.
    // Ou, para minimizar mudanças, vamos simular que cada entrada no histórico é um "doc" num array.
    
    if (!unidadeRef.listaDocsHistorico) {
        unidadeRef.listaDocsHistorico = [];
    }
    
    unidadeRef.listaDocsHistorico.push({
        tipoDoc: item.tipo_documento,
        nomeArquivo: item.nome_arquivo,
        url: item.url_arquivo,
        ano: item.ano_referencia,
        dataUpload: item.created_at
    });
  });

  // Converte o mapa em array
  return Object.values(gruposMap).map(grupo => {
    // Converte o mapa de unidades (filiais) em array
    const filiaisArray = Object.values(grupo.unidadesMap);
    return {
      principal: grupo.principal,
      filiais: filiaisArray
    };
  });
}

// Utilitário para converter snake_case do banco para camelCase do JS
function mapSnakeToCamel(data) {
  if (!data) return null;
  return {
    id: data.id,
    tipo: data.tipo,
    parentCompanyId: data.parent_company_id,
    nome: data.nome,
    cnpj: data.cnpj,
    statusEmpresa: data.status_empresa,
    dataInicio: data.data_inicio,
    dataTermino: data.data_termino,
    esocial: data.esocial,
    medicoCoordenador: data.medico_coordenador,
    observacoes: data.observacoes,
    documentos: data.documentos, // JSONB já vem como objeto
    criadoEm: data.created_at,
    atualizadoEm: data.updated_at
  };
}
