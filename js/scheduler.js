// scheduler.js - Vardiya planlama algoritmasi

const Scheduler = {
    STORAGE_KEY: 'sp_schedule',

    GROUP_NAMES: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],

    GROUP_COLORS: {
        'A': { bg: '#28a745', text: '#fff' },  // Yesil
        'B': { bg: '#fd7e14', text: '#fff' },  // Turuncu
        'C': { bg: '#007bff', text: '#fff' },  // Mavi
        'D': { bg: '#dc3545', text: '#fff' },  // Kirmizi
        'E': { bg: '#ffc107', text: '#000' },  // Sari
        'F': { bg: '#6f42c1', text: '#fff' },  // Mor
        'G': { bg: '#e83e8c', text: '#fff' }   // Pembe
    },

    SHIFTS: {
        '3': {
            name: "3'lu Vardiya",
            slots: [
                { code: 'S', label: 'Sabah', start: '07:30', end: '15:30', hours: 8 },
                { code: 'O', label: 'Ogle', start: '15:30', end: '23:30', hours: 8 },
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
                { code: 'S12', label: 'Gunduz', start: '07:30', end: '19:30', hours: 12 },
                { code: 'G12', label: 'Gece', start: '19:30', end: '07:30', hours: 12 }
            ]
        },
        '7': {
            name: "7'li Vardiya",
            slots: [
                { code: 'S', label: 'Sabah', start: '07:30', end: '15:30', hours: 8 },
                { code: 'A', label: 'Aksam', start: '15:30', end: '23:30', hours: 8 },
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

    generate(config) {
        const personnel = Personnel.getAll();
        if (personnel.length === 0) return { error: 'Personel listesi bos' };

        const { type, month, minPerShift, requireSenior } = config;
        const [year, mon] = month.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();

        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, mon - 1, d);
            days.push({
                day: d,
                dow: date.getDay(),
                date: date,
                isWeekend: date.getDay() === 0 || date.getDay() === 6
            });
        }

        let result;
        switch (type) {
            case '3': result = this._generate3Shift(personnel, days, minPerShift, requireSenior); break;
            case '12': result = this._generate12Shift(personnel, days, minPerShift, requireSenior); break;
            case '7': result = this._generate7Shift(personnel, days, minPerShift, requireSenior); break;
            default: return { error: 'Gecersiz vardiya tipi' };
        }

        result.config = config;
        result.days = days;
        result.generatedAt = new Date().toISOString();
        this.saveSchedule(result);
        return result;
    },

    /**
     * 3'lu Vardiya (8 saat) - 3 Grup
     */
    _generate3Shift(personnel, days, minPerShift, requireSenior) {
        const groups = this._splitIntoGroups(personnel, 3, requireSenior);
        if (groups.error) return groups;

        const assignments = {};
        personnel.forEach(p => { assignments[p.id] = []; });

        const personGroup = {};
        groups.forEach((group, gi) => {
            group.forEach(p => { personGroup[p.id] = gi; });
        });

        const rotationMap = [
            [0, 1, 2],
            [1, 2, 0],
            [2, 0, 1]
        ];
        const shiftCodes = ['S', 'O', 'G'];

        days.forEach((dayInfo) => {
            const weekIndex = Math.floor((dayInfo.day - 1) / 7) % 3;
            const rotation = rotationMap[weekIndex];

            if (dayInfo.dow === 0) {
                groups.forEach((group, gi) => {
                    const assignedShiftIdx = rotation[gi];
                    group.forEach(p => {
                        if (assignedShiftIdx === 0) {
                            assignments[p.id].push({ day: dayInfo.day, shift: 'S12', hours: 12 });
                        } else if (assignedShiftIdx === 1) {
                            assignments[p.id].push({ day: dayInfo.day, shift: 'G12', hours: 12 });
                        } else {
                            assignments[p.id].push({ day: dayInfo.day, shift: 'I', hours: 0 });
                        }
                    });
                });
            } else {
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
            groupNames: ['Grup 1', 'Grup 2', 'Grup 3'],
            assignments,
            personnel
        };
    },

    /**
     * 12 Saatlik Vardiya - 4 Grup
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

        const cyclePattern = ['S12', 'S12', 'G12', 'G12', 'I', 'I'];
        const groupOffsets = [0, 2, 4, 3];

        days.forEach((dayInfo) => {
            const dayIdx = dayInfo.day - 1;
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
            groupNames: ['Grup 1', 'Grup 2', 'Grup 3', 'Grup 4'],
            assignments,
            personnel
        };
    },

    /**
     * 7'li Vardiya - 7 Grup (A-G)
     * Her gun 3 grup calisir (Sabah/Aksam/Gece), 4 grup tatil
     * 7 gunluk dongu: Her grup 3 gun calisir (S->A->G) sonra 4 gun tatil
     *
     * Rotasyon tablosu (7 gunluk dongu):
     * Gun:  1  2  3  4  5  6  7
     * A:    S  A  G  T  T  T  T
     * B:    T  S  A  G  T  T  T
     * C:    T  T  S  A  G  T  T
     * D:    T  T  T  S  A  G  T
     * E:    T  T  T  T  S  A  G
     * F:    G  T  T  T  T  S  A
     * G:    A  G  T  T  T  T  S
     */
    _generate7Shift(personnel, days, minPerShift, requireSenior) {
        const groups = this._splitIntoGroups(personnel, 7, requireSenior);
        if (groups.error) return groups;

        const assignments = {};
        personnel.forEach(p => { assignments[p.id] = []; });

        const personGroup = {};
        groups.forEach((group, gi) => {
            group.forEach(p => { personGroup[p.id] = gi; });
        });

        // 7 gunluk dongu deseni: S=Sabah, A=Aksam, G=Gece, T=Tatil
        // Her grup icin offset: grup 0 gun 0'da S baslar, grup 1 gun 1'de S baslar, vs.
        // Desen: S, A, G, T, T, T, T (3 gun calis, 4 gun tatil)
        const cyclePattern = ['S', 'A', 'G', 'T', 'T', 'T', 'T'];

        // Grup bazli atama bilgisi (gun -> {shift: grupAdi})
        const dayGroupAssignments = [];

        days.forEach((dayInfo) => {
            const dayIdx = dayInfo.day - 1;
            const dayAssignment = { S: null, A: null, G: null, T: [] };

            groups.forEach((group, gi) => {
                // Her grubun offseti kendi indeksi
                const cycleDay = (dayIdx + (7 - gi)) % 7;
                const shiftCode = cyclePattern[cycleDay];
                const hours = shiftCode === 'T' ? 0 : 8;

                if (shiftCode === 'T') {
                    dayAssignment.T.push(this.GROUP_NAMES[gi]);
                } else {
                    dayAssignment[shiftCode] = this.GROUP_NAMES[gi];
                }

                group.forEach(p => {
                    assignments[p.id].push({ day: dayInfo.day, shift: shiftCode, hours });
                });
            });

            dayGroupAssignments.push(dayAssignment);
        });

        // Her grup icin tatil gunlerini hesapla
        const groupHolidays = {};
        this.GROUP_NAMES.forEach((name, gi) => {
            groupHolidays[name] = [];
            days.forEach((dayInfo) => {
                const dayIdx = dayInfo.day - 1;
                const cycleDay = (dayIdx + (7 - gi)) % 7;
                if (cyclePattern[cycleDay] === 'T') {
                    groupHolidays[name].push(dayInfo.day);
                }
            });
        });

        return {
            type: '7',
            groups: groups.map(g => g.map(p => p.id)),
            groupNames: [...this.GROUP_NAMES],
            dayGroupAssignments,
            groupHolidays,
            assignments,
            personnel
        };
    },

    /**
     * Personeli gruplara bol
     * Yetkinlik dengesini sagla
     */
    _splitIntoGroups(personnel, groupCount, requireSenior) {
        if (personnel.length < groupCount) {
            return { error: `En az ${groupCount} personel gerekli (su an: ${personnel.length})` };
        }

        const sorted = [...personnel].sort((a, b) => b.competency - a.competency);

        if (requireSenior > 0) {
            const seniors = sorted.filter(p => p.competency >= 4);
            const totalNeeded = requireSenior * groupCount;
            if (seniors.length < totalNeeded) {
                return { error: `Her vardiyaya ${requireSenior} senior gerekli (toplam ${totalNeeded}) ama sadece ${seniors.length} senior var` };
            }
        }

        // Round-robin dagilim (yetkinlik dengesi icin)
        const groups = Array.from({ length: groupCount }, () => []);
        sorted.forEach((person, i) => {
            const cycle = Math.floor(i / groupCount);
            const pos = i % groupCount;
            const groupIdx = cycle % 2 === 0 ? pos : (groupCount - 1 - pos);
            groups[groupIdx].push(person);
        });

        return groups;
    },

    /**
     * Kisi bazli istatistik hesapla
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
                if (d.shift === 'O' || d.shift === 'A') afternoonCount++;
                if (d.shift === 'I' || d.shift === 'T') offCount++;

                const dayInfo = schedule.days.find(di => di.day === d.day);
                if (dayInfo && dayInfo.dow === 0 && d.hours > 0) sundayWork++;
            });

            const weeksInMonth = schedule.days.length / 7;
            const normalHours = Math.round(weeksInMonth * 45);
            const overtime = Math.max(0, totalHours - normalHours);

            stats.push({
                id: p.id,
                name: p.name,
                department: p.department,
                section: p.section,
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

    getSurplusAlerts(schedule, minPerShift) {
        if (!schedule) return [];
        const alerts = [];
        const shiftTypes = schedule.type === '7' ? ['S', 'A', 'G'] : ['S', 'O', 'G', 'S12', 'G12'];

        schedule.days.forEach(dayInfo => {
            const dayCounts = {};
            shiftTypes.forEach(s => { dayCounts[s] = 0; });

            schedule.personnel.forEach(p => {
                const assignment = schedule.assignments[p.id]?.find(a => a.day === dayInfo.day);
                if (assignment && assignment.shift !== 'I' && assignment.shift !== 'T') {
                    dayCounts[assignment.shift] = (dayCounts[assignment.shift] || 0) + 1;
                }
            });

            Object.entries(dayCounts).forEach(([shift, count]) => {
                if (count > 0 && count > minPerShift + 2) {
                    alerts.push({ day: dayInfo.day, shift, count, surplus: count - minPerShift, type: 'surplus' });
                }
                if (count > 0 && count < minPerShift) {
                    alerts.push({ day: dayInfo.day, shift, count, deficit: minPerShift - count, type: 'deficit' });
                }
            });
        });

        return alerts;
    }
};
