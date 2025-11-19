// Use the API key from config.js
const API_KEY = CONFIG.GOOGLE_MAPS_API_KEY;
window.MAPS_API_KEY = API_KEY;

function toggleCard(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;

    const icon = document.getElementById(`icon-${bodyId}`);
    const isVisible = body.style.display === 'block';

    body.style.display = isVisible ? 'none' : 'block';

    if (icon) {
        icon.textContent = isVisible ? '▶' : '▼';
    }

    if (isVisible) {
        expandedStates.delete(bodyId);
    } else {
        expandedStates.add(bodyId);
    }
}

const domUtils = {
    getElement: (id) => document.getElementById(id),
    getToggleButton: (targetId) => document.querySelector(`button[data-target="${targetId}"]`),
    getBairroInput: () => document.getElementById('bairro-input'),
    getBairrosList: () => document.getElementById('bairros-select-list'),
    getBairrosAutocomplete: () => document.getElementById('bairros-autocomplete'),
    getRuasAutocomplete: () => document.getElementById('ruas-autocomplete')
};

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-index'));
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedItem = null;

    // Remove as bordas visuais de todos os itens
    document.querySelectorAll('.draggable-list li').forEach(item => {
        item.style.borderTop = '';
        item.style.borderBottom = '';
    });
}

function handleDragOver(e) {
    if (!draggedItem) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const list = this.parentNode;
    const bounding = this.getBoundingClientRect();
    const offset = bounding.y + (bounding.height / 2);

    if (e.clientY - offset > 0) {
        this.style.borderBottom = '2px solid var(--primary-color)';
        this.style.borderTop = '';
    } else {
        this.style.borderTop = '2px solid var(--primary-color)';
        this.style.borderBottom = '';
    }
}

function handleDrop(e) {
    e.preventDefault();
    if (!draggedItem || draggedItem === this) return;

    this.style.borderTop = '';
    this.style.borderBottom = '';

    const list = this.parentNode;
    const fromIndex = parseInt(draggedItem.getAttribute('data-index'));
    const toIndex = parseInt(this.getAttribute('data-index'));

    const items = Array.from(list.children);
    const fromElement = items[fromIndex];
    const toElement = items[toIndex];

    if (!fromElement || !toElement) return;

    if (fromIndex < toIndex) {
        list.insertBefore(fromElement, toElement.nextSibling);
    } else {
        list.insertBefore(fromElement, toElement);
    }

    // Reatribui data-index dos itens visualmente
    Array.from(list.children).forEach((li, index) => li.setAttribute('data-index', index));
}

function confirmarNovaOrdem() {
    const modalTitulo = document.getElementById('modal-titulo').textContent;
    const matches = modalTitulo.match(/Editando:\s*(.*)/);
    const territorioNome = matches ? matches[1].trim() : null;
    if (!territorioNome) return;

    // Localiza bairro e índice do território
    let bairroEncontrado, territorioIndex;
    for (const bairro in territorios) {
        const index = territorios[bairro].findIndex(t => t.nome === territorioNome);
        if (index !== -1) {
            bairroEncontrado = bairro;
            territorioIndex = index;
            break;
        }
    }

    if (bairroEncontrado === undefined) return;

    const lista = document.getElementById('modal-enderecos-lista');
    const territorio = territorios[bairroEncontrado][territorioIndex];
    const novaOrdem = [];

    // Novo: lê os textos de cada <li> e reconstrói a lista na ordem atual
    lista.querySelectorAll('li').forEach(li => {
        const texto = li.querySelector('.address-content').innerText.split('\n')[0];
        const [rua, numero] = texto.split(',').map(s => s.trim());
        const encontrado = territorio.enderecos.find(
            e => e.rua === rua && e.numero === numero
        );
        if (encontrado) novaOrdem.push(encontrado);
    });

    // Salva apenas se a ordem for realmente diferente
    if (novaOrdem.length === territorio.enderecos.length) {
        territorios[bairroEncontrado][territorioIndex].enderecos = novaOrdem;
        salvarTerritorios();
        feedback.toast('Nova ordem salva com sucesso!', 'success');
        abrirModalEdicao(bairroEncontrado, territorioIndex);
    } else {
        feedback.toast('Erro ao salvar: alguns endereços não foram reconhecidos.', 'error');
    }
}


let dadosApp = {
    perfil: {
        nome: '',
        congregacao: '',
        cidade: ''
    },
    territorios: {}
};
let territorios = {};  // Add this line
let expandedStates = new Set();
let isFirstTime = false;

function salvarDados() {
    dadosApp.territorios = territorios;  // Garante que os territórios estão sincronizados
    localStorage.setItem('dadosApp', JSON.stringify(dadosApp));
}

function salvarTerritorios() {
    dadosApp.territorios = territorios;
    salvarDados();
}

