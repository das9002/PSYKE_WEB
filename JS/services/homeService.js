document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');

            hamburgerBtn.innerHTML = sidebar.classList.contains('open')
                ? '<i class="bi bi-x"></i>'
                : '<i class="bi bi-list"></i>';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
        });

        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
                hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
            });
        });
    }

    const searchInput = document.getElementById('searchRecentStudents');
    const tableBody = document.querySelector('#recentStudentsTable tbody');
    const noResultsMsg = document.getElementById('noResultsMessage');

    if (searchInput && tableBody) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const rows = tableBody.querySelectorAll('tr');
            let visibleCount = 0;

            rows.forEach(row => {
                const rowText = row.textContent.toLowerCase();
                if (rowText.includes(query)) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });

            if (noResultsMsg) {
                if (visibleCount === 0 && query.length > 0) {
                    noResultsMsg.classList.remove('d-none');
                } else {
                    noResultsMsg.classList.add('d-none');
                }
            }
        });
    }

    (function () {
        if (localStorage.getItem('psyke_dark_mode') === 'enabled') {
            document.documentElement.classList.add('dark-mode');
        }
    })();
});
