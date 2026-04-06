// ================================
// APEX LIVE RANKING (multi-disciplina)
// ================================

const cursos_paises = [
    { p: "Italia",         c: "1RO A", f: "it" },
    { p: "Argentina",      c: "1RO B", f: "ar" },
    { p: "España",         c: "2DO A", f: "es" },
    { p: "Portugal",       c: "2DO B", f: "pt" },
    { p: "Brasil",         c: "3RO A", f: "br" },
    { p: "Inglaterra",     c: "3RO B", f: "gb" },
    { p: "Bélgica",        c: "4TO A", f: "be" },
    { p: "Francia",        c: "4TO B", f: "fr" },
    { p: "México",         c: "4TO C", f: "mx" },
    { p: "Bolivia",        c: "5TO A", f: "bo" },
    { p: "Estados Unidos", c: "5TO B", f: "us" },
    { p: "Alemania 1",     c: "6TO A", f: "de" },
    { p: "Alemania 2",     c: "6TO B", f: "de" },
];

const BC_CALENDAR = "apex_calendar";

let currentScope = "futbol_hombres";
let rankingInterval = null;

function D() {
    return window.APEXDisciplinas;
}

function getScopeFromDOM() {
    const disc = document.getElementById("apex-disciplina")?.value || "futbol";
    const rama = document.getElementById("apex-rama")?.value || "hombres";
    return D().parseScopeFromDisciplinaRama(disc, rama);
}

function setDisciplinaUI(scope) {
    const s = D().normalizeLegacyScope(scope) || scope;
    const disc = D().disciplinaFromScope(s);
    const sel = document.getElementById("apex-disciplina");
    const wrap = document.getElementById("apex-rama-wrap");
    const ramaSel = document.getElementById("apex-rama");
    if (sel) sel.value = disc;
    if (disc === "voley") {
        wrap?.classList.add("hidden");
    } else {
        wrap?.classList.remove("hidden");
        if (ramaSel) ramaSel.value = D().ramaFromScope(s) || "hombres";
    }
}

function getFlag(nombre) {
    const e = cursos_paises.find(x => x.p === nombre);
    return e ? `https://flagcdn.com/w40/${e.f}.png` : null;
}

function getCurso(nombre) {
    const e = cursos_paises.find(x => x.p === nombre);
    return e ? e.c : "";
}

function formatFechaES(iso) {
    if (!iso) return "";
    const p = iso.split("-");
    if (p.length !== 3) return iso;
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
}

let lastData = [];

function parseCSV(csv) {
    const lines = csv.trim().split("\n");
    const headers = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
        const values = line.split(",");
        return headers.reduce((obj, h, i) => {
            obj[h] = values[i]?.trim();
            return obj;
        }, {});
    });
}

function buildForma(pg, pe, pp) {
    let w = parseInt(pg, 10) || 0;
    let d = parseInt(pe, 10) || 0;
    let l = parseInt(pp, 10) || 0;
    const total = w + d + l;
    if (!total) return '<span class="forma-empty">—</span>';
    const seq = [];
    for (let i = 0; i < Math.min(5, total); i++) {
        const mw = Math.max(w, d, l);
        if (mw === 0) break;
        if (w === mw) { seq.push("win"); w--; }
        else if (d === mw) { seq.push("draw"); d--; }
        else { seq.push("loss"); l--; }
    }
    return seq.map(c => `<span class="dot ${c}"></span>`).join("");
}

function actualizarTitulosRanking(scope) {
    const s = D().normalizeLegacyScope(scope) || scope;
    const labels = D().LABELS[s] || D().LABELS.futbol_hombres;
    const hRank = document.getElementById("apex-ranking-title");
    if (hRank) hRank.textContent = `Ranking · ${labels.rankingTitle}`;
    const thG = document.getElementById("apex-th-gf");
    const thC = document.getElementById("apex-th-gc");
    const isFutbol = String(s).startsWith("futbol");
    if (thG) thG.textContent = isFutbol ? "GF" : labels.pointsHeader;
    if (thC) thC.textContent = isFutbol ? "GC" : "PC";
    const detLab = document.getElementById("det-points-label");
    if (detLab) detLab.textContent = labels.pointsDetail;
}

// ================================
function cargarProximosDesdeStorage(scope) {
    scope = scope || currentScope;
    try {
        const raw = localStorage.getItem(D().storageCal(scope));
        const data = raw ? JSON.parse(raw) : null;
        if (Array.isArray(data) && data.length) renderProximosPartidos(data);
        else renderProximosPartidos([]);
    } catch (e) {
        renderProximosPartidos([]);
    }
}

