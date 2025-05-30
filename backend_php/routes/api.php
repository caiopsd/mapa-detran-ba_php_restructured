<?php
// Roteador de API simples e handlers para endpoints

require_once __DIR__ . '/../config/database.php';

// --- Funções Auxiliares ---
function send_json($data, $statusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

function get_pdo() {
    global $pdo, $config; // Adiciona $config como global
    if (!$pdo) {
        // Tenta obter a conexão se ainda não existir
        try {
            // $config já foi carregado pelo require_once no topo do arquivo
            if (empty($config)) {
                 // Se $config estiver vazio por algum motivo, tenta carregar de novo (fallback)
                 $config = require_once __DIR__ . '/../config/database.php';
            }
            $dsn = "mysql:host={$config['host']};dbname={$config['dbname']};charset={$config['charset']}";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $pdo = new PDO($dsn, $config['user'], $config['password'], $options);
        } catch (\PDOException $e) {
            // Logar erro em produção
            error_log("Erro de conexão PDO em get_pdo: " . $e->getMessage());
            send_json(['error' => 'Database connection error'], 500);
        }
    }
    return $pdo;
}

// Função auxiliar para buscar detalhes de credenciados por tipo
function get_credenciados_por_tipo($pdo, $id_municipio, $tipo) {
    $tabela_servico = '';
    switch (strtolower($tipo)) {
        case 'cfc': $tabela_servico = 'ServicosCFC'; break;
        case 'clinicas': $tabela_servico = 'ServicosClinicas'; break;
        case 'ecv': $tabela_servico = 'ServicosECV'; break;
        case 'epiv': $tabela_servico = 'ServicosEPIV'; break;
        case 'patio': $tabela_servico = 'ServicosPatio'; break;
        default: return [];
    }

    $sql = "
        SELECT 
            c.cnpj, 
            c.razao_social
            -- Adicionar outras colunas relevantes de Credenciado se necessário
        FROM Credenciados c
        JOIN {$tabela_servico} sc ON c.cnpj = sc.cnpj
        WHERE c.id_municipio = ? AND sc.ano = 2024 -- Assumindo ano 2024 como padrão
        GROUP BY c.cnpj, c.razao_social
        ORDER BY c.razao_social;
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id_municipio]);
    return $stmt->fetchAll();
}

// Função auxiliar para buscar detalhes de serviços por tipo
function get_servicos_por_tipo($pdo, $id_municipio, $tipo) {
    $detalhamento = [];
    $total_geral = 0;

    try {
        switch (strtolower($tipo)) {
            case 'cfc':
                $sql = "SELECT SUM(cursos_teoricos) as teoricos, SUM(cursos_praticos) as praticos FROM ServicosCFC sc JOIN Credenciados c ON sc.cnpj = c.cnpj WHERE c.id_municipio = ? AND sc.ano = 2024";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$id_municipio]);
                $result = $stmt->fetch();
                $total_geral = ($result['teoricos'] ?? 0) + ($result['praticos'] ?? 0);
                $detalhamento = [
                    ['tipo' => 'Cursos Teóricos', 'quantidade' => $result['teoricos'] ?? 0],
                    ['tipo' => 'Cursos Práticos', 'quantidade' => $result['praticos'] ?? 0]
                ];
                break;
            case 'clinicas':
                $sql = "SELECT SUM(exames_medicos) as medicos, SUM(exames_psicologicos) as psicologicos FROM ServicosClinicas sc JOIN Credenciados c ON sc.cnpj = c.cnpj WHERE c.id_municipio = ? AND sc.ano = 2024";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$id_municipio]);
                $result = $stmt->fetch();
                $total_geral = ($result['medicos'] ?? 0) + ($result['psicologicos'] ?? 0);
                $detalhamento = [
                    ['tipo' => 'Exames Médicos', 'quantidade' => $result['medicos'] ?? 0],
                    ['tipo' => 'Exames Psicológicos', 'quantidade' => $result['psicologicos'] ?? 0]
                ];
                break;
            case 'ecv':
                $sql = "SELECT SUM(vistoria_lacrada_veic_combinado + vistoria_lacrada_veic_passageiros + vistoria_lacrada_veic_2_3_rodas + vistoria_renave_veic_4_rodas + vistoria_renave_veic_2_3_rodas + vistoria_veic_carga + vistoria_veicular_combinacoes + vistoria_veic_2_3_rodas + vistoria_veic_4_rodas + vistoria_veic_passageiros + outras_vistorias + vistoria_veicular_combinacoes_extra) as total FROM ServicosECV sc JOIN Credenciados c ON sc.cnpj = c.cnpj WHERE c.id_municipio = ? AND sc.ano = 2024";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$id_municipio]);
                $total_geral = $stmt->fetchColumn() ?? 0;
                // Detalhamento pode ser complexo, simplificando para total por enquanto
                $detalhamento = [['tipo' => 'Total Vistorias', 'quantidade' => $total_geral]];
                break;
             case 'epiv':
                $sql = "SELECT SUM(estampagens) as total FROM ServicosEPIV sc JOIN Credenciados c ON sc.cnpj = c.cnpj WHERE c.id_municipio = ? AND sc.ano = 2024";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$id_municipio]);
                $total_geral = $stmt->fetchColumn() ?? 0;
                $detalhamento = [['tipo' => 'Total Estampagens', 'quantidade' => $total_geral]];
                break;
            case 'patio':
                 $sql = "SELECT SUM(veiculos_removidos) as total FROM ServicosPatio sc JOIN Credenciados c ON sc.cnpj = c.cnpj WHERE c.id_municipio = ? AND sc.ano = 2024";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$id_municipio]);
                $total_geral = $stmt->fetchColumn() ?? 0;
                $detalhamento = [['tipo' => 'Total Veículos Removidos', 'quantidade' => $total_geral]];
                break;
        }
    } catch (\PDOException $e) {
        error_log("Erro ao buscar serviços tipo {$tipo} para município {$id_municipio}: " . $e->getMessage());
        return ['total' => 0, 'detalhamento' => []]; // Retorna vazio em caso de erro
    }

    return ['total' => $total_geral, 'detalhamento' => $detalhamento];
}

