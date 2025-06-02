<?php
require_once __DIR__ . '/../config/database.php';
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

// Função auxiliar para buscar credenciados por tipo (para details)
function get_credenciados_por_tipo($pdo, $id_municipio, $tipo) {
    $tabela = '';
    switch (strtolower($tipo)) {
        case 'cfc': $tabela = 'ServicosCFC'; break;
        case 'clinicas': $tabela = 'ServicosClinicas'; break;
        case 'ecv': $tabela = 'ServicosECV'; break;
        case 'epiv': $tabela = 'ServicosEPIV'; break;
        case 'patio': $tabela = 'ServicosPatio'; break;
        default: return [];
    }
    $sql = "SELECT c.cnpj, c.razao_social FROM Credenciados c JOIN {$tabela} sc ON c.cnpj=sc.cnpj WHERE c.id_municipio=? AND sc.ano=2024 GROUP BY c.cnpj,c.razao_social ORDER BY c.razao_social";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id_municipio]);
    return $stmt->fetchAll();
}

// Função auxiliar para buscar serviços por tipo (para details)
function get_servicos_por_tipo($pdo, $id_municipio, $tipo) {
    $det = [];
    $total = 0;
    switch (strtolower($tipo)) {
        case 'cfc':
            $stmt = $pdo->prepare("SELECT SUM(cursos_teoricos) AS teoricos, SUM(cursos_praticos) AS praticos FROM ServicosCFC sc JOIN Credenciados c ON sc.cnpj=c.cnpj WHERE c.id_municipio=? AND sc.ano=2024");
            $stmt->execute([$id_municipio]); $res=$stmt->fetch();
            $total=($res['teoricos']?:0)+($res['praticos']?:0);
            $det=[['tipo'=>'Cursos Teóricos','quantidade'=>$res['teoricos']?:0],['tipo'=>'Cursos Práticos','quantidade'=>$res['praticos']?:0]];
            break;
        case 'clinicas':
            $stmt = $pdo->prepare("SELECT SUM(exames_medicos) AS medicos, SUM(exames_psicologicos) AS psicologicos FROM ServicosClinicas sc JOIN Credenciados c ON sc.cnpj=c.cnpj WHERE c.id_municipio=? AND sc.ano=2024");
            $stmt->execute([$id_municipio]); $res=$stmt->fetch();
            $total=($res['medicos']?:0)+($res['psicologicos']?:0);
            $det=[['tipo'=>'Exames Médicos','quantidade'=>$res['medicos']?:0],['tipo'=>'Exames Psicológicos','quantidade'=>$res['psicologicos']?:0]];
            break;
        case 'ecv':
            $stmt = $pdo->prepare("SELECT SUM(vistoria_lacrada_veic_combinado+vistoria_lacrada_veic_passageiros+vistoria_lacrada_veic_2_3_rodas+vistoria_renave_veic_4_rodas+vistoria_renave_veic_2_3_rodas+vistoria_veic_carga+vistoria_veicular_combinacoes+vistoria_veic_2_3_rodas+vistoria_veic_4_rodas+vistoria_veic_passageiros+outras_vistorias) AS total FROM ServicosECV sc JOIN Credenciados c ON sc.cnpj=c.cnpj WHERE c.id_municipio=? AND sc.ano=2024");
            $stmt->execute([$id_municipio]); $total=$stmt->fetchColumn()?:0;
            $det=[['tipo'=>'Total Vistorias','quantidade'=>$total]];
            break;
        case 'epiv':
            $stmt=$pdo->prepare("SELECT SUM(estampagens) FROM ServicosEPIV sc JOIN Credenciados c ON sc.cnpj=c.cnpj WHERE c.id_municipio=? AND sc.ano=2024");
            $stmt->execute([$id_municipio]); $total=$stmt->fetchColumn()?:0;
            $det=[['tipo'=>'Total Estampagens','quantidade'=>$total]];
            break;
        case 'patio':
            $stmt=$pdo->prepare("SELECT SUM(veiculos_removidos) FROM ServicosPatio sc JOIN Credenciados c ON sc.cnpj=c.cnpj WHERE c.id_municipio=? AND sc.ano=2024");
            $stmt->execute([$id_municipio]); $total=$stmt->fetchColumn()?:0;
            $det=[['tipo'=>'Total Veículos Removidos','quantidade'=>$total]];
            break;
    }
    return ['total'=>$total,'detalhamento'=>$det];
}