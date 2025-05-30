// Configuração inicial do mapa
let map;
let geojson;
let info;
let legend;
let currentVisualizacao = 'visao_geral';
let dadosMunicipios = {};
let legendaIntervalos = [];
let cores = ['#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#E31A1C', '#BD0026', '#800026'];
let detalhesMunicipio = null;
let municipioSelecionado = null;
let sidebarVisible = false;
let sidebarJustOpened = false; // Flag para controlar abertura recente

// Filtros e destaques
let municipiosFiltrados = [];
let razaoSocialFiltrada = null;
let cnpjFiltrado = null;
let todosCredenciados = [];
let todosMunicipios = [];

// Cores para destaques
const corDestaqueMunicipio = '#3388ff';
const corDestaqueRazaoSocial = '#ff6b6b';
const corDestaqueCNPJ = '#5cb85c';

// Inicialização do mapa
document.addEventListener("DOMContentLoaded", function() {
    inicializarMapa();
    carregarDados(currentVisualizacao); // Carrega dados iniciais
    
    // Inicializar Select2 para seletores
    $("#municipios").select2({
        placeholder: "Selecione municípios",
        allowClear: true
    });
    
    $("#razao-social").select2({
        placeholder: "Selecione uma razão social",
        allowClear: true
    });
    
    $("#cnpj").select2({
        placeholder: "Selecione um CNPJ",
        allowClear: true
    });
    
    // Adicionar evento de mudança ao seletor de visualização
    document.getElementById("visualizacao").addEventListener("change", function() {
        currentVisualizacao = this.value;
        // Mostrar/ocultar filtros de razão social e CNPJ conforme a visualização
        const razaoSocialSection = document.querySelector('.controls-section label[for="razao-social"]').parentElement;
        const cnpjSection = document.querySelector('.controls-section label[for="cnpj"]').parentElement;
        if (currentVisualizacao === 'frota_total') {
            razaoSocialSection.style.display = 'none';
            cnpjSection.style.display = 'none';
        } else {
            razaoSocialSection.style.display = '';
            cnpjSection.style.display = '';
        }
        // Chamar a função que carrega os dados (ela agora gerencia o overlay)
        carregarDados(currentVisualizacao);
    });
    
    // Adicionar eventos aos seletores de filtro
    $("#municipios").on("change", function() {
        const valores = $(this).val();
        municipiosFiltrados = valores || [];
        aplicarFiltros();
    });
    
    $("#razao-social").on("change", function() {
        razaoSocialFiltrada = $(this).val();
        aplicarFiltros();
    });
    
    $("#cnpj").on("change", function() {
        cnpjFiltrado = $(this).val();
        aplicarFiltros();
    });
    
    // Botão para limpar filtros
    document.getElementById("limpar-filtros").addEventListener("click", limparFiltros);
    
    // --- Configurar fechamento da Sidebar ---
    const sidebar = document.getElementById("sidebar");
    const openButton = document.getElementById("open-sidebar");
    const closeButton = document.getElementById("close-sidebar");

    // Fechar pelo botão X
    closeButton.addEventListener("click", function(event) {
        event.stopPropagation();
        fecharSidebar();
    });

    // Abrir pelo botão de menu
    openButton.addEventListener("click", function(event) {
        event.stopPropagation(); // Impede que o clique no botão propague
        abrirSidebar();
    });

    // Fechar clicando fora da sidebar
    document.addEventListener("click", function(event) {
        // Fecha se clicar fora da sidebar e ela estiver aberta
        if (sidebarVisible && !sidebar.contains(event.target) && !openButton.contains(event.target)) {
            fecharSidebar();
        }
    });

    // Impedir que cliques dentro da sidebar a fechem (necessário por causa do listener no document)
    sidebar.addEventListener("click", function(event) {
        event.stopPropagation();
    });
    // --- Fim da configuração da Sidebar ---

    // Iniciar com a sidebar fechada
    fecharSidebar();
    
    // Carregar dados para os seletores
    carregarDadosSeletores();
});

function inicializarMapa() {
    // Coordenadas aproximadas do centro da Bahia
    const centroBahia = [-12.5, -41.7];
    
    // Criar o mapa
    map = L.map("mapa").setView(centroBahia, 7);
    
    // Adicionar camada de mapa base (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
    }).addTo(map);
    
    // Carregar o GeoJSON da Bahia
    fetch("/data/geo-ba.json")
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            geojson = L.geoJson(data, {
                style: estiloPadrao,
                onEachFeature: onEachFeature
            }).addTo(map);
            console.log("GeoJSON carregado e adicionado ao mapa.");
            // Esconder o overlay de carregamento inicial (do mapa)
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        })
        .catch(error => {
            console.error("Erro ao carregar o GeoJSON:", error);
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                 loadingOverlay.innerHTML = '<p class="error">Erro ao carregar mapa. Tente recarregar a página.</p>';
            }
        });

    // Controle de informações
    info = L.control();
    info.onAdd = function (map) {
        this._div = L.DomUtil.create("div", "info");
        this.update();
        return this._div;
    };
    info.update = function (props) {
        this._div.innerHTML = "" + (props ?
            "<b>" + props.name + "</b><br />" + (dadosMunicipios[props.id] ? formatarValor(dadosMunicipios[props.id].valor) + " " + getUnidadeMedida(currentVisualizacao) : "Dados não disponíveis") :
            "");
    };
    info.addTo(map);

    // Legenda
    legend = L.control({ position: "bottomright" });
    legend.onAdd = function (map) {
        const div = L.DomUtil.create("div", "info legend");
        atualizarLegenda(div);
        return div;
    };
    legend.addTo(map);
}

function getUnidadeMedida(visualizacao) {
    switch (visualizacao) {
        case 'frota_total': return 'veículos';
        case 'credenciados_cfc':
        case 'credenciados_clinicas':
        case 'credenciados_ecv':
        case 'credenciados_epiv':
        case 'credenciados_patio': return 'credenciados';
        case 'servicos_cfc': return 'cursos';
        case 'servicos_clinicas': return 'exames';
        case 'servicos_ecv': return 'vistorias';
        case 'servicos_epiv': return 'estampagens';
        case 'servicos_patio': return 'veículos removidos';
        default: return '';
    }
}

