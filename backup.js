// ==========================================
// MÓDULO DE BACKUP E PERSISTÊNCIA (backup.js)
// ==========================================


// ==========================================
// ARMAZENAMENTO DA REFERÊNCIA DA PASTA DE BACKUP
// ==========================================

const BACKUP_DB_NAME = 'CRM_RCLC_Backup_Config';
const BACKUP_STORE_NAME = 'pastas';
const BACKUP_HANDLE_KEY = 'pasta_backup_rclc';

function abrirBancoBackup() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(BACKUP_DB_NAME, 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
                db.createObjectStore(BACKUP_STORE_NAME);
            }
        };

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

async function salvarReferenciaPasta(handle) {
    const db = await abrirBancoBackup();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(BACKUP_STORE_NAME, 'readwrite');

        transaction.objectStore(BACKUP_STORE_NAME).put(
            handle,
            BACKUP_HANDLE_KEY
        );

        transaction.oncomplete = function() {
            db.close();
            resolve(true);
        };

        transaction.onerror = function() {
            db.close();
            reject(transaction.error);
        };
    });
}

async function carregarReferenciaPasta() {
    const db = await abrirBancoBackup();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(BACKUP_STORE_NAME, 'readonly');

        const request = transaction
            .objectStore(BACKUP_STORE_NAME)
            .get(BACKUP_HANDLE_KEY);

        request.onsuccess = function() {
            db.close();
            resolve(request.result || null);
        };

        request.onerror = function() {
            db.close();
            reject(request.error);
        };
    });
}


// ==========================================
// PROTEÇÃO DA INICIALIZAÇÃO DO CRM
// ==========================================

let CRM_INICIALIZACAO_BLOQUEADA = false;
let CRM_MOTIVO_BLOQUEIO = '';


// ==========================================
// CARREGAMENTO SEGURO DOS PROSPECTS
// ==========================================

function loadProspectsData() {
    CRM_INICIALIZACAO_BLOQUEADA = false;
    CRM_MOTIVO_BLOQUEIO = '';

    const chaves = ['prospects', 'rclc_crm_prospects'];
    const basesValidas = [];

    chaves.forEach(chave => {
        try {
            const conteudo = localStorage.getItem(chave);

            if (conteudo === null) return;

            const dados = JSON.parse(conteudo);

            if (Array.isArray(dados)) {
                basesValidas.push({
                    chave,
                    dados
                });
            }
        } catch (erro) {
            console.error(`Erro ao ler a base ${chave}:`, erro);
        }
    });

    if (basesValidas.length === 0) {
        CRM_INICIALIZACAO_BLOQUEADA = true;
        CRM_MOTIVO_BLOQUEIO = 'Nenhuma base válida foi encontrada.';

        console.error(
            'INICIALIZAÇÃO BLOQUEADA: nenhuma base válida encontrada.'
        );

        alert(
            'ATENÇÃO: O CRM não conseguiu localizar uma base válida de dados.\n\n' +
            'Por segurança, a gravação de dados foi bloqueada.\n\n' +
            'NÃO importe planilhas, não limpe os dados e não tente cadastrar registros nesta abertura.\n\n' +
            'Verifique o backup antes de continuar.'
        );

        return [];
    }

    basesValidas.sort((a, b) => {
        if (b.dados.length !== a.dados.length) {
            return b.dados.length - a.dados.length;
        }

        if (a.chave === 'prospects') return -1;
        if (b.chave === 'prospects') return 1;

        return 0;
    });

    const baseEscolhida = basesValidas[0];

    if (baseEscolhida.dados.length === 0) {
        CRM_INICIALIZACAO_BLOQUEADA = true;
        CRM_MOTIVO_BLOQUEIO = 'As bases encontradas estão vazias.';

        console.error(
            'INICIALIZAÇÃO BLOQUEADA: as bases encontradas estão vazias.'
        );

        alert(
            'ATENÇÃO: As bases de dados encontradas estão vazias.\n\n' +
            'Por segurança, a gravação de dados foi bloqueada para evitar sobrescrever informações anteriores.\n\n' +
            'NÃO importe planilhas, não limpe os dados e não faça novos cadastros nesta abertura.\n\n' +
            'Verifique o backup antes de continuar.'
        );

        return [];
    }

    console.info(
        `CRM carregado: ${baseEscolhida.dados.length} prospects. Origem: ${baseEscolhida.chave}`
    );

    return baseEscolhida.dados;
}