// --- Lógica de Roteamento (Simples) ---
$request_uri = $_SERVER['REQUEST_URI'];
$request_method = $_SERVER['REQUEST_METHOD'];

// Remover query string da URI e o prefixo /api se existir
$path = parse_url($request_uri, PHP_URL_PATH);
$api_prefix = '/api';
if (strpos($path, $api_prefix) === 0) {
    $path = substr($path, strlen($api_prefix));
}

// --- Handlers de Rota ---

// Endpoint: /municipios
if ($path === '/municipios' && $request_method === 'GET') {
    try {
        $pdo = get_pdo();
        $stmt = $pdo->query("SELECT id_municipio as id, Nome as nome FROM Municipios ORDER BY Nome");
        $municipios = $stmt->fetchAll();
        send_json($municipios);
    } catch (\PDOException $e) {
        error_log("Erro API /municipios: " . $e->getMessage());
        send_json(['error' => 'Erro ao buscar municípios'], 500);
    }
}

// Endpoint: /credenciados
elseif ($path === '/credenciados' && $request_method === 'GET') {
    try {
        $pdo = get_pdo();
        $sql = "
            SELECT DISTINCT
                c.cnpj,
                c.razao_social,
                m.Nome AS nome_municipio
            FROM Credenciados c
            JOIN Municipios m ON c.id_municipio = m.id_municipio
            ORDER BY c.razao_social;
        ";
        $stmt = $pdo->query($sql);
        $credenciados = $stmt->fetchAll();
        send_json($credenciados);
    } catch (\PDOException $e) {
        error_log("Erro API /credenciados: " . $e->getMessage());
        send_json(['error' => 'Erro ao buscar credenciados'], 500);
    }
}

// Endpoint: /credenciados/total
elseif ($path === '/credenciados/total' && $request_method === 'GET') {
    try {
        $pdo = get_pdo();
        $sql = "
            SELECT
                m.id_municipio,
                m.Nome AS nome_municipio,
                COUNT(DISTINCT c.cnpj) AS total_credenciados,
                COALESCE(pm.populacao, 0) AS populacao
            FROM Municipios m
            LEFT JOIN Credenciados c ON m.id_municipio = c.id_municipio
            LEFT JOIN PopulacaoMunicipios pm ON m.id_municipio = pm.id_municipio
            GROUP BY m.id_municipio, m.Nome, pm.populacao
            ORDER BY m.Nome;
        ";
        $stmt = $pdo->query($sql);
        $visao_geral = $stmt->fetchAll();
        send_json($visao_geral);
    } catch (\PDOException $e) {
        error_log("Erro API /credenciados/total: " . $e->getMessage());
        send_json(['error' => 'Erro ao buscar visão geral de credenciados'], 500);
    }
}

