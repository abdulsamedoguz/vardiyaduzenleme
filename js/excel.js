// excel.js - Excel export

const ExcelExport = {
    export(schedule) {
        if (!schedule) { alert('Vardiya planı bulunamadı'); return; }

        const wb = XLSX.utils.book_new();

        // Sayfa 1: Vardiya Tablosu
        this._addScheduleSheet(wb, schedule);

        // Sayfa 2: Özet
        this._addSummarySheet(wb, schedule);

        const fileName = `vardiya_plani_${schedule.config.month}.xlsx`;
        XLSX.writeFile(wb, fileName);
    },

    _addScheduleSheet(wb, schedule) {
        const days = schedule.days;
        const personnel = schedule.personnel;

        // Başlık satırı
        const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        const header = ['Personel', 'Bölüm'];
        days.forEach(d => {
            header.push(`${d.day} ${dayNames[d.dow]}`);
        });
        header.push('Toplam Saat', 'Fazla Mesai');

        const rows = [header];

        personnel.forEach(p => {
            const row = [p.name, p.department || '-'];
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

        // Sütun genişlikleri
        ws['!cols'] = [
            { wch: 20 }, // Personel
            { wch: 12 }, // Bölüm
            ...days.map(() => ({ wch: 6 })),
            { wch: 12 }, // Toplam
            { wch: 12 }  // FM
        ];

        // Hücre stilleri (renklendirme)
        const shiftColors = {
            'S': { fgColor: { rgb: 'D4EDDA' } },   // Yeşil
            'O': { fgColor: { rgb: 'FFE5CC' } },   // Turuncu
            'G': { fgColor: { rgb: 'CCE5FF' } },   // Mavi
            'I': { fgColor: { rgb: 'E2E3E5' } },   // Gri
            'S12': { fgColor: { rgb: 'B8E6CC' } }, // Koyu yeşil
            'G12': { fgColor: { rgb: '99CCFF' } }  // Koyu mavi
        };

        // Apply styles
        for (let r = 1; r < rows.length; r++) {
            for (let c = 2; c < 2 + days.length; c++) {
                const cellRef = XLSX.utils.encode_cell({ r, c });
                const cell = ws[cellRef];
                if (cell && shiftColors[cell.v]) {
                    cell.s = { fill: shiftColors[cell.v] };
                }
            }
        }

        // Pazar günlerini kalınlaştır
        days.forEach((d, i) => {
            if (d.dow === 0) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: i + 2 });
                const cell = ws[cellRef];
                if (cell) {
                    cell.s = { font: { bold: true, color: { rgb: 'DC3545' } } };
                }
            }
        });

        XLSX.utils.book_append_sheet(wb, ws, 'Vardiya Planı');
    },

    _addSummarySheet(wb, schedule) {
        const stats = Scheduler.getPersonStats(schedule);

        const header = ['Personel', 'Bölüm', 'Yetkinlik', 'Toplam Saat', 'Normal Saat', 'Fazla Mesai',
            'Sabah', 'Öğle', 'Gece', 'İzin', 'Çalışma Günü', 'Pazar Çalışma'];

        const rows = [header];
        stats.forEach(s => {
            rows.push([
                s.name, s.department || '-', s.competency,
                s.totalHours, s.normalHours, s.overtime,
                s.morningCount, s.afternoonCount, s.nightCount,
                s.offCount, s.workDays, s.sundayWork
            ]);
        });

        // Toplam satırı
        rows.push([]);
        rows.push([
            'TOPLAM', '', '',
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
            { wch: 20 }, { wch: 12 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 8 }, { wch: 8 }, { wch: 8 },
            { wch: 8 }, { wch: 12 }, { wch: 14 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Özet');
    }
};
