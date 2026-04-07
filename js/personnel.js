// personnel.js - Personel CRUD islemleri

const Personnel = {
    STORAGE_KEY: 'sp_personnel',

    getAll() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    },

    save(list) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    },

    add(person) {
        const list = this.getAll();
        person.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        list.push(person);
        this.save(list);
        return person;
    },

    remove(id) {
        const list = this.getAll().filter(p => p.id !== id);
        this.save(list);
    },

    update(id, data) {
        const list = this.getAll();
        const idx = list.findIndex(p => p.id === id);
        if (idx >= 0) Object.assign(list[idx], data);
        this.save(list);
    },

    clearAll() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    getDepartments() {
        const all = this.getAll();
        return [...new Set(all.map(p => p.department).filter(Boolean))];
    },

    getSections() {
        const all = this.getAll();
        return [...new Set(all.map(p => p.section).filter(Boolean))];
    },

    getByCompetency(minLevel) {
        return this.getAll().filter(p => p.competency >= minLevel);
    },

    importFromExcel(data) {
        const list = this.getAll();
        data.forEach(row => {
            if (row.name && row.name.trim()) {
                list.push({
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    name: row.name.trim(),
                    department: (row.department || '').trim(),
                    section: (row.section || '').trim(),
                    competency: parseInt(row.competency) || 3
                });
            }
        });
        this.save(list);
        return list.length;
    }
};

// UI Functions for Personnel Tab
function initPersonnelUI() {
    renderPersonnelTable();
    updateDeptList();

    document.getElementById('btnAddPerson').addEventListener('click', () => {
        const name = document.getElementById('pName').value.trim();
        const dept = document.getElementById('pDept').value.trim();
        const section = document.getElementById('pSection').value.trim();
        const comp = document.getElementById('pCompetency').value;

        if (!name) { alert('Ad Soyad gerekli'); return; }
        if (!comp) { alert('Yetkinlik seviyesi secin'); return; }

        Personnel.add({ name, department: dept, section: section, competency: parseInt(comp) });
        document.getElementById('pName').value = '';
        document.getElementById('pDept').value = '';
        document.getElementById('pSection').value = '';
        document.getElementById('pCompetency').value = '';
        renderPersonnelTable();
        updateDeptList();
    });

    document.getElementById('btnClearAll').addEventListener('click', () => {
        if (confirm('Tum personeli silmek istediginize emin misiniz?')) {
            Personnel.clearAll();
            renderPersonnelTable();
        }
    });

    document.getElementById('excelImport').addEventListener('change', handleExcelImport);
    document.getElementById('btnDownloadTemplate').addEventListener('click', downloadTemplate);
}

function renderPersonnelTable() {
    const list = Personnel.getAll();
    const tbody = document.getElementById('personnelBody');
    document.getElementById('personnelCount').textContent = list.length;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Personel eklenmemis</td></tr>';
        return;
    }

    const compLabels = { 1: 'Stajyer', 2: 'Junior', 3: 'Orta', 4: 'Senior', 5: 'Uzman' };

    tbody.innerHTML = list.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.department || '-')}</td>
            <td>${escapeHtml(p.section || '-')}</td>
            <td><span class="competency-badge competency-${p.competency}">${p.competency}</span> ${compLabels[p.competency] || ''}</td>
            <td><button class="btn btn-outline-danger btn-sm py-0" onclick="deletePerson('${p.id}')"><i class="bi bi-trash"></i></button></td>
        </tr>
    `).join('');
}

function deletePerson(id) {
    Personnel.remove(id);
    renderPersonnelTable();
}

function updateDeptList() {
    const depts = Personnel.getDepartments();
    const sections = Personnel.getSections();
    document.getElementById('deptList').innerHTML = depts.map(d => `<option value="${d}">`).join('');
    document.getElementById('sectionList').innerHTML = sections.map(s => `<option value="${s}">`).join('');
}

function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        const mapped = rows.map(r => ({
            name: r['Ad Soyad'] || r['name'] || r['Ad'] || Object.values(r)[0] || '',
            department: r['Departman'] || r['department'] || r['Bolum'] || Object.values(r)[1] || '',
            section: r['Kisim'] || r['section'] || Object.values(r)[2] || '',
            competency: parseInt(r['Yetkinlik'] || r['competency'] || r['Seviye'] || Object.values(r)[3]) || 3
        }));

        const count = Personnel.importFromExcel(mapped);
        renderPersonnelTable();
        updateDeptList();
        alert(`${mapped.length} personel ice aktarildi. Toplam: ${count}`);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
}

function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['Ad Soyad', 'Departman', 'Kisim', 'Yetkinlik'],
        ['Ahmet Yilmaz', 'Uretim', 'Galvaniz', 4],
        ['Fatma Demir', 'Depo', 'Hammadde', 3],
        ['Mehmet Kaya', 'Kalite', 'Son Kontrol', 5]
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personel');
    XLSX.writeFile(wb, 'personel_sablonu.xlsx');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