// ==========================================
// GRAVAÇÃO SEGURA NAS DUAS CHAVES
// ==========================================

function saveProspectsData(prospectsArray, permitirRecuperacao = false) {

    if (CRM_INICIALIZACAO_BLOQUEADA && !permitirRecuperacao) {
        const mensagem =
            'GRAVAÇÃO BLOQUEADA POR SEGURANÇA.\n\n' +
            CRM_MOTIVO_BLOQUEIO +
            '\n\nOs dados existentes não foram substituídos.\n\n' +
            'Verifique o backup e utilize a restauração de backup para recuperar os registros.';

        console.error(mensagem);
        alert(mensagem);

        throw new Error(
            'Gravação impedida porque a inicialização do CRM foi bloqueada.'
        );
    }

    if (!Array.isArray(prospectsArray)) {
        throw new Error('Os dados enviados para gravação não são válidos.');
    }

    const dadosJSON = JSON.stringify(prospectsArray);

    if (!dadosJSON || dadosJSON === 'null') {
        throw new Error('Não foi possível preparar os dados para gravação.');
    }

    if (permitirRecuperacao && prospectsArray.length === 0) {
        throw new Error(
            'A restauração foi impedida porque o arquivo está vazio.'
        );
    }

    try {
        localStorage.setItem('prospects', dadosJSON);
        localStorage.setItem('rclc_crm_prospects', dadosJSON);

        if (permitirRecuperacao) {
            CRM_INICIALIZACAO_BLOQUEADA = false;
            CRM_MOTIVO_BLOQUEIO = '';
        }

        console.info(`Dados salvos: ${prospectsArray.length} prospects.`);

        return true;

    } catch (erro) {
        console.error('Erro ao salvar os dados do CRM:', erro);

        alert(
            'ATENÇÃO: não foi possível salvar os dados do CRM.\n\n' +
            'Não feche o navegador antes de verificar o problema.\n\n' +
            'Erro: ' + erro.message
        );

        throw erro;
    }
}


// ==========================================
// FUNÇÕES AUXILIARES PARA IMPORTAÇÃO
// ==========================================

function normalizarCabecalhoExcel(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}


function obterValorColunaExcel(registro, aliases) {
    const chaves = Object.keys(registro);
    const aliasesNormalizados = aliases.map(normalizarCabecalhoExcel);

    for (const alias of aliasesNormalizados) {
        const chaveEncontrada = chaves.find(chave => {
            return normalizarCabecalhoExcel(chave) === alias;
        });

        if (chaveEncontrada !== undefined) {
            const valor = registro[chaveEncontrada];

            if (
                valor !== undefined &&
                valor !== null &&
                String(valor).trim() !== ''
            ) {
                return valor;
            }
        }
    }

    return '';
}


function formatarDataBR(dataBruta) {
    if (
        dataBruta === undefined ||
        dataBruta === null ||
        String(dataBruta).trim() === ''
    ) {
        return '';
    }

    if (dataBruta instanceof Date && !isNaN(dataBruta.getTime())) {
        return [
            String(dataBruta.getDate()).padStart(2, '0'),
            String(dataBruta.getMonth() + 1).padStart(2, '0'),
            dataBruta.getFullYear()
        ].join('/');
    }

    const str = String(dataBruta).trim();

    const dataBR = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (dataBR) {
        return (
            String(dataBR[1]).padStart(2, '0') + '/' +
            String(dataBR[2]).padStart(2, '0') + '/' +
            dataBR[3]
        );
    }

    const dataISO = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

    if (dataISO) {
        return (
            String(dataISO[3]).padStart(2, '0') + '/' +
            String(dataISO[2]).padStart(2, '0') + '/' +
            dataISO[1]
        );
    }

    const data = new Date(dataBruta);

    if (!isNaN(data.getTime())) {
        return [
            String(data.getDate()).padStart(2, '0'),
            String(data.getMonth() + 1).padStart(2, '0'),
            data.getFullYear()
        ].join('/');
    }

    return str;
}


