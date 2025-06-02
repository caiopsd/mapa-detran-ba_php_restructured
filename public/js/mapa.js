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
    carregarDados(currentVisualizacao);
    
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
        // Mostrar overlay de carregamento IMEDIATAMENTE ao trocar a visualização
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }
        // Chamar a função que carrega os dados (ela também gerencia o overlay)
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
    closeButton.addEventListener("click", fecharSidebar);

    // Abrir pelo botão de menu
    openButton.addEventListener("click", function(event) {
        event.stopPropagation(); // Impede que o clique no botão propague
        abrirSidebar();
    });

    // Fechar clicando fora da sidebar
    document.addEventListener("click", function(event) {
        // Verifica se a sidebar está visível E o clique NÃO foi dentro da sidebar E NÃO foi no botão de abrir E a sidebar NÃO acabou de ser aberta
        if (sidebarVisible && !sidebar.contains(event.target) && !openButton.contains(event.target)) {
            if (sidebarJustOpened) {
                // Se a sidebar acabou de ser aberta pelo clique no município, ignora este clique e reseta a flag
                sidebarJustOpened = false;
            } else {
                // Se não foi aberta agora, fecha a sidebar
                fecharSidebar();
            }
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

// Função para carregar dados para os seletores
async function carregarDadosSeletores() {
    // Carregar lista de municípios
    fetch('./municipios.php')
        .then(response => response.json())
        .then(data => {
            todosMunicipios = data;
            
            // Preencher seletor de municípios
            const seletorMunicipios = document.getElementById('municipios');
            seletorMunicipios.innerHTML = '';
            
            data.forEach(municipio => {
                const option = document.createElement('option');
                option.value = municipio.id;
                option.textContent = municipio.nome;
                seletorMunicipios.appendChild(option);
            });
            
            // Atualizar Select2
            $('#municipios').trigger('change');
        })
        .catch(error => {
            console.error('Erro ao carregar municípios:', error);
        });

    try {
        // Usa o endpoint /api/credenciados do seu backend PHP
        const responseCredenciados = await fetch('/credenciados.php'); 

        if (!responseCredenciados.ok) {
            const errorText = await responseCredenciados.text();
            console.error(`HTTP error fetching /api/credenciados: ${responseCredenciados.status}. Response: ${errorText}`);
            throw new Error(`HTTP error fetching credenciados list: ${responseCredenciados.status}`);
        }

        const contentType = responseCredenciados.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const responseText = await responseCredenciados.text();
            console.error("Server did not return JSON for /api/credenciados. Response:", responseText);
            throw new Error("Server did not return JSON for credenciados list.");
        }

        todosCredenciados = await responseCredenciados.json(); 

        // Validação: Verifique se o id_municipio está presente após a alteração no backend
        if (todosCredenciados.length > 0 && todosCredenciados[0].id_municipio === undefined) {
            console.warn("Dados de /api/credenciados recebidos, mas 'id_municipio' está faltando. Verifique a alteração no backend PHP.");
        }

        const selectRazaoSocial = $("#razao-social");
        const selectCNPJ = $("#cnpj");

        const rsPlaceholderOption = selectRazaoSocial.find('option[value=""]').clone();
        selectRazaoSocial.empty();
        if(rsPlaceholderOption.length) selectRazaoSocial.append(rsPlaceholderOption); else selectRazaoSocial.append(new Option("Selecione uma razão social", ""));

        const cnpjPlaceholderOption = selectCNPJ.find('option[value=""]').clone();
        selectCNPJ.empty();
        if(cnpjPlaceholderOption.length) selectCNPJ.append(cnpjPlaceholderOption); else selectCNPJ.append(new Option("Selecione um CNPJ", ""));
        
        const razoesSociais = new Set();
        const cnpjsMap = new Map(); 

        if (todosCredenciados && Array.isArray(todosCredenciados)) {
            todosCredenciados.forEach(cred => {
                if (cred.razao_social) {
                    razoesSociais.add(String(cred.razao_social).trim());
                }
                if (cred.cnpj) {
                    const cnpjOriginal = String(cred.cnpj).trim();
                    const cnpjNormalizado = cnpjOriginal.replace(/\D/g, ''); 
                    if (cnpjNormalizado.length > 0 && !cnpjsMap.has(cnpjNormalizado)) {
                        cnpjsMap.set(cnpjNormalizado, formatarCNPJ(cnpjOriginal)); 
                    }
                }
            });
        } else {
            console.warn("Nenhum dado em 'todosCredenciados' ou formato incorreto após fetch de /api/credenciados.");
        }

        Array.from(razoesSociais).sort((a,b) => a.localeCompare(b)).forEach(rs => {
            selectRazaoSocial.append(new Option(rs, rs));
        });

        const sortedCnpjs = Array.from(cnpjsMap.entries()).sort((a, b) => a[1].localeCompare(b[1])); 
        sortedCnpjs.forEach(([cnpjNormalizado, cnpjFormatado]) => {
            selectCNPJ.append(new Option(cnpjFormatado, cnpjNormalizado)); 
        });
        
        if (selectRazaoSocial.data('select2')) selectRazaoSocial.trigger('change.select2');
        if (selectCNPJ.data('select2')) selectCNPJ.trigger('change.select2');

    } catch (error) {
        console.error("Erro na função carregarDadosSeletores (Razão Social/CNPJ):", error);
        // alert("Falha ao carregar opções de filtro para Razão Social e CNPJ.");
    }
}

// Função para aplicar filtros e destacar municípios
function aplicarFiltros() {
    console.log('Aplicando filtros...');
    console.log('Municípios filtrados:', municipiosFiltrados);
    console.log('Razão social filtrada:', razaoSocialFiltrada);
    console.log('CNPJ filtrado:', cnpjFiltrado);
    
    if (!geojson) {
        console.error('GeoJSON não está disponível');
        return;
    }
    
    // Resetar estilos
    geojson.eachLayer(function(layer) {
        layer.setStyle(estiloPadrao(layer.feature));
    });
    
    // Aplicar destaque para municípios selecionados
    if (municipiosFiltrados.length > 0) {
        geojson.eachLayer(function(layer) {
            const municipioId = layer.feature.properties.id;
            if (municipiosFiltrados.includes(municipioId.toString())) {
                layer.setStyle({
                    weight: 3,
                    color: corDestaqueMunicipio,
                    dashArray: '',
                    fillColor: corDestaqueMunicipio,
                    fillOpacity: 0.7
                });
                
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    layer.bringToFront();
                }
            }
        });
    }
    
    // Aplicar destaque para razão social
    if (razaoSocialFiltrada) {
        // Encontrar municípios com esta razão social
        const municipiosComRazaoSocial = encontrarMunicipiosPorRazaoSocial(razaoSocialFiltrada);
        console.log('Municípios com razão social:', municipiosComRazaoSocial);
        
        geojson.eachLayer(function(layer) {
            const municipioId = layer.feature.properties.id;
            if (municipiosComRazaoSocial.includes(municipioId.toString())) {
                layer.setStyle({
                    weight: 3,
                    color: corDestaqueRazaoSocial,
                    dashArray: '',
                    fillColor: corDestaqueRazaoSocial,
                    fillOpacity: 0.7
                });
                
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    layer.bringToFront();
                }
            }
        });
    }
    
    // Aplicar destaque para CNPJ
    if (cnpjFiltrado) {
        // Encontrar municípios com este CNPJ
        const municipiosComCNPJ = encontrarMunicipiosPorCNPJ(cnpjFiltrado);
        console.log('Municípios com CNPJ:', municipiosComCNPJ);
        
        geojson.eachLayer(function(layer) {
            const municipioId = layer.feature.properties.id;
            if (municipiosComCNPJ.includes(municipioId.toString())) {
                layer.setStyle({
                    weight: 3,
                    color: corDestaqueCNPJ,
                    dashArray: '',
                    fillColor: corDestaqueCNPJ,
                    fillOpacity: 0.7
                });
                
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    layer.bringToFront();
                }
            }
        });
    }
    
    // Atualizar legenda de filtros
    atualizarLegendaFiltros();
}

