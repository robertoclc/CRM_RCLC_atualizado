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

// Se as bases não puderem ser carregadas, o CRM ficará
// bloqueado para gravações até uma restauração válida.

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

    // Nenhuma base válida: impede que o CRM grave uma base vazia.
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

    // Seleciona a base com maior quantidade de registros.
    basesValidas.sort((a, b) => {
        if (b.dados.length !== a.dados.length) {
            return b.dados.length - a.dados.length;
        }

        if (a.chave === 'prospects') return -1;
        if (b.chave === 'prospects') return 1;

        return 0;
    });

    const baseEscolhida = basesValidas[0];

    // Se todas as bases válidas estiverem vazias, bloqueia a gravação.
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

    // Impede gravações quando a inicialização detectou
    // ausência de dados ou bases vazias.
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

    // Não permite salvar uma lista vazia como recuperação.
    if (permitirRecuperacao && prospectsArray.length === 0) {
        throw new Error(
            'A restauração foi impedida porque o arquivo está vazio.'
        );
    }

    try {
        localStorage.setItem('prospects', dadosJSON);
        localStorage.setItem('rclc_crm_prospects', dadosJSON);

        // Uma restauração válida libera novamente a gravação.
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
// FORMATAÇÃO DE DATAS
// ==========================================

function formatarDataBR(dataBruta) {
    if (!dataBruta) {
        return new Date().toLocaleDateString('pt-BR');
    }

    const str = String(dataBruta).trim();

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        return str;
    }

    const data = new Date(dataBruta);

    if (!isNaN(data.getTime())) {
        return data.toLocaleDateString('pt-BR');
    }

    return str;
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
        statusCount.innerText = 'A ler colunas e a detetar links do WhatsApp...';
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

            const validRows = rows.filter(r => {
                return Object.values(r).some(
                    val =>
                        val !== undefined &&
                        val !== null &&
                        String(val).trim() !== ''
                );
            });

            if (validRows.length > 0) {
                const mappedRows = validRows.map((r, index) => {
                    let empresa = '';
                    let telefone = '';
                    let whatsappLink = '';
                    let segmento = '';
                    let statusBruto = '';
                    let originVal = 'Google Maps';
                    let notesList = [];

                    const val1o = formatarDataBR(
                        r['1o. Envio'] ||
                        r['1o envio'] ||
                        r['DT ENVIO'] ||
                        ''
                    );

                    const val2o = formatarDataBR(
                        r['2o. ENVIO'] ||
                        r['2o env'] ||
                        ''
                    );

                    const valRetorno = formatarDataBR(
                        r['Dt Retorno'] ||
                        r['dt retorno'] ||
                        r['Retorno'] ||
                        ''
                    );

                    if (String(val1o).trim() !== '') {
                        notesList.push(`1º Envio: ${val1o}`);
                    }

                    if (String(val2o).trim() !== '') {
                        notesList.push(`2º Envio: ${val2o}`);
                    }

                    if (String(valRetorno).trim() !== '') {
                        notesList.push(`Retorno: ${valRetorno}`);
                    }

                    for (let key in r) {
                        const kLower = key
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .trim();

                        const val = r[key];

                        if (
                            val === undefined ||
                            val === null ||
                            val === ''
                        ) {
                            continue;
                        }

                        const valStr = String(val).trim();

                        if (
                            kLower.includes('link whats') ||
                            kLower.includes('url whats') ||
                            kLower.includes('api whats')
                        ) {
                            whatsappLink = valStr;

                        } else if (
                            kLower.includes('telef') ||
                            kLower.includes('tel') ||
                            kLower.includes('cel') ||
                            kLower.includes('whats') ||
                            kLower.includes('zap') ||
                            kLower.includes('numero')
                        ) {
                            telefone = valStr;

                        } else if (
                            kLower.includes('empresa') ||
                            kLower.includes('nome')
                        ) {
                            empresa = valStr;

                        } else if (
                            kLower.includes('segmento') ||
                            kLower.includes('contato')
                        ) {
                            segmento = valStr;

                        } else if (kLower.includes('origem')) {
                            originVal = valStr;

                        } else if (
                            kLower.includes('status') ||
                            kLower.includes('verificacao')
                        ) {
                            statusBruto = valStr;

                        } else {
                            if (
                                !kLower.includes('envio') &&
                                !kLower.includes('retorno') &&
                                !kLower.includes('1o') &&
                                !kLower.includes('2o') &&
                                !kLower.includes('3o')
                            ) {
                                notesList.push(`${key}: ${valStr}`);
                            }
                        }
                    }

                    if (!whatsappLink) {
                        for (let key in r) {
                            const valStr = String(r[key]).trim();

                            if (
                                valStr.includes('wa.me/') ||
                                valStr.includes('whatsapp.com')
                            ) {
                                whatsappLink = valStr;
                                break;
                            }
                        }
                    }

                    if (!empresa) empresa = 'Empresa Sem Nome';
                    if (!segmento) segmento = 'Geral';

                    let status = 'Novo prospect';

                    const sLower = statusBruto
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .trim();

                    if (sLower.includes('sem interesse')) {
                        status = 'Sem interesse';

                    } else if (
                        sLower.includes('negociacao') ||
                        sLower.includes('respondeu')
                    ) {
                        status = 'Em negociação';

                    } else if (
                        sLower.includes('conquistado') ||
                        sLower.includes('cliente')
                    ) {
                        status = 'Cliente conquistado';

                    } else if (sLower.includes('sem contato')) {
                        status = 'Sem contato';

                    } else if (
                        sLower.includes('terceiro') ||
                        sLower.includes('3o contato') ||
                        sLower.includes('3º contato') ||
                        /^3\b/.test(sLower)
                    ) {
                        status = 'Terceiro contato enviado';

                    } else if (
                        sLower.includes('segundo') ||
                        sLower.includes('2o contato') ||
                        sLower.includes('2º contato') ||
                        /^2\b/.test(sLower)
                    ) {
                        status = 'Segundo contato enviado';

                    } else if (
                        sLower.includes('primeiro') ||
                        sLower.includes('1o contato') ||
                        sLower.includes('1º contato') ||
                        /^1\b/.test(sLower)
                    ) {
                        status = 'Primeiro contato enviado';

                    } else {
                        status = statusBruto || 'Novo prospect';
                    }

                    const lastContact =
                        valRetorno ||
                        val2o ||
                        val1o ||
                        new Date().toLocaleDateString('pt-BR');

                    return {
                        id: r.id || (Date.now() + index),
                        name: empresa,
                        company: segmento,
                        phone: telefone,
                        whatsappLink: whatsappLink,
                        origin: originVal,
                        value: parseFloat(
                            r['Valor'] || r['valor'] || 0
                        ) || 0.00,
                        status: status,
                        lastContact: lastContact,
                        notes: notesList.join(' | ')
                    };
                });

                if (statusText) {
                    statusText.innerText = 'Importação concluída com sucesso!';
                }

                if (statusCount) {
                    statusCount.innerText =
                        `${mappedRows.length} registos carregados com sucesso.`;
                }

                setTimeout(() => {
                    if (statusBox) {
                        statusBox.classList.add('hidden');
                    }
                }, 3500);

                callback(mappedRows);

            } else {
                if (statusBox) {
                    statusBox.classList.add('hidden');
                }

                alert('O ficheiro Excel parece estar vazio.');
            }

        } catch (err) {
            console.error('Erro ao importar Excel:', err);

            if (statusBox) {
                statusBox.classList.add('hidden');
            }

            alert('Erro ao ler o ficheiro Excel: ' + err.message);
        }
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

        // Primeiro tenta recuperar a pasta já autorizada.
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

        // Se ainda não existe pasta autorizada, solicita a seleção inicial.
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
            // A restauração é uma ação explícita do usuário.
            // Ela pode liberar o bloqueio de inicialização.
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