function atualizarLegenda(div) {
    div = div || legend.getContainer();
    if (!div) return;

    div.innerHTML = ''; // Limpar legenda existente
    const titulo = getTituloLegenda(currentVisualizacao);
    div.innerHTML += `<h4>${titulo}</h4>`;

    if (legendaIntervalos.length > 0) {
        for (let i = 0; i < legendaIntervalos.length; i++) {
            const inicio = legendaIntervalos[i];
            const fim = legendaIntervalos[i + 1];
            const cor = cores[i];

            div.innerHTML +=
                `<i style="background:${cor}"></i> ` +
                formatarValor(inicio) + (fim ? "&ndash;" + formatarValor(fim) : "+");
            div.innerHTML += '<br>';
        }
    } else {
        div.innerHTML += '';
    }
}

function getTituloLegenda(visualizacao) {
    switch (visualizacao) {
        case 'visao_geral': return 'Visão Geral';
        case 'frota_total': return 'Frota Total';
        case 'credenciados_cfc': return 'Quantidade de CFCs';
        case 'credenciados_clinicas': return 'Quantidade de Clínicas';
        case 'credenciados_ecv': return 'Quantidade de ECVs';
        case 'credenciados_epiv': return 'Quantidade de EPIVs';
        case 'credenciados_patio': return 'Quantidade de Pátios';
        case 'servicos_cfc': return 'Quantidade de Cursos (CFC)';
        case 'servicos_clinicas': return 'Quantidade de Exames (Clínicas)';
        case 'servicos_ecv': return 'Quantidade de Vistorias (ECV)';
        case 'servicos_epiv': return 'Quantidade de Estampagens (EPIV)';
        case 'servicos_patio': return 'Quantidade de Veículos Removidos (Pátio)';
        default: return 'Legenda';
    }
}

function carregarDados(visualizacao) {
    console.log('Carregando dados para visualização:', visualizacao);
    let endpoint = '';

    // Mostrar overlay de carregamento ANTES de buscar
    const loadingOverlay = document.getElementById("loading-overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.remove("hidden");
        // Atualizar texto para indicar carregamento de dados
        const loadingText = loadingOverlay.querySelector("p");
        if (loadingText) loadingText.textContent = "Carregando dados...";
    }

    switch (visualizacao) {
        case 'visao_geral': endpoint = '/api/credenciados/total'; break;
        case 'frota_total': endpoint = '/api/frotas'; break;
        case 'credenciados_cfc': endpoint = '/api/credenciados/cfc'; break;
        case 'credenciados_clinicas': endpoint = '/api/credenciados/clinicas'; break;
        case 'credenciados_ecv': endpoint = '/api/credenciados/ecv'; break;
        case 'credenciados_epiv': endpoint = '/api/credenciados/epiv'; break;
        case 'credenciados_patio': endpoint = '/api/credenciados/patio'; break;
        case 'servicos_cfc': endpoint = '/api/servicos/cfc'; break;
        case 'servicos_clinicas': endpoint = '/api/servicos/clinicas'; break;
        case 'servicos_ecv': endpoint = '/api/servicos/ecv'; break;
        case 'servicos_epiv': endpoint = '/api/servicos/epiv'; break;
        case 'servicos_patio': endpoint = '/api/servicos/patio'; break;
        default: endpoint = '/api/credenciados/total'; // Fallback
    }

    fetch(endpoint)
        .then(response => {
             if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            processarDados(data, visualizacao);
            if (geojson) {
                geojson.eachLayer(layer => {
                    const id = layer.feature.properties.id;
                    layer.setStyle(getEstilo(id));
                });
            }
            atualizarLegenda();
        })
        .catch(error => {
            console.error('Erro ao carregar dados:', error);
            alert(`Erro ao carregar dados para a visualização '${visualizacao}'. Verifique o console para detalhes.`);
            // Limpar dados antigos para evitar confusão
            dadosMunicipios = {};
            legendaIntervalos = [];
            if (geojson) {
                 geojson.eachLayer(layer => {
                    layer.setStyle(estiloPadrao(layer.feature));
                });
            }
            atualizarLegenda();
        })
        .finally(() => {
            // Esconder overlay de carregamento SEMPRE (sucesso ou erro)
            if (loadingOverlay) {
                loadingOverlay.classList.add("hidden");
            }
        });
}

function processarDados(data, visualizacao) {
    dadosMunicipios = {};
    let valores = [];

    data.forEach(item => {
        let valor;
        const id = item.id_municipio;

        switch (visualizacao) {
            case 'visao_geral': valor = item.total_credenciados || 0; break;
            case 'frota_total': valor = item.total_frota || 0; break;
            case 'credenciados_cfc': valor = item.total_cfc || 0; break;
            case 'credenciados_clinicas': valor = item.total_clinicas || 0; break;
            case 'credenciados_ecv': valor = item.total_ecv || 0; break;
            case 'credenciados_epiv': valor = item.total_epiv || 0; break;
            case 'credenciados_patio': valor = item.total_patio || 0; break;
            case 'servicos_cfc': valor = item.total_cursos || 0; break;
            case 'servicos_clinicas': valor = item.total_exames || 0; break;
            case 'servicos_ecv': valor = item.total_vistorias || 0; break;
            case 'servicos_epiv': valor = item.total_estampagens || 0; break;
            case 'servicos_patio': valor = item.total_veiculos_removidos || 0; break;
            default: valor = 0;
        }
        dadosMunicipios[id] = { valor: valor };
        if (valor > 0) {
            valores.push(valor);
        }
    });

    // Calcular intervalos para a legenda (exemplo simples com quantis)
    if (valores.length > 0) {
        valores.sort((a, b) => a - b);
        const numIntervalos = Math.min(cores.length, valores.length);
        legendaIntervalos = [0]; // Começa com 0
        for (let i = 1; i <= numIntervalos; i++) {
            const index = Math.ceil(i * valores.length / numIntervalos) - 1;
            // Evitar duplicatas nos intervalos
            if (valores[index] > legendaIntervalos[legendaIntervalos.length - 1]) {
                 legendaIntervalos.push(valores[index]);
            }
        }
         // Se o último intervalo calculado for menor que o máximo, adiciona o máximo
        const maxVal = Math.max(...valores);
        if (legendaIntervalos[legendaIntervalos.length - 1] < maxVal) {
             // Remove o último se for igual ao penúltimo antes de adicionar o max
             if(legendaIntervalos.length > 1 && legendaIntervalos[legendaIntervalos.length - 1] === legendaIntervalos[legendaIntervalos.length - 2]) {
                 legendaIntervalos.pop();
             }
             // Adiciona o máximo apenas se for maior que o último intervalo atual
             if (maxVal > legendaIntervalos[legendaIntervalos.length - 1]) {
                legendaIntervalos.push(maxVal);
             }
        }
        // Garante que não haja mais intervalos que cores
        while(legendaIntervalos.length > cores.length + 1) {
            legendaIntervalos.splice(legendaIntervalos.length - 2, 1); // Remove o penúltimo
        }
        // Remove o 0 inicial se não houver valores entre 0 e o próximo intervalo
        if (legendaIntervalos.length > 1 && legendaIntervalos[1] === 0) {
            legendaIntervalos.shift();
        }

    } else {
        legendaIntervalos = [];
    }
    console.log("Intervalos da legenda:", legendaIntervalos);
}