// Função para encontrar municípios por razão social
function encontrarMunicipiosPorRazaoSocial(razaoSocial) {
    const municipiosIds = [];
    
    todosCredenciados.forEach(credenciado => {
        if (credenciado.razao_social === razaoSocial) {
            municipiosIds.push(credenciado.id_municipio.toString());
        }
    });
    
    return [...new Set(municipiosIds)]; // Remover duplicatas
}

// Função para encontrar municípios por CNPJ
function encontrarMunicipiosPorCNPJ(cnpj) {
    const municipiosIds = [];
    
    todosCredenciados.forEach(credenciado => {
        if (credenciado.cnpj === cnpj) {
            municipiosIds.push(credenciado.id_municipio.toString());
        }
    });
    
    return [...new Set(municipiosIds)]; // Remover duplicatas
}

// Função para atualizar a legenda de filtros aplicados
function atualizarLegendaFiltros() {
    const legendaContent = document.getElementById('legenda-content');
    legendaContent.innerHTML = '';
    
    // Verificar se há algum filtro aplicado
    if (municipiosFiltrados.length === 0 && !razaoSocialFiltrada && !cnpjFiltrado) {
        legendaContent.innerHTML = '<p>Nenhum filtro aplicado</p>';
        return;
    }
    
    // Adicionar municípios filtrados
    if (municipiosFiltrados.length > 0) {
        const nomesMunicipios = municipiosFiltrados.map(id => {
            const municipio = todosMunicipios.find(m => m.id.toString() === id);
            return municipio ? municipio.nome : id;
        });
        
        const item = document.createElement('div');
        item.className = 'filtro-item';
        item.innerHTML = `
            <div class="filtro-cor" style="background-color: ${corDestaqueMunicipio}"></div>
            <div class="filtro-texto">Municípios: ${nomesMunicipios.join(', ')}</div>
            <button class="filtro-remover" data-tipo="municipios">×</button>
        `;
        legendaContent.appendChild(item);
        
        // Adicionar evento para remover filtro
        item.querySelector('.filtro-remover').addEventListener('click', function() {
            $('#municipios').val(null).trigger('change');
        });
    }
    
    // Adicionar razão social filtrada
    if (razaoSocialFiltrada) {
        const item = document.createElement('div');
        item.className = 'filtro-item';
        item.innerHTML = `
            <div class="filtro-cor" style="background-color: ${corDestaqueRazaoSocial}"></div>
            <div class="filtro-texto">Razão Social: ${razaoSocialFiltrada}</div>
            <button class="filtro-remover" data-tipo="razao-social">×</button>
        `;
        legendaContent.appendChild(item);
        
        // Adicionar evento para remover filtro
        item.querySelector('.filtro-remover').addEventListener('click', function() {
            $('#razao-social').val('').trigger('change');
        });
    }
    
    // Adicionar CNPJ filtrado
    if (cnpjFiltrado) {
        const item = document.createElement('div');
        item.className = 'filtro-item';
        item.innerHTML = `
            <div class="filtro-cor" style="background-color: ${corDestaqueCNPJ}"></div>
            <div class="filtro-texto">CNPJ: ${formatarCNPJ(cnpjFiltrado)}</div>
            <button class="filtro-remover" data-tipo="cnpj">×</button>
        `;
        legendaContent.appendChild(item);
        
        // Adicionar evento para remover filtro
        item.querySelector('.filtro-remover').addEventListener('click', function() {
            $('#cnpj').val('').trigger('change');
        });
    }
}

