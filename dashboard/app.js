document.addEventListener('DOMContentLoaded', () => {
    const uploadStatus = document.getElementById('upload-status');
    
    // Store loaded global data
    let globalClubData = [];

    // Chart instances
    let statusChartInstance = null;
    let scatterChartInstance = null;

    // View Navigation Switcher
    const navButtons = document.querySelectorAll('.top-nav-btn');
    const views = document.querySelectorAll('.dashboard-view');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');

            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            views.forEach(v => {
                if (v.id === `view-${targetView}`) {
                    v.classList.remove('hidden-view');
                    v.classList.add('active-view');
                } else {
                    v.classList.add('hidden-view');
                    v.classList.remove('active-view');
                }
            });
        });
    });

    // Auto-load data on page start
    autoLoadMastersheet();

    function autoLoadMastersheet() {
        const jsonPaths = ['./District 121 - Mastersheet.json', 'District 121 - Mastersheet.json', '../District 121 - Mastersheet.json'];
        const excelPaths = ['./District 121 - Mastersheet.xlsx', 'District 121 - Mastersheet.xlsx', '../District 121 - Mastersheet.xlsx'];

        function tryNextJson(index) {
            if (index >= jsonPaths.length) {
                tryNextExcel(0);
                return;
            }
            fetch(jsonPaths[index])
                .then(res => {
                    if (!res.ok) throw new Error('JSON not found');
                    return res.json();
                })
                .then(data => {
                    if (uploadStatus) uploadStatus.textContent = 'Synced live dataset';
                    globalClubData = data;
                    renderAllViews(data);
                })
                .catch(() => {
                    tryNextJson(index + 1);
                });
        }

        function tryNextExcel(index) {
            if (index >= excelPaths.length) {
                if (uploadStatus) uploadStatus.textContent = 'Waiting for dataset pipeline...';
                return;
            }
            fetch(excelPaths[index])
                .then(res => {
                    if (!res.ok) throw new Error('Excel not found');
                    return res.arrayBuffer();
                })
                .then(buffer => {
                    if (uploadStatus) uploadStatus.textContent = 'Synced live dataset';
                    parseWorkbookBuffer(buffer);
                })
                .catch(() => {
                    tryNextExcel(index + 1);
                });
        }

        tryNextJson(0);
    }

    function parseWorkbookBuffer(buffer) {
        try {
            const data = new Uint8Array(buffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const targetSheet = workbook.SheetNames.includes('ClubDetails') ? 'ClubDetails' : workbook.SheetNames[0];
            const worksheet = workbook.Sheets[targetSheet];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            globalClubData = jsonData;
            renderAllViews(jsonData);
        } catch (err) {
            if (uploadStatus) uploadStatus.textContent = 'Error parsing dataset.';
            console.error(err);
        }
    }

    function renderAllViews(data) {
        const validData = data.filter(row => row['Club Name']);

        // 1. Overview View
        renderOverview(validData);

        // 2. Sept Renewal Report View
        renderSeptRenewalReport(validData);

        // 3. Awards & Campaigns View
        renderCampaignsView(validData);

        // 4. Renewals Tracker View
        renderRenewalsView(validData);
    }

    /* ----------------------------------------------------
       1. OVERVIEW DASHBOARD
    ---------------------------------------------------- */
    function renderOverview(data) {
        const totalClubs = data.length;
        const totalActiveMembers = data.reduce((acc, row) => {
            const act = row['Active Members'] ?? row['Active Membership'] ?? 0;
            return acc + Number(act);
        }, 0);

        let totalGoals = 0;
        let distCount = 0;
        const clubStatuses = {};
        const scatterData = [];

        data.forEach(row => {
            const goals = Number(row['Goals Met'] ?? row['Goals'] ?? 0);
            totalGoals += goals;

            const distStatus = String(row['Distinguished Status'] ?? row['Distinguished'] ?? 'None');
            if (distStatus.includes('Distinguished') || distStatus === 'Yes' || distStatus === 'P' || distStatus === 'S' || distStatus === 'M') {
                distCount++;
            }

            const clubStatus = String(row['Club Status'] ?? 'Active');
            clubStatuses[clubStatus] = (clubStatuses[clubStatus] || 0) + 1;

            const base = Number(row['Mem. Base'] ?? row['Base Membership'] ?? 0);
            const active = Number(row['Active Members'] ?? row['Active Membership'] ?? 0);
            const netGrowth = row['Net Growth'] ?? (active - base);

            scatterData.push({
                x: netGrowth,
                y: goals,
                clubName: row['Club Name']
            });
        });

        const avgGoals = totalClubs > 0 ? (totalGoals / totalClubs).toFixed(1) : 0;

        document.getElementById('kpi-total-clubs').textContent = totalClubs;
        document.getElementById('kpi-active-members').textContent = totalActiveMembers.toLocaleString();
        document.getElementById('kpi-avg-goals').textContent = avgGoals;
        document.getElementById('kpi-distinguished').textContent = distCount;

        updateStatusChart(clubStatuses);
        updateScatterChart(scatterData);
        updateTopClubsTable(data);
    }

    function updateStatusChart(dataObj) {
        const ctx = document.getElementById('statusChart').getContext('2d');
        if (statusChartInstance) statusChartInstance.destroy();

        statusChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(dataObj),
                datasets: [{
                    data: Object.values(dataObj),
                    backgroundColor: ['#004165', '#772432', '#EF4444', '#F59E0B'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#1F2937' } } },
                cutout: '70%'
            }
        });
    }

    function updateScatterChart(dataArray) {
        const ctx = document.getElementById('scatterChart').getContext('2d');
        if (scatterChartInstance) scatterChartInstance.destroy();

        scatterChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    data: dataArray,
                    backgroundColor: 'rgba(0, 65, 101, 0.7)',
                    borderColor: '#004165',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.raw.clubName}: Growth(${ctx.raw.x}), Goals(${ctx.raw.y})`
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Net Growth', color: '#4B5563' }, grid: { color: '#E5E7EB' }, ticks: { color: '#4B5563' } },
                    y: { title: { display: true, text: 'Goals Met', color: '#4B5563' }, grid: { color: '#E5E7EB' }, ticks: { color: '#4B5563' } }
                }
            }
        });
    }

    function updateTopClubsTable(data) {
        const tbody = document.querySelector('#top-clubs-table tbody');
        tbody.innerHTML = '';

        const formatted = data.map(club => {
            const base = Number(club['Mem. Base'] ?? club['Base Membership'] ?? 0);
            const active = Number(club['Active Members'] ?? club['Active Membership'] ?? 0);
            const netGrowth = club['Net Growth'] ?? (active - base);
            return { ...club, base, active, netGrowth };
        });

        const sorted = [...formatted].sort((a, b) => b.netGrowth - a.netGrowth);
        const top10 = sorted.slice(0, 10);

        top10.forEach(club => {
            const tr = document.createElement('tr');
            const net = club.netGrowth;
            const cls = net > 0 ? 'positive' : (net < 0 ? 'negative' : '');
            const sign = net > 0 ? '+' : '';

            tr.innerHTML = `
                <td><strong>${club['Club Name']}</strong></td>
                <td>Div ${club['Division']} / Area ${club['Area']}</td>
                <td>${club.base}</td>
                <td>${club.active}</td>
                <td class="${cls}">${sign}${net}</td>
                <td>${club['Goals Met'] ?? club['Goals'] ?? 0}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    /* ----------------------------------------------------
       2. SEPT RENEWAL REPORT
    ---------------------------------------------------- */
    function renderSeptRenewalReport(data) {
        const levelBtns = document.querySelectorAll('.level-btn');
        const searchInput = document.getElementById('sept-renewal-search');
        let currentLevel = 'district';

        levelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                levelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentLevel = btn.getAttribute('data-level');
                updateDashboardTable();
            });
        });

        searchInput.addEventListener('input', updateDashboardTable);

        function updateDashboardTable() {
            const searchVal = searchInput.value.toLowerCase().trim();
            const tbody = document.querySelector('#sept-renewal-dashboard-table tbody');
            const thEntity = document.getElementById('th-dashboard-entity');
            tbody.innerHTML = '';

            let rowsToDisplay = [];

            if (currentLevel === 'district') {
                thEntity.textContent = 'Dashboard (District Level)';
                let totBase = 0, totSingle = 0, totDouble = 0, totSept = 0;
                data.forEach(c => {
                    totBase += Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    totSingle += Number(c['Single Renewal'] ?? c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    totDouble += Number(c['Double Renewal'] ?? 0);
                    totSept += Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                });
                const pct = totBase > 0 ? ((totSept / totBase) * 100).toFixed(1) + '%' : '0.0%';
                rowsToDisplay.push({ entity: 'District 227 Total', base: totBase, single: totSingle, double: totDouble, pct: pct });
            } 
            else if (currentLevel === 'div') {
                thEntity.textContent = 'Dashboard (Division Level)';
                const divMap = {};
                data.forEach(c => {
                    const d = String(c['Division'] || 'Unknown');
                    if (!divMap[d]) divMap[d] = { base: 0, single: 0, double: 0, sept: 0 };
                    divMap[d].base += Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    divMap[d].single += Number(c['Single Renewal'] ?? c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    divMap[d].double += Number(c['Double Renewal'] ?? 0);
                    divMap[d].sept += Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                });
                Object.keys(divMap).sort().forEach(d => {
                    const item = divMap[d];
                    const pct = item.base > 0 ? ((item.sept / item.base) * 100).toFixed(1) + '%' : '0.0%';
                    rowsToDisplay.push({ entity: `Division ${d}`, base: item.base, single: item.single, double: item.double, pct: pct });
                });
            }
            else if (currentLevel === 'area') {
                thEntity.textContent = 'Dashboard (Area Level)';
                const areaMap = {};
                data.forEach(c => {
                    const key = `Div ${c['Division']} / Area ${c['Area']}`;
                    if (!areaMap[key]) areaMap[key] = { base: 0, single: 0, double: 0, sept: 0 };
                    areaMap[key].base += Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    areaMap[key].single += Number(c['Single Renewal'] ?? c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    areaMap[key].double += Number(c['Double Renewal'] ?? 0);
                    areaMap[key].sept += Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                });
                Object.keys(areaMap).sort().forEach(a => {
                    const item = areaMap[a];
                    const pct = item.base > 0 ? ((item.sept / item.base) * 100).toFixed(1) + '%' : '0.0%';
                    rowsToDisplay.push({ entity: a, base: item.base, single: item.single, double: item.double, pct: pct });
                });
            }
            else {
                thEntity.textContent = 'Dashboard (Club Level)';
                data.forEach(c => {
                    const base = Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    const single = Number(c['Single Renewal'] ?? c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    const double = Number(c['Double Renewal'] ?? 0);
                    const sept = Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    const pct = base > 0 ? ((sept / base) * 100).toFixed(1) + '%' : '0.0%';
                    rowsToDisplay.push({ entity: `${c['Club Name']} (Div ${c['Division']}/Area ${c['Area']})`, base: base, single: single, double: double, pct: pct });
                });
            }

            const filteredRows = rowsToDisplay.filter(r => r.entity.toLowerCase().includes(searchVal));

            filteredRows.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.entity}</strong></td>
                    <td>${r.base.toLocaleString()}</td>
                    <td>${r.single.toLocaleString()}</td>
                    <td>${r.double.toLocaleString()}</td>
                    <td><strong>${r.pct}</strong></td>
                `;
                tbody.appendChild(tr);
            });
        }

        function updateReportTable() {
            const tbody = document.querySelector('#sept-renewal-report-table tbody');
            tbody.innerHTML = '';

            let totSingle = 0, totDouble = 0, totSept = 0;
            data.forEach(c => {
                totSingle += Number(c['Single Renewal'] ?? c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                totDouble += Number(c['Double Renewal'] ?? 0);
                totSept += Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
            });

            const reportRows = [
                { name: 'Member Level', single: totSingle, double: totDouble, total: totSept },
                { name: '2800+ Target Level', single: totSingle >= 2800 ? 2800 : totSingle, double: totDouble, total: totSept }
            ];

            reportRows.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.name}</strong></td>
                    <td>${r.single.toLocaleString()}</td>
                    <td>${r.double.toLocaleString()}</td>
                    <td><strong>${r.total.toLocaleString()}</strong></td>
                `;
                tbody.appendChild(tr);
            });
        }

        updateDashboardTable();
        updateReportTable();
    }

    /* ----------------------------------------------------
       3. AWARDS & CAMPAIGNS TRACKER
    ---------------------------------------------------- */
    function renderCampaignsView(data) {
        let smedleyCount = 0;
        let talkupCount = 0;
        let clockCount = 0;

        data.forEach(row => {
            if (row['Smedley Award Eligibility'] === 'Yes') smedleyCount++;
            if (row['Talk Up Eligibility'] === 'Yes') talkupCount++;
            if (row['Beat the Clock Eligibility'] === 'Yes') clockCount++;
        });

        document.getElementById('award-smedley-count').textContent = `${smedleyCount} / ${data.length}`;
        document.getElementById('award-talkup-count').textContent = `${talkupCount} / ${data.length}`;
        document.getElementById('award-clock-count').textContent = `${clockCount} / ${data.length}`;

        const campaignSelect = document.getElementById('campaign-select');
        const statusSelect = document.getElementById('campaign-filter-status');
        const searchInput = document.getElementById('campaign-search');

        function updateCampaignTable() {
            const selectedCampaign = campaignSelect.value;
            const selectedStatus = statusSelect.value;
            const searchVal = searchInput.value.toLowerCase().trim();

            const tbody = document.querySelector('#campaign-table tbody');
            tbody.innerHTML = '';

            const filtered = data.filter(club => {
                const name = String(club['Club Name'] || '').toLowerCase();
                const div = String(club['Division'] || '').toLowerCase();
                const area = String(club['Area'] || '').toLowerCase();
                const matchesSearch = name.includes(searchVal) || div.includes(searchVal) || area.includes(searchVal);

                if (!matchesSearch) return false;

                const smedleyYes = club['Smedley Award Eligibility'] === 'Yes';
                const talkupYes = club['Talk Up Eligibility'] === 'Yes';
                const clockYes = club['Beat the Clock Eligibility'] === 'Yes';

                if (selectedCampaign === 'smedley') {
                    if (selectedStatus === 'achieved') return smedleyYes;
                    if (selectedStatus === 'pending') return !smedleyYes;
                } else if (selectedCampaign === 'talkup') {
                    if (selectedStatus === 'achieved') return talkupYes;
                    if (selectedStatus === 'pending') return !talkupYes;
                } else if (selectedCampaign === 'clock') {
                    if (selectedStatus === 'achieved') return clockYes;
                    if (selectedStatus === 'pending') return !clockYes;
                } else {
                    if (selectedStatus === 'achieved') return smedleyYes || talkupYes || clockYes;
                    if (selectedStatus === 'pending') return !smedleyYes || !talkupYes || !clockYes;
                }
                return true;
            });

            filtered.forEach(club => {
                const tr = document.createElement('tr');
                const smedleyYes = club['Smedley Award Eligibility'] === 'Yes';
                const talkupYes = club['Talk Up Eligibility'] === 'Yes';
                const clockYes = club['Beat the Clock Eligibility'] === 'Yes';

                const smedleyGoal = club['Smedley Award Goal'] ?? (smedleyYes ? 0 : 5);
                const talkupGoal = club['Talk Up Goal'] ?? (talkupYes ? 0 : 5);
                const clockGoal = club['Beat the Clock Goal'] ?? (clockYes ? 0 : 5);

                tr.innerHTML = `
                    <td><strong>${club['Club Name']}</strong></td>
                    <td>Div ${club['Division']} / Area ${club['Area']}</td>
                    <td><span class="badge ${smedleyYes ? 'badge-yes' : 'badge-no'}">${smedleyYes ? 'Achieved' : 'In Progress'}</span></td>
                    <td><strong>${smedleyGoal}</strong> new members</td>
                    <td><span class="badge ${talkupYes ? 'badge-yes' : 'badge-no'}">${talkupYes ? 'Achieved' : 'In Progress'}</span></td>
                    <td><strong>${talkupGoal}</strong> new members</td>
                    <td><span class="badge ${clockYes ? 'badge-yes' : 'badge-no'}">${clockYes ? 'Achieved' : 'In Progress'}</span></td>
                    <td><strong>${clockGoal}</strong> new members</td>
                `;
                tbody.appendChild(tr);
            });
        }

        campaignSelect.addEventListener('change', updateCampaignTable);
        statusSelect.addEventListener('change', updateCampaignTable);
        searchInput.addEventListener('input', updateCampaignTable);

        document.getElementById('card-smedley').addEventListener('click', () => {
            campaignSelect.value = 'smedley';
            updateCampaignTable();
        });
        document.getElementById('card-talkup').addEventListener('click', () => {
            campaignSelect.value = 'talkup';
            updateCampaignTable();
        });
        document.getElementById('card-clock').addEventListener('click', () => {
            campaignSelect.value = 'clock';
            updateCampaignTable();
        });

        updateCampaignTable();
    }

    /* ----------------------------------------------------
       4. RENEWALS TRACKER
    ---------------------------------------------------- */
    function renderRenewalsView(data) {
        let totalSeptRenewals = 0;
        let totalSeptBase = 0;
        let totalMarchRenewals = 0;

        data.forEach(row => {
            totalSeptRenewals += Number(row['September Renewals'] ?? row['Oct. Ren.'] ?? 0);
            totalSeptBase += Number(row['Base Membership'] ?? row['Mem. Base'] ?? 0);
            totalMarchRenewals += Number(row['March Renewals'] ?? row['Apr. Ren.'] ?? 0);
        });

        const septRate = totalSeptBase > 0 ? ((totalSeptRenewals / totalSeptBase) * 100).toFixed(1) : 0;
        const marchRate = totalSeptBase > 0 ? ((totalMarchRenewals / totalSeptBase) * 100).toFixed(1) : 0;

        document.getElementById('renew-sept-total').textContent = totalSeptRenewals.toLocaleString();
        document.getElementById('renew-sept-pct').textContent = `Renewal Rate: ${septRate}%`;

        document.getElementById('renew-march-total').textContent = totalMarchRenewals.toLocaleString();
        document.getElementById('renew-march-pct').textContent = `Renewal Rate: ${marchRate}%`;

        const periodSelect = document.getElementById('renewal-period-select');
        const statusSelect = document.getElementById('renewal-status-select');
        const searchInput = document.getElementById('renewal-search');

        function updateRenewalTable() {
            const period = periodSelect.value;
            const statusFilter = statusSelect.value;
            const searchVal = searchInput.value.toLowerCase().trim();

            const tbody = document.querySelector('#renewal-table tbody');
            tbody.innerHTML = '';

            const filtered = data.filter(club => {
                const name = String(club['Club Name'] || '').toLowerCase();
                const div = String(club['Division'] || '').toLowerCase();
                const area = String(club['Area'] || '').toLowerCase();
                const matchesSearch = name.includes(searchVal) || div.includes(searchVal) || area.includes(searchVal);

                if (!matchesSearch) return false;

                const septStatus = String(club['September Renewal Status'] || 'Renewals not here');
                const marchStatus = String(club['March Renewal Status'] || 'Renewals not here');

                if (statusFilter !== 'all') {
                    if (period === 'september' && septStatus !== statusFilter) return false;
                    if (period === 'march' && marchStatus !== statusFilter) return false;
                    if (period === 'all' && septStatus !== statusFilter && marchStatus !== statusFilter) return false;
                }
                return true;
            });

            filtered.forEach(club => {
                const tr = document.createElement('tr');

                const base = Number(club['Base Membership'] ?? club['Mem. Base'] ?? 0);
                const active = Number(club['Active Membership'] ?? club['Active Members'] ?? 0);

                const sept = Number(club['September Renewals'] ?? club['Oct. Ren.'] ?? 0);
                const septPctRaw = club['September Renewals %'] ?? (base > 0 ? sept / base : 0);
                const septPctFormatted = (Number(septPctRaw) * 100).toFixed(1) + '%';
                const septStatus = String(club['September Renewal Status'] || 'Renewals not here');

                const march = Number(club['March Renewals'] ?? club['Apr. Ren.'] ?? 0);
                const marchPctRaw = club['March Renewals %'] ?? (base > 0 ? march / base : 0);
                const marchPctFormatted = (Number(marchPctRaw) * 100).toFixed(1) + '%';
                const marchStatus = String(club['March Renewal Status'] || 'Renewals not here');

                function getBadgeClass(status) {
                    if (status === 'Active') return 'badge-active';
                    if (status === 'Low') return 'badge-low';
                    if (status === 'Ineligible') return 'badge-ineligible';
                    return 'badge-pending';
                }

                tr.innerHTML = `
                    <td><strong>${club['Club Name']}</strong></td>
                    <td>Div ${club['Division']} / Area ${club['Area']}</td>
                    <td>${base}</td>
                    <td>${active}</td>
                    <td>${sept}</td>
                    <td><strong>${septPctFormatted}</strong></td>
                    <td><span class="badge ${getBadgeClass(septStatus)}">${septStatus}</span></td>
                    <td>${march}</td>
                    <td><strong>${marchPctFormatted}</strong></td>
                    <td><span class="badge ${getBadgeClass(marchStatus)}">${marchStatus}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        periodSelect.addEventListener('change', updateRenewalTable);
        statusSelect.addEventListener('change', updateRenewalTable);
        searchInput.addEventListener('input', updateRenewalTable);

        updateRenewalTable();
    }
});