// Endpoint: /credenciados/<tipo>
elseif (preg_match("#/credenciados/(cfc|clinicas|ecv|epiv|patio)$#", $path, $matches_tipo) && $request_method === 'GET') {
    $tipo = $matches_tipo[1];
    $tabela_servico = '';
    $coluna_total = 'total_' . strtolower($tipo);
    switch (strtolower($tipo)) {
        case 'cfc': $tabela_servico = 'ServicosCFC'; break;
        case 'clinicas': $tabela_servico = 'ServicosClinicas'; break;
        case 'ecv': $tabela_servico = 'ServicosECV'; break;
        case 'epiv': $tabela_servico = 'ServicosEPIV'; break;
        case 'patio': $tabela_servico = 'ServicosPatio'; break;
    }

    if ($tabela_servico) {
        try {
            $pdo = get_pdo();
            $sql = "
                SELECT
                    m.id_municipio,
                    m.Nome AS nome_municipio,
                    COUNT(DISTINCT sc.cnpj) AS {$coluna_total}
                FROM Municipios m
                LEFT JOIN Credenciados c ON m.id_municipio = c.id_municipio
                LEFT JOIN {$tabela_servico} sc ON c.cnpj = sc.cnpj AND sc.ano = 2024
                GROUP BY m.id_municipio, m.Nome
                ORDER BY m.Nome;
            ";
            $stmt = $pdo->query($sql);
            $credenciados_tipo = $stmt->fetchAll();
            // Garantir que a coluna de total exista mesmo se for 0
            $credenciados_tipo = array_map(function($item) use ($coluna_total) {
                $item[$coluna_total] = $item[$coluna_total] ?? 0;
                return $item;
            }, $credenciados_tipo);
            send_json($credenciados_tipo);
        } catch (\PDOException $e) {
            error_log("Erro API /credenciados/{$tipo}: " . $e->getMessage());
            send_json(['error' => "Erro ao buscar credenciados {$tipo}"], 500);
        }
    } else {
         send_json(['error' => 'Tipo de credenciado inválido'], 400);
    }
}

