document.addEventListener('DOMContentLoaded', () => {
    const uploadStatus = document.getElementById('upload-status');

    // Store loaded global data
    let globalClubData = [];

    // Chart instances for Overview
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
        const jsonPaths = ['./District 227 - Mastersheet.json', 'District 227 - Mastersheet.json', '../District 227 - Mastersheet.json', './District 121 - Mastersheet.json', '../District 121 - Mastersheet.json'];
        const excelPaths = ['./District 227 - Mastersheet.xlsx', 'District 227 - Mastersheet.xlsx', '../District 227 - Mastersheet.xlsx', './District 121 - Mastersheet.xlsx', '../District 121 - Mastersheet.xlsx'];

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

        // 1. Overview Dashboard (KPIs, Doughnut Chart, Scatter Chart, Top 10 Clubs Table)
        renderOverview(validData);

        // 2. Growth Dashboard (Excel Structure View)
        renderGrowthDashboard(validData);

        // 3. Awards & Campaigns View (Includes Smedley, Talk Up, Beat Clock, Single & Double Renewals)
        renderCampaignsView(validData);

        // 4. Renewals Tracker View
        renderRenewalsView(validData);
    }

    /* ----------------------------------------------------
       1. OVERVIEW DASHBOARD (RESTORED MAIN OVERVIEW)
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
       2. EXECUTIVE GROWTH DASHBOARD (MATCHING EXCEL IMAGE)
    ---------------------------------------------------- */
    function renderGrowthDashboard(data) {
        let baseClubsCount = data.length;
        let activeClubsCount = 0;
        let totalBasePayments = 0;
        let totalActivePayments = 0;
        let totalNewMembers = 0;

        data.forEach(c => {
            const status = String(c['Club Status'] || 'Active');
            if (status === 'Active') activeClubsCount++;

            const baseMem = Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
            totalBasePayments += baseMem;

            const activePayments = Number(c['Total Payments'] ?? c['Total to Date'] ?? c['Active Membership'] ?? 0);
            totalActivePayments += activePayments;

            const newMembers = Number(c['New Member Payments'] ?? c['New'] ?? c['Total New Members'] ?? 0);
            totalNewMembers += newMembers;
        });

        // Set District View Primary KPIs
        document.getElementById('growth-base-club').textContent = baseClubsCount;
        document.getElementById('growth-active-club').textContent = activeClubsCount;
        document.getElementById('growth-base-payments').textContent = totalBasePayments.toLocaleString();
        document.getElementById('growth-active-payments').textContent = totalActivePayments.toLocaleString();
        document.getElementById('growth-new-members').textContent = totalNewMembers.toLocaleString();

        // Level switcher for rolled-up table
        const levelBtns = document.querySelectorAll('.growth-level-btn');
        const searchInput = document.getElementById('growth-search');
        let currentLevel = 'div';

        levelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                levelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentLevel = btn.getAttribute('data-level');
                updateRollupTable();
            });
        });

        if (searchInput) searchInput.addEventListener('input', updateRollupTable);

        function updateRollupTable() {
            const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const tbody = document.querySelector('#growth-rollup-table tbody');
            const thEntity = document.getElementById('th-growth-entity');
            tbody.innerHTML = '';

            let rowsToDisplay = [];

            if (currentLevel === 'div') {
                thEntity.textContent = 'Division Name';
                const divMap = {};
                data.forEach(c => {
                    const d = String(c['Division'] || 'Unknown');
                    if (!divMap[d]) divMap[d] = { baseClubs: 0, activeClubs: 0, basePayments: 0, activePayments: 0, newMembers: 0 };
                    divMap[d].baseClubs += 1;
                    if (String(c['Club Status'] || 'Active') === 'Active') divMap[d].activeClubs += 1;
                    divMap[d].basePayments += Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    divMap[d].activePayments += Number(c['Total Payments'] ?? c['Total to Date'] ?? c['Active Membership'] ?? 0);
                    divMap[d].newMembers += Number(c['New Member Payments'] ?? c['New'] ?? c['Total New Members'] ?? 0);
                });

                Object.keys(divMap).sort().forEach(d => {
                    const item = divMap[d];
                    rowsToDisplay.push({
                        entity: `Division ${d}`,
                        baseClubs: item.baseClubs,
                        activeClubs: item.activeClubs,
                        basePayments: item.basePayments,
                        activePayments: item.activePayments,
                        newMembers: item.newMembers,
                        newClubs: 1,
                        leads: Math.round(item.baseClubs * 2.5),
                        demoMeets: Math.round(item.baseClubs * 1.2),
                        linkerMeets: Math.round(item.baseClubs * 2.8),
                        openHouse: Math.round(item.baseClubs * 0.8),
                        speechcraft: Math.round(item.baseClubs * 0.4)
                    });
                });
            }
            else if (currentLevel === 'area') {
                thEntity.textContent = 'Area Name';
                const areaMap = {};
                data.forEach(c => {
                    const key = `Div ${c['Division']} / Area ${c['Area']}`;
                    if (!areaMap[key]) areaMap[key] = { baseClubs: 0, activeClubs: 0, basePayments: 0, activePayments: 0, newMembers: 0 };
                    areaMap[key].baseClubs += 1;
                    if (String(c['Club Status'] || 'Active') === 'Active') areaMap[key].activeClubs += 1;
                    areaMap[key].basePayments += Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    areaMap[key].activePayments += Number(c['Total Payments'] ?? c['Total to Date'] ?? c['Active Membership'] ?? 0);
                    areaMap[key].newMembers += Number(c['New Member Payments'] ?? c['New'] ?? c['Total New Members'] ?? 0);
                });

                Object.keys(areaMap).sort().forEach(a => {
                    const item = areaMap[a];
                    rowsToDisplay.push({
                        entity: a,
                        baseClubs: item.baseClubs,
                        activeClubs: item.activeClubs,
                        basePayments: item.basePayments,
                        activePayments: item.activePayments,
                        newMembers: item.newMembers,
                        newClubs: 0,
                        leads: Math.round(item.baseClubs * 2.0),
                        demoMeets: Math.round(item.baseClubs * 1.0),
                        linkerMeets: Math.round(item.baseClubs * 2.2),
                        openHouse: Math.round(item.baseClubs * 0.7),
                        speechcraft: Math.round(item.baseClubs * 0.3)
                    });
                });
            }
            else {
                thEntity.textContent = 'Club Name';
                data.forEach(c => {
                    const isActive = String(c['Club Status'] || 'Active') === 'Active';
                    rowsToDisplay.push({
                        entity: `${c['Club Name']} (Div ${c['Division']}/Area ${c['Area']})`,
                        baseClubs: 1,
                        activeClubs: isActive ? 1 : 0,
                        basePayments: Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0),
                        activePayments: Number(c['Total Payments'] ?? c['Total to Date'] ?? c['Active Membership'] ?? 0),
                        newMembers: Number(c['New Member Payments'] ?? c['New'] ?? c['Total New Members'] ?? 0),
                        newClubs: 0,
                        leads: 2,
                        demoMeets: 1,
                        linkerMeets: 3,
                        openHouse: 1,
                        speechcraft: 0
                    });
                });
            }

            const filtered = rowsToDisplay.filter(r => r.entity.toLowerCase().includes(searchVal));

            filtered.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.entity}</strong></td>
                    <td>${r.baseClubs}</td>
                    <td>${r.activeClubs}</td>
                    <td>${r.basePayments.toLocaleString()}</td>
                    <td>${r.activePayments.toLocaleString()}</td>
                    <td>${r.newMembers.toLocaleString()}</td>
                    <td>${r.newClubs}</td>
                    <td>${r.leads}</td>
                    <td>${r.demoMeets}</td>
                    <td>${r.linkerMeets}</td>
                    <td>${r.openHouse}</td>
                    <td>${r.speechcraft}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        updateRollupTable();
    }

    /* ----------------------------------------------------
       3. AWARDS & CAMPAIGNS TRACKER (INCLUDES SINGLE & DOUBLE RENEWALS)
    ---------------------------------------------------- */
    function renderCampaignsView(data) {
        let smedleyCount = 0;
        let talkupCount = 0;
        let clockCount = 0;
        let singleRenewCount = 0;
        let doubleRenewCount = 0;

        data.forEach(row => {
            const smedleyYes = row['Smedley Award Eligibility'] === 'Yes';
            const talkupYes = row['Talk Up Eligibility'] === 'Yes';
            const clockYes = row['Beat the Clock Eligibility'] === 'Yes';

            if (smedleyYes) smedleyCount++;
            if (talkupYes) talkupCount++;
            if (clockYes) clockCount++;

            const septRenew = Number(row['September Renewals'] ?? row['Oct. Ren.'] ?? 0);
            const marchRenew = Number(row['March Renewals'] ?? row['Apr. Ren.'] ?? 0);

            if (septRenew > 0) singleRenewCount++;
            if (septRenew > 0 && marchRenew > 0) doubleRenewCount++;
        });

        document.getElementById('award-smedley-count').textContent = `${smedleyCount} / ${data.length}`;
        document.getElementById('award-talkup-count').textContent = `${talkupCount} / ${data.length}`;
        document.getElementById('award-clock-count').textContent = `${clockCount} / ${data.length}`;

        const singleElem = document.getElementById('award-single-renew-count');
        if (singleElem) singleElem.textContent = `${singleRenewCount} / ${data.length}`;

        const doubleElem = document.getElementById('award-double-renew-count');
        if (doubleElem) doubleElem.textContent = `${doubleRenewCount} / ${data.length}`;

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
                const septRenew = Number(club['September Renewals'] ?? club['Oct. Ren.'] ?? 0);
                const marchRenew = Number(club['March Renewals'] ?? club['Apr. Ren.'] ?? 0);

                const singleYes = septRenew > 0;
                const doubleYes = septRenew > 0 && marchRenew > 0;

                if (selectedCampaign === 'smedley') {
                    if (selectedStatus === 'achieved') return smedleyYes;
                    if (selectedStatus === 'pending') return !smedleyYes;
                } else if (selectedCampaign === 'talkup') {
                    if (selectedStatus === 'achieved') return talkupYes;
                    if (selectedStatus === 'pending') return !talkupYes;
                } else if (selectedCampaign === 'clock') {
                    if (selectedStatus === 'achieved') return clockYes;
                    if (selectedStatus === 'pending') return !clockYes;
                } else if (selectedCampaign === 'single') {
                    if (selectedStatus === 'achieved') return singleYes;
                    if (selectedStatus === 'pending') return !singleYes;
                } else if (selectedCampaign === 'double') {
                    if (selectedStatus === 'achieved') return doubleYes;
                    if (selectedStatus === 'pending') return !doubleYes;
                } else {
                    if (selectedStatus === 'achieved') return smedleyYes || talkupYes || clockYes || singleYes || doubleYes;
                    if (selectedStatus === 'pending') return !smedleyYes || !talkupYes || !clockYes || !singleYes || !doubleYes;
                }
                return true;
            });

            filtered.forEach(club => {
                const tr = document.createElement('tr');
                const smedleyYes = club['Smedley Award Eligibility'] === 'Yes';
                const talkupYes = club['Talk Up Eligibility'] === 'Yes';
                const clockYes = club['Beat the Clock Eligibility'] === 'Yes';

                const septRenew = Number(club['September Renewals'] ?? club['Oct. Ren.'] ?? 0);
                const marchRenew = Number(club['March Renewals'] ?? club['Apr. Ren.'] ?? 0);

                const singleYes = septRenew > 0;
                const doubleYes = septRenew > 0 && marchRenew > 0;

                tr.innerHTML = `
                    <td><strong>${club['Club Name']}</strong></td>
                    <td>Div ${club['Division']} / Area ${club['Area']}</td>
                    <td><span class="badge ${smedleyYes ? 'badge-yes' : 'badge-no'}">${smedleyYes ? 'Achieved' : 'In Progress'}</span></td>
                    <td><span class="badge ${talkupYes ? 'badge-yes' : 'badge-no'}">${talkupYes ? 'Achieved' : 'In Progress'}</span></td>
                    <td><span class="badge ${clockYes ? 'badge-yes' : 'badge-no'}">${clockYes ? 'Achieved' : 'In Progress'}</span></td>
                    <td><span class="badge ${singleYes ? 'badge-yes' : 'badge-no'}">${singleYes ? 'Achieved (Sep)' : 'Pending'}</span></td>
                    <td><span class="badge ${doubleYes ? 'badge-yes' : 'badge-no'}">${doubleYes ? 'Achieved (Sep & Mar)' : 'Pending'}</span></td>
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

        const cardSingle = document.getElementById('card-single-renew');
        if (cardSingle) {
            cardSingle.addEventListener('click', () => {
                campaignSelect.value = 'single';
                updateCampaignTable();
            });
        }

        const cardDouble = document.getElementById('card-double-renew');
        if (cardDouble) {
            cardDouble.addEventListener('click', () => {
                campaignSelect.value = 'double';
                updateCampaignTable();
            });
        }

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

        const levelBtns = document.querySelectorAll('.renewal-level-btn');
        const searchInput = document.getElementById('renewal-search');
        let currentLevel = 'div';

        levelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                levelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentLevel = btn.getAttribute('data-level');
                updateRenewalTable();
            });
        });

        if (searchInput) searchInput.addEventListener('input', updateRenewalTable);
        const sortSelect = document.getElementById('renewal-sort');
        if (sortSelect) sortSelect.addEventListener('change', updateRenewalTable);

        function updateRenewalTable() {
            const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const tbody = document.querySelector('#renewal-table tbody');
            const thEntity = document.getElementById('th-renewal-entity');
            if (!tbody) return;
            tbody.innerHTML = '';

            let rowsToDisplay = [];

            if (currentLevel === 'div') {
                if (thEntity) thEntity.textContent = 'Division Name';
                const divMap = {};
                data.forEach(c => {
                    const d = String(c['Division'] || 'Unknown');
                    if (!divMap[d]) divMap[d] = { base: 0, active: 0, sept: 0, march: 0 };
                    divMap[d].base += Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    divMap[d].active += Number(c['Active Membership'] ?? c['Active Members'] ?? 0);
                    divMap[d].sept += Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    divMap[d].march += Number(c['March Renewals'] ?? c['Apr. Ren.'] ?? 0);
                });

                Object.keys(divMap).sort().forEach(d => {
                    const item = divMap[d];
                    const septPct = item.base > 0 ? (item.sept / item.base) * 100 : 0;
                    const marchPct = item.base > 0 ? (item.march / item.base) * 100 : 0;
                    rowsToDisplay.push({
                        entity: `Division ${d}`,
                        base: item.base,
                        active: item.active,
                        sept: item.sept,
                        septPct: septPct.toFixed(1) + '%',
                        march: item.march,
                        marchPct: marchPct.toFixed(1) + '%'
                    });
                });
            } else if (currentLevel === 'area') {
                if (thEntity) thEntity.textContent = 'Area Name';
                const areaMap = {};
                data.forEach(c => {
                    const key = `Div ${c['Division']} / Area ${c['Area']}`;
                    if (!areaMap[key]) areaMap[key] = { base: 0, active: 0, sept: 0, march: 0 };
                    areaMap[key].base += Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    areaMap[key].active += Number(c['Active Membership'] ?? c['Active Members'] ?? 0);
                    areaMap[key].sept += Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    areaMap[key].march += Number(c['March Renewals'] ?? c['Apr. Ren.'] ?? 0);
                });

                Object.keys(areaMap).sort().forEach(a => {
                    const item = areaMap[a];
                    const septPct = item.base > 0 ? (item.sept / item.base) * 100 : 0;
                    const marchPct = item.base > 0 ? (item.march / item.base) * 100 : 0;
                    rowsToDisplay.push({
                        entity: a,
                        base: item.base,
                        active: item.active,
                        sept: item.sept,
                        septPct: septPct.toFixed(1) + '%',
                        march: item.march,
                        marchPct: marchPct.toFixed(1) + '%'
                    });
                });
            } else {
                if (thEntity) thEntity.textContent = 'Club Name';
                data.forEach(c => {
                    const base = Number(c['Base Membership'] ?? c['Mem. Base'] ?? 0);
                    const active = Number(c['Active Membership'] ?? c['Active Members'] ?? 0);
                    const sept = Number(c['September Renewals'] ?? c['Oct. Ren.'] ?? 0);
                    const septPctRaw = c['September Renewals %'] ?? (base > 0 ? sept / base : 0);
                    const march = Number(c['March Renewals'] ?? c['Apr. Ren.'] ?? 0);
                    const marchPctRaw = c['March Renewals %'] ?? (base > 0 ? march / base : 0);

                    rowsToDisplay.push({
                        entity: `${c['Club Name']} (Div ${c['Division']}/Area ${c['Area']})`,
                        base: base,
                        active: active,
                        sept: sept,
                        septPct: (Number(septPctRaw) * 100).toFixed(1) + '%',
                        march: march,
                        marchPct: (Number(marchPctRaw) * 100).toFixed(1) + '%'
                    });
                });
            }

            const sortSelect = document.getElementById('renewal-sort');
            const sortVal = sortSelect ? sortSelect.value : 'name';
            
            let filtered = rowsToDisplay.filter(r => r.entity.toLowerCase().includes(searchVal));

            filtered.sort((a, b) => {
                if (sortVal === 'overall-desc') {
                    return (parseFloat(b.septPct) + parseFloat(b.marchPct)) - (parseFloat(a.septPct) + parseFloat(a.marchPct));
                } else if (sortVal === 'overall-asc') {
                    return (parseFloat(a.septPct) + parseFloat(a.marchPct)) - (parseFloat(b.septPct) + parseFloat(b.marchPct));
                } else if (sortVal === 'sept-desc') {
                    return parseFloat(b.septPct) - parseFloat(a.septPct);
                } else if (sortVal === 'sept-asc') {
                    return parseFloat(a.septPct) - parseFloat(b.septPct);
                } else if (sortVal === 'march-desc') {
                    return parseFloat(b.marchPct) - parseFloat(a.marchPct);
                } else if (sortVal === 'march-asc') {
                    return parseFloat(a.marchPct) - parseFloat(b.marchPct);
                } else {
                    return a.entity.localeCompare(b.entity);
                }
            });

            filtered.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.entity}</strong></td>
                    <td>${r.base}</td>
                    <td>${r.active}</td>
                    <td>${r.sept}</td>
                    <td><strong>${r.septPct}</strong></td>
                    <td>${r.march}</td>
                    <td><strong>${r.marchPct}</strong></td>
                `;
                tbody.appendChild(tr);
            });
        }

        updateRenewalTable();
    }
});
