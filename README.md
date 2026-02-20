# Sistema de Controle de Documentos Ocupacionais (SCDO)

Uma plataforma robusta para gestão e monitoramento de documentos de saúde e segurança do trabalho (PCMSO, LTCAT, PGR). O sistema oferece alertas automáticos de vencimento, controle de acesso por perfil e suporte completo a dispositivos móveis.

## 🚀 Tecnologias Utilizadas

### Frontend
- **HTML5 & CSS3 Moderno**: Utilização de variáveis CSS (Custom Properties) para suporte nativo a temas (Dark/Light Mode), CSS Grid e Flexbox para layouts complexos e responsivos.
- **Vanilla JavaScript (ES6+)**: Implementação de lógica modular sem dependência de frameworks pesados, garantindo performance excepcional e facilidade de manutenção.
- **Responsividade Mobile-First**: Sistema adaptável com navegação lateral dinâmica e tabelas otimizadas para telas pequenas.

### Backend & Infraestrutura (BaaS)
- **Supabase**: Utilizado como infraestrutura backend principal, provendo:
  - **PostgreSQL**: Banco de dados relacional para armazenamento de perfis e dados de empresas.
  - **Supabase Auth**: Sistema de autenticação seguro com JWT e proteção de rotas.
  - **Supabase Storage**: Armazenamento em nuvem para arquivos PDF dos documentos ocupacionais.
  - **Edge Functions & RPC**: Funções no lado do servidor (Postgres Functions) para operações administrativas seguras que exigem privilégios elevados.

## 🛠️ Funcionalidades Principais

- **Dashboard Inteligente**: Visão geral de documentos vencidos, a vencer (próximos 90 dias) e estatísticas gerais.
- **Gestão de Empresas e Filiais**: Estrutura hierárquica para organizar matrizes e suas respectivas unidades.
- **Controle de Vencimentos**: Alertas visuais automáticos baseados na validade dos documentos.
- **Histórico de Documentos**: Explorador de arquivos organizado por ano e unidade.
- **Gestão de Usuários**: Níveis de acesso distintos (Administrador vs. Usuário Padrão) com controle de permissões RPC.
- **Dark/Light Mode**: Interface personalizável com persistência de preferência via LocalStorage.

## 📂 Estrutura do Projeto

- `/assets`: Recursos compartilhados (CSS global, lógica de autenticação, temas e utilitários).
- `/cadastro`: Módulo de inserção e edição de empresas e documentos.
- `/dashboard`: Painel principal com indicadores e alertas.
- `/visualizar`: Listagem detalhada e visualização de PDFs.
- `/historico`: Arquivo digital de documentos antigos.
- `/controle`: Relatórios e filtros por período.
- `/usuarios`: Área administrativa para gestão de contas.

## 🔐 Segurança

O sistema implementa múltiplas camadas de segurança:
1. **Row Level Security (RLS)**: Políticas no banco de dados que garantem que usuários acessem apenas o que lhes é permitido.
2. **Security Definer Functions**: Operações críticas (como exclusão de usuários) são realizadas através de funções RPC que validam o perfil do solicitante no lado do servidor.
3. **Persistência Segura**: Tokens de sessão gerenciados via Supabase Auth.

---
Desenvolvido com foco em eficiência, escalabilidade e experiência do usuário.
