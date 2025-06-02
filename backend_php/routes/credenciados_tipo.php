<?php
require_once __DIR__ . '/init.php';

$tipo = $_GET['tipo'] ?? '';
if (!in_array(strtolower($tipo), ['cfc','clinicas','ecv','epiv','patio'])) {
    send_json(['error' => 'Tipo de credenciado inválido'], 400);
}

$tabela = '';
switch (strtolower($tipo)) {
    case 'cfc': $tabela = 'ServicosCFC'; break;
    case 'clinicas': $tabela = 'ServicosClinicas'; break;
    case 'ecv': $tabela = 'ServicosECV'; break;
    case 'epiv': $tabela = 'ServicosEPIV'; break;
    case 'patio': $tabela = 'ServicosPatio'; break;
}
$coluna = 'total_' . strtolower($tipo);

try {
    $pdo = get_pdo();
    $sql = "
        SELECT
            m.id_municipio,
            m.Nome AS nome_municipio,
            COUNT(DISTINCT sc.cnpj) AS {$coluna}
        FROM Municipios m
        LEFT JOIN Credenciados c ON c.id_municipio = m.id_municipio
        LEFT JOIN {$tabela} sc ON sc.cnpj = c.cnpj AND sc.ano = 2024
        GROUP BY m.id_municipio, m.Nome
        ORDER BY m.Nome
    ";
    $stmt = $pdo->query($sql);
    $data = $stmt->fetchAll();
    send_json($data);
} catch (PDOException $e) {
    error_log("Erro ao buscar credenciados tipo {$tipo}: " . $e->getMessage());
    send_json(['error' => "Erro ao buscar credenciados {$tipo}"], 500);
}