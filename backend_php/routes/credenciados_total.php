<?php
require_once __DIR__ . '/init.php';

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
        ORDER BY m.Nome
    ";
    $stmt = $pdo->query($sql);
    send_json($stmt->fetchAll());
} catch (PDOException $e) {
    error_log("Erro ao buscar total de credenciados: " . $e->getMessage());
    send_json(['error' => 'Erro ao buscar visão geral'], 500);
}