function carregarDados() {
    const dados = localStorage.getItem('dadosApp');
    if (dados) {
        try {
            dadosApp = JSON.parse(dados);
            territorios = dadosApp.territorios || {};  // Garante que territorios seja sincronizado

            // Atualiza campos do perfil
            document.getElementById('nomePublicador').value = dadosApp.perfil.nome || '';
            document.getElementById('congregacao').value = dadosApp.perfil.congregacao || '';
            document.getElementById('cidadePadrao').value = dadosApp.perfil.cidade || '';

            // Atualiza a visualização do perfil
            document.getElementById('viewNome').textContent = dadosApp.perfil.nome || '(não definido)';
            document.getElementById('viewCongregacao').textContent = dadosApp.perfil.congregacao || '(não definida)';
            document.getElementById('viewCidade').textContent = dadosApp.perfil.cidade || '(não definida)';

            if (dadosApp.perfil.nome || dadosApp.perfil.congregacao || dadosApp.perfil.cidade) {
                toggleProfileMode('view');
            } else {
                toggleProfileMode('edit');
            }

            atualizarLista();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }
}

// Atualizar window.onload para garantir que os dados são carregados corretamente
window.onload = function () {
    const dados = localStorage.getItem('dadosApp');
    if (dados) {
        try {
            dadosApp = JSON.parse(dados);
            dadosApp = migrarDados(dadosApp);
            territorios = dadosApp.territorios || {};

            if (!dadosApp.perfil || !dadosApp.perfil.nome || !dadosApp.perfil.congregacao || !dadosApp.perfil.cidade) {
                isFirstTime = true;
                document.getElementById('welcomeModal').classList.remove('hidden');
            } else {
                carregarDados();
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            isFirstTime = true;
            document.getElementById('welcomeModal').classList.remove('hidden');
        }
    } else {
        isFirstTime = true;
        document.getElementById('welcomeModal').classList.remove('hidden');
    }
};

function salvarPerfil() {
    const nome = document.getElementById('nomePublicador').value.trim();
    const congregacao = document.getElementById('congregacao').value.trim();
    const cidade = document.getElementById('cidadePadrao').value.trim();

    if (!nome || !congregacao || !cidade) {
        feedback.toast('Por favor, preencha todos os campos!', 'error');
        return;
    }

    dadosApp.perfil = { nome, congregacao, cidade };
    salvarDados();

    // Atualiza a visualização
    document.getElementById('viewNome').textContent = nome;
    document.getElementById('viewCongregacao').textContent = congregacao;
    document.getElementById('viewCidade').textContent = cidade;

    toggleProfileMode('view');
    feedback.toast('Perfil salvo com sucesso!', 'success');
}

function salvarPerfilInicial() {
    const nome = document.getElementById('initialNome').value.trim();
    const congregacao = document.getElementById('initialCongregacao').value.trim();
    const cidade = document.getElementById('initialCidade').value.trim();

    if (!nome || !congregacao || !cidade) {
        feedback.toast('Por favor, preencha todos os campos!', 'error');
        return;
    }

    dadosApp.perfil = { nome, congregacao, cidade };
    dadosApp.territorios = territorios;

    salvarDados();  // Salva tudo no localStorage

    const welcomeModal = document.getElementById('welcomeModal');
    welcomeModal.style.display = 'none';
    welcomeModal.classList.add('hidden');
    mostrarTela('home');
    carregarDados();  // Carrega os dados salvos
    atualizarLista();
}

function toggleProfileMode(mode) {
    const viewMode = document.getElementById('viewProfile');
    const editMode = document.getElementById('editProfile');

    if (mode === 'edit') {
        viewMode.classList.add('hidden');
        editMode.classList.remove('hidden');
    } else {
        // Atualizar contadores antes de mostrar
        const totais = calcularTotais();
        document.getElementById('totalTerritorios').textContent = totais.territorios;
        document.getElementById('totalEnderecos').textContent = totais.enderecos;

        viewMode.classList.remove('hidden');
        editMode.classList.add('hidden');
    }
}

function calcularTotais() {
    let totalTerritorios = 0;
    let totalEnderecos = 0;

    for (const bairro in territorios) {
        totalTerritorios += territorios[bairro].length;
        for (const territorio of territorios[bairro]) {
            totalEnderecos += territorio.enderecos.length;
        }
    }

    return { territorios: totalTerritorios, enderecos: totalEnderecos };
}

function getDistance(coords1, coords2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    const R = 6371; // Raio da Terra em km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toggleHamburgerMenu() {
    const menu = document.getElementById('hamburger-menu');
    menu.classList.toggle('hidden');
}

function mostrarTela(tela) {
    const container = document.querySelector('.container');
    document.getElementById("telaCriar").classList.add("hidden");
    document.getElementById("telaEndereco").classList.add("hidden");
    document.getElementById("telaConfig").classList.add("hidden");

    if (tela === "home") {
        container.classList.add("home");
    } else {
        container.classList.remove("home");
        if (tela === "criar") {
            document.getElementById("telaCriar").classList.remove("hidden");
        } else if (tela === "endereco") {
            document.getElementById("telaEndereco").classList.remove("hidden");
        } else if (tela === "config") {
            document.getElementById("telaConfig").classList.remove("hidden");
        }
    }
}

function criarTerritorio() {
    let bairro = domUtils.getBairroInput().value.trim();
    let nome = document.getElementById("nomeTerritorio").value.trim();

    if (!bairro || !nome) {
        feedback.toast("Preencha todos os campos!", 'error');
        return;
    }

    // Inicializa o array do bairro se não existir
    if (!territorios[bairro]) {
        territorios[bairro] = [];
    }

    // Cria o novo território
    const novoTerritorio = {
        nome: nome,
        enderecos: []
    };

    // Adiciona ao array de territórios do bairro
    territorios[bairro].push(novoTerritorio);

    // Salva os dados
    dadosApp.territorios = territorios;
    salvarDados();

    // Atualiza a interface
    atualizarLista();

    // Limpa os campos
    domUtils.getBairroInput().value = "";
    document.getElementById("nomeTerritorio").value = "";

    // Feedback para o usuário
    feedback.toast("Território criado com sucesso!", 'success');
}

// Adicionar utilitários para feedback
const feedback = {
    toast(message, type = 'info', duration = 6000) {  // Alterado para 6000ms (6 segundos)
        const container = document.querySelector('.toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    loading: {
        show() {
            document.querySelector('.loading-overlay').style.display = 'flex';
        },
        hide() {
            document.querySelector('.loading-overlay').style.display = 'none';
        }
    },

    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
};

// Substitua a função adicionarEndereco existente por esta:

async function adicionarEndereco() {
    const btn = event.target;
    feedback.setButtonLoading(btn, true);

    try {
        const territorioManual = domUtils.getElement('territorioManual').value;
        const rua = domUtils.getElement('rua-input').value.trim();
        const numero = domUtils.getElement('numeroInput').value.trim();
        const bairroEndereco = domUtils.getElement('bairro-endereco').value.trim();
        const observacoes = domUtils.getElement('observacoesInput').value.trim();
        const cep = document.getElementById('cepInput').value.trim();

        // Modifique a validação no início da função adicionarEndereco
        if (!rua || !numero || !bairroEndereco) {
            feedback.toast('Preencha os campos obrigatórios (rua, número e bairro)', 'error');
            return;
        }

        const fullAddress = `${rua}, ${numero}, ${bairroEndereco}, ${dadosApp.perfil.cidade}`;

        feedback.loading.show();

        // Usando a chave diretamente
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${API_KEY}`
        );

        if (!response.ok) {
            throw new Error('Erro na requisição do Google Maps API');
        }

        const data = await response.json();

        if (data.status !== "OK") {
            throw new Error(data.status === "ZERO_RESULTS" ?
                "Endereço não encontrado. Tente adicionar o CEP ou nome completo da rua e bairro" :
                "Erro ao buscar endereço. Tente novamente em alguns instantes");
        }

        const location = data.results[0].geometry.location; // {lat, lng}
        const newAddressData = {
            rua,
            numero,
            bairro: bairroEndereco,
            cidade: dadosApp.perfil.cidade,
            cep: cep,
            notas: observacoes,
            lat: location.lat,
            lng: location.lng
        };

        // Lógica para adição manual
        if (territorioManual) {
            const [bairroKey, terIndex] = territorioManual.split(';');
            const targetTerritory = territorios[bairroKey][terIndex];
            if (targetTerritory.enderecos.length >= 8) {
                feedback.toast(`O território "${targetTerritory.nome}" já está cheio. Não é possível adicionar mais endereços.`, 'error');
                return;
            }
            targetTerritory.enderecos.push(newAddressData);
            feedback.toast(`Endereço adicionado manualmente ao território ${targetTerritory.nome}.`, 'success');
        } else {
            // Lógica de alocação automática
            let bairro = data.results[0].address_components.find(c => c.types.includes("sublocality") || c.types.includes("political"))?.long_name || bairroEndereco;

            let allTerritories = Object.values(territorios).flat();
            let closestTerritory = null;
            let minDistance = Infinity;

            // Encontra o território mais próximo
            for (const t of allTerritories) {
                if (t.enderecos.length > 0) {
                    const baseCoords = t.enderecos[0]; // O primeiro endereço é a base
                    const distance = getDistance(baseCoords, newAddressData);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestTerritory = t;
                    }
                }
            }

            // Se o território mais próximo estiver a menos de 8km
            if (closestTerritory && minDistance < 8) {
                if (closestTerritory.enderecos.length < 8) {
                    // Adiciona se houver espaço
                    closestTerritory.enderecos.push(newAddressData);
                    feedback.toast(`Endereço adicionado ao território ${closestTerritory.nome}.`, 'success');
                } else {
                    // Reorganiza se estiver cheio
                    feedback.toast(`Território ${closestTerritory.nome} está cheio. Tentando reorganizar...`, 'info');

                    // Encontra o endereço mais distante da base no território cheio
                    let farthestAddress = null;
                    let maxDistance = -1;
                    let farthestIndex = -1;

                    const baseCoords = closestTerritory.enderecos[0];
                    closestTerritory.enderecos.forEach((addr, index) => {
                        const dist = getDistance(baseCoords, addr);
                        if (dist > maxDistance) {
                            maxDistance = dist;
                            farthestAddress = addr;
                            farthestIndex = index;
                        }
                    });

                    // Remove o mais distante e adiciona o novo
                    closestTerritory.enderecos.splice(farthestIndex, 1);
                    closestTerritory.enderecos.push(newAddressData);
                    feedback.toast(`Endereço ${farthestAddress.rua} removido de ${closestTerritory.nome} e o novo endereço foi adicionado.`, 'success');

                    // Tenta realocar o endereço removido (lógica simplificada: cria um novo território para ele)
                    const bairroDoRemovido = farthestAddress.bairro;
                    const newTerritoryName = `${bairroDoRemovido} ${territorios[bairroDoRemovido] ? territorios[bairroDoRemovido].length + 1 : 1}`;
                    if (!territorios[bairroDoRemovido]) {
                        territorios[bairroDoRemovido] = [];
                    }
                    territorios[bairroDoRemovido].push({ nome: newTerritoryName, enderecos: [farthestAddress] });
                    feedback.toast(`Um novo território "${newTerritoryName}" foi criado para o endereço removido.`, 'success');
                }
            } else {
                // Cria um novo território se não houver nenhum próximo
                const newTerritoryName = `${bairro} ${territorios[bairro] ? territorios[bairro].length + 1 : 1}`;
                if (!territorios[bairro]) territorios[bairro] = [];
                territorios[bairro].push({ nome: newTerritoryName, enderecos: [newAddressData] });
                feedback.toast(`Nenhum território próximo. Novo território "${newTerritoryName}" criado.`, 'success');
            }
        }

        salvarTerritorios();
        atualizarLista();
        // Limpar campos
        domUtils.getElement('rua-input').value = "";
        domUtils.getElement('numeroInput').value = "";
        domUtils.getElement('bairro-endereco').value = "";
        domUtils.getElement('observacoesInput').value = "";
    } catch (error) {
        feedback.toast(error.message, 'error');
        console.error('Erro:', error);
    } finally {
        feedback.loading.hide();
        feedback.setButtonLoading(btn, false);
    }
}

function editarNomeTerritorio(bairro, index) {
    const territorio = territorios[bairro][index];
    const novoNome = prompt("Digite o novo nome para o território:", territorio.nome);
    const novoBairro = prompt("Digite o novo bairro para o território:", bairro);

    let mudouAlgo = false;

    // Atualiza o nome se for diferente
    if (novoNome && novoNome.trim() !== "" && novoNome.trim() !== territorio.nome) {
        territorio.nome = novoNome.trim();
        mudouAlgo = true;
    }

    // Move o território se o bairro for diferente
    if (novoBairro && novoBairro.trim() !== "" && novoBairro.trim() !== bairro) {
        const bairroAntigo = bairro;
        const bairroNovo = novoBairro.trim();

        // Remove o território do array do bairro antigo
        const territorioMovido = territorios[bairroAntigo].splice(index, 1)[0];

        // Se o array do bairro antigo ficou vazio, remove a chave do objeto
        if (territorios[bairroAntigo].length === 0) {
            delete territorios[bairroAntigo];
        }

        // Garante que o array do novo bairro exista
        if (!territorios[bairroNovo]) {
            territorios[bairroNovo] = [];
        }

        // Adiciona o território ao novo bairro
        territorios[bairroNovo].push(territorioMovido);
        mudouAlgo = true;
    }

    if (mudouAlgo) {
        salvarTerritorios();
        atualizarLista();
        feedback.toast("Território atualizado com sucesso!", 'success');
    }
}

function excluirTerritorio(bairro, index) {
    if (confirm(`Tem certeza que deseja excluir o território "${territorios[bairro][index].nome}"?`)) {
        territorios[bairro].splice(index, 1);
        if (territorios[bairro].length === 0) {
            delete territorios[bairro];
        }
        salvarTerritorios();
        atualizarLista();
        feedback.toast('Território excluído com sucesso!', 'success');
    }
}

function abrirModalEdicao(bairro, terIndex) {
    const modal = document.getElementById('modalEdicao');
    const lista = document.getElementById('modal-enderecos-lista');
    const titulo = document.getElementById('modal-titulo');
    const territorio = territorios[bairro][terIndex];

    titulo.textContent = `Editando: ${territorio.nome}`;
    lista.innerHTML = '';
    lista.className = 'draggable-list';

    territorio.enderecos.forEach((end, enderIndex) => {
        const li = document.createElement('li');
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-index', enderIndex);
        li.innerHTML = `
          <span class="drag-handle">&#8942;&#8942;</span>
          <div class="address-content">${end.rua}, ${end.numero}${end.notas ? `<br><small>${end.notas}</small>` : ''}</div>
          <div class="address-actions">
            <button class="edit-btn" title="Editar Endereço" onclick="editarEndereco('${bairro}', ${terIndex}, ${enderIndex})">&#9998;</button>
            <button class="delete-btn" title="Excluir Endereço" onclick="excluirEndereco('${bairro}', ${terIndex}, ${enderIndex})">&#128465;</button>
          </div>
        `;

        // Adiciona eventos de drag and drop
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragend', handleDragEnd);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);

        lista.appendChild(li);
    });

    modal.style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalEdicao').style.display = 'none';
}

function editarEndereco(bairro, terIndex, enderIndex) {
    const end = territorios[bairro][terIndex].enderecos[enderIndex];
    const novaRua = prompt("Rua:", end.rua);
    const novoNumero = prompt("Número:", end.numero);
    const novasNotas = prompt("Notas:", end.notas);

    if (novaRua !== null && novoNumero !== null) {
        end.rua = novaRua.trim();
        end.numero = novoNumero.trim();
        end.notas = novasNotas ? novasNotas.trim() : '';
        salvarTerritorios();
        atualizarLista();
        abrirModalEdicao(bairro, terIndex); // Reabre a modal para mostrar a alteração
    }
}

function excluirEndereco(bairro, terIndex, enderIndex) {
    if (confirm("Tem certeza que deseja excluir este endereço?")) {
        territorios[bairro][terIndex].enderecos.splice(enderIndex, 1);
        salvarTerritorios();
        atualizarLista();
        abrirModalEdicao(bairro, terIndex); // Reabre a modal para mostrar a alteração
        feedback.toast('Endereço excluído com sucesso!', 'success');
    }
}

async function gerarMensagemWhatsapp(bairro, territorio) {
    const enderecos = territorio.enderecos;
    if (enderecos.length === 0) {
        feedback.toast("Não há endereços neste território para gerar a mensagem.", 'error');
        return;
    }

    // Prompt para data e destinatário
    const hoje = new Date().toISOString().split('T')[0];
    const dataEnvio = prompt("Data de envio (DD/MM/YYYY):", hoje.split('-').reverse().join('/'));
    if (!dataEnvio) return;

    const destinatario = prompt("Para quem você está enviando este território?");
    if (!destinatario || !destinatario.trim()) {
        feedback.toast("É necessário informar o destinatário.", 'error');
        return;
    }

    // Validar e converter a data
    let dataFormatada;
    try {
        const [dia, mes, ano] = dataEnvio.split('/').map(num => parseInt(num, 10));
        dataFormatada = new Date(ano, mes - 1, dia);
        if (isNaN(dataFormatada.getTime())) throw new Error();
    } catch (e) {
        feedback.toast("Data inválida. Use o formato DD/MM/YYYY", 'error');
        return;
    }

    const titulo = `*${bairro.toUpperCase()} - ${territorio.nome.toUpperCase()}*`;
    const info = "Las direcciones están organizadas por proximidad; antes de empezar el trabajo, revise el mapa para optimizar su ruta.";
    const listaEnderecos = enderecos.map((e, i) => {
        let textoEndereco = `${i + 1}. *${e.rua}, ${e.numero}*`;
        if (e.notas) {
            textoEndereco += `\n   (${e.notas})`;
        }
        return textoEndereco;
    }).join('\n\n');
    const pecaAnotacoes = "Envie agora las informaciones de esta tarjeta para el conductor!";

    const mensagem = `${titulo}\n\n${info}\n\n${listaEnderecos}\n\n${pecaAnotacoes}`;

    let copiado = false;

    try {
        await navigator.clipboard.writeText(mensagem);
        copiado = true;
    } catch (err) {
        console.log("Clipboard API falhou, tentando método alternativo...");

        const textarea = document.createElement('textarea');
        textarea.value = mensagem;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            copiado = document.execCommand('copy');
        } catch (err) {
            console.log("execCommand falhou também");
        }

        document.body.removeChild(textarea);
    }

    if (copiado) {
        territorio.lastSent = dataFormatada.toISOString();
        territorio.lastRecipient = destinatario.trim();
        dadosApp.territorios = territorios;
        salvarDados();
        atualizarLista();
        feedback.toast(`Mensagem copiada! Território enviado para ${destinatario}`, 'success');
    } else {
        feedback.toast("Não foi possível copiar a mensagem. Por favor, tente novamente.", 'error');
    }
}

const renderTerritorioCard = (t) => {
    const cardId = `territorio-body-${t.bairro.replace(/\s/g, '')}-${t.originalIndex}`;
    const isExpanded = expandedStates.has(cardId);

    // Format date without time
    const lastSentDate = t.lastSent ? new Date(t.lastSent).toLocaleDateString('pt-BR') : null;
    const lastRecipient = t.lastRecipient ? `para ${t.lastRecipient}` : '';
    const lastSentHtml = lastSentDate ?
        `<div class="last-sent">
            <span>Enviado em: ${lastSentDate}</span>
            ${lastRecipient ? `<br><span>${lastRecipient}</span>` : ''}
            <button class="edit-date-btn" title="Editar Data" onclick="event.stopPropagation(); editarDataEnvio('${t.bairro}', ${t.originalIndex})">📅</button>
        </div>` : '';

    const enderecosHtml = t.enderecos.map((e, i) => {
        const notaHtml = e.notas ? ` <em>(${e.notas})` : '';
        const enderecoTexto = e.rua ? `${e.rua}, ${e.numero}` : e.endereco || 'Endereço inválido';
        return `${i + 1}. ${enderecoTexto}${notaHtml}`;
    }).join('<br>');

    return `
        <div class="territorio">
            <div style="width: 100%;">
                <div class="territorio-header" onclick="toggleCard('${cardId}')">
                    <div class="territorio-info">
                        <strong>${t.bairro} - ${t.nome}</strong>
                        ${lastSentHtml}
                    </div>
                    <div class="territorio-botoes">
                        <button class="edit-addr-btn" title="Editar Endereços" onclick="event.stopPropagation(); abrirModalEdicao('${t.bairro}', ${t.originalIndex})">&#128221;</button>
                        <button class="edit-btn" title="Editar" onclick="event.stopPropagation(); editarNomeTerritorio('${t.bairro}', ${t.originalIndex})">&#9998;</button>
                        <button class="whatsapp-btn" title="Copiar Mensagem" onclick="event.stopPropagation(); gerarMensagemWhatsapp('${t.bairro}', territorios['${t.bairro}'][${t.originalIndex}])">&#128203;</button>
                        <button class="delete-btn" title="Excluir" onclick="event.stopPropagation(); excluirTerritorio('${t.bairro}', ${t.originalIndex})">&#128465;</button>
                    </div>
                </div>
                <div class="territorio-body" id="${cardId}" style="display: ${isExpanded ? 'block' : 'none'}">
                    <strong>Endereços:</strong><br>
                    ${enderecosHtml || 'Nenhum endereço adicionado.'}
                </div>
            </div>
        </div>
    `;
};

function editarDataEnvio(bairro, index) {
    const territorio = territorios[bairro][index];
    const dataAtual = territorio.lastSent ?
        new Date(territorio.lastSent).toLocaleDateString('pt-BR') :
        new Date().toLocaleDateString('pt-BR');

    const novaData = prompt("Digite a nova data de envio (DD/MM/YYYY):", dataAtual);
    if (!novaData) return;

    try {
        const [dia, mes, ano] = novaData.split('/').map(num => parseInt(num, 10));
        const dataFormatada = new Date(ano, mes - 1, dia);

        if (isNaN(dataFormatada.getTime())) {
            throw new Error('Data inválida');
        }

        territorio.lastSent = dataFormatada.toISOString();
        salvarTerritorios();
        atualizarLista();
        feedback.toast('Data de envio atualizada com sucesso!', 'success');
    } catch (error) {
        feedback.toast('Data inválida. Use o formato DD/MM/YYYY', 'error');
    }
}

function migrarDados(dados) {
    // Se os dados antigos forem apenas territórios
    if (!dados.perfil && !dados.territorios) {
        return {
            perfil: {
                nome: '',
                congregacao: '',
                cidade: ''
            },
            territorios: dados // dados antigos são apenas os territórios
        };
    }

    // Se já estiver no formato novo, apenas garante que tem todos os campos
    if (!dados.perfil) {
        dados.perfil = {
            nome: '',
            congregacao: '',
            cidade: ''
        };
    }

    if (!dados.territorios) {
        dados.territorios = {};
    }

    return dados;
}

function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (typeof importedData === 'object' && importedData !== null) {
                if (confirm("Tem certeza que deseja importar estes dados?")) {
                    const currentProfile = dadosApp.perfil;
                    dadosApp = migrarDados(importedData);
                    dadosApp.perfil = currentProfile;
                    territorios = dadosApp.territorios;
                    salvarDados();
                    atualizarLista();
                    feedback.toast("Dados importados com sucesso!", 'success');
                }
            } else {
                throw new Error("Formato de arquivo inválido.");
            }
        } catch (error) {
            feedback.toast("Erro ao importar arquivo: " + error.message, 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function atualizarFormularios() {
    const selectTerritorio = domUtils.getElement('territorioManual');
    const bairrosAutocomplete = domUtils.getBairrosAutocomplete();
    const ruasAutocomplete = domUtils.getRuasAutocomplete();

    // Limpar campos
    selectTerritorio.innerHTML = '<option value="">Automático</option>';
    bairrosAutocomplete.innerHTML = '';
    ruasAutocomplete.innerHTML = '';

    const bairrosSet = new Set();
    const ruasSet = new Set();

    for (const bairroKey in territorios) {
        territorios[bairroKey].forEach((t, index) => {
            const option = document.createElement('option');
            option.value = `${bairroKey};${index}`;
            option.textContent = t.nome;
            selectTerritorio.appendChild(option);

            bairrosSet.add(bairroKey);
            t.enderecos.forEach(e => {
                ruasSet.add(e.rua);
                bairrosSet.add(e.bairro);
            });
        });
    }

    bairrosSet.forEach(b => {
        const option = document.createElement('option');
        option.value = b;
        bairrosAutocomplete.appendChild(option);
    });

    ruasSet.forEach(r => {
        const option = document.createElement('option');
        option.value = r;
        ruasAutocomplete.appendChild(option);
    });
}

function atualizarLista() {
    const divSugestoes = document.getElementById("sugestoesTerritorios");
    const divRecentes = document.getElementById("recentesTerritorios");
    const divLista = document.getElementById("listaTerritorios");
    const tituloSugestoes = document.getElementById("sugestoes-titulo");
    const tituloRecentes = document.getElementById("recentes-titulo");

    divSugestoes.innerHTML = "";
    divRecentes.innerHTML = "";
    divLista.innerHTML = "";

    let todosTerritorios = [];
    for (let bairro in territorios) {
        territorios[bairro].forEach((t, index) => {
            todosTerritorios.push({ ...t, bairro, originalIndex: index });
        });
    }

    const vinteDiasAtras = new Date();
    vinteDiasAtras.setDate(vinteDiasAtras.getDate() - 20);

    // Separar territórios por categoria
    const sugestoes = todosTerritorios
        .filter(t => t.lastSent && new Date(t.lastSent) < vinteDiasAtras)
        .sort((a, b) => new Date(a.lastSent) - new Date(b.lastSent));

    const recentes = todosTerritorios
        .filter(t => t.lastSent && new Date(t.lastSent) >= vinteDiasAtras)
        .sort((a, b) => new Date(b.lastSent) - new Date(a.lastSent));

    const naoEnviados = todosTerritorios.filter(t => !t.lastSent);

    const renderBairroGrupo = (territorios, bairro, section) => {
        const grupoId = `grupo-${section}-${bairro.replace(/\s/g, '')}`;
        const isExpanded = expandedStates.has(grupoId);
        return `
                <div class="bairro-grupo">
                    <div class="bairro-grupo-header" onclick="toggleCard('${grupoId}')">
                        <span class="toggle-icon" id="icon-${grupoId}">${isExpanded ? '▼' : '▶'}</span>
                        <h3>${bairro} (${territorios.length})</h3>
                    </div>
                    <div class="bairro-grupo-content" id="${grupoId}" style="display: ${isExpanded ? 'block' : 'none'}">
                        ${territorios.map(t => renderTerritorioCard(t)).join('')}
                    </div>
                </div>
            `;
    };

    // Renderizar sugestões agrupadas por bairro
    if (sugestoes.length > 0) {
        tituloSugestoes.classList.remove('hidden');
        const sugestoesPorBairro = groupByBairro(sugestoes);
        for (const [bairro, territorios] of Object.entries(sugestoesPorBairro)) {
            divSugestoes.insertAdjacentHTML('beforeend', renderBairroGrupo(territorios, bairro, 'sugestoes'));
        }
    } else {
        tituloSugestoes.classList.add('hidden');
    }

    // Renderizar recentes agrupados por bairro
    if (recentes.length > 0) {
        tituloRecentes.classList.remove('hidden');
        const recentesPorBairro = groupByBairro(recentes);
        for (const [bairro, territorios] of Object.entries(recentesPorBairro)) {
            divRecentes.insertAdjacentHTML('beforeend', renderBairroGrupo(territorios, bairro, 'recentes'));
        }
    } else {
        tituloRecentes.classList.add('hidden');
    }

    // Renderizar outros territórios agrupados por bairro
    const outrosPorBairro = groupByBairro(naoEnviados);
    for (const [bairro, territorios] of Object.entries(outrosPorBairro)) {
        divLista.insertAdjacentHTML('beforeend', renderBairroGrupo(territorios, bairro, 'outros'));
    }

    atualizarFormularios();
}

// Função auxiliar para agrupar territórios por bairro
function groupByBairro(territorios) {
    return territorios.reduce((groups, t) => {
        if (!groups[t.bairro]) {
            groups[t.bairro] = [];
        }
        groups[t.bairro].push(t);
        return groups;
    }, {});
}

function toggleBairrosList(event) {
    event.preventDefault();
    const targetId = event.target.dataset.target;
    const lista = domUtils.getElement(targetId);
    const button = event.target;
    const isVisible = lista.classList.toggle('visible');
    button.textContent = isVisible ? '▲' : '▼';

    if (isVisible) {
        lista.innerHTML = '';
        const bairros = Object.keys(territorios).sort();
        bairros.forEach(bairro => {
            const li = document.createElement('li');
            li.textContent = bairro;
            li.onclick = () => {
                domUtils.getBairroInput().value = bairro;
                lista.classList.remove('visible');
                button.textContent = '▼';
            };
            lista.appendChild(li);
        });

        if (bairros.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Nenhum bairro cadastrado';
            li.style.fontStyle = 'italic';
            li.style.color = 'var(--outline-color)';
            lista.appendChild(li);
        }
    }
}

// Atualizar manipulador de clique fora da lista
document.addEventListener('click', function (event) {
    const lista = domUtils.getBairrosList();
    const button = event.target;
    const isToggleButton = button.hasAttribute('data-target');

    if (!lista.contains(event.target) && !isToggleButton) {
        lista.classList.remove('visible');
        const toggleBtn = domUtils.getToggleButton('bairros-select-list');
        if (toggleBtn) toggleBtn.textContent = '▼';
    }
});

function formatCEP(cep) {
    return cep.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2');
}

async function buscarCEPPreditivo(input) {
    const cep = input.value.replace(/\D/g, '');
    const suggestionsList = document.getElementById('cepSuggestions');

    if (cep.length < 5) {
        suggestionsList.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${dadosApp.perfil.cidade}/json/`);
        const data = await response.json();

        if (!Array.isArray(data)) {
            suggestionsList.classList.add('hidden');
            return;
        }

        const sugestoes = data
            .filter(endereco => endereco.cep.replace(/\D/g, '').startsWith(cep))
            .slice(0, 5); // Limita a 5 sugestões

        if (sugestoes.length > 0) {
            suggestionsList.innerHTML = sugestoes
                .map(endereco => `
          <div class="suggestion-item" onclick="selecionarCEP('${endereco.cep}', '${endereco.logradouro}', '${endereco.bairro}')">
            <div class="cep">${endereco.cep}</div>
            <div class="address">${endereco.logradouro} - ${endereco.bairro}</div>
          </div>
        `)
                .join('');

            suggestionsList.classList.remove('hidden');
        } else {
            suggestionsList.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        suggestionsList.classList.add('hidden');
    }
}

function selecionarCEP(cep, logradouro, bairro) {
    const cepInput = document.getElementById('cepInput');
    const ruaInput = document.getElementById('rua-input');
    const bairroInput = document.getElementById('bairro-endereco');
    const suggestionsList = document.getElementById('cepSuggestions');

    cepInput.value = cep;

    // Só atualiza os outros campos se estiverem vazios
    if (!ruaInput.value.trim()) {
        ruaInput.value = logradouro;
    }
    if (!bairroInput.value.trim()) {
        bairroInput.value = bairro;
    }

    suggestionsList.classList.add('hidden');
}

// Adicione os event listeners
document.addEventListener('DOMContentLoaded', function () {
    const ruaInput = document.getElementById('rua-input');
    const cepInput = document.getElementById('cepInput');

    // Event listener existente para o CEP
    cepInput.addEventListener('input', function (e) {
        e.target.value = formatCEP(e.target.value);
    });

    // Novo event listener para o campo de rua
    ruaInput.addEventListener('input', debounce(async function (e) {
        const rua = e.target.value.trim();
        if (rua.length < 3) return; // Só busca se tiver pelo menos 3 caracteres

        const ceps = await buscarCEPsPorLogradouro(rua);
        const suggestionsList = document.getElementById('cepSuggestions');

        if (ceps.length > 0) {
            suggestionsList.innerHTML = ceps
                .map(endereco => `
          <div class="suggestion-item" onclick="selecionarCEP('${endereco.cep}', '${endereco.logradouro}', '${endereco.bairro}')">
            <div class="cep">${endereco.cep}</div>
            <div class="address">${endereco.logradouro} - ${endereco.bairro}</div>
          </div>
        `)
                .join('');

            // Posiciona a lista de sugestões abaixo do campo CEP
            const cepInputRect = cepInput.getBoundingClientRect();
            suggestionsList.style.top = `${cepInputRect.bottom + window.scrollY}px`;
            suggestionsList.style.left = `${cepInputRect.left}px`;
            suggestionsList.style.width = `${cepInputRect.width}px`;

            suggestionsList.classList.remove('hidden');
        } else {
            suggestionsList.classList.add('hidden');
        }
    }, 500)); // Aguarda 500ms após o último caractere digitado
});


function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function buscarCEPsPorLogradouro(rua) {
    try {
        const cidade = dadosApp.perfil.cidade;
        if (!cidade) {
            throw new Error('Cidade não configurada');
        }

        const response = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`);
        const data = await response.json();

        if (Array.isArray(data)) {
            return data.slice(0, 5); // Limita a 5 sugestões
        }
        return [];
    } catch (error) {
        console.error('Erro ao buscar CEPs:', error);
        return [];
    }
}