// Função para limpar todos os filtros
function limparFiltros() {
    // Limpar seletores
    $('#municipios').val(null).trigger('change');
    $('#razao-social').val('').trigger('change');
    $('#cnpj').val('').trigger('change');
    
    // Limpar variáveis
    municipiosFiltrados = [];
    razaoSocialFiltrada = null;
    cnpjFiltrado = null;
    
    // Resetar estilos do mapa
    if (geojson) {
        geojson.eachLayer(function(layer) {
            layer.setStyle(estiloPadrao(layer.feature));
        });
    }
    
    // Atualizar legenda
    atualizarLegendaFiltros();
}

// Função para fechar a sidebar
function fecharSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mapContainer = document.getElementById('map-container');
    const openButton = document.getElementById('open-sidebar');
    
    sidebar.classList.add('hidden');
    mapContainer.classList.add('expanded');
    openButton.classList.add('visible');
    sidebarVisible = false;
}

// Função para abrir a sidebar
function abrirSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mapContainer = document.getElementById('map-container');
    const openButton = document.getElementById('open-sidebar');
    
    sidebar.classList.remove('hidden');
    mapContainer.classList.remove('expanded');
    openButton.classList.remove('visible');
    sidebarVisible = true;
}

// Função para inicializar o mapa
function inicializarMapa() {
    // Coordenadas aproximadas do centro da Bahia
    const centroBahia = [-12.5, -41.7];
    
    // Criar o mapa
    map = L.map('mapa').setView(centroBahia, 7);
    
    // Adicionar camada de mapa base (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Carregar o GeoJSON da Bahia
    fetch('./data/geo-ba.json')
        .then(response => response.json())
        .then(data => {
            // Armazenar o GeoJSON para uso posterior
            geojson = L.geoJson(data, {
                style: estiloPadrao,
                onEachFeature: onEachFeature
            }).addTo(map);
        })
        .catch(error => {
            console.error('Erro ao carregar o GeoJSON:', error);
            document.getElementById('info-content').innerHTML = 
                '<p class="error">Erro ao carregar o mapa. Por favor, tente novamente mais tarde.</p>';
        });
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
            endpoint = '/credenciados_total.php';
            break;
        case 'credenciados_cfc':
            endpoint = '/credenciados_tipo.php?tipo=cfc';
            break;
        case 'credenciados_clinicas':
            endpoint = '/credenciados_tipo.php?tipo=clinicas';
            break;
        case 'credenciados_ecv':
            endpoint = '/credenciados_tipo.php?tipo=ecv';
            break;
        case 'credenciados_epiv':
            endpoint = '/credenciados_tipo.php?tipo=epiv';
            break;
        case 'credenciados_patio':
            endpoint = '/credenciados_tipo.php?tipo=patio';
            break;
        case 'servicos_cfc':
            endpoint = '/servicos_tipo.php?tipo=cfc';
            break;
        case 'servicos_clinicas':
            endpoint = '/servicos_tipo.php?tipo=clinicas';
            break;
        case 'servicos_ecv':
            endpoint = '/servicos_tipo.php?tipo=ecv';
            break;
        case 'servicos_epiv':
            endpoint = '/servicos_tipo.php?tipo=epiv';
            break;
        case 'servicos_patio':
            endpoint = '/servicos_tipo.php?tipo=patio';
            break;
        case 'frota_total':
            endpoint = '/frotas.php';
            break;
        default:
            endpoint = '/credenciados_total.php';
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
                fetch('/frotas.php')
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
