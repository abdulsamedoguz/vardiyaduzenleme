// app.js - Ana uygulama mantigi

document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    initPersonnelUI();
    initSettingsUI();
    initScheduleUI();
    Dashboard.render();

    document.querySelectorAll('#mainTabs .nav-link').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            if (e.target.dataset.bsTarget === '#tabDashboard') Dashboard.render();
            if (e.target.dataset.bsTarget === '#tabSchedule') renderScheduleTable();
        });
    });
});

// Vardiya Ayarlari UI
function initSettingsUI() {
    const now = new Date();
    document.getElementById('planMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    document.querySelectorAll('input[name="shiftType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('shiftInfo3').classList.toggle('d-none', e.target.value !== '3');
            document.getElementById('shiftInfo12').classList.toggle('d-none', e.target.value !== '12');
            document.getElementById('shiftInfo7').classList.toggle('d-none', e.target.value !== '7');
        });
    });

    document.getElementById('btnGenerate').addEventListener('click', generatePlan);
}

function generatePlan() {
    const type = document.querySelector('input[name="shiftType"]:checked').value;
    const month = document.getElementById('planMonth').value;
    const minPerShift = parseInt(document.getElementById('minPerShift').value) || 3;
    const requireSenior = parseInt(document.getElementById('requireSenior').value) || 0;

    if (!month) { showGenerateAlert('Planlama ayi secin', 'danger'); return; }

    const personnel = Personnel.getAll();
    if (personnel.length === 0) { showGenerateAlert('Once personel ekleyin', 'danger'); return; }

    const result = Scheduler.generate({ type, month, minPerShift, requireSenior });
    if (result.error) { showGenerateAlert(result.error, 'danger'); return; }

    showGenerateAlert('Vardiya plani basariyla olusturuldu!', 'success');
    setTimeout(() => {
        const tabEl = document.querySelector('[data-bs-target="#tabSchedule"]');
        new bootstrap.Tab(tabEl).show();
    }, 800);
}

function showGenerateAlert(msg, type) {
    const el = document.getElementById('generateAlert');
    el.innerHTML = `<div class="alert alert-${type} py-2 small">${msg}</div>`;
    setTimeout(() => { el.innerHTML = ''; }, 5000);
}

// Vardiya Tablosu UI
function initScheduleUI() {
    document.getElementById('btnExportExcel')?.addEventListener('click', () => {
        ExcelExport.export(Scheduler.getSchedule());
    });
    renderScheduleTable();
}

function renderScheduleTable() {
    const schedule = Scheduler.getSchedule();
    if (!schedule) {
        document.getElementById('noSchedule').classList.remove('d-none');
        document.getElementById('scheduleContent').classList.add('d-none');
        return;
    }

    document.getElementById('noSchedule').classList.add('d-none');
    document.getElementById('scheduleContent').classList.remove('d-none');

    // Legend'i vardiya tipine gore guncelle
    updateShiftLegend(schedule.type);

    if (schedule.type === '7') {
        render7ShiftSchedule(schedule);
    } else {
        renderClassicSchedule(schedule);
    }
}

function updateShiftLegend(type) {
    const legend = document.getElementById('shiftLegend');
    if (type === '7') {
        legend.innerHTML = `
            <span class="badge bg-success">S = Sabah (07:30-15:30)</span>
            <span class="badge bg-warning text-dark">A = Aksam (15:30-23:30)</span>
            <span class="badge bg-primary">G = Gece (23:30-07:30)</span>
            <span class="badge bg-secondary">T = Tatil</span>
        `;
    } else {
        legend.innerHTML = `
            <span class="badge bg-success">S = Sabah</span>
            <span class="badge bg-warning text-dark">O = Ogle</span>
            <span class="badge bg-primary">G = Gece</span>
            <span class="badge bg-secondary">I = Izin</span>
            <span class="badge" style="background:#155724;color:#fff">S12 = Sabah 12s</span>
            <span class="badge" style="background:#004085;color:#fff">G12 = Gece 12s</span>
        `;
    }
}

/**
 * 7'li Vardiya - Gun bazli tablo + Grup paneli
 */