function getCor(valor) {
    if (valor === undefined || valor === null || valor <= 0) {
        return '#CCCCCC'; // Cor padrão para dados ausentes ou zero
    }
    for (let i = 0; i < legendaIntervalos.length; i++) {
        if (valor <= legendaIntervalos[i + 1]) {
            return cores[i];
        }
    }
    // Se for maior que o último intervalo
    return cores[cores.length - 1]; 
}

function estiloPadrao(feature) {
    return {
        fillColor: '#CCCCCC', // Cor padrão inicial
        weight: 1,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

function getEstilo(municipioId) {
    const dados = dadosMunicipios[municipioId];
    const valor = dados ? dados.valor : 0;
    const cor = getCor(valor);

    // Verificar se o município está destacado por algum filtro
    const isMunicipioFiltrado = municipiosFiltrados.includes(municipioId.toString());
    const isRazaoSocialFiltrada = razaoSocialFiltrada && encontrarMunicipiosPorRazaoSocial(razaoSocialFiltrada).includes(municipioId.toString());
    const isCnpjFiltrado = cnpjFiltrado && encontrarMunicipiosPorCNPJ(cnpjFiltrado).includes(municipioId.toString());

    let estilo = {
        fillColor: cor,
        weight: 1,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };

    // Aplicar estilos de destaque sobrepostos
    if (isMunicipioFiltrado) {
        estilo.weight = 3;
        estilo.color = corDestaqueMunicipio;
        estilo.dashArray = '';
        estilo.fillColor = corDestaqueMunicipio; // Sobrescreve a cor base
        estilo.fillOpacity = 0.8;
    }
    if (isRazaoSocialFiltrada) {
        estilo.weight = estilo.weight > 1 ? estilo.weight : 2; // Aumenta se já destacado
        estilo.color = corDestaqueRazaoSocial;
        estilo.dashArray = '';
        // Não sobrescreve fillColor se já destacado por município
        if (!isMunicipioFiltrado) {
             estilo.fillColor = corDestaqueRazaoSocial;
             estilo.fillOpacity = 0.8;
        }
    }
    if (isCnpjFiltrado) {
        estilo.weight = estilo.weight > 1 ? estilo.weight : 2;
        estilo.color = corDestaqueCNPJ;
        estilo.dashArray = '';
         // Não sobrescreve fillColor se já destacado por município ou razão
        if (!isMunicipioFiltrado && !isRazaoSocialFiltrada) {
            estilo.fillColor = corDestaqueCNPJ;
            estilo.fillOpacity = 0.8;
        }
    }

    return estilo;
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: destacarFeature,
        mouseout: resetarDestaque,
        click: mostrarInfoMunicipio
    });
}

function destacarFeature(e) {
    const layer = e.target;
    const props = layer.feature.properties;

    // Estilo temporário de hover
    layer.setStyle({
        weight: 3,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.8
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    info.update(props);
}

function resetarDestaque(e) {
    const layer = e.target;
    const id = layer.feature.properties.id;
    // Reseta para o estilo definido pelos dados e filtros
    layer.setStyle(getEstilo(id));
    info.update();
}

function mostrarInfoMunicipio(e) {
    const layer = e.target;
    const props = layer.feature.properties;
    municipioSelecionado = props.id;

    // Centralizar e dar zoom (opcional)
    // map.fitBounds(layer.getBounds());

    // Buscar detalhes do município para a sidebar
    fetch(`/api/municipio/${props.id}/detalhes`)
        .then(response => response.json())
        .then(data => {
            detalhesMunicipio = data;
            atualizarSidebar();
            abrirSidebar();
        })
        .catch(error => {
            console.error('Erro ao buscar detalhes do município:', error);
            // Exibir mensagem de erro na sidebar
            document.getElementById('info-content').innerHTML = 
                '<p class="error">Erro ao carregar detalhes. Tente novamente.</p>';
            abrirSidebar(); // Abrir mesmo com erro para mostrar a mensagem
        });
}

function atualizarSidebar() {
    const infoContent = document.getElementById('info-content');
    const titleElement = document.getElementById('info-title'); // Assumindo que existe um elemento para o título
    if (!detalhesMunicipio) {
        infoContent.innerHTML = '<p>Selecione um município para ver os detalhes.</p>';
        if (titleElement) titleElement.textContent = 'Informações';
        return;
    }

    if (titleElement) titleElement.textContent = detalhesMunicipio.nome || 'Detalhes do Município';

    let html = `
        <div class="info-section">
            <h3>Dados Gerais</h3>
            <p><strong>População:</strong> ${formatarValor(detalhesMunicipio.populacao || 0)} habitantes</p>
            <p><strong>Frota Total:</strong> ${formatarValor(detalhesMunicipio.frota_total || 0)} veículos</p>
            <p><strong>Habitantes por Veículo:</strong> ${calcularHabitantesPorVeiculo(detalhesMunicipio.populacao, detalhesMunicipio.frota_total)}</p>
        </div>
    `;

    if (detalhesMunicipio.credenciados && Object.keys(detalhesMunicipio.credenciados).length > 0) {
        html += `<div class="info-section"><h3>Credenciados</h3>`;
        const tipos = {
            cfc: 'Centros de Formação de Condutores',
            clinicas: 'Clínicas',
            ecv: 'Empresas Credenciadas de Vistoria',
            epiv: 'Estampadores de Placas',
            patio: 'Pátios'
        };

        for (const tipo in tipos) {
            if (detalhesMunicipio.credenciados[tipo] && detalhesMunicipio.credenciados[tipo].length > 0) {
                html += `<h4>${tipos[tipo]} (${detalhesMunicipio.credenciados[tipo].length})</h4><ul>`;
                detalhesMunicipio.credenciados[tipo].forEach(cred => {
                    html += `<li>${cred.razao_social} (${formatarCNPJ(cred.cnpj)})</li>`;
                });
                html += `</ul>`;
            }
        }
        html += `</div>`;
    }

    if (detalhesMunicipio.servicos && Object.keys(detalhesMunicipio.servicos).length > 0) {
        html += `<div class="info-section"><h3>Serviços (Ano: ${detalhesMunicipio.servicos.ano || 'N/A'})</h3>`;
        const tiposServico = {
            cfc: 'CFC',
            clinicas: 'Clínicas',
            ecv: 'ECV',
            epiv: 'EPIV',
            patio: 'Pátio'
        };

        for (const tipo in tiposServico) {
            if (detalhesMunicipio.servicos[tipo] && detalhesMunicipio.servicos[tipo].detalhamento.length > 0) {
                html += `<h4>${tiposServico[tipo]} (Total: ${formatarValor(detalhesMunicipio.servicos[tipo].total)})</h4><ul>`;
                detalhesMunicipio.servicos[tipo].detalhamento.forEach(det => {
                    html += `<li>${det.tipo}: ${formatarValor(det.quantidade)}</li>`;
                });
                html += `</ul>`;
            }
        }
        html += `</div>`;
    }

    infoContent.innerHTML = html;
}

// Funções para abrir e fechar a sidebar
function abrirSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mapaContainer = document.getElementById('map-container');
    const openButton = document.getElementById('open-sidebar');

    sidebar.classList.remove('hidden');
    mapaContainer.classList.remove('expanded');
    openButton.classList.remove('visible');
    sidebarVisible = true;
    sidebarJustOpened = true; // Marca que foi aberta recentemente

    // Atualizar o tamanho do mapa após a transição da sidebar
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 300); // Tempo da transição CSS
}

function fecharSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mapaContainer = document.getElementById('map-container');
    const openButton = document.getElementById('open-sidebar');

    sidebar.classList.add('hidden');
    mapaContainer.classList.add('expanded');
    openButton.classList.add('visible');
    sidebarVisible = false;

    // Atualizar o tamanho do mapa após a transição da sidebar
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 300); // Tempo da transição CSS
}

// Funções utilitárias
function formatarValor(valor) {
    if (valor === undefined || valor === null) return 'N/A';
    return valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    const numeros = cnpj.replace(/\D/g, '');
    if (numeros.length !== 14) return cnpj; // Retorna original se não tiver 14 dígitos
    return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function calcularHabitantesPorVeiculo(populacao, frota) {
    if (!populacao || !frota || frota === 0) return 'N/A';
    const razao = populacao / frota;
    return razao.toFixed(2);
}

// Função para carregar dados da API conforme a visualização selecionada
function carregarDados(tipoVisualizacao) {
    let endpoint;
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Mostrar overlay de carregamento
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
    
    // Definir o endpoint com base no tipo de visualização
    switch(tipoVisualizacao) {
        case 'credenciados_total':
        case 'visao_geral':
            endpoint = '/api/credenciados/total';
            break;
        case 'credenciados_cfc':
            endpoint = '/api/credenciados/cfc';
            break;
        case 'credenciados_clinicas':
            endpoint = '/api/credenciados/clinicas';
            break;
        case 'credenciados_ecv':
            endpoint = '/api/credenciados/ecv';
            break;
        case 'credenciados_epiv':
            endpoint = '/api/credenciados/epiv';
            break;
        case 'credenciados_patio':
            endpoint = '/api/credenciados/patio';
            break;
        case 'servicos_cfc':
            endpoint = '/api/servicos/cfc';
            break;
        case 'servicos_clinicas':
            endpoint = '/api/servicos/clinicas';
            break;
        case 'servicos_ecv':
            endpoint = '/api/servicos/ecv';
            break;
        case 'servicos_epiv':
            endpoint = '/api/servicos/epiv';
            break;
        case 'servicos_patio':
            endpoint = '/api/servicos/patio';
            break;
        case 'frota_total':
            endpoint = '/api/frotas';
            break;
        default:
            endpoint = '/api/credenciados/total';
    }
    
    // Buscar dados da API
    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            // Armazenar dados para uso no mapa
            dadosMunicipios = {};
            data.forEach(item => {
                dadosMunicipios[item.id_municipio] = item;
            });
            // Se for visão geral, buscar e mesclar dados de frota
            if (tipoVisualizacao === 'visao_geral') {
                fetch('/api/frotas')
                    .then(resp => resp.json())
                    .then(frotas => {
                        frotas.forEach(frota => {
                            if (dadosMunicipios[frota.id_municipio]) {
                                dadosMunicipios[frota.id_municipio].total_frota = frota.total_frota;
                                dadosMunicipios[frota.id_municipio].detalhe_frota = frota.detalhe_frota;
                            }
                        });
                        // Atualizar mapa e sidebar após mesclar frotas
                        atualizarMapaEDepois();
                    });
            } else {
                atualizarMapaEDepois();
            }
            function atualizarMapaEDepois() {
                // Calcular intervalos para a legenda
                calcularIntervalosLegenda(data, tipoVisualizacao);
                // Atualizar o mapa com os novos dados imediatamente
                if (geojson) {
                    geojson.setStyle(estiloPadrao);
                    geojson.eachLayer(function(layer) {
                        const props = layer.feature.properties;
                        layer.unbindPopup();
                        layer.bindPopup(criarConteudoPopup(props), {
                            closeButton: false,
                            offset: L.point(0, -20)
                        });
                    });
                    aplicarFiltros();
                }
                if (legend) {
                    map.removeControl(legend);
                }
                adicionarLegenda();
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
            }
        })
        .catch(error => {
            console.error('Erro ao carregar dados:', error);
            document.getElementById('info-content').innerHTML = 
                '<p class="error">Erro ao carregar dados. Por favor, tente novamente mais tarde.</p>';
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        });
}

