document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('csv-upload');
    const uploadStatus = document.getElementById('upload-status');
    const welcomeMessage = document.getElementById('welcome-message');
    const dashboardContent = document.getElementById('dashboard-content');
    const chartsContent = document.getElementById('charts-content');

    // Chart instances
    let distChartInstance = null;
    let statusChartInstance = null;
    let scatterChartInstance = null;

    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadStatus.textContent = `Loading ${file.name}...`;
            
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    uploadStatus.textContent = `Loaded ${results.data.length} records.`;
                    processData(results.data);
                },
                error: function(err) {
                    uploadStatus.textContent = 'Error parsing CSV.';
                    console.error(err);
                }
            });
        }
    });

    function processData(data) {
        // Filter out empty rows just in case
        const validData = data.filter(row => row['Club Name']);

        // 1. Calculate KPIs
        const totalClubs = validData.length;
        const totalActiveMembers = validData.reduce((acc, row) => acc + (row['Active Members'] || 0), 0);
        
        let totalGoals = 0;
        let distCount = 0;
        
        const distStatuses = {};
        const clubStatuses = {};
        const scatterData = [];
        
        validData.forEach(row => {
            // Goals
            totalGoals += (row['Goals Met'] || 0);
            
            // Distinguished count (any status containing 'Distinguished')
            const distStatus = row['Distinguished Status'] || 'None';
            if (distStatus.includes('Distinguished')) distCount++;
            
            // Group for Dist Status Chart
            distStatuses[distStatus] = (distStatuses[distStatus] || 0) + 1;
            
            // Group for Club Status Chart
            const clubStatus = row['Club Status'] || 'Unknown';
            clubStatuses[clubStatus] = (clubStatuses[clubStatus] || 0) + 1;
            
            // Scatter data
            scatterData.push({
                x: row['Net Growth'] || 0,
                y: row['Goals Met'] || 0,
                clubName: row['Club Name']
            });
        });

        const avgGoals = totalClubs > 0 ? (totalGoals / totalClubs).toFixed(1) : 0;

        // Update KPI DOM
        document.getElementById('kpi-total-clubs').textContent = totalClubs;
        document.getElementById('kpi-active-members').textContent = totalActiveMembers.toLocaleString();
        document.getElementById('kpi-avg-goals').textContent = avgGoals;
        document.getElementById('kpi-distinguished').textContent = distCount;

        // Update Charts
        updateDistinguishedChart(distStatuses);
        updateStatusChart(clubStatuses);
        updateScatterChart(scatterData);
        
        // Update Table
        updateTopClubsTable(validData);

        // Show dashboard, hide welcome
        welcomeMessage.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
        chartsContent.classList.remove('hidden');
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
                    backgroundColor: ['#3b82f6', '#10B981', '#EF4444', '#F59E0B'],
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
        tbody.innerHTML = ''; // clear

        // Sort by Net Growth descending
        const sorted = [...data].sort((a, b) => (b['Net Growth'] || 0) - (a['Net Growth'] || 0));
        const top10 = sorted.slice(0, 10);

        top10.forEach(club => {
            const tr = document.createElement('tr');
            
            const netGrowth = club['Net Growth'] || 0;
            const growthClass = netGrowth > 0 ? 'positive' : (netGrowth < 0 ? 'negative' : '');
            const growthSign = netGrowth > 0 ? '+' : '';

            tr.innerHTML = `
                <td><strong>${club['Club Name']}</strong></td>
                <td>Div ${club['Division']} / Area ${club['Area']}</td>
                <td>${club['Mem. Base'] || 0}</td>
                <td>${club['Active Members'] || 0}</td>
                <td class="${growthClass}">${growthSign}${netGrowth}</td>
                <td>${club['Goals Met'] || 0}</td>
            `;
            tbody.appendChild(tr);
        });
    }
});
