// excel.js - Excel export

const ExcelExport = {
    export(schedule) {
        if (!schedule) { alert('Vardiya plani bulunamadi'); return; }

        const wb = XLSX.utils.book_new();

        if (schedule.type === '7') {
            this._add7ShiftScheduleSheet(wb, schedule);
            this._add7ShiftGroupSheet(wb, schedule);
        } else {
            this._addScheduleSheet(wb, schedule);
        }

        this._addSummarySheet(wb, schedule);

        const fileName = `vardiya_plani_${schedule.config.month}.xlsx`;
        XLSX.writeFile(wb, fileName);
    },

    /**
     * 7'li Vardiya - Gun bazli tablo
     */
    _add7ShiftScheduleSheet(wb, schedule) {
        const [year, mon] = schedule.config.month.split('-').map(Number);
        const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];

        const header = ['Tarih', 'Gun', 'Sabah (07:30-15:30)', 'Aksam (15:30-23:30)', 'Gece (23:30-07:30)', 'Tatil'];
        const rows = [header];

        schedule.days.forEach((d, idx) => {
            const assignment = schedule.dayGroupAssignments[idx];
            const dateStr = `${String(d.day).padStart(2, '0')}.${String(mon).padStart(2, '0')}.${year}`;
            rows.push([
                dateStr,
                dayNames[d.dow],
                assignment.S ? `Grup ${assignment.S}` : '-',
                assignment.A ? `Grup ${assignment.A}` : '-',
                assignment.G ? `Grup ${assignment.G}` : '-',
                assignment.T.map(g => `Grup ${g}`).join(', ')
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 12 }, { wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 30 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Vardiya Programi');
    },

    /**
     * 7'li Vardiya - Grup detaylari
     */
    _add7ShiftGroupSheet(wb, schedule) {
        const rows = [['GRUP DETAYLARI']];
        rows.push([]);

        Scheduler.GROUP_NAMES.forEach((gName, gi) => {
            const groupPersonIds = schedule.groups[gi];
            const persons = schedule.personnel.filter(p => groupPersonIds.includes(p.id));
            const holidays = schedule.groupHolidays[gName] || [];

            rows.push([`Grup ${gName} (${persons.length} kisi)`]);
            rows.push(['Ad Soyad', 'Departman', 'Kisim', 'Yetkinlik']);

            persons.forEach(p => {
                const compLabels = { 1: 'Stajyer', 2: 'Junior', 3: 'Orta', 4: 'Senior', 5: 'Uzman' };
                rows.push([p.name, p.department || '-', p.section || '-', compLabels[p.competency] || p.competency]);
            });

            rows.push([`Tatil Gunleri: ${holidays.join(', ')}`]);
            rows.push([]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Gruplar');
    },

    /**
     * Klasik personel bazli tablo
     */
    _addScheduleSheet(wb, schedule) {
        const days = schedule.days;
        const personnel = schedule.personnel;
        const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];

        const header = ['Personel', 'Departman', 'Kisim'];
        days.forEach(d => {
            header.push(`${d.day} ${dayNames[d.dow]}`);
        });
        header.push('Toplam Saat', 'Fazla Mesai');

        const rows = [header];

        personnel.forEach(p => {
            const row = [p.name, p.department || '-', p.section || '-'];
            let totalHours = 0;
            days.forEach(d => {
                const assignment = schedule.assignments[p.id]?.find(a => a.day === d.day);
                if (assignment) {
                    row.push(assignment.shift);
                    totalHours += assignment.hours;
                } else {
                    row.push('-');
                }
            });

            const weeksInMonth = days.length / 7;
            const normalHours = Math.round(weeksInMonth * 45);
            const overtime = Math.max(0, totalHours - normalHours);

            row.push(totalHours);
            row.push(overtime);
            rows.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 20 }, { wch: 12 }, { wch: 12 },
            ...days.map(() => ({ wch: 6 })),
            { wch: 12 }, { wch: 12 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Vardiya Plani');
    },

    _addSummarySheet(wb, schedule) {
        const stats = Scheduler.getPersonStats(schedule);

        const header = ['Personel', 'Departman', 'Kisim', 'Yetkinlik', 'Toplam Saat', 'Normal Saat', 'Fazla Mesai',
            'Sabah', 'Aksam/Ogle', 'Gece', 'Izin/Tatil', 'Calisma Gunu', 'Pazar Calisma'];

        const rows = [header];
        stats.forEach(s => {
            rows.push([
                s.name, s.department || '-', s.section || '-', s.competency,
                s.totalHours, s.normalHours, s.overtime,
                s.morningCount, s.afternoonCount, s.nightCount,
                s.offCount, s.workDays, s.sundayWork
            ]);
        });

        rows.push([]);
        rows.push([
            'TOPLAM', '', '', '',
            stats.reduce((s, p) => s + p.totalHours, 0),
            stats.reduce((s, p) => s + p.normalHours, 0),
            stats.reduce((s, p) => s + p.overtime, 0),
            stats.reduce((s, p) => s + p.morningCount, 0),
            stats.reduce((s, p) => s + p.afternoonCount, 0),
            stats.reduce((s, p) => s + p.nightCount, 0),
            stats.reduce((s, p) => s + p.offCount, 0),
            stats.reduce((s, p) => s + p.workDays, 0),
            stats.reduce((s, p) => s + p.sundayWork, 0)
        ]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 8 }, { wch: 10 }, { wch: 8 },
            { wch: 10 }, { wch: 12 }, { wch: 14 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Ozet');
    }
};