// Função para calcular intervalos para a legenda
function calcularIntervalosLegenda(dados, tipoVisualizacao) {
    // Extrair valores relevantes com base no tipo de visualização
    let valores = [];
    switch(tipoVisualizacao) {
        case 'credenciados_total':
            valores = dados.map(item => item.total_credenciados || 0);
            break;
        case 'credenciados_cfc':
            valores = dados.map(item => item.total_cfc || 0);
            break;
        case 'credenciados_clinicas':
            valores = dados.map(item => item.total_clinicas || 0);
            break;
        case 'credenciados_ecv':
            valores = dados.map(item => item.total_ecv || 0);
            break;
        case 'credenciados_epiv':
            valores = dados.map(item => item.total_epiv || 0);
            break;
        case 'credenciados_patio':
            valores = dados.map(item => item.total_patio || 0);
            break;
        case 'servicos_cfc':
            valores = dados.map(item => item.total_cursos || 0);
            break;
        case 'servicos_clinicas':
            valores = dados.map(item => item.total_exames || 0);
            break;
        case 'servicos_ecv':
            valores = dados.map(item => item.total_vistorias || 0);
            break;
        case 'servicos_epiv':
            valores = dados.map(item => item.total_estampagens || 0);
            break;
        case 'servicos_patio':
            valores = dados.map(item => item.total_veiculos_removidos || 0);
            break;
        case 'frota_total':
            valores = dados.map(item => item.total_frota || 0);
            break;
        default:
            valores = dados.map(item => currentVisualizacao === 'visao_geral' ? (item.populacao || 0) : (item.total_credenciados || 0));
    }
    // Encontrar valor máximo
    const valorMaximo = Math.max(...valores);
    // Definir intervalos com base no valor máximo
    if (tipoVisualizacao === 'frota_total' && valorMaximo > 100000) {
        // Para frotas grandes, criar intervalos proporcionais
        const step = Math.ceil(valorMaximo / 7);
        legendaIntervalos = [0];
        for (let i = 1; i <= 7; i++) {
            legendaIntervalos.push(i * step);
        }
    } else if (valorMaximo <= 10) {
        legendaIntervalos = [0, 2, 5, 10];
    } else if (valorMaximo <= 20) {
        legendaIntervalos = [0, 5, 10, 20];
    } else if (valorMaximo <= 50) {
        legendaIntervalos = [0, 10, 20, 50];
    } else if (valorMaximo <= 100) {
        legendaIntervalos = [0, 20, 50, 100];
    } else if (valorMaximo <= 200) {
        legendaIntervalos = [0, 20, 50, 100, 200];
    } else if (valorMaximo <= 500) {
        legendaIntervalos = [0, 50, 100, 200, 350, 500];
    } else if (valorMaximo <= 1000) {
        legendaIntervalos = [0, 100, 200, 500, 750, 1000];
    } else {
        // Para valores muito grandes, criar intervalos proporcionais
        const intervalo = Math.ceil(valorMaximo / 6);
        legendaIntervalos = [0];
        for (let i = 1; i <= 6; i++) {
            legendaIntervalos.push(i * intervalo);
        }
    }
}

// Função para definir o estilo de cada município no mapa
function estiloPadrao(feature) {
    const municipioId = feature.properties.id.toString(); // Garantir que é string
    const dadosMunicipio = dadosMunicipios[municipioId];
    
    // Valor padrão se não houver dados
    let valor = 0;
    
    // Definir o valor com base no tipo de visualização atual
    if (dadosMunicipio) {
        switch(currentVisualizacao) {
            case 'visao_geral':
                valor = dadosMunicipio.populacao || 0;
                break;
            case 'credenciados_cfc':
                valor = dadosMunicipio.total_cfc || 0;
                break;
            case 'credenciados_clinicas':
                valor = dadosMunicipio.total_clinicas || 0;
                break;
            case 'credenciados_ecv':
                valor = dadosMunicipio.total_ecv || 0;
                break;
            case 'credenciados_epiv':
                valor = dadosMunicipio.total_epiv || 0;
                break;
            case 'credenciados_patio':
                valor = dadosMunicipio.total_patio || 0;
                break;
            case 'servicos_cfc':
                valor = dadosMunicipio.total_cursos !== undefined ? dadosMunicipio.total_cursos : (dadosMunicipio.quantidade || 0);
                break;
            case 'servicos_clinicas':
                valor = dadosMunicipio.total_exames !== undefined ? dadosMunicipio.total_exames : (dadosMunicipio.quantidade || 0);
                break;
            case 'servicos_ecv':
                valor = dadosMunicipio.total_vistorias !== undefined ? dadosMunicipio.total_vistorias : (dadosMunicipio.quantidade || 0);
                break;
            case 'servicos_epiv':
                valor = dadosMunicipio.total_estampagens !== undefined ? dadosMunicipio.total_estampagens : (dadosMunicipio.quantidade || 0);
                break;
            case 'servicos_patio':
                valor = dadosMunicipio.total_veiculos_removidos !== undefined ? dadosMunicipio.total_veiculos_removidos : (dadosMunicipio.quantidade || 0);
                break;
            case 'frota_total':
                valor = dadosMunicipio.total_frota || 0;
                break;
            default:
                valor = dadosMunicipio.total_credenciados || 0;
        }
    }

    // Verificar se o município está filtrado/selecionado
    const isMunicipioFiltrado = municipiosFiltrados.includes(municipioId);
    const municipiosComRazao = razaoSocialFiltrada ? encontrarMunicipiosPorRazaoSocial(razaoSocialFiltrada) : [];
    const isRazaoFiltrada = razaoSocialFiltrada && municipiosComRazao.includes(municipioId);
    const municipiosComCNPJ = cnpjFiltrado ? encontrarMunicipiosPorCNPJ(cnpjFiltrado) : [];
    const isCNPJFiltrado = cnpjFiltrado && municipiosComCNPJ.includes(municipioId);

    // Definir estilo base - GARANTIR BORDA VISÍVEL
    let estilo = {
        fillColor: getColor(valor),
        weight: 1, // Borda padrão
        opacity: 1,
        color: '#000000', // Cor da borda padrão PRETA
        dashArray: '', // Linha sólida padrão
        fillOpacity: 0.7
    };

    // Sobrescrever estilo se estiver filtrado/selecionado
    if (isMunicipioFiltrado) {
        estilo.weight = 2;
        estilo.color = corDestaqueMunicipio;
        estilo.dashArray = '3'; // Pontilhado para seleção
    } else if (isRazaoFiltrada) {
        estilo.weight = 2;
        estilo.color = corDestaqueRazaoSocial;
        estilo.dashArray = '3';
    } else if (isCNPJFiltrado) {
        estilo.weight = 2;
        estilo.color = corDestaqueCNPJ;
        estilo.dashArray = '3';
    }

    return estilo;
}

