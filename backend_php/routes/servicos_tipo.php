<?php
// Endpoint: /servicos/{tipo}
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/init.php';

// Endpoint: /routes/credenciados_tipo.php?tipo={tipo}
$tipo = $_GET['tipo'] ?? '';
if (!$tipo) {
    send_json(['error' => 'Parâmetro tipo é obrigatório'], 400);
}

if (preg_match("#^/servicos/(cfc|clinicas|ecv|epiv|patio)$#", $path, $matches_servico) && $request_method === 'GET') {
    $tipo = $matches_servico[1];
    $coluna_total = 'total_' . strtolower($tipo);
    try {
        $pdo = get_pdo();
        switch (strtolower($tipo)) {
            case 'cfc':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.cursos_teoricos),0) AS total_cursos_teoricos, COALESCE(SUM(sc.cursos_praticos),0) AS total_cursos_praticos, (COALESCE(SUM(sc.cursos_teoricos),0)+COALESCE(SUM(sc.cursos_praticos),0)) AS total_cursos FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosCFC sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_cursos';
                break;
            case 'clinicas':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.exames_medicos),0) AS total_exames_medicos, COALESCE(SUM(sc.exames_psicologicos),0) AS total_exames_psicologicos, (COALESCE(SUM(sc.exames_medicos),0)+COALESCE(SUM(sc.exames_psicologicos),0)) AS total_exames FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosClinicas sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_exames';
                break;
            case 'ecv':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.vistoria_lacrada_veic_combinado+sc.vistoria_lacrada_veic_passageiros+sc.vistoria_lacrada_veic_2_3_rodas+sc.vistoria_renave_veic_4_rodas+sc.vistoria_renave_veic_2_3_rodas+sc.vistoria_veic_carga+sc.vistoria_veicular_combinacoes+sc.vistoria_veic_2_3_rodas+sc.vistoria_veic_4_rodas+sc.vistoria_veic_passageiros+sc.outras_vistorias+sc.vistoria_veicular_combinacoes_extra),0) AS total_vistorias FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosECV sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_vistorias';
                break;
            case 'epiv':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.estampagens),0) AS total_estampagens FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosEPIV sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_estampagens';
                break;
            case 'patio':
                $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.veiculos_removidos),0) AS total_veiculos_removidos FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosPatio sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome;";
                $coluna_total = 'total_veiculos_removidos';
                break;
        }
        if (isset($sql)) {
            $stmt = $pdo->query($sql);
            $rows = $stmt->fetchAll();
            $rows = array_map(function($item) use ($coluna_total) {
                $item[$coluna_total] = $item[$coluna_total] ?? 0;
                return $item;
            }, $rows);
            send_json($rows);
        } else {
            send_json(['error'=>'Tipo de serviço inválido'],400);
        }
    } catch (\PDOException $e) {
        error_log("Erro API /servicos/{$tipo}: " . $e->getMessage());
        send_json(['error'=>"Erro ao buscar serviços {$tipo}"],500);
    }
    exit;
}
$tipo = $_GET['tipo'] ?? '';
if (!in_array(strtolower($tipo), ['cfc','clinicas','ecv','epiv','patio'])) {
    send_json(['error' => 'Tipo de serviço inválido'], 400);
}

$coluna_total = 'total_' . strtolower($tipo);
try {
    $pdo = get_pdo();
    switch (strtolower($tipo)) {
        case 'cfc':
            $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.cursos_teoricos),0) AS total_cursos_teoricos, COALESCE(SUM(sc.cursos_praticos),0) AS total_cursos_praticos, (COALESCE(SUM(sc.cursos_teoricos),0)+COALESCE(SUM(sc.cursos_praticos),0)) AS total_cursos FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosCFC sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome";
            $coluna_total = 'total_cursos';
            break;
        case 'clinicas':
            $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.exames_medicos),0) AS total_exames_medicos, COALESCE(SUM(sc.exames_psicologicos),0) AS total_exames_psicologicos, (COALESCE(SUM(sc.exames_medicos),0)+COALESCE(SUM(sc.exames_psicologicos),0)) AS total_exames FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosClinicas sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome";
            $coluna_total = 'total_exames';
            break;
        case 'ecv':
            $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.vistoria_lacrada_veic_combinado+sc.vistoria_lacrada_veic_passageiros+sc.vistoria_lacrada_veic_2_3_rodas+sc.vistoria_renave_veic_4_rodas+sc.vistoria_renave_veic_2_3_rodas+sc.vistoria_veic_carga+sc.vistoria_veicular_combinacoes+sc.vistoria_veic_2_3_rodas+sc.vistoria_veic_4_rodas+sc.vistoria_veic_passageiros+sc.outras_vistorias),0) AS total_vistorias FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosECV sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome";
            $coluna_total = 'total_vistorias';
            break;
        case 'epiv':
            $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.estampagens),0) AS total_estampagens FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosEPIV sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome";
            $coluna_total = 'total_estampagens';
            break;
        case 'patio':
            $sql = "SELECT m.id_municipio, m.Nome AS nome_municipio, COALESCE(SUM(sc.veiculos_removidos),0) AS total_veiculos_removidos FROM Municipios m LEFT JOIN Credenciados c ON m.id_municipio=c.id_municipio LEFT JOIN ServicosPatio sc ON c.cnpj=sc.cnpj AND sc.ano=2024 GROUP BY m.id_municipio, m.Nome ORDER BY m.Nome";
            $coluna_total = 'total_veiculos_removidos';
            break;
    }

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();
    send_json($rows);
} catch (PDOException $e) {
    error_log("Erro ao buscar serviços tipo {$tipo}: " . $e->getMessage());
    send_json(['error' => "Erro ao buscar serviços {$tipo}"], 500);
}