// Endpoint: /servicos/<tipo>
elseif (preg_match("#/servicos/(cfc|clinicas|ecv|epiv|patio)$#", $path, $matches_servico) && $request_method === 'GET') {
    $tipo = $matches_servico[1];
    $sql = "";
    $coluna_total = 'total_' . strtolower($tipo); // Nome padrão, pode ser ajustado

    try {
        $pdo = get_pdo();
        switch (strtolower($tipo)) {
            case 'cfc':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.cursos_teoricos), 0) AS total_cursos_teoricos, COALESCE(SUM(sc.cursos_praticos), 0) AS total_cursos_praticos, (COALESCE(SUM(sc.cursos_teoricos), 0) + COALESCE(SUM(sc.cursos_praticos), 0)) AS total_cursos FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio = c.id_municipio LEFT JOIN ServicosCFC sc ON c.cnpj = sc.cnpj AND sc.ano = 2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_cursos';
                break;
            case 'clinicas':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.exames_medicos), 0) AS total_exames_medicos, COALESCE(SUM(sc.exames_psicologicos), 0) AS total_exames_psicologicos, (COALESCE(SUM(sc.exames_medicos), 0) + COALESCE(SUM(sc.exames_psicologicos), 0)) AS total_exames FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio = c.id_municipio LEFT JOIN ServicosClinicas sc ON c.cnpj = sc.cnpj AND sc.ano = 2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_exames';
                break;
            case 'ecv':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.vistoria_lacrada_veic_combinado + sc.vistoria_lacrada_veic_passageiros + sc.vistoria_lacrada_veic_2_3_rodas + sc.vistoria_renave_veic_4_rodas + sc.vistoria_renave_veic_2_3_rodas + sc.vistoria_veic_carga + sc.vistoria_veicular_combinacoes + sc.vistoria_veic_2_3_rodas + sc.vistoria_veic_4_rodas + sc.vistoria_veic_passageiros + sc.outras_vistorias + sc.vistoria_veicular_combinacoes_extra), 0) AS total_vistorias FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio = c.id_municipio LEFT JOIN ServicosECV sc ON c.cnpj = sc.cnpj AND sc.ano = 2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_vistorias';
                break;
            case 'epiv':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.estampagens), 0) AS total_estampagens FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio = c.id_municipio LEFT JOIN ServicosEPIV sc ON c.cnpj = sc.cnpj AND sc.ano = 2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_estampagens';
                break;
            case 'patio':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.veiculos_removidos), 0) AS total_veiculos_removidos FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio = c.id_municipio LEFT JOIN ServicosPatio sc ON c.cnpj = sc.cnpj AND sc.ano = 2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_veiculos_removidos';
                break;
        }

        if ($sql) {
            $stmt = $pdo->query($sql);
            $servicos_tipo = $stmt->fetchAll();
             // Garantir que a coluna de total exista mesmo se for 0
            $servicos_tipo = array_map(function($item) use ($coluna_total) {
                $item[$coluna_total] = $item[$coluna_total] ?? 0;
                // Adicionar outras colunas se necessário (ex: CFC tem teoricos/praticos)
                if (isset($item['total_cursos_teoricos'])) $item['total_cursos_teoricos'] = $item['total_cursos_teoricos'] ?? 0;
                if (isset($item['total_cursos_praticos'])) $item['total_cursos_praticos'] = $item['total_cursos_praticos'] ?? 0;
                if (isset($item['total_exames_medicos'])) $item['total_exames_medicos'] = $item['total_exames_medicos'] ?? 0;
                if (isset($item['total_exames_psicologicos'])) $item['total_exames_psicologicos'] = $item['total_exames_psicologicos'] ?? 0;
                return $item;
            }, $servicos_tipo);
            send_json($servicos_tipo);
        } else {
            send_json(['error' => 'Tipo de serviço inválido'], 400);
        }
    } catch (\PDOException $e) {
        error_log("Erro API /servicos/{$tipo}: " . $e->getMessage());
        send_json(['error' => "Erro ao buscar serviços {$tipo}"], 500);
    }
}

// Endpoint: /frotas
elseif ($path === '/frotas' && $request_method === 'GET') {
    try {
        $pdo = get_pdo();
        $sql = "
            SELECT
                m.id_municipio,
                m.Nome AS nome_municipio,
                COALESCE(pm.populacao, 0) AS populacao,
                fm.ano AS ano_frota,
                COALESCE(fm.automovel, 0) AS automovel,
                COALESCE(fm.caminhao, 0) AS caminhao,
                COALESCE(fm.caminhoneta_caminhonete, 0) AS caminhoneta_caminhonete,
                COALESCE(fm.microonibus, 0) AS microonibus,
                COALESCE(fm.moto, 0) AS moto,
                COALESCE(fm.motor_casa, 0) AS motor_casa,
                COALESCE(fm.onibus, 0) AS onibus,
                COALESCE(fm.reboque_semireboque, 0) AS reboque_semireboque,
                COALESCE(fm.trator, 0) AS trator,
                COALESCE(fm.outros, 0) AS outros,
                (
                    COALESCE(fm.automovel, 0) + COALESCE(fm.caminhao, 0) +
                    COALESCE(fm.caminhoneta_caminhonete, 0) + COALESCE(fm.microonibus, 0) +
                    COALESCE(fm.moto, 0) + COALESCE(fm.motor_casa, 0) +
                    COALESCE(fm.onibus, 0) + COALESCE(fm.reboque_semireboque, 0) +
                    COALESCE(fm.trator, 0) + COALESCE(fm.outros, 0)
                ) AS total_frota
            FROM Municipios m
            LEFT JOIN PopulacaoMunicipios pm ON m.id_municipio = pm.id_municipio
            LEFT JOIN (
                SELECT id_municipio, MAX(ano) AS max_ano
                FROM FrotasMunicipios
                GROUP BY id_municipio
            ) AS max_fm ON m.id_municipio = max_fm.id_municipio
            LEFT JOIN FrotasMunicipios fm ON m.id_municipio = fm.id_municipio AND fm.ano = max_fm.max_ano
            ORDER BY m.Nome;
        ";
        $stmt = $pdo->query($sql);
        $frotas_raw = $stmt->fetchAll();

        // Reformatar para incluir 'detalhe_frota'
        $frotas_final = [];
        foreach ($frotas_raw as $r) {
            $frotas_final[] = [
                'id_municipio' => $r['id_municipio'],
                'nome_municipio' => $r['nome_municipio'],
                'populacao' => $r['populacao'] ?? 0,
                'ano_frota' => $r['ano_frota'],
                'total_frota' => $r['total_frota'] ?? 0,
                'detalhe_frota' => [
                    'Automóvel' => $r['automovel'] ?? 0,
                    'Caminhão' => $r['caminhao'] ?? 0,
                    'Caminhoneta/Caminhonete' => $r['caminhoneta_caminhonete'] ?? 0,
                    'Micro-ônibus' => $r['microonibus'] ?? 0,
                    'Moto' => $r['moto'] ?? 0,
                    'Motor-casa' => $r['motor_casa'] ?? 0,
                    'Ônibus' => $r['onibus'] ?? 0,
                    'Reboque/Semirreboque' => $r['reboque_semireboque'] ?? 0,
                    'Trator' => $r['trator'] ?? 0,
                    'Outros' => $r['outros'] ?? 0
                ]
            ];
        }
        send_json($frotas_final);

    } catch (\PDOException $e) {
        error_log("Erro API /frotas: " . $e->getMessage());
        send_json(['error' => 'Erro ao buscar dados de frota'], 500);
    }
}