// Função para definir a cor com base no valor
function getColor(d) {
    for (let i = legendaIntervalos.length - 1; i >= 0; i--) {
        if (d >= legendaIntervalos[i]) {
            return cores[i];
        }
    }
    return cores[0];
}

// Função para adicionar interatividade a cada município
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
    
    // Adicionar popup
    layer.bindPopup(criarConteudoPopup(feature.properties), {
        closeButton: false,
        offset: L.point(0, -20)
    });
}

// Função para criar o conteúdo do popup
function criarConteudoPopup(props) {
    const municipioId = props.id;
    const municipioNome = props.name;
    const dadosMunicipio = dadosMunicipios[municipioId];
    
    let conteudo = `<div class="popup-content"><strong>${municipioNome}</strong>`;
    
    if (dadosMunicipio) {
        // Definir o valor e o texto com base no tipo de visualização
        let valor, texto;
        
        switch(currentVisualizacao) {
            case 'visao_geral':
                valor = dadosMunicipio.populacao || 0;
                texto = 'População';
                break;
            case 'credenciados_cfc':
                valor = dadosMunicipio.total_cfc || 0;
                texto = 'Total de CFCs';
                break;
            case 'credenciados_clinicas':
                valor = dadosMunicipio.total_clinicas || 0;
                texto = 'Total de Clínicas';
                break;
            case 'credenciados_ecv':
                valor = dadosMunicipio.total_ecv || 0;
                texto = 'Total de ECVs';
                break;
            case 'credenciados_epiv':
                valor = dadosMunicipio.total_epiv || 0;
                texto = 'Total de EPIVs';
                break;
            case 'credenciados_patio':
                valor = dadosMunicipio.total_patio || 0;
                texto = 'Total de Pátios';
                break;
            case 'servicos_cfc':
                valor = dadosMunicipio.total_cursos !== undefined ? dadosMunicipio.total_cursos : (dadosMunicipio.quantidade || 0);
                texto = 'Total de Cursos';
                break;
            case 'servicos_clinicas':
                valor = dadosMunicipio.total_exames !== undefined ? dadosMunicipio.total_exames : (dadosMunicipio.quantidade || 0);
                texto = 'Total de Exames';
                break;
            case 'servicos_ecv':
                valor = dadosMunicipio.total_vistorias !== undefined ? dadosMunicipio.total_vistorias : (dadosMunicipio.quantidade || 0);
                texto = 'Total de Vistorias';
                break;
            case 'servicos_epiv':
                valor = dadosMunicipio.total_estampagens !== undefined ? dadosMunicipio.total_estampagens : (dadosMunicipio.quantidade || 0);
                texto = 'Total de Estampagens';
                break;
            case 'servicos_patio':
                valor = dadosMunicipio.total_veiculos_removidos !== undefined ? dadosMunicipio.total_veiculos_removidos : (dadosMunicipio.quantidade || 0);
                texto = 'Total de Veículos Removidos';
                break;
            case 'frota_total':
                valor = dadosMunicipio.total_frota || 0;
                texto = 'Total de Frota';
                break;
            default:
                valor = dadosMunicipio.total_credenciados || 0;
                texto = 'Total de Credenciados';
        }
        
        conteudo += `<br>${texto}: ${formatarNumero(valor)}`;
    } else {
        conteudo += '<br>Sem dados disponíveis';
    }
    
    conteudo += '</div>';
    
    return conteudo;
}

// Função para destacar um município ao passar o mouse
function highlightFeature(e) {
    const layer = e.target;
    const featureId = layer.feature.properties.id.toString();

    // Aplicar estilo de hover
    layer.setStyle({
        weight: 3, // Borda mais grossa no hover
        color: "#555",
        dashArray: "",
        fillOpacity: 0.8
    });

    // Trazer para frente, exceto se for um dos navegadores problemáticos
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    // Abrir o popup SEMPRE ao passar o mouse
    layer.openPopup();  
    const municipioId = layer.feature.properties.id.toString();
    
    // Não resetar o estilo se o município estiver destacado por um filtro
    if (municipiosFiltrados.includes(municipioId) ||
        (razaoSocialFiltrada && encontrarMunicipiosPorRazaoSocial(razaoSocialFiltrada).includes(municipioId)) ||
        (cnpjFiltrado && encontrarMunicipiosPorCNPJ(cnpjFiltrado).includes(municipioId))) {
        return;
    }
    
    geojson.resetStyle(layer);
    
    // Fechar popup
     layer.openPopup();
}

// Função para resetar o destaque visual ao tirar o mouse
function resetHighlight(e) {
    const layer = e.target;
    const feature = layer.feature;
    const municipioId = feature.properties.id.toString();

    let estiloFinal = estiloPadrao(feature); // Começa com o estilo padrão da visualização

    // Verifica se este município está filtrado e aplica o estilo de filtro correspondente
    // A ordem importa se um município puder corresponder a múltiplos filtros
    if (municipiosFiltrados.includes(municipioId)) {
        estiloFinal = { // Sobrescreve com estilo de filtro de município
            weight: 3,
            color: corDestaqueMunicipio,
            dashArray: '',
            fillColor: corDestaqueMunicipio,
            fillOpacity: 0.7
        };
    } else if (razaoSocialFiltrada && encontrarMunicipiosPorRazaoSocial(razaoSocialFiltrada).includes(municipioId)) {
         estiloFinal = { // Sobrescreve com estilo de filtro de razão social
            weight: 3,
            color: corDestaqueRazaoSocial,
            dashArray: '',
            fillColor: corDestaqueRazaoSocial,
            fillOpacity: 0.7
        };
    } else if (cnpjFiltrado && encontrarMunicipiosPorCNPJ(cnpjFiltrado).includes(municipioId)) {
         estiloFinal = { // Sobrescreve com estilo de filtro de CNPJ
            weight: 3,
            color: corDestaqueCNPJ,
            dashArray: '',
            fillColor: corDestaqueCNPJ,
            fillOpacity: 0.7
        };
    }
    // Se não estiver filtrado, estiloFinal continua sendo o estiloPadrao

    layer.setStyle(estiloFinal); // Aplica o estilo final (padrão ou filtro)

    // Fechar o popup ao tirar o mouse
    layer.closePopup();
}

