// scheduler.js - Vardiya planlama algoritması

const Scheduler = {
    STORAGE_KEY: 'sp_schedule',

    // Vardiya sabitleri
    SHIFTS: {
        '3': {
            name: '3\'lü Vardiya',
            slots: [
                { code: 'S', label: 'Sabah', start: '07:30', end: '15:30', hours: 8 },
                { code: 'O', label: 'Öğle', start: '15:30', end: '23:30', hours: 8 },
                { code: 'G', label: 'Gece', start: '23:30', end: '07:30', hours: 8 }
            ],
            sundaySlots: [
                { code: 'S12', label: 'Sabah 12s', start: '07:30', end: '19:30', hours: 12 },
                { code: 'G12', label: 'Gece 12s', start: '19:30', end: '07:30', hours: 12 }
            ]
        },
        '12': {
            name: '12 Saatlik',
            slots: [
                { code: 'S12', label: 'Gündüz', start: '07:30', end: '19:30', hours: 12 },
                { code: 'G12', label: 'Gece', start: '19:30', end: '07:30', hours: 12 }
            ]
        },
        '7': {
            name: '7\'li Vardiya',
            slots: [
                { code: 'S', label: 'Sabah', start: '07:30', end: '15:30', hours: 8 },
                { code: 'O', label: 'Öğle', start: '15:30', end: '23:30', hours: 8 },
                { code: 'G', label: 'Gece', start: '23:30', end: '07:30', hours: 8 }
            ]
        }
    },

    getSchedule() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
    },

    saveSchedule(schedule) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(schedule));
    },

    /**
     * Ana planlama fonksiyonu
     * @param {Object} config - {type, month, minPerShift, requireSenior}
     * @returns {Object} schedule data
     */
    generate(config) {
        const personnel = Personnel.getAll();
        if (personnel.length === 0) return { error: 'Personel listesi boş' };

        const { type, month, minPerShift, requireSenior } = config;
        const [year, mon] = month.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();

        // Gün bilgileri
        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, mon - 1, d);
            days.push({
                day: d,
                dow: date.getDay(), // 0=Pazar
                date: date,
                isWeekend: date.getDay() === 0
            });
        }

        let result;
        switch (type) {
            case '3': result = this._generate3Shift(personnel, days, minPerShift, requireSenior); break;
            case '12': result = this._generate12Shift(personnel, days, minPerShift, requireSenior); break;
            case '7': result = this._generate7Shift(personnel, days, minPerShift, requireSenior); break;
            default: return { error: 'Geçersiz vardiya tipi' };
        }

        result.config = config;
        result.days = days;
        result.generatedAt = new Date().toISOString();
        this.saveSchedule(result);
        return result;
    },

    /**
     * 3'lü Vardiya (8 saat)
     * Pzt-Cmt: S/Ö/G (8 saat)
     * Pazar: 1.V ve 2.V 12 saat, 3.V(gece) izin
     * Dönüş: İzinli gece grubu → Pazartesi sabaha geçer
     */
    _generate3Shift(personnel, days, minPerShift, requireSenior) {
        const groups = this._splitIntoGroups(personnel, 3, requireSenior);
        if (groups.error) return groups;

        // Grup ataması: 0=Sabah, 1=Öğle, 2=Gece
        // Her 3 hafta döngü (21 gün): hafta1=Sabah, hafta2=Öğle, hafta3=Gece
        const assignments = {}; // personId -> [{day, shift, hours}]
        personnel.forEach(p => { assignments[p.id] = []; });

        // Her personelin hangi grupta olduğunu belirle
        const personGroup = {};
        groups.forEach((group, gi) => {
            group.forEach(p => { personGroup[p.id] = gi; });
        });

        // Döngü: 3 haftalık periyot
        // Hafta 1: Grup0=S, Grup1=Ö, Grup2=G
        // Hafta 2: Grup0=Ö, Grup1=G, Grup2=S
        // Hafta 3: Grup0=G, Grup1=S, Grup2=Ö
        const rotationMap = [
            [0, 1, 2], // Hafta 1
            [1, 2, 0], // Hafta 2
            [2, 0, 1]  // Hafta 3
        ];

        const shiftCodes = ['S', 'O', 'G'];

        days.forEach((dayInfo) => {
            // Haftanın kaçıncı haftası (0-indexed, Pazartesi başlangıç)
            // İlk Pazartesi'yi bul ve ona göre hafta hesapla
            const dayOfMonth = dayInfo.day;
            const weekIndex = Math.floor((dayOfMonth - 1) / 7) % 3;
            const rotation = rotationMap[weekIndex];

            if (dayInfo.dow === 0) {
                // PAZAR: 1.V ve 2.V 12 saat, Gece grubu İZİN
                groups.forEach((group, gi) => {
                    const assignedShiftIdx = rotation[gi]; // 0=S, 1=Ö, 2=G
                    group.forEach(p => {
                        if (assignedShiftIdx === 0) {
                            // Sabah grubu → 12 saat sabah
                            assignments[p.id].push({ day: dayInfo.day, shift: 'S12', hours: 12 });
                        } else if (assignedShiftIdx === 1) {
                            // Öğle grubu → 12 saat gece
                            assignments[p.id].push({ day: dayInfo.day, shift: 'G12', hours: 12 });
                        } else {
                            // Gece grubu → İZİN
                            assignments[p.id].push({ day: dayInfo.day, shift: 'I', hours: 0 });
                        }
                    });
                });
            } else {
                // PAZARTESİ-CUMARTESİ: Normal 8 saat
                // Eğer Pazartesi ise ve önceki gün (Pazar) gece grubu izindiyse,
                // gece grubu sabaha geçer = bir sonraki rotasyona kayar
                // Bu zaten 3 haftalık döngüde ele alınıyor

                groups.forEach((group, gi) => {
                    const assignedShiftIdx = rotation[gi];
                    const code = shiftCodes[assignedShiftIdx];
                    group.forEach(p => {
                        assignments[p.id].push({ day: dayInfo.day, shift: code, hours: 8 });
                    });
                });
            }
        });

        return {
            type: '3',
            groups: groups.map(g => g.map(p => p.id)),
            assignments,
            personnel
        };
    },

    /**
     * 12 Saatlik Vardiya - 4 Grup Sistemi
     * 2 gün gündüz → 2 gün gece → 2 gün izin → tekrar
     * 6 günlük döngü
     */
    _generate12Shift(personnel, days, minPerShift, requireSenior) {
        const groups = this._splitIntoGroups(personnel, 4, requireSenior);
        if (groups.error) return groups;

        const assignments = {};
        personnel.forEach(p => { assignments[p.id] = []; });

        const personGroup = {};
        groups.forEach((group, gi) => {
            group.forEach(p => { personGroup[p.id] = gi; });
        });

        // 6 günlük döngü her grup için:
        // Gün 0,1: Gündüz (S12)
        // Gün 2,3: Gece (G12)
        // Gün 4,5: İzin (I)
        // Her grup farklı offset ile başlar
        const cyclePattern = ['S12', 'S12', 'G12', 'G12', 'I', 'I'];
        const groupOffsets = [0, 2, 4, 3]; // Stagger groups so 2 are always working

        days.forEach((dayInfo) => {
            const dayIdx = dayInfo.day - 1; // 0-indexed

            groups.forEach((group, gi) => {
                const cycleDay = (dayIdx + groupOffsets[gi]) % 6;
                const shift = cyclePattern[cycleDay];
                const hours = shift === 'I' ? 0 : 12;

                group.forEach(p => {
                    assignments[p.id].push({ day: dayInfo.day, shift, hours });
                });
            });
        });

        return {
            type: '12',
            groups: groups.map(g => g.map(p => p.id)),
            assignments,
            personnel
        };
    },

    /**
     * 7'li Vardiya - Haftalık rotasyon, hafta tatili var
     */
    _generate7Shift(personnel, days, minPerShift, requireSenior) {
        const groups = this._splitIntoGroups(personnel, 4, requireSenior);
        if (groups.error) return groups;

        const assignments = {};
        personnel.forEach(p => { assignments[p.id] = []; });

        // 7 günlük döngü: 5 gün çalış, 1 gün izin, 1 gün izin (cumartesi-pazar)
        // veya basitçe: Pzt-Cum çalış, Cmt-Paz izin, haftalık vardiya rotasyonu
        const shiftCodes = ['S', 'O', 'G'];
        const personGroup = {};
        groups.forEach((group, gi) => {
            group.forEach(p => { personGroup[p.id] = gi; });
        });

        // Rotation: her hafta vardiya kayar
        days.forEach((dayInfo) => {
            const weekIdx = Math.floor((dayInfo.day - 1) / 7) % 3;
            const rotationMap = [
                [0, 1, 2, -1], // Grup0=S, Grup1=Ö, Grup2=G, Grup3=İzin
                [1, 2, -1, 0],
                [2, -1, 0, 1],
            ];
            const rotation = rotationMap[weekIdx];

            // Cumartesi-Pazar izin (hafta tatili)
            const isWeekend = dayInfo.dow === 0 || dayInfo.dow === 6;

            groups.forEach((group, gi) => {
                const shiftIdx = rotation[gi];
                group.forEach(p => {
                    if (isWeekend || shiftIdx === -1) {
                        assignments[p.id].push({ day: dayInfo.day, shift: 'I', hours: 0 });
                    } else {
                        assignments[p.id].push({ day: dayInfo.day, shift: shiftCodes[shiftIdx], hours: 8 });
                    }
                });
            });
        });

        return {
            type: '7',
            groups: groups.map(g => g.map(p => p.id)),
            assignments,
            personnel
        };
    },

    /**
     * Personeli gruplara böl
     * Yetkinlik dengesini sağla (her grupta mix)
     */
    _splitIntoGroups(personnel, groupCount, requireSenior) {
        if (personnel.length < groupCount) {
            return { error: `En az ${groupCount} personel gerekli (şu an: ${personnel.length})` };
        }

        // Yetkinliğe göre sırala (yüksek önce)
        const sorted = [...personnel].sort((a, b) => b.competency - a.competency);

        // Senior kontrolü
        if (requireSenior > 0) {
            const seniors = sorted.filter(p => p.competency >= 4);
            const totalNeeded = requireSenior * groupCount;
            if (seniors.length < totalNeeded) {
                return { error: `Her vardiyaya ${requireSenior} senior gerekli (toplam ${totalNeeded}) ama sadece ${seniors.length} senior var` };
            }
        }

        // Round-robin dağılım (yetkinlik dengesi için)
        const groups = Array.from({ length: groupCount }, () => []);
        sorted.forEach((person, i) => {
            // Zigzag: 0,1,2,3,3,2,1,0,0,1,2,3...
            const cycle = Math.floor(i / groupCount);
            const pos = i % groupCount;
            const groupIdx = cycle % 2 === 0 ? pos : (groupCount - 1 - pos);
            groups[groupIdx].push(person);
        });

        return groups;
    },

    /**
     * Kişi bazlı istatistik hesapla
     */
    getPersonStats(schedule) {
        if (!schedule || !schedule.assignments) return [];

        const stats = [];
        schedule.personnel.forEach(p => {
            const days = schedule.assignments[p.id] || [];
            let totalHours = 0;
            let nightCount = 0;
            let morningCount = 0;
            let afternoonCount = 0;
            let offCount = 0;
            let sundayWork = 0;

            days.forEach(d => {
                totalHours += d.hours;
                if (d.shift === 'G' || d.shift === 'G12') nightCount++;
                if (d.shift === 'S' || d.shift === 'S12') morningCount++;
                if (d.shift === 'O') afternoonCount++;
                if (d.shift === 'I') offCount++;

                // Pazar çalışma tespiti
                const dayInfo = schedule.days.find(di => di.day === d.day);
                if (dayInfo && dayInfo.dow === 0 && d.hours > 0) sundayWork++;
            });

            // Normal aylık çalışma: 45 saat/hafta * ~4.33 hafta = ~195 saat
            // Ama yasal normal: 45*4 = 180 saat (4 hafta bazında)
            const weeksInMonth = schedule.days.length / 7;
            const normalHours = Math.round(weeksInMonth * 45);
            const overtime = Math.max(0, totalHours - normalHours);

            stats.push({
                id: p.id,
                name: p.name,
                department: p.department,
                competency: p.competency,
                totalHours,
                normalHours,
                overtime,
                nightCount,
                morningCount,
                afternoonCount,
                offCount,
                sundayWork,
                workDays: days.length - offCount
            });
        });

        return stats;
    },

    /**
     * Fazla personel tespiti (belirli gün/vardiyada gerekenden fazla)
     */
    getSurplusAlerts(schedule, minPerShift) {
        if (!schedule) return [];
        const alerts = [];
        const shiftTypes = ['S', 'O', 'G', 'S12', 'G12'];

        schedule.days.forEach(dayInfo => {
            const dayCounts = {};
            shiftTypes.forEach(s => { dayCounts[s] = 0; });

            schedule.personnel.forEach(p => {
                const assignment = schedule.assignments[p.id]?.find(a => a.day === dayInfo.day);
                if (assignment && assignment.shift !== 'I') {
                    dayCounts[assignment.shift] = (dayCounts[assignment.shift] || 0) + 1;
                }
            });

            Object.entries(dayCounts).forEach(([shift, count]) => {
                if (count > 0 && count > minPerShift + 2) {
                    alerts.push({
                        day: dayInfo.day,
                        shift,
                        count,
                        surplus: count - minPerShift,
                        type: 'surplus'
                    });
                }
                if (count > 0 && count < minPerShift) {
                    alerts.push({
                        day: dayInfo.day,
                        shift,
                        count,
                        deficit: minPerShift - count,
                        type: 'deficit'
                    });
                }
            });
        });

        return alerts;
    }
};
