// ================================
// APEX EDITOR (multi-disciplina)
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

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxO-3ybv1KaST9q-sdcCl_a6xeB64e8hH667cLb-liVmdFxCS8_NPGfvbn03ecEUNI/exec";
const BC_CALENDAR = "apex_calendar";

let currentScope = "futbol_hombres";

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

function getCalendarChannel() {
    return new BroadcastChannel(BC_CALENDAR);
}

// ================================
// CSV
// ================================
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

// ================================
// OPCIONES EQUIPOS
// ================================
function generarOpciones() {
    return cursos_paises.map(x =>
        `<option value="${x.p}">${x.p} — ${x.c}</option>`
    ).join("");
}

function generarOpcionesSelected(selected) {
    return cursos_paises.map(x => {
        const sel = x.p === selected ? " selected" : "";
        return `<option value="${x.p}"${sel}>${x.p} — ${x.c}</option>`;
    }).join("");
}

function defaultFechaPartido() {
    return new Date().toISOString().slice(0, 10);
}

function escapeAttr(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

// ================================
// TIEMPO / PERÍODO (según disciplina)
// ================================
function rellenarSelectTiempoVivo(scope) {
    const sel = document.getElementById("live-time");
    if (!sel) return;
    const key = D().liveTimeKeyForScope(scope);
    const opts = D().LIVE_TIME[key] || D().LIVE_TIME.futbol;
    const guardado = (() => {
        try {
            const raw = localStorage.getItem(D().storageLive(scope));
            if (!raw) return null;
            return JSON.parse(raw)?.time;
        } catch (e) {
            return null;
        }
    })();
    sel.innerHTML = opts.map(([v, lab]) => `<option value="${escapeAttr(v)}">${lab}</option>`).join("");
    if (guardado && [...sel.options].some(o => o.value === guardado)) sel.value = guardado;
}

// ================================
// CALENDARIO
// ================================
function leerCalendarioDesdeDOM() {
    const rows = document.querySelectorAll("#calendar-editor .cal-row");
    const out = [];
    rows.forEach(row => {
        const hour = row.querySelector(".c-hour")?.value?.trim() || "";
        const t1 = row.querySelector(".c-t1")?.value || "";
        const t2 = row.querySelector(".c-t2")?.value || "";
        const date = row.querySelector(".fecha-partido")?.value || "";
        out.push({ hour, t1, t2, date });
    });
    return out;
}

function quitarFilaCalendario(btn) {
    const cal = document.getElementById("calendar-editor");
    btn.closest(".cal-row")?.remove();
    if (!cal.querySelector(".cal-row")) {
        renderCalendarioRows([{
            hour: "",
            t1: cursos_paises[0]?.p || "",
            t2: cursos_paises[1]?.p || "",
            date: defaultFechaPartido()
        }]);
    }
    persistirCalendario();
}

function renderCalendarioRows(data) {
    const cal = document.getElementById("calendar-editor");
    if (!data?.length) {
        data = [{
            hour: "",
            t1: cursos_paises[0]?.p || "",
            t2: cursos_paises[1]?.p || "",
            date: defaultFechaPartido()
        }];
    }
    cal.innerHTML = data.map((m, i) => `
        <div class="cal-row" data-row="${i}">
            <input type="text" placeholder="Hora" class="c-hour" value="${escapeAttr(m.hour)}">
            <select class="c-t1">${generarOpcionesSelected(m.t1)}</select>
            <span class="vs-mid">VS</span>
            <select class="c-t2">${generarOpcionesSelected(m.t2)}</select>
            <input type="date" class="fecha-partido" value="${escapeAttr(m.date || defaultFechaPartido())}">
            <button type="button" class="btn-row-remove" onclick="quitarFilaCalendario(this)" aria-label="Quitar partido">✕</button>
        </div>
    `).join("");
}

function persistirCalendario() {
    const scope = currentScope;
    const data = leerCalendarioDesdeDOM();
    try {
        localStorage.setItem(D().storageCal(scope), JSON.stringify(data));
    } catch (e) {
        console.warn("Calendario:", e);
    }
    try {
        getCalendarChannel().postMessage({ scope, matches: data });
    } catch (e) { /* ignore */ }
}

function guardarCalendarioScope(scope) {
    const data = leerCalendarioDesdeDOM();
    try {
        localStorage.setItem(D().storageCal(scope), JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

function initCalendarioDelegation() {
    const cal = document.getElementById("calendar-editor");
    if (!cal || cal.dataset.delegationBound) return;
    cal.dataset.delegationBound = "1";
    cal.addEventListener("input", () => persistirCalendario());
    cal.addEventListener("change", () => persistirCalendario());
}

// ================================
// RANKING TABLA
// ================================
function dotsFormaDesdeStats(pg, pe, pp) {
    let w = parseInt(pg, 10) || 0;
    let d = parseInt(pe, 10) || 0;
    let l = parseInt(pp, 10) || 0;
    const total = w + d + l;
    if (!total) return "—";
    const seq = [];
    for (let i = 0; i < Math.min(5, total); i++) {
        const mw = Math.max(w, d, l);
        if (mw === 0) break;
        if (w === mw) { seq.push("V"); w--; }
        else if (d === mw) { seq.push("E"); d--; }
        else { seq.push("D"); l--; }
    }
    return seq.join(" · ");
}

function actualizarDerivadosFila(tr) {
    const c = tr.querySelectorAll("td");
    if (c.length < 9) return;
    const pg = parseInt(c[2].innerText, 10) || 0;
    const pe = parseInt(c[3].innerText, 10) || 0;
    const pp = parseInt(c[4].innerText, 10) || 0;
    const pj = pg + pe + pp;
    const pts = pg * 3 + pe;
    c[1].innerText = String(pj);
    c[7].innerText = String(pts);
    const formaCell = c[8];
    if (formaCell) formaCell.innerText = dotsFormaDesdeStats(pg, pe, pp);
}

function initTablaRankingDelegation() {
    const tbody = document.getElementById("editor-body");
    if (!tbody || tbody.dataset.delegationBound) return;
    tbody.dataset.delegationBound = "1";
    tbody.addEventListener("input", (e) => {
        const tr = e.target.closest("tr");
        if (tr && e.target.closest("td") && !e.target.closest(".team-info-cell")) {
            actualizarDerivadosFila(tr);
            guardarBackupRanking();
        }
    });
    tbody.addEventListener("blur", (e) => {
        const tr = e.target.closest("tr");
        if (tr && e.target.closest("td") && !e.target.closest(".team-info-cell")) {
            actualizarDerivadosFila(tr);
            guardarBackupRanking();
        }
    }, true);
}

function filaHTMLDesdeEquipo(item, pg, pe, pp, gf, gc) {
    const pj = pg + pe + pp;
    const pts = pg * 3 + pe;
    const forma = dotsFormaDesdeStats(pg, pe, pp);
    return `
        <tr>
            <td class="team-info-cell">
                <img src="https://flagcdn.com/w40/${item.f}.png" width="30" alt="">
                <div><b>${item.p}</b><br><small>${item.c}</small></div>
            </td>
            <td contenteditable="true">${pj}</td>
            <td contenteditable="true">${pg}</td>
            <td contenteditable="true">${pe}</td>
            <td contenteditable="true">${pp}</td>
            <td contenteditable="true">${gf}</td>
            <td contenteditable="true">${gc}</td>
            <td contenteditable="true">${pts}</td>
            <td contenteditable="true" class="col-forma">${forma}</td>
            <td class="col-actions"><button type="button" class="btn-row-remove" onclick="this.closest('tr').remove(); guardarBackupRanking();" aria-label="Eliminar fila">✕</button></td>
        </tr>`;
}

function renderTablaPorDefecto() {
    const tbody = document.getElementById("editor-body");
    tbody.innerHTML = cursos_paises.map(item =>
        filaHTMLDesdeEquipo(item, 0, 0, 0, 0, 0)
    ).join("");
}

function renderTablaDesdeCSVRows(rows) {
    const sorted = [...rows]
        .filter(r => editorCsvPais(r))
        .sort((a, b) => {
            const pa = parseInt(a["PTS"] ?? a["pts"], 10) || 0;
            const pb = parseInt(b["PTS"] ?? b["pts"], 10) || 0;
            return pb - pa;
        });
    if (!sorted.length) {
        renderTablaPorDefecto();
        return;
    }
    const tbody = document.getElementById("editor-body");
    tbody.innerHTML = sorted.map(t => {
        const pg = parseInt(t["PG"] ?? t["Pg"], 10) || 0;
        const pe = parseInt(t["PE"] ?? t["Pe"], 10) || 0;
        const pp = parseInt(t["PP"] ?? t["Pp"], 10) || 0;
        const gf = parseInt(t["GF"] ?? t["Gf"] ?? t["PF"] ?? t["Pf"], 10) || 0;
        const gc = parseInt(t["GC"] ?? t["Gc"] ?? t["PC"] ?? t["Pc"], 10) || 0;
        const flagRaw = t["flag"] ?? t["FLAG"] ?? "";
        const flagCode = String(flagRaw).startsWith("http")
            ? flagRaw
            : `https://flagcdn.com/w40/${String(flagRaw || "xx").toLowerCase()}.png`;
        const forma = dotsFormaDesdeStats(pg, pe, pp);
        const pj = pg + pe + pp;
        const pts = parseInt(t["PTS"] ?? t["pts"], 10) || (pg * 3 + pe);
        const nombrePais = editorCsvPais(t);
        const nombreCurso = editorCsvCurso(t);
        return `
        <tr>
            <td class="team-info-cell">
                <img src="${escapeAttr(flagCode)}" width="30" alt="" onerror="this.src='https://flagcdn.com/w40/xx.png'">
                <div><b contenteditable="true">${escapeAttr(nombrePais)}</b><br><small contenteditable="true">${escapeAttr(nombreCurso)}</small></div>
            </td>
            <td contenteditable="true">${pj}</td>
            <td contenteditable="true">${pg}</td>
            <td contenteditable="true">${pe}</td>
            <td contenteditable="true">${pp}</td>
            <td contenteditable="true">${gf}</td>
            <td contenteditable="true">${gc}</td>
            <td contenteditable="true">${pts}</td>
            <td contenteditable="true" class="col-forma">${forma}</td>
            <td class="col-actions"><button type="button" class="btn-row-remove" onclick="this.closest('tr').remove(); guardarBackupRanking();" aria-label="Eliminar fila">✕</button></td>
        </tr>`;
    }).join("");
    document.querySelectorAll("#editor-body tr").forEach(actualizarDerivadosFila);
}

function guardarBackupRanking() {
    try {
        localStorage.setItem(D().storageRankingBackup(currentScope), JSON.stringify(recopilarRankingParaJSON()));
    } catch (e) { /* ignore */ }
}

function cargarBackupRanking(scope) {
    try {
        const raw = localStorage.getItem(D().storageRankingBackup(scope));
        const arr = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(arr) || !arr.length) return false;
        const tbody = document.getElementById("editor-body");
        tbody.innerHTML = arr.map(row => {
            const pg = row.pg ?? 0, pe = row.pe ?? 0, pp = row.pp ?? 0;
            const gf = row.gf ?? 0, gc = row.gc ?? 0;
            const pj = row.pj ?? (pg + pe + pp);
            const pts = row.pts ?? (pg * 3 + pe);
            const forma = row.forma || dotsFormaDesdeStats(pg, pe, pp);
            const flagSrc = row.flag || "https://flagcdn.com/w40/xx.png";
            return `
        <tr>
            <td class="team-info-cell">
                <img src="${escapeAttr(flagSrc)}" width="30" alt="">
                <div><b contenteditable="true">${escapeAttr(row.pais || "")}</b><br><small contenteditable="true">${escapeAttr(row.curso || "")}</small></div>
            </td>
            <td contenteditable="true">${pj}</td>
            <td contenteditable="true">${pg}</td>
            <td contenteditable="true">${pe}</td>
            <td contenteditable="true">${pp}</td>
            <td contenteditable="true">${gf}</td>
            <td contenteditable="true">${gc}</td>
            <td contenteditable="true">${pts}</td>
            <td contenteditable="true" class="col-forma">${escapeAttr(forma)}</td>
            <td class="col-actions"><button type="button" class="btn-row-remove" onclick="this.closest('tr').remove(); guardarBackupRanking();" aria-label="Eliminar fila">✕</button></td>
        </tr>`;
        }).join("");
        document.querySelectorAll("#editor-body tr").forEach(actualizarDerivadosFila);
        return true;
    } catch (e) {
        return false;
    }
}

function editorCsvPais(r) {
    return String(r["PAÍS"] ?? r["PAIS"] ?? r["Pais"] ?? "").trim();
}

function editorCsvCurso(r) {
    return String(r["CURSO"] ?? r["Curso"] ?? r["curso"] ?? "").trim();
}

async function cargarRankingDesdeSheets(scope) {
    const requested = D().normalizeLegacyScope(scope) || scope;
    const url = D().csvUrlForScope(requested);
    if (!url) {
        if (!cargarBackupRanking(requested)) renderTablaPorDefecto();
        return;
    }
    const bustUrl = `${url}${url.includes("?") ? "&" : "?"}cb=${Date.now()}`;
    try {
        const res = await fetch(bustUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        const csv = await res.text();
        const stillHere = (D().normalizeLegacyScope(currentScope) || currentScope) === requested;
        if (!stillHere) return;
        const data = parseCSV(csv);
        renderTablaDesdeCSVRows(data);
        guardarBackupRanking();
    } catch (e) {
        console.warn("CSV editor:", e);
        if ((D().normalizeLegacyScope(currentScope) || currentScope) !== requested) return;
        if (!cargarBackupRanking(requested)) renderTablaPorDefecto();
        mostrarToast("Sin conexión a la hoja: usando copia local o plantilla");
    }
}

// ================================
// MARCADOR
// ================================
function persistirMarcadorInputs(scope) {
    const data = {
        t1: document.getElementById("live-t1")?.value,
        s1: document.getElementById("live-s1")?.value,
        t2: document.getElementById("live-t2")?.value,
        s2: document.getElementById("live-s2")?.value,
        time: document.getElementById("live-time")?.value
    };
    try {
        localStorage.setItem(D().storageLive(scope), JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

function aplicarMarcadorGuardado(scope) {
    let raw = null;
    try {
        raw = localStorage.getItem(D().storageLive(scope));
    } catch (e) { /* ignore */ }
    const data = raw ? JSON.parse(raw) : null;
    const t1 = document.getElementById("live-t1");
    const t2 = document.getElementById("live-t2");
    const s1 = document.getElementById("live-s1");
    const s2 = document.getElementById("live-s2");
    const tm = document.getElementById("live-time");
    const opciones = generarOpciones();
    t1.innerHTML = opciones;
    t2.innerHTML = opciones;
    if (data?.t1 && [...t1.options].some(o => o.value === data.t1)) t1.value = data.t1;
    if (data?.t2 && [...t2.options].some(o => o.value === data.t2)) t2.value = data.t2;
    if (data?.s1 !== undefined && data?.s1 !== "") s1.value = data.s1;
    else s1.value = "0";
    if (data?.s2 !== undefined && data?.s2 !== "") s2.value = data.s2;
    else s2.value = "0";
    rellenarSelectTiempoVivo(scope);
    if (data?.time && tm && [...tm.options].some(o => o.value === data.time)) tm.value = data.time;
}

function emitirMarcador() {
    const scope = currentScope;
    const data = {
        t1: document.getElementById("live-t1").value,
        s1: document.getElementById("live-s1").value,
        t2: document.getElementById("live-t2").value,
        s2: document.getElementById("live-s2").value,
        time: document.getElementById("live-time").value
    };
    try {
        localStorage.setItem(D().storageLive(scope), JSON.stringify(data));
    } catch (e) { /* ignore */ }
    try {
        const bc = new BroadcastChannel("apex_live");
        bc.postMessage({ scope, ...data });
        bc.close();
    } catch (e) { /* ignore */ }
}

function aplicarMarcadorVivo() {
    emitirMarcador();
    mostrarToast("Marcador enviado · se verá en el ranking en vivo");
}

function initLiveDelegation() {
    const root = document.getElementById("apex-live-root");
    if (!root || root.dataset.bound) return;
    root.dataset.bound = "1";
    const fire = () => {
        emitirMarcador();
    };
    root.addEventListener("input", fire);
    root.addEventListener("change", fire);
    root.querySelectorAll(".contador-container button").forEach(btn => {
        btn.addEventListener("click", () => setTimeout(fire, 50));
    });
}

// ================================
// CAMBIO DE DISCIPLINA
// ================================
function onCambioDisciplina() {
    const next = getScopeFromDOM();
    if (next === currentScope) {
        const wrap = document.getElementById("apex-rama-wrap");
        const dval = document.getElementById("apex-disciplina")?.value;
        if (dval === "voley") wrap?.classList.add("hidden");
        else wrap?.classList.remove("hidden");
        return;
    }
    guardarCalendarioScope(currentScope);
    persistirMarcadorInputs(currentScope);
    guardarBackupRanking();

    currentScope = D().normalizeLegacyScope(next) || next;
    try {
        localStorage.setItem(D().storageLastScope(), currentScope);
    } catch (e) { /* ignore */ }

    cargarVistaDisciplina(currentScope);
}

function initDisciplinaUI() {
    const dSel = document.getElementById("apex-disciplina");
    const rSel = document.getElementById("apex-rama");
    if (!dSel || dSel.dataset.bound) return;
    dSel.dataset.bound = "1";
    dSel.addEventListener("change", () => {
        const v = dSel.value;
        const wrap = document.getElementById("apex-rama-wrap");
        if (v === "voley") wrap?.classList.add("hidden");
        else wrap?.classList.remove("hidden");
        onCambioDisciplina();
    });
    rSel?.addEventListener("change", onCambioDisciplina);
}

function actualizarTitulosTablaEditor(scope) {
    const s = D().normalizeLegacyScope(scope) || scope;
    const labels = D().LABELS[s] || D().LABELS.futbol_hombres;
    const thG = document.querySelector("#apex-th-gf");
    const thC = document.querySelector("#apex-th-gc");
    const isFutbol = String(s).startsWith("futbol");
    if (thG) thG.textContent = isFutbol ? "GF" : labels.pointsHeader;
    if (thC) thC.textContent = isFutbol ? "GC" : "PC";
}

// ================================
// CARGA VISTA
// ================================
function cargarVistaDisciplina(scope) {
    setDisciplinaUI(scope);
    actualizarTitulosTablaEditor(scope);
    const rk = document.getElementById("editor-link-ranking");
    if (rk) rk.href = `ranking.html?d=${encodeURIComponent(scope)}`;
    const fk = document.getElementById("editor-footer-ranking");
    if (fk) fk.href = `ranking.html?d=${encodeURIComponent(scope)}`;
    rellenarSelectTiempoVivo(scope);

    let calGuardado = null;
    try {
        calGuardado = JSON.parse(localStorage.getItem(D().storageCal(scope)) || "null");
    } catch (e) { /* ignore */ }
    renderCalendarioRows(Array.isArray(calGuardado) && calGuardado.length ? calGuardado : null);

    cargarRankingDesdeSheets(scope).then(() => {
        document.querySelectorAll("#editor-body tr").forEach(actualizarDerivadosFila);
    });

    aplicarMarcadorGuardado(scope);
    initLiveDelegation();
}

// ================================
// INICIO
// ================================
function inicializarEditor() {
    initCalendarioDelegation();
    initTablaRankingDelegation();
    initDisciplinaUI();

    let start = "futbol_hombres";
    try {
        const saved = localStorage.getItem(D().storageLastScope());
        const norm = saved ? D().normalizeLegacyScope(saved) : null;
        if (norm && D().csvUrlForScope(norm)) start = norm;
    } catch (e) { /* ignore */ }

    currentScope = start;
    setDisciplinaUI(start);
    cargarVistaDisciplina(start);
}

// ================================
// EXPORTAR / GUARDAR
// ================================
function recopilarRankingParaJSON() {
    const rankingData = [];
    document.querySelectorAll("#editor-body tr").forEach(f => {
        const c = f.querySelectorAll("td");
        const pg = parseInt(c[2].innerText, 10) || 0;
        const pe = parseInt(c[3].innerText, 10) || 0;
        const pp = parseInt(c[4].innerText, 10) || 0;
        const gf = parseInt(c[5].innerText, 10) || 0;
        const gc = parseInt(c[6].innerText, 10) || 0;
        rankingData.push({
            pais:  c[0].querySelector("b")?.innerText?.trim() || "",
            curso: c[0].querySelector("small")?.innerText?.trim() || "",
            flag:  c[0].querySelector("img")?.getAttribute("src") || "",
            pj:    pg + pe + pp,
            pg, pe, pp, gf, gc,
            pts:   pg * 3 + pe,
            forma: c[8]?.innerText?.trim() || ""
        });
    });
    return rankingData;
}

function exportarDatos() {
    const ranking = recopilarRankingParaJSON();
    const calendario = leerCalendarioDesdeDOM();
    let marcadorEnVivo = null;
    try {
        marcadorEnVivo = JSON.parse(localStorage.getItem(D().storageLive(currentScope)) || "null");
    } catch (e) { /* ignore */ }

    const payload = {
        exportedAt: new Date().toISOString(),
        disciplina: currentScope,
        ranking,
        calendario,
        marcadorEnVivo
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `apex-export-${currentScope}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    mostrarToast("✅ Exportación descargada");
}

function guardarTodo() {
    const rankingData = recopilarRankingParaJSON().map(({ forma, ...rest }) => rest);

    fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ disciplina: currentScope, ranking: rankingData })
    })
        .then(() => {
            mostrarToast("✅ Sincronizado con Google Sheets");
            guardarBackupRanking();
            persistirCalendario();
        })
        .catch(() => mostrarToast("❌ Error al sincronizar"));
}

function agregarPartido() {
    const cal = document.getElementById("calendar-editor");
    const div = document.createElement("div");
    div.className = "cal-row";
    div.innerHTML = `
        <input type="text" placeholder="Hora" class="c-hour">
        <select class="c-t1">${generarOpciones()}</select>
        <span class="vs-mid">VS</span>
        <select class="c-t2">${generarOpciones()}</select>
        <input type="date" class="fecha-partido" value="${defaultFechaPartido()}">
        <button type="button" class="btn-row-remove" onclick="quitarFilaCalendario(this)" aria-label="Quitar partido">✕</button>
    `;
    cal.appendChild(div);
    persistirCalendario();
}

function mostrarToast(msg) {
    const area = document.getElementById("notification-area");
    const t = document.createElement("div");
    t.className = "glass-toast";
    t.textContent = msg;
    area.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function agregarEquipo() {
    const tbody = document.getElementById("editor-body");
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td class="team-info-cell">
            <img src="https://flagcdn.com/w40/xx.png" width="30" alt="">
            <div><b contenteditable="true">Nuevo</b><br><small contenteditable="true">Curso</small></div>
        </td>
        <td contenteditable="true">0</td>
        <td contenteditable="true">0</td>
        <td contenteditable="true">0</td>
        <td contenteditable="true">0</td>
        <td contenteditable="true">0</td>
        <td contenteditable="true">0</td>
        <td contenteditable="true">0</td>
        <td contenteditable="true" class="col-forma">—</td>
        <td class="col-actions"><button type="button" class="btn-row-remove" onclick="this.closest('tr').remove(); guardarBackupRanking();" aria-label="Eliminar fila">✕</button></td>
    `;
    tbody.appendChild(tr);
    actualizarDerivadosFila(tr);
    guardarBackupRanking();
}

window.onload = inicializarEditor;
