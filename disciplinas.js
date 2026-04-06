/**
 * APEX — Disciplinas, ramas y planillas (Google Sheets)
 *
 * Estructura de hojas (cada una con su gid publicado en CSV):
 *   · futbol_hombres
 *   · futbol_mujeres
 *   · basquet_hombres
 *   · basquet_mujeres
 *   · voley          → una sola hoja (torneo mixto)
 *
 * El POST al Apps Script envía { disciplina: "<scope>", ranking: [...] }
 * con disciplina igual a una de las claves de SHEET_GIDS.
 *
 * Valores viejos guardados (futbol, basquet, voley_damas…) se normalizan con normalizeLegacyScope().
 */
(function (global) {
    const PUB =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9DrvCm5CcMBq-bXFGvt3HI9r72bNmn0p4tNk9TDpjazuhIjzsZvOLuLkd8g25GXMpfqSSJ_HQPysI/pub";
        

    /** Sustituí cada gid por el de la pestaña publicada correspondiente. */
    const SHEET_GIDS = {
        futbol_hombres: "1231632355",
        futbol_mujeres: "2048733688",
        basquet_hombres: "146219300",
        basquet_mujeres: "1472187570",
        voley: "1118458653"
    };

    const LIVE_TIME = {
        futbol: [
            ["1er", "Primer tiempo"],
            ["2do", "Segundo tiempo"],
            ["Ad", "Tiempo adicional"],
            ["Descanso", "Descanso"],
            ["Penales", "Penales"]
        ],
        basquet: [
            ["Q1", "Cuarto 1"],
            ["Q2", "Cuarto 2"],
            ["Q3", "Cuarto 3"],
            ["Q4", "Cuarto 4"],
            ["OT", "Prórroga"],
            ["Descanso", "Descanso"]
        ],
        voley: [
            ["S1", "Set 1"],
            ["S2", "Set 2"],
            ["S3", "Set 3"],
            ["S4", "Set 4"],
            ["S5", "Set 5"],
            ["Descanso", "Descanso"]
        ]
    };

    const LABELS = {
        futbol_hombres: { rankingTitle: "Fútbol · Hombres", pointsHeader: "GF", pointsDetail: "Goles a favor" },
        futbol_mujeres: { rankingTitle: "Fútbol · Mujeres", pointsHeader: "GF", pointsDetail: "Goles a favor" },
        basquet_hombres: { rankingTitle: "Básquet · Hombres", pointsHeader: "PF", pointsDetail: "Puntos a favor" },
        basquet_mujeres: { rankingTitle: "Básquet · Mujeres", pointsHeader: "PF", pointsDetail: "Puntos a favor" },
        voley: { rankingTitle: "Vóley (mixto)", pointsHeader: "PF", pointsDetail: "Puntos a favor" }
    };

    function csvUrlForScope(scope) {
        const s = normalizeLegacyScope(scope);
        const gid = SHEET_GIDS[s];
        if (!gid) return null;
        return `${PUB}?gid=${gid}&single=true&output=csv`;
    }

    function liveTimeKeyForScope(scope) {
        const s = normalizeLegacyScope(scope);
        if (String(s).startsWith("futbol")) return "futbol";
        if (String(s).startsWith("basquet")) return "basquet";
        return "voley";
    }

    function storageCal(scope) {
        return `apex_calendario_${normalizeLegacyScope(scope)}`;
    }

    function storageLive(scope) {
        return `apex_live_${normalizeLegacyScope(scope)}`;
    }

    function storageRankingBackup(scope) {
        return `apex_ranking_backup_${normalizeLegacyScope(scope)}`;
    }

    function storageLastScope() {
        return "apex_last_scope";
    }

    /**
     * disciplina: futbol | basquet | voley
     * rama: hombres | mujeres (solo aplica a futbol y basquet; se ignora en voley)
     */
    function parseScopeFromDisciplinaRama(disciplina, rama) {
        if (disciplina === "voley") return "voley";
        const r = rama === "mujeres" ? "mujeres" : "hombres";
        if (disciplina === "basquet") return `basquet_${r}`;
        return `futbol_${r}`;
    }

    function disciplinaFromScope(scope) {
        const s = normalizeLegacyScope(scope);
        if (s === "voley") return "voley";
        if (String(s).startsWith("basquet")) return "basquet";
        return "futbol";
    }

    function ramaFromScope(scope) {
        const s = normalizeLegacyScope(scope);
        if (s === "voley") return null;
        if (s.endsWith("_mujeres")) return "mujeres";
        if (s.endsWith("_hombres")) return "hombres";
        return "hombres";
    }

    function normalizeLegacyScope(scope) {
        if (!scope) return null;
        const legacy = {
            futbol: "futbol_hombres",
            basquet: "basquet_hombres",
            voley_damas: "voley",
            voley_varones: "voley"
        };
        return legacy[scope] || scope;
    }

    global.APEXDisciplinas = {
        SHEET_GIDS,
        csvUrlForScope,
        liveTimeKeyForScope,
        LIVE_TIME,
        LABELS,
        storageCal,
        storageLive,
        storageRankingBackup,
        storageLastScope,
        parseScopeFromDisciplinaRama,
        disciplinaFromScope,
        ramaFromScope,
        normalizeLegacyScope
    };
})(typeof window !== "undefined" ? window : globalThis);