function render7ShiftSchedule(schedule) {
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
    const monthNames = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
        'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];

    const [year, mon] = schedule.config.month.split('-').map(Number);

    // Departman bilgisini bul
    const depts = [...new Set(schedule.personnel.map(p => p.department).filter(Boolean))];
    const sections = [...new Set(schedule.personnel.map(p => p.section).filter(Boolean))];

    // Header
    const headerEl = document.getElementById('scheduleHeader');
    headerEl.innerHTML = `
        <div class="card bg-light">
            <div class="card-body py-2">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <h5 class="mb-0">VARDIYA PROGRAMI</h5>
                        <small class="text-muted">${depts.join(', ') || 'Tum Departmanlar'}${sections.length ? ' / ' + sections.join(', ') : ''}</small>
                    </div>
                    <div class="col-md-4 text-center">
                        <h6 class="mb-0">${monthNames[mon - 1]} ${year}</h6>
                    </div>
                    <div class="col-md-4 text-end">
                        <small>
                            <strong>07:30-15:30</strong> | <strong>15:30-23:30</strong> | <strong>23:30-07:30</strong> | <strong>TATIL</strong>
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Gun bazli tablo
    const table = document.getElementById('scheduleTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    thead.innerHTML = `<tr>
        <th>Tarih</th>
        <th>Gun</th>
        <th class="text-center shift-col-S">Sabah<br><small>07:30-15:30</small></th>
        <th class="text-center shift-col-A">Aksam<br><small>15:30-23:30</small></th>
        <th class="text-center shift-col-G">Gece<br><small>23:30-07:30</small></th>
        <th class="text-center shift-col-T">Tatil</th>
    </tr>`;

    let bodyHtml = '';
    schedule.days.forEach((dayInfo, idx) => {
        const assignment = schedule.dayGroupAssignments[idx];
        const isWeekend = dayInfo.dow === 0 || dayInfo.dow === 6;
        const rowClass = isWeekend ? 'table-light' : '';

        const dateStr = `${String(dayInfo.day).padStart(2, '0')}.${String(mon).padStart(2, '0')}.${year}`;

        bodyHtml += `<tr class="${rowClass}">
            <td><strong>${dateStr}</strong></td>
            <td class="${isWeekend ? 'text-danger fw-bold' : ''}">${dayNames[dayInfo.dow]}</td>
            <td class="text-center">${renderGroupBadge(assignment.S)}</td>
            <td class="text-center">${renderGroupBadge(assignment.A)}</td>
            <td class="text-center">${renderGroupBadge(assignment.G)}</td>
            <td class="text-center">${assignment.T.map(g => renderGroupBadge(g)).join(' ')}</td>
        </tr>`;
    });

    tbody.innerHTML = bodyHtml;

    // Sag panel: Grup listesi
    renderGroupPanel(schedule);
}

function renderGroupBadge(groupName) {
    if (!groupName) return '-';
    const color = Scheduler.GROUP_COLORS[groupName];
    if (!color) return groupName;
    return `<span class="badge group-badge" style="background:${color.bg};color:${color.text};min-width:32px;font-size:0.9rem">${groupName}</span>`;
}

function renderGroupPanel(schedule) {
    const panel = document.getElementById('groupPanel');
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];

    let html = '';

    // Haftalik rotasyon haritasi
    html += `<div class="card mb-3">
        <div class="card-header fw-bold"><i class="bi bi-calendar-week"></i> Haftalik Rotasyon</div>
        <div class="card-body p-2">
            <table class="table table-sm table-bordered mb-0 text-center" style="font-size:0.8rem">
                <thead><tr>
                    <th></th><th>Pzt</th><th>Sal</th><th>Car</th><th>Per</th><th>Cum</th><th>Cmt</th><th>Paz</th>
                </tr></thead>
                <tbody>`;

    // Ilk 7 gunu goster (1 tam dongu)
    Scheduler.GROUP_NAMES.forEach((gName, gi) => {
        html += `<tr><td>${renderGroupBadge(gName)}</td>`;
        for (let d = 0; d < 7; d++) {
            // Pazartesi'den baslat: dow=1
            // Ilk pazartesiyi bul
            let firstMonday = 0;
            for (let i = 0; i < schedule.days.length; i++) {
                if (schedule.days[i].dow === 1) { firstMonday = i; break; }
            }
            const dayIdx = firstMonday + d;
            if (dayIdx < schedule.days.length) {
                const assignment = schedule.dayGroupAssignments[dayIdx];
                let cellContent = '';
                let cellClass = '';
                if (assignment.S === gName) { cellContent = 'S'; cellClass = 'shift-cell-S'; }
                else if (assignment.A === gName) { cellContent = 'A'; cellClass = 'shift-cell-A'; }
                else if (assignment.G === gName) { cellContent = 'G'; cellClass = 'shift-cell-G'; }
                else { cellContent = 'T'; cellClass = 'shift-cell-T'; }
                html += `<td class="${cellClass}">${cellContent}</td>`;
            } else {
                html += '<td>-</td>';
            }
        }
        html += '</tr>';
    });

    html += `</tbody></table></div></div>`;

    // Grup detay kartlari
    Scheduler.GROUP_NAMES.forEach((gName, gi) => {
        const color = Scheduler.GROUP_COLORS[gName];
        const groupPersonIds = schedule.groups[gi];
        const groupPersons = schedule.personnel.filter(p => groupPersonIds.includes(p.id));
        const holidays = schedule.groupHolidays[gName] || [];

        // Tatil gunlerini formatla
        const holidayDates = holidays.map(d => {
            const dayInfo = schedule.days.find(di => di.day === d);
            return `${d} ${dayNames[dayInfo.dow]}`;
        });

        // Tatil gunlerini 7'li gruplar halinde goster (haftalik)
        const holidayWeeks = [];
        for (let i = 0; i < holidayDates.length; i += 4) {
            holidayWeeks.push(holidayDates.slice(i, i + 4).join(', '));
        }

        html += `<div class="card mb-2 group-card">
            <div class="card-header py-1 text-white fw-bold" style="background:${color.bg}">
                <div class="d-flex justify-content-between align-items-center">
                    <span>Grup ${gName}</span>
                    <span class="badge bg-light text-dark">${groupPersons.length} kisi</span>
                </div>
            </div>
            <div class="card-body py-2 px-3">
                <div class="mb-1">`;

        groupPersons.forEach(p => {
            const deptInfo = [p.department, p.section].filter(Boolean).join(' / ');
            html += `<div class="d-flex justify-content-between align-items-center border-bottom py-1" style="font-size:0.8rem">
                <span>
                    <span class="competency-badge competency-${p.competency} me-1" style="width:18px;height:18px;line-height:18px;font-size:0.6rem">${p.competency}</span>
                    ${escapeHtml(p.name)}
                </span>
                <small class="text-muted">${deptInfo || ''}</small>
            </div>`;
        });

        html += `</div>
                <div class="mt-2">
                    <small class="text-muted fw-bold">Tatil Gunleri (${holidays.length} gun):</small><br>
                    <small class="text-muted">${holidayWeeks.join('<br>')}</small>
                </div>
            </div>
        </div>`;
    });

    // Toplam eleman sayisi
    html += `<div class="card">
        <div class="card-header py-1 fw-bold"><i class="bi bi-people"></i> Toplam Eleman</div>
        <div class="card-body py-2">
            <table class="table table-sm mb-0" style="font-size:0.85rem">
                <thead><tr><th>Grup</th><th>Kisi</th></tr></thead>
                <tbody>`;

    let total = 0;
    Scheduler.GROUP_NAMES.forEach((gName, gi) => {
        const count = schedule.groups[gi].length;
        total += count;
        html += `<tr><td>${renderGroupBadge(gName)}</td><td>${count}</td></tr>`;
    });
    html += `<tr class="table-dark"><td><strong>Toplam</strong></td><td><strong>${total}</strong></td></tr>`;
    html += `</tbody></table></div></div>`;

    panel.innerHTML = html;
}

/**
 * Klasik (3'lu / 12 saatlik) personel bazli tablo
 */
function renderClassicSchedule(schedule) {
    document.getElementById('scheduleHeader').innerHTML = '';
    document.getElementById('groupPanel').innerHTML = '';

    const table = document.getElementById('scheduleTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];

    let headerHtml = '<tr><th>Personel</th>';
    schedule.days.forEach(d => {
        const isSunday = d.dow === 0;
        headerHtml += `<th class="${isSunday ? 'text-danger' : ''}" title="${d.day}.${schedule.config.month}">${d.day}<br><small>${dayNames[d.dow]}</small></th>`;
    });
    headerHtml += '<th>Toplam</th><th>FM</th></tr>';
    thead.innerHTML = headerHtml;

    const stats = Scheduler.getPersonStats(schedule);
    let bodyHtml = '';

    schedule.personnel.forEach(p => {
        const pStat = stats.find(s => s.id === p.id);
        bodyHtml += `<tr><td title="${p.department || ''} / ${p.section || ''} - Yetkinlik: ${p.competency}">
            <span class="competency-badge competency-${p.competency} me-1" style="width:20px;height:20px;line-height:20px;font-size:0.65rem">${p.competency}</span>
            ${escapeHtml(p.name)}</td>`;

        schedule.days.forEach(d => {
            const assignment = schedule.assignments[p.id]?.find(a => a.day === d.day);
            if (assignment) {
                bodyHtml += `<td class="shift-${assignment.shift}" title="${assignment.hours} saat">${assignment.shift}</td>`;
            } else {
                bodyHtml += '<td>-</td>';
            }
        });

        const overtimeClass = pStat && pStat.overtime > 50 ? 'text-danger fw-bold' : pStat && pStat.overtime > 0 ? 'text-warning' : '';
        bodyHtml += `<td><strong>${pStat ? pStat.totalHours : 0}</strong></td>`;
        bodyHtml += `<td class="${overtimeClass}">${pStat ? pStat.overtime : 0}</td>`;
        bodyHtml += '</tr>';
    });

    bodyHtml += '<tr class="table-dark"><td><strong>Gunluk Toplam</strong></td>';
    schedule.days.forEach(d => {
        let dayTotal = 0;
        schedule.personnel.forEach(p => {
            const assignment = schedule.assignments[p.id]?.find(a => a.day === d.day);
            if (assignment && assignment.shift !== 'I' && assignment.shift !== 'T') dayTotal++;
        });
        bodyHtml += `<td><strong>${dayTotal}</strong></td>`;
    });
    bodyHtml += '<td></td><td></td></tr>';
    tbody.innerHTML = bodyHtml;
}
