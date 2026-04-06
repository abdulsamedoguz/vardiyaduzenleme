// app.js - Ana uygulama mantığı

document.addEventListener('DOMContentLoaded', () => {
    // Auth kontrolü
    if (!Auth.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // Modülleri başlat
    initPersonnelUI();
    initSettingsUI();
    initScheduleUI();

    // Dashboard'u render et
    Dashboard.render();

    // Tab değiştiğinde dashboard güncelle
    document.querySelectorAll('#mainTabs .nav-link').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            if (e.target.dataset.bsTarget === '#tabDashboard') {
                Dashboard.render();
            }
            if (e.target.dataset.bsTarget === '#tabSchedule') {
                renderScheduleTable();
            }
        });
    });
});

// Vardiya Ayarları UI
function initSettingsUI() {
    // Varsayılan ay: bu ay
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('planMonth').value = defaultMonth;

    // Vardiya tipi değiştiğinde info göster
    document.querySelectorAll('input[name="shiftType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('shiftInfo3').classList.toggle('d-none', e.target.value !== '3');
            document.getElementById('shiftInfo12').classList.toggle('d-none', e.target.value !== '12');
            document.getElementById('shiftInfo7').classList.toggle('d-none', e.target.value !== '7');
        });
    });

    // Plan oluştur
    document.getElementById('btnGenerate').addEventListener('click', generatePlan);
}

function generatePlan() {
    const type = document.querySelector('input[name="shiftType"]:checked').value;
    const month = document.getElementById('planMonth').value;
    const minPerShift = parseInt(document.getElementById('minPerShift').value) || 3;
    const requireSenior = parseInt(document.getElementById('requireSenior').value) || 0;

    if (!month) {
        showGenerateAlert('Planlama ayı seçin', 'danger');
        return;
    }

    const personnel = Personnel.getAll();
    if (personnel.length === 0) {
        showGenerateAlert('Önce personel ekleyin', 'danger');
        return;
    }

    const result = Scheduler.generate({ type, month, minPerShift, requireSenior });

    if (result.error) {
        showGenerateAlert(result.error, 'danger');
        return;
    }

    showGenerateAlert('Vardiya planı başarıyla oluşturuldu!', 'success');

    // Vardiya tablosuna geç
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
        const schedule = Scheduler.getSchedule();
        ExcelExport.export(schedule);
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

    const table = document.getElementById('scheduleTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    // Header
    let headerHtml = '<tr><th>Personel</th>';
    schedule.days.forEach(d => {
        const isSunday = d.dow === 0;
        headerHtml += `<th class="${isSunday ? 'text-danger' : ''}" title="${d.day}.${schedule.config.month}">${d.day}<br><small>${dayNames[d.dow]}</small></th>`;
    });
    headerHtml += '<th>Toplam</th><th>FM</th></tr>';
    thead.innerHTML = headerHtml;

    // Body
    const stats = Scheduler.getPersonStats(schedule);
    let bodyHtml = '';

    schedule.personnel.forEach(p => {
        const pStat = stats.find(s => s.id === p.id);
        bodyHtml += `<tr><td title="${p.department || ''} - Yetkinlik: ${p.competency}">
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

    // Günlük toplam satırı
    bodyHtml += '<tr class="table-dark"><td><strong>Günlük Toplam</strong></td>';
    schedule.days.forEach(d => {
        let dayTotal = 0;
        schedule.personnel.forEach(p => {
            const assignment = schedule.assignments[p.id]?.find(a => a.day === d.day);
            if (assignment && assignment.shift !== 'I') dayTotal++;
        });
        bodyHtml += `<td><strong>${dayTotal}</strong></td>`;
    });
    bodyHtml += '<td></td><td></td></tr>';

    tbody.innerHTML = bodyHtml;
}