// Função para dar zoom e mostrar detalhes ao clicar em um município
function zoomToFeature(e) {
    const layer = e.target;
    const municipioId = layer.feature.properties.id;
    const municipioNome = layer.feature.properties.name;
    
    // Dar zoom no município
    map.fitBounds(layer.getBounds());
    
    // Armazenar o município selecionado
    municipioSelecionado = municipioId;
    
    // Carregar detalhes do município
    carregarDetalhesMunicipio(municipioId, municipioNome);
    
    // Abrir a sidebar
    abrirSidebar();

    // Definir a flag temporária
    sidebarJustOpened = true;
    // Resetar a flag após um pequeno delay para permitir que o evento de clique atual termine
    setTimeout(() => {
        sidebarJustOpened = false;
    }, 0);

    // Impedir que o clique no município propague para o listener do document
    L.DomEvent.stopPropagation(e);
}

// Função para carregar detalhes de um município
function carregarDetalhesMunicipio(municipioId, municipioNome) {
    // Mostrar mensagem de carregamento
    document.getElementById('info-content').innerHTML = '<p>Carregando informações...</p>';
    
    // Buscar detalhes do município na API
    fetch(`/api/municipio/${municipioId}/detalhes`)
        .then(response => response.json())
        .then(data => {
            // Armazenar detalhes para uso posterior
            detalhesMunicipio = data;
            
            // Atualizar o conteúdo da sidebar
            atualizarConteudoSidebar(municipioNome);
        })
        .catch(error => {
            console.error('Erro ao carregar detalhes do município:', error);
            document.getElementById('info-content').innerHTML = 
                '<p class="error">Erro ao carregar detalhes. Por favor, tente novamente mais tarde.</p>';
        });
}

