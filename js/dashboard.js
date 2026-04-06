// dashboard.js - Dashboard ve raporlama

const Dashboard = {
    render() {
        const schedule = Scheduler.getSchedule();
        if (!schedule) {
            document.getElementById('noPlanWarning').classList.remove('d-none');
            document.getElementById('dashboardContent').classList.add('d-none');
            return;
        }

        document.getElementById('noPlanWarning').classList.add('d-none');
        document.getElementById('dashboardContent').classList.remove('d-none');

        const stats = Scheduler.getPersonStats(schedule);
        const minPerShift = parseInt(schedule.config?.minPerShift) || 3;
        const alerts = Scheduler.getSurplusAlerts(schedule, minPerShift);

        this.renderStatCards(stats, schedule, alerts);
        this.renderTodayShift(schedule);
        this.renderAlerts(alerts, schedule);
        this.renderOvertimeTable(stats);
    },

    renderStatCards(stats, schedule, alerts) {
        const totalPersonnel = stats.length;
        const totalOvertime = stats.reduce((s, p) => s + p.overtime, 0);
        const surplusCount = alerts.filter(a => a.type === 'surplus').length;
        const deficitCount = alerts.filter(a => a.type === 'deficit').length;

        const shiftTypeName = {
            '3': '3\'lü Vardiya (8 saat)',
            '12': '12 Saatlik Vardiya',
            '7': '7\'li Vardiya'
        }[schedule.type] || schedule.type;

        document.getElementById('statCards').innerHTML = `
            <div class="col-md-3">
                <div class="card stat-card border-primary">
                    <div class="card-body py-2">
                        <div class="text-muted small">Personel</div>
                        <div class="h4 mb-0">${totalPersonnel}</div>
                        <div class="text-muted small">${shiftTypeName}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card border-success">
                    <div class="card-body py-2">
                        <div class="text-muted small">Planlama Ayı</div>
                        <div class="h4 mb-0">${schedule.config.month}</div>
                        <div class="text-muted small">${schedule.days.length} gün</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card border-warning">
                    <div class="card-body py-2">
                        <div class="text-muted small">Toplam Fazla Mesai</div>
                        <div class="h4 mb-0">${totalOvertime} <small class="fs-6">saat</small></div>
                        <div class="text-muted small">Kişi ort: ${totalPersonnel > 0 ? Math.round(totalOvertime / totalPersonnel) : 0}s</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card ${surplusCount > 0 || deficitCount > 0 ? 'border-danger' : 'border-success'}">
                    <div class="card-body py-2">
                        <div class="text-muted small">Uyarılar</div>
                        <div class="h4 mb-0">${surplusCount + deficitCount}</div>
                        <div class="text-muted small">
                            ${surplusCount > 0 ? `<span class="text-warning">${surplusCount} fazla</span> ` : ''}
                            ${deficitCount > 0 ? `<span class="text-danger">${deficitCount} eksik</span>` : ''}
                            ${surplusCount === 0 && deficitCount === 0 ? '<span class="text-success">Sorun yok</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderTodayShift(schedule) {
        const container = document.getElementById('todayShift');
        const today = new Date();
        const [sYear, sMonth] = schedule.config.month.split('-').map(Number);

        // Check if today is in the schedule month
        if (today.getFullYear() !== sYear || (today.getMonth() + 1) !== sMonth) {
            container.innerHTML = `<p class="text-muted">Planlanan ay (${schedule.config.month}) bugünkü tarihle eşleşmiyor.</p>
                <p class="small">Ayın 1. günü için gösterim:</p>`;
            this._renderDayShift(container, schedule, 1);
            return;
        }

        this._renderDayShift(container, schedule, today.getDate());
    },

    _renderDayShift(container, schedule, dayNum) {
        const shiftLabels = {
            'S': '<span class="badge bg-success">Sabah 07:30-15:30</span>',
            'O': '<span class="badge bg-warning text-dark">Öğle 15:30-23:30</span>',
            'G': '<span class="badge bg-primary">Gece 23:30-07:30</span>',
            'S12': '<span class="badge" style="background:#155724">Gündüz 07:30-19:30</span>',
            'G12': '<span class="badge" style="background:#004085">Gece 19:30-07:30</span>',
            'I': '<span class="badge bg-secondary">İzin</span>'
        };

        const dayGroups = {};
        schedule.personnel.forEach(p => {
            const assignment = schedule.assignments[p.id]?.find(a => a.day === dayNum);
            if (assignment) {
                if (!dayGroups[assignment.shift]) dayGroups[assignment.shift] = [];
                dayGroups[assignment.shift].push(p.name);
            }
        });

        let html = `<h6>Gün ${dayNum}</h6>`;
        Object.entries(dayGroups).forEach(([shift, names]) => {
            html += `<div class="mb-2">${shiftLabels[shift] || shift} <span class="badge bg-dark">${names.length} kişi</span>
                <div class="small text-muted">${names.join(', ')}</div></div>`;
        });

        container.innerHTML += html;
    },

    renderAlerts(alerts, schedule) {
        const container = document.getElementById('dashAlerts');

        if (alerts.length === 0) {
            container.innerHTML = '<p class="text-success"><i class="bi bi-check-circle"></i> Herşey yolunda, uyarı yok.</p>';
            return;
        }

        const shiftNames = { 'S': 'Sabah', 'O': 'Öğle', 'G': 'Gece', 'S12': 'Gündüz 12s', 'G12': 'Gece 12s' };

        // İlk 10 uyarıyı göster
        const shown = alerts.slice(0, 10);
        let html = '<ul class="list-group list-group-flush">';
        shown.forEach(a => {
            if (a.type === 'surplus') {
                html += `<li class="list-group-item list-group-item-warning py-1 small">
                    <i class="bi bi-exclamation-triangle"></i> Gün ${a.day} - ${shiftNames[a.shift] || a.shift}: ${a.count} kişi (${a.surplus} fazla)
                </li>`;
            } else {
                html += `<li class="list-group-item list-group-item-danger py-1 small">
                    <i class="bi bi-x-circle"></i> Gün ${a.day} - ${shiftNames[a.shift] || a.shift}: ${a.count} kişi (${a.deficit} eksik)
                </li>`;
            }
        });
        if (alerts.length > 10) {
            html += `<li class="list-group-item py-1 small text-muted">...ve ${alerts.length - 10} uyarı daha</li>`;
        }
        html += '</ul>';
        container.innerHTML = html;
    },

    renderOvertimeTable(stats) {
        const tbody = document.querySelector('#overtimeTable tbody');
        const maxOvertime = Math.max(...stats.map(s => s.overtime), 1);

        tbody.innerHTML = stats.map(s => {
            const pct = Math.round((s.overtime / maxOvertime) * 100);
            const barColor = s.overtime > 50 ? '#dc3545' : s.overtime > 20 ? '#ffc107' : '#28a745';
            return `<tr>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.department || '-')}</td>
                <td>${s.totalHours}s</td>
                <td>${s.normalHours}s</td>
                <td>
                    <strong class="${s.overtime > 50 ? 'text-danger' : s.overtime > 20 ? 'text-warning' : 'text-success'}">${s.overtime}s</strong>
                </td>
                <td style="width:120px">
                    <div class="overtime-bar">
                        <div class="overtime-bar-fill" style="width:${pct}%;background:${barColor}"></div>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }
};