// Endpoint: /municipio/{id}/detalhes
elseif (preg_match("|^/municipio/(\d+)/detalhes$|", $path, $matches) && $request_method === 'GET') {
    $id_municipio = (int)$matches[1];
    try {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT id_municipio, Nome FROM Municipios WHERE id_municipio = ?");
        $stmt->execute([$id_municipio]);
        $municipio = $stmt->fetch();

        if (!$municipio) {
            send_json(['error' => 'Município não encontrado'], 404);
        }

        // Buscar detalhes de credenciados e serviços usando as funções auxiliares
        $detalhes_completos = [
            'id_municipio' => $municipio['id_municipio'],
            'nome' => $municipio['Nome'],
            'credenciados' => [
                'cfc' => get_credenciados_por_tipo($pdo, $id_municipio, 'cfc'),
                'clinicas' => get_credenciados_por_tipo($pdo, $id_municipio, 'clinicas'),
                'ecv' => get_credenciados_por_tipo($pdo, $id_municipio, 'ecv'),
                'epiv' => get_credenciados_por_tipo($pdo, $id_municipio, 'epiv'),
                'patio' => get_credenciados_por_tipo($pdo, $id_municipio, 'patio'),
            ],
            'servicos' => [
                'cfc' => get_servicos_por_tipo($pdo, $id_municipio, 'cfc'),
                'clinicas' => get_servicos_por_tipo($pdo, $id_municipio, 'clinicas'),
                'ecv' => get_servicos_por_tipo($pdo, $id_municipio, 'ecv'),
                'epiv' => get_servicos_por_tipo($pdo, $id_municipio, 'epiv'),
                'patio' => get_servicos_por_tipo($pdo, $id_municipio, 'patio'),
            ]
        ];

        send_json($detalhes_completos);

    } catch (\PDOException $e) {
        error_log("Erro API /municipio/{$id_municipio}/detalhes: " . $e->getMessage());
        send_json(['error' => 'Erro ao buscar detalhes do município'], 500);
    }
}

// --- Endpoints de Usuário (Opcional, implementar se necessário) ---

// Endpoint: /users (GET - Listar)
elseif ($path === '/users' && $request_method === 'GET') {
    try {
        $pdo = get_pdo();
        $stmt = $pdo->query("SELECT id, username, email FROM User ORDER BY username");
        $users = $stmt->fetchAll();
        send_json($users);
    } catch (\PDOException $e) {
        error_log("Erro API GET /users: " . $e->getMessage());
        send_json(['error' => 'Erro ao listar usuários'], 500);
    }
}