function atualizarConteudoSidebar(municipioNome) {
    const infoContent = document.getElementById('info-content');
    
    // Verificar se há detalhes disponíveis
    if (!detalhesMunicipio) {
        infoContent.innerHTML = `
            <div class="info-header">
                <h3>${municipioNome}</h3>
            </div>
            <p>Não há dados disponíveis para este município.</p>
        `;
        return;
    }
    
    // Iniciar o HTML com o cabeçalho
    let html = `
        <div class="info-header">
            <h3>${municipioNome}</h3>
        </div>
    `;

    // Função para criar tabela de frotas formatada
    function criarTabelaFrotas(dadosFrota) {
        if (!dadosFrota) return '';
        let tabelaHtml = `<h4>Frota de Veículos</h4>`;
        tabelaHtml +=
            '<div class="tabela-scroll-container">' +
            '    <table class="tabela-servicos">' +
            '        <thead>' +
            '            <tr>' +
            '                <th>Tipo de Veículo</th>' +
            '                <th>Quantidade</th>' +
            '            </tr>' +
            '        </thead>' +
            '        <tbody>';
        for (const [tipo, quantidade] of Object.entries(dadosFrota)) {
            tabelaHtml += `<tr><td>${tipo}</td><td>${formatarNumero(quantidade)}</td></tr>`;
        }
        tabelaHtml +=
            '        </tbody>' +
            '    </table>' +
            '</div>';
        return tabelaHtml;
    }

    // Exibir tabela detalhada de frota na visualização de frota_total
    if (currentVisualizacao === 'frota_total') {
        const dados = dadosMunicipios[municipioSelecionado?.toString()];
        if (dados) {
            html += '<div class="info-pop-frota">';
            if (dados.total_frota !== undefined) {
                html += `<div><strong>Frota Total:</strong> ${formatarNumero(dados.total_frota)}</div>`;
            }
            // Tabela detalhada de veículos
            if (dados.detalhe_frota) {
                html += criarTabelaFrotas(dados.detalhe_frota);
            }
            html += '</div>';
        }
        infoContent.innerHTML = html;
        return;
    }

    // Exibir população e frota total no topo se visão geral
    if (currentVisualizacao === 'visao_geral') {
        const dados = dadosMunicipios[municipioSelecionado?.toString()];
        if (dados) {
            html += '<div class="info-pop-frota">';
            if (dados.populacao !== undefined) {
                html += `<div><strong>População:</strong> ${formatarNumero(dados.populacao)}</div>`;
            }
            if (dados.total_frota !== undefined) {
                html += `<div><strong>Frota Total:</strong> ${formatarNumero(dados.total_frota)}</div>`;
            }
            html += '</div>';
        }
    }

    // Determinar quais seções mostrar com base na visualização
    const mostrarVisaoGeral = currentVisualizacao === 'visao_geral';
    const mostrarCFC = mostrarVisaoGeral || currentVisualizacao === 'credenciados_cfc' || currentVisualizacao === 'servicos_cfc';
    const mostrarClinicas = mostrarVisaoGeral || currentVisualizacao === 'credenciados_clinicas' || currentVisualizacao === 'servicos_clinicas';
    const mostrarECV = mostrarVisaoGeral || currentVisualizacao === 'credenciados_ecv' || currentVisualizacao === 'servicos_ecv';
    const mostrarEPIV = mostrarVisaoGeral || currentVisualizacao === 'credenciados_epiv' || currentVisualizacao === 'servicos_epiv';
    const mostrarPatio = mostrarVisaoGeral || currentVisualizacao === 'credenciados_patio' || currentVisualizacao === 'servicos_patio';

    // --- Tabela de Serviços ---
    let temServicosParaMostrar = false;
    let tabelaServicosHtml = 
        // Título fora do container rolável
        "<h4>Serviços no Município</h4>" +
        "<div class=\"tabela-scroll-container\">" + // Novo container para rolagem
        "    <table class=\"tabela-servicos\">" +
        "        <thead>" +
        "            <tr>" +
        "                <th>Tipo de Serviço</th>" +
        "                <th>Quantidade</th>" +
        "            </tr>" +
        "        </thead>" +
        "        <tbody>";

    // Adicionar linhas para cada tipo de serviço relevante
    if (mostrarCFC && detalhesMunicipio.servicos.cfc && detalhesMunicipio.servicos.cfc.detalhamento) {
        detalhesMunicipio.servicos.cfc.detalhamento.forEach(item => {
            tabelaServicosHtml += `<tr><td>${item.tipo}</td><td>${formatarNumero(item.quantidade)}</td></tr>`;
            temServicosParaMostrar = true;
        });
    }
    if (mostrarClinicas && detalhesMunicipio.servicos.clinicas && detalhesMunicipio.servicos.clinicas.detalhamento) {
        detalhesMunicipio.servicos.clinicas.detalhamento.forEach(item => {
            tabelaServicosHtml += `<tr><td>${item.tipo}</td><td>${formatarNumero(item.quantidade)}</td></tr>`;
            temServicosParaMostrar = true;
        });
    }
    if (mostrarECV && detalhesMunicipio.servicos.ecv && detalhesMunicipio.servicos.ecv.detalhamento) {
        detalhesMunicipio.servicos.ecv.detalhamento.forEach(item => {
            tabelaServicosHtml += `<tr><td>${item.tipo}</td><td>${formatarNumero(item.quantidade)}</td></tr>`;
            temServicosParaMostrar = true;
        });
    }
    if (mostrarEPIV && detalhesMunicipio.servicos.epiv && detalhesMunicipio.servicos.epiv.detalhamento) {
        detalhesMunicipio.servicos.epiv.detalhamento.forEach(item => {
            tabelaServicosHtml += `<tr><td>${item.tipo}</td><td>${formatarNumero(item.quantidade)}</td></tr>`;
            temServicosParaMostrar = true;
        });
    }
    if (mostrarPatio && detalhesMunicipio.servicos.patio && detalhesMunicipio.servicos.patio.detalhamento) {
        detalhesMunicipio.servicos.patio.detalhamento.forEach(item => {
            tabelaServicosHtml += `<tr><td>${item.tipo}</td><td>${formatarNumero(item.quantidade)}</td></tr>`;
            temServicosParaMostrar = true;
        });
    }

    tabelaServicosHtml += 
        "        </tbody>" +
        "    </table>" +
        "</div>"; // Fechar tabela-scroll-container

    if (temServicosParaMostrar) {
        html += tabelaServicosHtml;
    } else if (!mostrarVisaoGeral) {
        html += '<p>Nenhum serviço deste tipo encontrado neste município.</p>';
    }

    // Adicionar tabela de frotas na visão geral
    if (mostrarVisaoGeral) {
        const dados = dadosMunicipios[municipioSelecionado?.toString()];
        if (dados && dados.detalhe_frota) {
            html += criarTabelaFrotas(dados.detalhe_frota);
        }
    }

    // --- Tabelas de Credenciados ---
    function criarTabelaCredenciados(titulo, tipoCredenciado, dados) {
        if (!dados || dados.length === 0) {
            return `<p>Nenhum(a) ${titulo} encontrado(a) neste município.</p>`;
        }
        // Título fora do container rolável
        let tabelaHtml = `<h4>${titulo} no Município (${dados.length})</h4>`;
        tabelaHtml += 
            "<div class=\"tabela-scroll-container\">" + // Novo container para rolagem
            "    <table class=\"tabela-credenciados\">" +
            "        <thead>" +
            "            <tr>" +
            "                <th>Razão Social</th>" +
            "                <th>CNPJ</th>" +
            "            </tr>" +
            "        </thead>" +
            "        <tbody>";
        dados.forEach(cred => {
            tabelaHtml += `
                <tr>
                    <td>${cred.razao_social}</td>
                    <td>${formatarCNPJ(cred.cnpj)}</td>
                </tr>
            `;
        });
        tabelaHtml += 
            "        </tbody>" +
            "    </table>" +
            "</div>"; // Fechar tabela-scroll-container
        return tabelaHtml;
    }

    if (mostrarCFC && detalhesMunicipio.credenciados.cfc) {
        html += criarTabelaCredenciados('CFCs', 'cfc', detalhesMunicipio.credenciados.cfc);
    }
    if (mostrarClinicas && detalhesMunicipio.credenciados.clinicas) {
        html += criarTabelaCredenciados('Clínicas', 'clinicas', detalhesMunicipio.credenciados.clinicas);
    }
    if (mostrarECV && detalhesMunicipio.credenciados.ecv) {
        html += criarTabelaCredenciados('ECVs', 'ecv', detalhesMunicipio.credenciados.ecv);
    }
    if (mostrarEPIV && detalhesMunicipio.credenciados.epiv) {
        html += criarTabelaCredenciados('EPIVs', 'epiv', detalhesMunicipio.credenciados.epiv);
    }
    if (mostrarPatio && detalhesMunicipio.credenciados.patio) {
        html += criarTabelaCredenciados('Pátios', 'patio', detalhesMunicipio.credenciados.patio);
    }

    // Atualizar o conteúdo da sidebar
    infoContent.innerHTML = html;
}

// Função para adicionar a legenda ao mapa
function adicionarLegenda() {
    if (legend) {
        map.removeControl(legend);
    }

    legend = L.control({position: 'topleft'});

    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        if (!legendaIntervalos || legendaIntervalos.length === 0) {
             div.innerHTML = '<h4>Legenda</h4><p>Dados insuficientes para gerar legenda.</p>';
             return div;
        }
        div.innerHTML = '<h4>Legenda</h4>';
        // Adicionar itens da legenda com cor
        const maxColorIndex = cores.length - 1;
        for (let i = 0; i < legendaIntervalos.length; i++) {
            const de = legendaIntervalos[i];
            const ate = legendaIntervalos[i + 1];
            const cor = cores[Math.min(i, maxColorIndex)];
            div.innerHTML += `
                <div class="legend-item" style="display:flex;align-items:center;margin-bottom:2px;">
                    <div class="legend-color" style="background:${cor};width:18px;height:18px;display:inline-block;margin-right:8px;border:1px solid #888;"></div>
                    <span>${formatarNumero(de)}${ate ? ' – ' + formatarNumero(ate) : '+'}</span>
                </div>
            `;
        }
        return div;
    };

    legend.addTo(map);
}

// Função para formatar CNPJ
function formatarCNPJ(cnpj) {
    // Remover caracteres não numéricos
    cnpj = cnpj.replace(/\D/g, '');
    
    // Adicionar zeros à esquerda se necessário
    while (cnpj.length < 14) {
        cnpj = '0' + cnpj;
    }
    
    // Formatar como XX.XXX.XXX/XXXX-XX
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

// Função utilitária para formatar números
function formatarNumero(valor) {
    return (valor || 0).toLocaleString();
}
