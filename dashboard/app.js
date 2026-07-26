document.addEventListener('DOMContentLoaded', () => {
    const uploadStatus = document.getElementById('upload-status');

    let distChartInstance = null;
    let statusChartInstance = null;
    let scatterChartInstance = null;

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
                    uploadStatus.textContent = 'Auto-synced live dataset';
                    processData(data);
                })
                .catch(() => {
                    tryNextJson(index + 1);
                });
        }

        function tryNextExcel(index) {
            if (index >= excelPaths.length) {
                uploadStatus.textContent = 'Waiting for background pipeline...';
                return;
            }
            fetch(excelPaths[index])
                .then(res => {
                    if (!res.ok) throw new Error('Excel not found');
                    return res.arrayBuffer();
                })
                .then(buffer => {
                    uploadStatus.textContent = 'Auto-synced live dataset';
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

            uploadStatus.textContent = `Auto-synced live dataset`;
            processData(jsonData);
        } catch (err) {
            uploadStatus.textContent = 'Error loading dataset.';
            console.error(err);
        }
    }

    function processData(data) {
        const validData = data.filter(row => row['Club Name']);

        const totalClubs = validData.length;
        const totalActiveMembers = validData.reduce((acc, row) => {
            const act = row['Active Members'] ?? row['Active Membership'] ?? 0;
            return acc + Number(act);
        }, 0);
        
        let totalGoals = 0;
        let distCount = 0;
        
        const distStatuses = {};
        const clubStatuses = {};
        const scatterData = [];
        
        validData.forEach(row => {
            const goals = Number(row['Goals Met'] ?? row['Goals'] ?? 0);
            totalGoals += goals;
            
            const distStatus = String(row['Distinguished Status'] ?? row['Distinguished'] ?? 'None');
            if (distStatus.includes('Distinguished') || distStatus === 'Yes' || distStatus === 'P' || distStatus === 'S' || distStatus === 'M') {
                distCount++;
            }
            
            const distLabel = distStatus === 'P' ? "President's Distinguished" :
                              (distStatus === 'S' ? 'Select Distinguished' :
                              (distStatus === 'M' ? 'Distinguished' : distStatus));
                              
            distStatuses[distLabel] = (distStatuses[distLabel] || 0) + 1;
            
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

        updateDistinguishedChart(distStatuses);
        updateStatusChart(clubStatuses);
        updateScatterChart(scatterData);
        updateTopClubsTable(validData);
    }

    function updateDistinguishedChart(dataObj) {
        const ctx = document.getElementById('distinguishedChart').getContext('2d');
        const labels = Object.keys(dataObj);
        const data = Object.values(dataObj);

        if (distChartInstance) distChartInstance.destroy();

        distChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Clubs',
                    data: data,
                    backgroundColor: 'rgba(139, 92, 246, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94A3B8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94A3B8' }
                    }
                }
            }
        });
    }

    function updateStatusChart(dataObj) {
        const ctx = document.getElementById('statusChart').getContext('2d');
        const labels = Object.keys(dataObj);
        const data = Object.values(dataObj);

        if (statusChartInstance) statusChartInstance.destroy();

        statusChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#10B981', '#3b82f6', '#EF4444', '#F59E0B'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#F8FAFC', padding: 20 }
                    }
                },
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
                    label: 'Clubs',
                    data: dataArray,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw.clubName}: Growth(${context.raw.x}), Goals(${context.raw.y})`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Net Growth', color: '#94A3B8' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94A3B8' }
                    },
                    y: {
                        title: { display: true, text: 'Goals Met', color: '#94A3B8' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94A3B8' }
                    }
                }
            }
        });
    }

    function updateTopClubsTable(data) {
        const tbody = document.querySelector('#top-clubs-table tbody');
        tbody.innerHTML = '';

        const formattedData = data.map(club => {
            const base = Number(club['Mem. Base'] ?? club['Base Membership'] ?? 0);
            const active = Number(club['Active Members'] ?? club['Active Membership'] ?? 0);
            const netGrowth = club['Net Growth'] ?? (active - base);
            return { ...club, base, active, netGrowth };
        });

        const sorted = [...formattedData].sort((a, b) => b.netGrowth - a.netGrowth);
        const top10 = sorted.slice(0, 10);

        top10.forEach(club => {
            const tr = document.createElement('tr');
            
            const netGrowth = club.netGrowth;
            const growthClass = netGrowth > 0 ? 'positive' : (netGrowth < 0 ? 'negative' : '');
            const growthSign = netGrowth > 0 ? '+' : '';

            tr.innerHTML = `
                <td><strong>${club['Club Name']}</strong></td>
                <td>Div ${club['Division']} / Area ${club['Area']}</td>
                <td>${club.base}</td>
                <td>${club.active}</td>
                <td class="${growthClass}">${growthSign}${netGrowth}</td>
                <td>${club['Goals Met'] ?? club['Goals'] ?? 0}</td>
            `;
            tbody.appendChild(tr);
        });
    }
});