function identificarLinkWhatsApp(valor) {
    const texto = String(valor || '').trim();

    if (!texto) return '';

    const textoMinusculo = texto.toLowerCase();

    if (
        textoMinusculo.includes('wa.me/') ||
        textoMinusculo.includes('whatsapp.com/') ||
        textoMinusculo.includes('api.whatsapp.com/')
    ) {
        try {
            const url = new URL(
                texto.match(/^https?:\/\//i) ? texto : `https://${texto}`
            );

            const host = url.hostname.toLowerCase();

            const hostsValidos = [
                'wa.me',
                'www.wa.me',
                'whatsapp.com',
                'www.whatsapp.com',
                'api.whatsapp.com'
            ];

            if (hostsValidos.includes(host)) {
                return url.href;
            }
        } catch (erro) {
            return '';
        }
    }

    return '';
}


function normalizarTelefoneImportado(valor) {
    return String(valor || '').trim();
}


function converterStatusImportado(statusBruto) {
    const status = normalizarCabecalhoExcel(statusBruto);

    if (!status) {
        return 'Novo prospect';
    }

    if (
        status.includes('seminteresse') ||
        status.includes('naoteminteresse')
    ) {
        return 'Sem interesse';
    }

    if (
        status.includes('avaliandoproposta') ||
        status.includes('negociacao') ||
        status.includes('respondeu') ||
        status.includes('emnegociacao')
    ) {
        return 'Em negociação';
    }

    if (
        status.includes('conquistado') ||
        status.includes('cliente') ||
        status.includes('convertido')
    ) {
        return 'Cliente conquistado';
    }

    if (
        status.includes('semcontato') ||
        status === 'naocontatado'
    ) {
        return 'Sem contato';
    }

    if (
        status.includes('terceirocontato') ||
        status.includes('terceiramensagem') ||
        status.includes('3ocontato') ||
        status.includes('3ocont') ||
        status.startsWith('3o') ||
        status.startsWith('3a')
    ) {
        return 'Terceiro contato enviado';
    }

    if (
        status.includes('segundocontato') ||
        status.includes('segundamensagem') ||
        status.includes('2amensagem') ||
        status.includes('2ocontato') ||
        status.includes('2ocont') ||
        status.startsWith('2o') ||
        status.startsWith('2a')
    ) {
        return 'Segundo contato enviado';
    }

    if (
        status.includes('primeirocontato') ||
        status.includes('primeiramensagem') ||
        status.includes('semrespostaprimeirocontato') ||
        status.includes('zapcomprimeirocontato') ||
        status.includes('1ocontato') ||
        status.includes('1ocont') ||
        status.startsWith('1o') ||
        status.startsWith('1a')
    ) {
        return 'Primeiro contato enviado';
    }

    if (
        status.includes('novoprospect') ||
        status === 'novo'
    ) {
        return 'Novo prospect';
    }

    return 'Novo prospect';
}


// ==========================================
// IMPORTAÇÃO DE PLANILHAS EXCEL
// ==========================================

function importExcel(event, callback) {
    const file = event.target.files[0];

    if (!file) return;

    const statusBox = document.getElementById('importStatus');
    const statusText = document.getElementById('importStatusText');
    const statusCount = document.getElementById('importCount');

    if (statusBox) statusBox.classList.remove('hidden');

    if (statusText) {
        statusText.innerText = 'A processar ficheiro Excel...';
    }

    if (statusCount) {
        statusCount.innerText = 'A ler colunas, datas e dados do WhatsApp...';
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);

            const workbook = XLSX.read(data, {
                type: 'array',
                cellText: true,
                cellDates: true
            });

            const firstSheet = workbook.SheetNames[0];

            if (!firstSheet) {
                throw new Error('A planilha não possui uma aba válida.');
            }

            const rows = XLSX.utils.sheet_to_json(
                workbook.Sheets[firstSheet],
                {
                    raw: false,
                    defval: ''
                }
            );

            const validRows = rows.filter(registro => {
                return Object.values(registro).some(valor => {
                    return (
                        valor !== undefined &&
                        valor !== null &&
                        String(valor).trim() !== ''
                    );
                });
            });

            if (validRows.length === 0) {
                if (statusBox) {
                    statusBox.classList.add('hidden');
                }

                alert('O ficheiro Excel parece estar vazio.');
                return;
            }

            const mappedRows = validRows.map((registro, index) => {
                const notesList = [];

                const empresa = obterValorColunaExcel(registro, [
                    'Nome da empresa',
                    'Empresa',
                    'Nome',
                    'Nome fantasia'
                ]);

                let telefone = normalizarTelefoneImportado(
                    obterValorColunaExcel(registro, [
                        'Telefone',
                        'Telefone celular',
                        'Celular',
                        'Número',
                        'Número de telefone',
                        'WhatsApp'
                    ])
                );

                const valorLinkWhats = obterValorColunaExcel(registro, [
                    'Link Whats',
                    'Link WhatsApp',
                    'URL Whats',
                    'URL WhatsApp',
                    'API Whats'
                ]);

                let whatsappLink = identificarLinkWhatsApp(valorLinkWhats);

                // Se a coluna Link Whats contiver apenas um número,
                // utiliza esse número como telefone, caso esteja vazio.
                if (
                    !telefone &&
                    valorLinkWhats &&
                    !whatsappLink
                ) {
                    const possivelTelefone = String(valorLinkWhats).trim();

                    const somenteNumeros = possivelTelefone.replace(/\D/g, '');

                    if (
                        somenteNumeros.length >= 10 &&
                        somenteNumeros.length <= 13
                    ) {
                        telefone = possivelTelefone;
                    }
                }

                const segmento = obterValorColunaExcel(registro, [
                    'Segmento',
                    'Ramo',
                    'Categoria',
                    'Atividade'
                ]);

                const statusBruto = obterValorColunaExcel(registro, [
                    'Status de verificação',
                    'Status verificacao',
                    'Status',
                    'Situação',
                    'Situacao'
                ]);

                const origem = obterValorColunaExcel(registro, [
                    'Origem',
                    'Fonte'
                ]);

                const valor1o = formatarDataBR(
                    obterValorColunaExcel(registro, [
                        '1o. Envio',
                        '1o Envio',
                        '1º Envio',
                        '1o envio',
                        'Primeiro envio',
                        'Data primeiro envio',
                        'DT ENVIO'
                    ])
                );

                const valor2o = formatarDataBR(
                    obterValorColunaExcel(registro, [
                        '2o. ENVIO',
                        '2o ENVIO',
                        '2º Envio',
                        '2o envio',
                        'Segundo envio',
                        'Data segundo envio'
                    ])
                );

                const valor3o = formatarDataBR(
                    obterValorColunaExcel(registro, [
                        '3o. ENVIO',
                        '3o ENVIO',
                        '3º Envio',
                        '3o envio',
                        'Terceiro envio',
                        'Data terceiro envio'
                    ])
                );

                const valorRetorno = formatarDataBR(
                    obterValorColunaExcel(registro, [
                        'Dt Retorno',
                        'Data Retorno',
                        'Data de Retorno',
                        'Retorno'
                    ])
                );

                if (valor1o) {
                    notesList.push(`1º Envio: ${valor1o}`);
                }

                if (valor2o) {
                    notesList.push(`2º Envio: ${valor2o}`);
                }

                if (valor3o) {
                    notesList.push(`3º Envio: ${valor3o}`);
                }

                if (valorRetorno) {
                    notesList.push(`Retorno: ${valorRetorno}`);
                }

                // Registra informações adicionais que não fazem parte
                // dos campos principais da importação.
                const cabecalhosReconhecidos = [
                    'nomedaempresa',
                    'empresa',
                    'nome',
                    'nomefantasia',
                    'telefone',
                    'telefonecelular',
                    'celular',
                    'numero',
                    'numerodetelefone',
                    'whatsapp',
                    'linkwhats',
                    'linkwhatsapp',
                    'urlwhats',
                    'urlwhatsapp',
                    'apiwhats',
                    'segmento',
                    'ramo',
                    'categoria',
                    'atividade',
                    'statusdeverificacao',
                    'statusverificacao',
                    'status',
                    'situacao',
                    'origem',
                    'fonte',
                    '1oenvio',
                    '1envio',
                    'primeiroenvio',
                    'dataprimeiroenvio',
                    'dtenvio',
                    '2oenvio',
                    '2envio',
                    'segundoenvio',
                    'datasegundoenvio',
                    '3oenvio',
                    '3envio',
                    'terceiroenvio',
                    'dataterceiroenvio',
                    'dtretorno',
                    'dataretorno',
                    'dataderetorno',
                    'retorno',
                    'valor'
                ];

                Object.keys(registro).forEach(chave => {
                    const valor = registro[chave];

                    if (
                        valor === undefined ||
                        valor === null ||
                        String(valor).trim() === ''
                    ) {
                        return;
                    }

                    const chaveNormalizada = normalizarCabecalhoExcel(chave);

                    if (!cabecalhosReconhecidos.includes(chaveNormalizada)) {
                        notesList.push(`${chave}: ${String(valor).trim()}`);
                    }
                });

                const statusConvertido = converterStatusImportado(statusBruto);

                if (
                    statusBruto &&
                    statusConvertido === 'Novo prospect' &&
                    normalizarCabecalhoExcel(statusBruto) !== 'novo' &&
                    normalizarCabecalhoExcel(statusBruto) !== 'novoprospect'
                ) {
                    notesList.push(`Status original: ${String(statusBruto).trim()}`);
                }

                const valorImportado = obterValorColunaExcel(registro, [
                    'Valor',
                    'Valor estimado',
                    'Valor potencial'
                ]);

                const valorNumerico = parseFloat(
                    String(valorImportado || '0')
                        .replace(/\./g, '')
                        .replace(',', '.')
                ) || 0;

                const lastContact =
                    valorRetorno ||
                    valor3o ||
                    valor2o ||
                    valor1o ||
                    '';

                return {
                    id: registro.id || (Date.now() + index),
                    name: String(empresa || 'Empresa Sem Nome').trim(),
                    company: String(segmento || 'Geral').trim(),
                    phone: telefone,
                    whatsappLink: whatsappLink,
                    origin: String(origem || 'Google Maps').trim(),
                    value: valorNumerico,
                    status: statusConvertido,
                    lastContact: lastContact,
                    notes: notesList.join(' | ')
                };
            });

            if (statusText) {
                statusText.innerText = 'Leitura da planilha concluída!';
            }

            if (statusCount) {
                statusCount.innerText =
                    `${mappedRows.length} registros preparados para importação.`;
            }

            setTimeout(() => {
                if (statusBox) {
                    statusBox.classList.add('hidden');
                }
            }, 3500);

            // A função apenas entrega os registros ao app.js.
            // A inclusão e complementação serão tratadas no controlador.
            callback(mappedRows);

        } catch (err) {
            console.error('Erro ao importar Excel:', err);

            if (statusBox) {
                statusBox.classList.add('hidden');
            }

            alert('Erro ao ler o ficheiro Excel: ' + err.message);

        } finally {
            event.target.value = '';
        }
    };

    reader.onerror = function() {
        if (statusBox) {
            statusBox.classList.add('hidden');
        }

        alert('Não foi possível ler o arquivo selecionado.');
        event.target.value = '';
    };

    reader.readAsArrayBuffer(file);
}