function renderProximosPartidos(matches) {
    const carousel = document.querySelector(".matches-carousel");
    if (!carousel) return;

    if (!matches.length) {
        carousel.innerHTML = `
            <div class="next-match-card next-match-card--empty">
                <p class="empty-matches-msg">Los próximos encuentros se configuran en el <strong>panel</strong> para esta disciplina.</p>
            </div>`;
        return;
    }

    carousel.innerHTML = matches.map(m => {
        const f1 = getFlag(m.t1);
        const f2 = getFlag(m.t2);
        const c1 = getCurso(m.t1);
        const c2 = getCurso(m.t2);
        const when = [formatFechaES(m.date), m.hour].filter(Boolean).join(" · ");
        return `
            <div class="next-match-card">
                <span class="match-hour">${when || "Fecha por confirmar"}</span>
                <div class="match-teams">
                    ${f1 ? `<img src="${f1}" alt="" width="42" height="42">` : ""}
                    <div class="match-team-label">
                        <span class="match-team-name">${m.t1 || "—"}</span>
                        <span class="match-team-course">${c1}</span>
                    </div>
                    <b class="vs-text">VS</b>
                    <div class="match-team-label">
                        <span class="match-team-name">${m.t2 || "—"}</span>
                        <span class="match-team-course">${c2}</span>
                    </div>
                    ${f2 ? `<img src="${f2}" alt="" width="42" height="42">` : ""}
                </div>
                <p class="court-info">Cancha principal</p>
            </div>`;
    }).join("");
}

// ================================
/** Cabeceras de Sheets pueden variar (PAÍS vs PAIS). */
function csvPais(r) {
    return String(r["PAÍS"] ?? r["PAIS"] ?? r["Pais"] ?? "").trim();
}

function csvCurso(r) {
    return String(r["CURSO"] ?? r["Curso"] ?? r["curso"] ?? "").trim();
}

function csvPts(r) {
    const v = r["PTS"] ?? r["Pts"] ?? r["pts"];
    return Number(v) || 0;
}

function csvCell(r, ...keys) {
    for (const k of keys) {
        if (r[k] !== undefined && r[k] !== "") return r[k];
    }
    return "";
}

function cargarRanking() {
    const scopeAtStart = D().normalizeLegacyScope(currentScope) || currentScope;
    const url = D().csvUrlForScope(scopeAtStart);
    if (!url) return;
    const bustUrl = `${url}${url.includes("?") ? "&" : "?"}cb=${Date.now()}`;
    fetch(bustUrl, { cache: "no-store" })
        .then(res => {
            if (!res.ok) throw new Error(String(res.status));
            return res.text();
        })
        .then(csv => {
            const scopeNow = D().normalizeLegacyScope(currentScope) || currentScope;
            if (scopeAtStart !== scopeNow) return;
            renderRanking(parseCSV(csv));
        })
        .catch(err => console.error("Error CSV:", err));
}

