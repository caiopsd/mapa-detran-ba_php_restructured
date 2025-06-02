<?php
require_once __DIR__ . '/init.php';

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

    $frotas_final = [];
    foreach ($frotas_raw as $r) {
        $frotas_final[] = [
            'id_municipio' => $r['id_municipio'],
            'nome_municipio' => $r['nome_municipio'],
            'populacao' => $r['populacao'],
            'ano_frota' => $r['ano_frota'],
            'total_frota' => $r['total_frota'],
            'detalhe_frota' => [
                'Automóvel' => $r['automovel'],
                'Caminhão' => $r['caminhao'],
                'Caminhoneta/Caminhonete' => $r['caminhoneta_caminhonete'],
                'Micro-ônibus' => $r['microonibus'],
                'Moto' => $r['moto'],
                'Motor-casa' => $r['motor_casa'],
                'Ônibus' => $r['onibus'],
                'Reboque/Semirreboque' => $r['reboque_semireboque'],
                'Trator' => $r['trator'],
                'Outros' => $r['outros']
            ]
        ];
    }
    send_json($frotas_final);
} catch (PDOException $e) {
    error_log("Erro ao buscar dados de frota: " . $e->getMessage());
    send_json(['error' => 'Erro ao buscar dados de frota'], 500);
}
