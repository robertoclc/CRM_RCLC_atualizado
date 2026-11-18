# CRM RCLC — Documentação do sistema

## 1. Visão geral

O CRM RCLC é uma aplicação web local para organizar a prospecção comercial, acompanhar contatos com empresas e visualizar a evolução dos leads em um funil.

A interface é construída em HTML, estilizada com Tailwind CSS (carregado por CDN) e CSS próprio, e utiliza JavaScript no navegador. A biblioteca SheetJS (XLSX) é carregada por CDN para importar planilhas Excel e CSV.

## 2. Arquivos do projeto

| Arquivo | Responsabilidade |
|---|---|
| `CRM_RCLC.html` | Estrutura da página, botões, indicadores, filtros, Kanban, tabela, dashboard e formulário de prospecto. |
| `config.js` | Configuração central dos status e seus nomes exibidos no Kanban e em outras áreas. |
| `backup.js` | Leitura e gravação no `localStorage`, importação de Excel/CSV, exportação e restauração de backup JSON. |
| `app.js` | Estado da aplicação, filtros, indicadores, renderização das visualizações, cadastro, edição e exclusão de prospectos. |
| `script.js` | Funções auxiliares de orquestração e inicialização após o carregamento do documento. |
| `style.css` | Estilos próprios, controle de exibição das visualizações e dimensões do Kanban. |
| `README.md` | Esta documentação. |

A pasta `Backup` não estava presente no ZIP recebido. O pacote de atualização contém os seis arquivos de aplicação enviados e esta documentação; não contém a base real de prospectos do navegador.

## 3. Como abrir o CRM

1. Extraia os arquivos para uma pasta no computador.
2. Mantenha todos os arquivos na mesma pasta.
3. Abra `CRM_RCLC.html` no navegador (preferencialmente Chrome ou Edge).
4. É necessária conexão com a internet para carregar as bibliotecas externas usadas pela interface.

Não renomeie os arquivos sem também atualizar os caminhos dos scripts e da folha de estilos no HTML.

## 4. Fluxo de prospecção e status

Os status internos são mantidos para compatibilidade com os dados existentes. Os títulos apresentados na interface foram abreviados:

| Status interno armazenado | Nome exibido |
|---|---|
| `Novo prospect` | Novo Prospect |
| `Primeiro contato enviado` | 1º Contato |
| `Segundo contato enviado` | 2º Contato |
| `Terceiro contato enviado` | 3º Contato |
| `Em negociação` | Em Negociação |
| `Cliente conquistado` | Cliente Conquistado |
| `Sem contato` | Sem Contato |
| `Sem interesse` | Sem Interesse |

### 3º Contato

O status interno correto para a nova etapa é `Terceiro contato enviado`. Ele foi incluído na configuração do Kanban, no formulário de cadastro/edição e no reconhecimento de status durante a importação de planilhas.

**Atenção:** no HTML anterior, a opção visual “Terceiro contato enviado” usava por engano o valor `Sem contato`. Como esse valor era indistinguível de um registro realmente marcado como “Sem contato”, não é possível identificar automaticamente quais registros antigos foram classificados incorretamente. Confira manualmente os prospectos que deveriam estar no 3º Contato.

## 5. Cadastro e manutenção de prospectos

O formulário permite registrar ou editar nome da empresa, segmento ou contato, telefone/WhatsApp, status do funil, origem, valor estimado, cidade/bairro e observações/diagnóstico.

Os cartões do Kanban e as linhas da tabela permitem abrir a edição. A exclusão solicita confirmação.

## 6. Visualizações e indicadores

- **Kanban:** apresenta as etapas configuradas em `STATUS_CONFIG`, com paginação individual por coluna (10 prospectos por página).
- **Tabela:** lista os prospectos filtrados, também com paginação de 10 registros.
- **Dashboard:** apresenta a distribuição dos prospectos por status e os cinco segmentos mais frequentes.
- **Indicadores superiores:** total de prospectos, em negociação, clientes conquistados, taxa de conversão, sem contato e sem interesse.
- **Filtros:** pesquisa por empresa, segmento/contato ou telefone e filtro por origem.