// ==========================================
// CRIAÇÃO DO ARQUIVO DE BACKUP
// ==========================================

async function exportJSON(prospectsArray) {
    if (!Array.isArray(prospectsArray) || prospectsArray.length === 0) {
        alert(
            'O backup foi cancelado porque os dados do CRM estão vazios ou inválidos.\n\n' +
            'Verifique os registros antes de continuar.'
        );

        return;
    }

    if (!window.showDirectoryPicker) {
        alert(
            'Seu navegador não oferece suporte à gravação direta na pasta de backup.\n\n' +
            'Utilize o Chrome ou Edge atualizado.'
        );

        return;
    }

    try {
        let pastaBackup = null;

        try {
            const pastaSalva = await carregarReferenciaPasta();

            if (pastaSalva) {
                let permissao = await pastaSalva.queryPermission({
                    mode: 'readwrite'
                });

                if (permissao !== 'granted') {
                    permissao = await pastaSalva.requestPermission({
                        mode: 'readwrite'
                    });
                }

                if (permissao === 'granted') {
                    pastaBackup = pastaSalva;
                }
            }

        } catch (erroMemoria) {
            console.warn(
                'Não foi possível recuperar a pasta anterior:',
                erroMemoria
            );
        }

        if (!pastaBackup) {
            alert(
                'Na primeira utilização, selecione a pasta CRM_RCLC_atualizado.\n\n' +
                'O sistema criará ou localizará a subpasta backup e guardará essa referência para os próximos backups.'
            );

            const pastaPrincipal = await window.showDirectoryPicker({
                mode: 'readwrite'
            });

            pastaBackup = await pastaPrincipal.getDirectoryHandle(
                'backup',
                { create: true }
            );

            await salvarReferenciaPasta(pastaBackup);
        }

        const agora = new Date();

        const dataArquivo =
            agora.getFullYear() + '-' +
            String(agora.getMonth() + 1).padStart(2, '0') + '-' +
            String(agora.getDate()).padStart(2, '0') + '_' +
            String(agora.getHours()).padStart(2, '0') + '-' +
            String(agora.getMinutes()).padStart(2, '0') + '-' +
            String(agora.getSeconds()).padStart(2, '0');

        const nomeArquivo = `backup_crm_rclc_${dataArquivo}.json`;
        const conteudo = JSON.stringify(prospectsArray, null, 2);

        const arquivo = await pastaBackup.getFileHandle(
            nomeArquivo,
            { create: true }
        );

        const gravador = await arquivo.createWritable();

        await gravador.write(conteudo);
        await gravador.close();

        alert(
            'BACKUP REALIZADO COM SUCESSO!\n\n' +
            `Arquivo: ${nomeArquivo}\n\n` +
            'Local: CRM_RCLC_atualizado\\backup\n\n' +
            `Total de prospects: ${prospectsArray.length}`
        );

        console.info(
            `Backup salvo na pasta backup: ${nomeArquivo}`
        );

    } catch (erro) {
        if (erro.name === 'AbortError') {
            console.info('Seleção da pasta de backup cancelada.');
            return;
        }

        console.error('Erro ao criar backup:', erro);

        alert(
            'Não foi possível salvar o backup.\n\n' +
            'Nenhum registro do CRM foi apagado por esta operação.\n\n' +
            'Erro: ' + erro.message
        );
    }
}