// Endpoint: /users (POST - Criar)
elseif ($path === '/users' && $request_method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['username']) || empty($input['email'])) {
        send_json(['error' => 'Username e email são obrigatórios'], 400);
    }
    try {
        $pdo = get_pdo();
        $sql = "INSERT INTO User (username, email) VALUES (?, ?)";
        $stmt= $pdo->prepare($sql);
        $stmt->execute([$input['username'], $input['email']]);
        $id = $pdo->lastInsertId();
        // Buscar o usuário criado para retornar
        $stmt = $pdo->prepare("SELECT id, username, email FROM User WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        send_json($user, 201);
    } catch (\PDOException $e) {
        error_log("Erro API POST /users: " . $e->getMessage());
        // Verificar erro de duplicidade (código 23000)
        if ($e->getCode() == 23000) {
             send_json(['error' => 'Username ou email já existe'], 409); // Conflict
        } else {
             send_json(['error' => 'Erro ao criar usuário'], 500);
        }
    }
}

// Endpoint: /users/{id} (GET - Obter)
elseif (preg_match("|^/users/(\d+)$|", $path, $matches_user) && $request_method === 'GET') {
    $user_id = (int)$matches_user[1];
    try {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT id, username, email FROM User WHERE id = ?");
        $stmt->execute([$user_id]);
        $user = $stmt->fetch();
        if ($user) {
            send_json($user);
        } else {
            send_json(['error' => 'Usuário não encontrado'], 404);
        }
    } catch (\PDOException $e) {
        error_log("Erro API GET /users/{$user_id}: " . $e->getMessage());
        send_json(['error' => 'Erro ao buscar usuário'], 500);
    }
}

// Endpoint: /users/{id} (PUT - Atualizar)
elseif (preg_match("|^/users/(\d+)$|", $path, $matches_user) && $request_method === 'PUT') {
    $user_id = (int)$matches_user[1];
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['username']) && empty($input['email'])) {
        send_json(['error' => 'Pelo menos um campo (username ou email) deve ser fornecido para atualização'], 400);
    }
    try {
        $pdo = get_pdo();
        // Verificar se usuário existe
        $stmt = $pdo->prepare("SELECT id FROM User WHERE id = ?");
        $stmt->execute([$user_id]);
        if (!$stmt->fetch()) {
             send_json(['error' => 'Usuário não encontrado'], 404);
        }

        // Construir a query de update dinamicamente
        $fields = [];
        $params = [];
        if (!empty($input['username'])) {
            $fields[] = 'username = ?';
            $params[] = $input['username'];
        }
        if (!empty($input['email'])) {
            $fields[] = 'email = ?';
            $params[] = $input['email'];
        }
        $params[] = $user_id; // Adiciona o ID para o WHERE

        $sql = "UPDATE User SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt= $pdo->prepare($sql);
        $stmt->execute($params);

        // Buscar o usuário atualizado para retornar
        $stmt = $pdo->prepare("SELECT id, username, email FROM User WHERE id = ?");
        $stmt->execute([$user_id]);
        $user = $stmt->fetch();
        send_json($user);

    } catch (\PDOException $e) {
        error_log("Erro API PUT /users/{$user_id}: " . $e->getMessage());
         if ($e->getCode() == 23000) {
             send_json(['error' => 'Username ou email já existe'], 409); // Conflict
        } else {
            send_json(['error' => 'Erro ao atualizar usuário'], 500);
        }
    }
}

// Endpoint: /users/{id} (DELETE - Deletar)
elseif (preg_match("|^/users/(\d+)$|", $path, $matches_user) && $request_method === 'DELETE') {
    $user_id = (int)$matches_user[1];
    try {
        $pdo = get_pdo();
        $sql = "DELETE FROM User WHERE id = ?";
        $stmt= $pdo->prepare($sql);
        $affectedRows = $stmt->execute([$user_id]);

        if ($affectedRows > 0) {
            http_response_code(204); // No Content
            exit;
        } else {
            send_json(['error' => 'Usuário não encontrado'], 404);
        }
    } catch (\PDOException $e) {
        error_log("Erro API DELETE /users/{$user_id}: " . $e->getMessage());
        send_json(['error' => 'Erro ao deletar usuário'], 500);
    }
}

// Rota não encontrada
else {
    send_json(['error' => 'Endpoint não encontrado: ' . $path], 404);
}

?>