A contagem dos cards do Kanban é calculada a partir do status interno do prospecto.

## 7. Importação de Excel e CSV

O botão **Importar Excel** aceita `.xlsx`, `.xls` e `.csv`. O sistema lê a primeira planilha e tenta identificar colunas de empresa, telefone, WhatsApp, segmento, origem e status.

A interpretação de status reconhece os termos e números referentes a 1º, 2º e 3º contato, além de Sem Contato, Sem Interesse, Em Negociação e Cliente Conquistado.

A importação substitui a lista atual quando a rotina de callback grava os dados importados. Faça um backup JSON antes de importar uma nova base.

## 8. Armazenamento local

Os prospectos são armazenados no `localStorage` do navegador, nas chaves:
- `rclc_crm_prospects`
- `prospects` (chave mantida por compatibilidade com versões anteriores).

O salvamento grava a mesma lista nas duas chaves. O carregamento tenta primeiro `prospects` e depois `rclc_crm_prospects`.

### Consequências importantes

- Os dados não ficam dentro do arquivo HTML nem dentro do ZIP do programa.
- Os dados pertencem ao perfil e à origem do navegador em que o CRM foi utilizado.
- Abrir o CRM em outro navegador, perfil ou computador não transfere automaticamente os prospectos.
- Limpar os dados do site/navegador pode apagar os prospectos.
- O ZIP do código-fonte não substitui o backup JSON dos dados.

## 9. Backup e restauração

### Fazer backup

1. Abra o CRM no navegador em que os prospectos estão cadastrados.
2. Clique em **Fazer Backup**.
3. O navegador fará o download de um arquivo `backup_crm_rclc_AAAA-MM-DD.json`.
4. Guarde uma cópia em local seguro, preferencialmente também em outro dispositivo ou serviço de armazenamento.

### Restaurar backup

1. Abra o CRM no navegador correto.
2. Clique em **Restaurar Backup**.
3. Selecione o arquivo `.json`.
4. Confira a quantidade indicada e confirme somente se deseja substituir os dados atuais.

A restauração substitui a lista atual. Faça um backup do estado atual antes de restaurar uma versão anterior.

## 10. Cuidados antes de atualizar o programa

1. Abra o CRM no navegador em que a base oficial está salva.
2. Clique em **Fazer Backup** e confirme que o arquivo JSON foi baixado.
3. Guarde também uma cópia da pasta atual do projeto.
4. Atualize os arquivos do programa sem limpar o armazenamento do navegador.
5. Reabra o CRM no mesmo navegador e perfil.
6. Confira o total de prospectos e alguns registros de cada etapa.
7. Faça um novo backup após validar a atualização.

Não utilize o botão **Limpar** como procedimento de manutenção. Ele apaga todos os prospectos armazenados.

## 11. Alterações desta versão

- Abreviação dos títulos de contato para `1º Contato`, `2º Contato` e `3º Contato`.
- Inclusão de `Terceiro contato enviado` em `STATUS_CONFIG`, tornando a etapa uma coluna do Kanban.
- Correção do valor da opção de terceiro contato no formulário HTML.
- Inclusão do status no controle de paginação do Kanban.
- Ajuste do mapeamento de status da importação Excel/CSV para reconhecer o terceiro contato.
- Preservação dos identificadores internos de primeiro e segundo contato para compatibilidade com os dados já armazenados.

## 12. Limitações e pontos para evolução

- O sistema usa armazenamento local do navegador, sem sincronização entre dispositivos.
- O backup é manual; recomenda-se criar uma rotina periódica de cópias JSON.
- Os scripts e bibliotecas externas são carregados por CDN e dependem de conexão com a internet.
- A planilha importada deve ter cabeçalhos claros para melhorar o reconhecimento das colunas.
- O ZIP fornecido não continha a base de dados real do navegador; por isso, a validação final dos totais deve ser feita no computador onde o CRM é utilizado.