// ==========================================
// IMPORTAÇÃO DE BACKUP JSON
// ==========================================

function importJSON(event, callback) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (!Array.isArray(importedData)) {
                alert('O ficheiro de backup não é válido.');
                return;
            }

            if (importedData.length === 0) {
                alert(
                    'O arquivo de backup está vazio.\n\n' +
                    'A restauração foi cancelada para proteger os dados atuais.'
                );

                return;
            }

            const registrosValidos = importedData.every(item => {
                return (
                    item &&
                    typeof item === 'object' &&
                    !Array.isArray(item) &&
                    item.id !== undefined &&
                    item.name !== undefined
                );
            });

            if (!registrosValidos) {
                alert(
                    'O arquivo contém registros em formato inválido.\n\n' +
                    'A restauração foi cancelada.'
                );

                return;
            }

            callback(importedData);

        } catch (error) {
            console.error('Erro ao ler o backup:', error);

            alert(
                'Erro ao ler o ficheiro JSON. O arquivo pode estar danificado.'
            );

        } finally {
            event.target.value = '';
        }
    };

    reader.onerror = function() {
        alert('Não foi possível ler o arquivo selecionado.');
        event.target.value = '';
    };

    reader.readAsText(file, 'UTF-8');
}


// ==========================================
// RESTAURAÇÃO DO BACKUP
// ==========================================

function handleRestoreBackup(event) {
    importJSON(event, (importedData) => {
        const confirmar = confirm(
            `Deseja restaurar ${importedData.length} prospects do arquivo de backup?\n\n` +
            'Os dados atuais serão substituídos.\n\n' +
            'Certifique-se de que já possui um backup atualizado antes de continuar.'
        );

        if (!confirmar) return;

        try {
            saveProspectsData(importedData, true);

            prospects = importedData;

            if (typeof currentTablePage !== 'undefined') {
                currentTablePage = 1;
            }

            if (typeof currentPages !== 'undefined') {
                Object.keys(currentPages).forEach(status => {
                    currentPages[status] = 1;
                });
            }

            renderApp();

            alert(
                'Backup restaurado com sucesso!\n\n' +
                `Total de prospects: ${importedData.length}`
            );

        } catch (erro) {
            console.error('Erro durante a restauração:', erro);

            alert(
                'Não foi possível concluir a restauração.\n\n' +
                'Verifique o armazenamento do navegador antes de tentar novamente.'
            );
        }
    });
}