function renderRanking(data) {
    const tbody = document.getElementById("public-ranking-body");
    tbody.innerHTML = "";

    const sorted = [...data]
        .filter(r => csvPais(r))
        .sort((a, b) => csvPts(b) - csvPts(a));

    if (!sorted.length) {
        tbody.innerHTML = `
            <tr><td colspan="9" class="ranking-empty-msg">
                No hay equipos en el CSV de esta disciplina (revisá que la primera columna se llame PAÍS o PAIS y que el gid en <code>disciplinas.js</code> sea el de esta hoja).
            </td></tr>`;
        lastData = [];
        return;
    }

    sorted.forEach((t, index) => {
        const pais = csvPais(t);
        const curso = csvCurso(t);
        const pts = csvPts(t);
        const prev = lastData.find(p => p.pais === pais);
        const ptsChanged = prev && String(prev.pts) !== String(pts);

        const flagRaw = csvCell(t, "flag", "FLAG", "Bandera");
        const flagSrc = String(flagRaw).startsWith("http")
            ? flagRaw
            : `https://flagcdn.com/w40/${String(flagRaw || "xx").toLowerCase()}.png`;

        const tr = document.createElement("tr");
        tr.classList.add("ranking-row-clickable");
        tr.tabIndex = 0;
        tr.dataset.pais = pais;
        tr.dataset.curso = curso;
        if (ptsChanged) tr.classList.add("points-up");

        const pg = csvCell(t, "PG", "Pg") || 0;
        const pe = csvCell(t, "PE", "Pe") || 0;
        const pp = csvCell(t, "PP", "Pp") || 0;
        const gf = csvCell(t, "GF", "Gf", "PF", "Pf") || 0;
        const gc = csvCell(t, "GC", "Gc", "PC", "Pc") || 0;

        tr.innerHTML = `
            <td class="pos">${index + 1}</td>
            <td class="col-team">
                <div class="team-box">
                    <img src="${flagSrc}" width="26" alt="" onerror="this.style.display='none'">
                    <div>
                        <div class="country-name">${pais}</div>
                        <div class="course-name">${curso}</div>
                    </div>
                </div>
            </td>
            <td>${pg}</td>
            <td>${pe}</td>
            <td>${pp}</td>
            <td>${gf}</td>
            <td>${gc}</td>
            <td class="col-pts">${pts}</td>
            <td>
                <div class="form-dots">
                    ${buildForma(pg, pe, pp)}
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    lastData = sorted.map(r => ({ pais: csvPais(r), pts: csvPts(r) }));
}

// ================================
function cargarMarcadorLive(scope) {
    const s = D().normalizeLegacyScope(scope || currentScope) || scope || currentScope;
    const local = localStorage.getItem(D().storageLive(s));
    if (local) {
        try {
            const d = JSON.parse(local);
            renderMarcador({ scope: s, ...d });
        } catch (e) { /* ignore */ }
    } else {
        mostrarPlaceholderMarcador();
    }
}

function mostrarPlaceholderMarcador() {
    const strip = document.querySelector(".live-score-strip");
    if (!strip) return;
    const s = D().normalizeLegacyScope(currentScope) || currentScope;
    const title = D().LABELS[s]?.rankingTitle || "";
    strip.innerHTML = `
        <div class="live-strip-placeholder">
            <span class="live-indicator">● LIVE</span>
            <span class="live-placeholder-text">Marcador de <strong>${escapeHtml(title)}</strong> cuando el panel lo actualice</span>
        </div>
    `;
}

function renderMarcador(payload) {
    const strip = document.querySelector(".live-score-strip");
    if (!strip || !payload) return;

    const sc = D().normalizeLegacyScope(payload.scope || currentScope) || payload.scope || currentScope;
    const cur = D().normalizeLegacyScope(currentScope) || currentScope;
    if (sc !== cur) return;

    const { t1, t2, s1, s2, time } = payload;
    const flag1 = getFlag(t1);
    const flag2 = getFlag(t2);
    const curso1 = getCurso(t1);
    const curso2 = getCurso(t2);

    strip.innerHTML = `
        <div class="live-strip-inner">
            <div class="live-indicator">● LIVE</div>
            <div class="live-match-block">
                <div class="live-side">
                    ${flag1 ? `<img src="${flag1}" width="40" height="40" alt="">` : ""}
                    <span class="live-team">${t1 || "—"}</span>
                    <span class="live-curso">${curso1}</span>
                </div>
                <span class="m-score">${s1 ?? 0} — ${s2 ?? 0}</span>
                <div class="live-side">
                    ${flag2 ? `<img src="${flag2}" width="40" height="40" alt="">` : ""}
                    <span class="live-team">${t2 || "—"}</span>
                    <span class="live-curso">${curso2}</span>
                </div>
            </div>
            <span class="live-time-label">${escapeHtml(time || "")}</span>
        </div>
    `;
}

function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
}

// ================================
function onRankingRowClick(ev) {
    const tr = ev.target.closest("tr.ranking-row-clickable");
    if (!tr) return;
    abrirDetalleDesdeFila(tr);
}

function abrirDetalleDesdeFila(tr) {
    const card = document.getElementById("detail-card");
    if (!card) return;

    const tds = tr.querySelectorAll("td");
    const img = tr.querySelector("img");
    const pais = tr.dataset.pais || tr.querySelector(".country-name")?.textContent || "—";
    const curso = tr.dataset.curso || tr.querySelector(".course-name")?.textContent || "";

    const pg = parseInt(tds[2]?.textContent, 10) || 0;
    const pe = parseInt(tds[3]?.textContent, 10) || 0;
    const pp = parseInt(tds[4]?.textContent, 10) || 0;
    const gf = parseInt(tds[5]?.textContent, 10) || 0;
    const gc = parseInt(tds[6]?.textContent, 10) || 0;
    const pts = parseInt(tds[7]?.textContent, 10) || 0;
    const pj = pg + pe + pp;
    const dg = gf - gc;
    const rend = pj ? Math.min(100, Math.round((pts / (pj * 3)) * 100)) : 0;

    document.getElementById("det-flag").src = img?.src || "";
    document.getElementById("det-pais").textContent = pais;
    document.getElementById("det-curso").textContent = curso;
    document.getElementById("det-gf").textContent = String(gf);
    document.getElementById("det-dg").textContent = dg >= 0 ? `+${dg}` : String(dg);
    document.getElementById("det-rend").textContent = `${rend}%`;

    card.classList.remove("hidden");
}

function buscarMiCurso() {
    const curso = prompt("¿Cuál es tu curso? (ej: 5TO A)");
    if (!curso) return;

    const filas = document.querySelectorAll("#public-ranking-body tr");
    let encontrado = false;

    filas.forEach(fila => {
        fila.classList.remove("my-course");
        if (fila.textContent.toLowerCase().includes(curso.toLowerCase())) {
            fila.classList.add("my-course");
            fila.scrollIntoView({ behavior: "smooth", block: "center" });
            encontrado = true;
        }
    });

    if (!encontrado) alert(`No se encontró "${curso}"`);
}

function cerrarDetalle() {
    document.getElementById("detail-card").classList.add("hidden");
}

function onCambioDisciplinaRanking() {
    const next = getScopeFromDOM();
    if (next === currentScope) {
        const wrap = document.getElementById("apex-rama-wrap");
        const dval = document.getElementById("apex-disciplina")?.value;
        if (dval === "voley") wrap?.classList.add("hidden");
        else wrap?.classList.remove("hidden");
        return;
    }
    currentScope = D().normalizeLegacyScope(next) || next;
    try {
        localStorage.setItem(D().storageLastScope(), currentScope);
    } catch (e) { /* ignore */ }
    history.replaceState(null, "", `?d=${encodeURIComponent(currentScope)}`);
    aplicarVistaDisciplina();
}

function aplicarVistaDisciplina() {
    actualizarTitulosRanking(currentScope);
    lastData = [];
    cargarRanking();
    cargarProximosDesdeStorage(currentScope);
    cargarMarcadorLive(currentScope);
    if (rankingInterval) clearInterval(rankingInterval);
    rankingInterval = setInterval(cargarRanking, 15000);
}

function initDisciplinaRanking() {
    const dSel = document.getElementById("apex-disciplina");
    const rSel = document.getElementById("apex-rama");
    if (!dSel || dSel.dataset.bound) return;
    dSel.dataset.bound = "1";
    dSel.addEventListener("change", () => {
        const v = dSel.value;
        const wrap = document.getElementById("apex-rama-wrap");
        if (v === "voley") wrap?.classList.add("hidden");
        else wrap?.classList.remove("hidden");
        onCambioDisciplinaRanking();
    });
    rSel?.addEventListener("change", onCambioDisciplinaRanking);
}

window.addEventListener("load", () => {
    const params = new URLSearchParams(location.search);
    const q = params.get("d");
    let start = "futbol_hombres";
    try {
        const saved = localStorage.getItem(D().storageLastScope());
        const normQ = q ? D().normalizeLegacyScope(q) : null;
        const normSaved = saved ? D().normalizeLegacyScope(saved) : null;
        if (normQ && D().csvUrlForScope(normQ)) start = normQ;
        else if (normSaved && D().csvUrlForScope(normSaved)) start = normSaved;
    } catch (e) { /* ignore */ }

    currentScope = start;
    setDisciplinaUI(start);
    initDisciplinaRanking();

    aplicarVistaDisciplina();

    const bcLive = new BroadcastChannel("apex_live");
    bcLive.onmessage = (e) => {
        const p = e.data;
        if (!p) return;
        const ps = D().normalizeLegacyScope(p.scope) || p.scope;
        const cur = D().normalizeLegacyScope(currentScope) || currentScope;
        if (ps !== cur) return;
        renderMarcador(p);
    };

    try {
        const bcCal = new BroadcastChannel(BC_CALENDAR);
        bcCal.onmessage = (e) => {
            const p = e.data;
            if (p && p.scope === currentScope && Array.isArray(p.matches)) {
                renderProximosPartidos(p.matches);
            }
        };
    } catch (e) { /* ignore */ }

    window.addEventListener("storage", (ev) => {
        if (ev.key === D().storageLive(currentScope) && ev.newValue) {
            try {
                renderMarcador({ scope: currentScope, ...JSON.parse(ev.newValue) });
            } catch (err) { /* ignore */ }
        }
        if (ev.key === D().storageCal(currentScope) && ev.newValue) {
            try {
                renderProximosPartidos(JSON.parse(ev.newValue));
            } catch (err) { /* ignore */ }
        }
    });

    document.getElementById("public-ranking-body")?.addEventListener("click", onRankingRowClick);
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarDetalle();
});
