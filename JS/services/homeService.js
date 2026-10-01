/**
 * Script Principal de Interfaz (Menú Lateral, Búsqueda de Estudiantes y Modo Oscuro)
 */

// 1. Inicialización inmediata del Modo Oscuro (Evita el destello/FOUC al cargar)
(function aplicarModoOscuro() {
    if (localStorage.getItem('psyke_dark_mode') === 'enabled') {
        document.documentElement.classList.add('dark-mode');
    }
})();

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // MÓDULO 1: Menú Lateral (Sidebar) Responsivo
    // ==========================================
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (hamburgerBtn && sidebar && overlay) {

        const cerrarMenu = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
            hamburgerBtn.setAttribute('aria-expanded', 'false');
        };

        const abrirMenu = () => {
            sidebar.classList.add('open');
            overlay.classList.add('active');
            hamburgerBtn.innerHTML = '<i class="bi bi-x"></i>';
            hamburgerBtn.setAttribute('aria-expanded', 'true');
        };

        // Alternar menú al hacer clic en el botón hamburguesa
        hamburgerBtn.addEventListener('click', () => {
            const estaAbierto = sidebar.classList.contains('open');
            estaAbierto ? cerrarMenu() : abrirMenu();
        });

        // Cerrar menú al hacer clic en la capa translúcida (overlay)
        overlay.addEventListener('click', cerrarMenu);

        // Cerrar menú móvil al hacer clic en cualquier enlace de navegación
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', cerrarMenu);
        });
    }

    // ==========================================
    // MÓDULO 2: Búsqueda en Tiempo Real en Tabla
    // ==========================================
    const searchInput = document.getElementById('searchRecentStudents');
    const tableBody = document.querySelector('#recentStudentsTable tbody');
    const noResultsMsg = document.getElementById('noResultsMessage');

    if (searchInput && tableBody) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const rows = tableBody.querySelectorAll('tr');
            let visibleCount = 0;

            rows.forEach(row => {
                // Ignora filas informativas ("Cargando...", "No hay datos disponibles")
                if (row.cells.length === 1 && row.querySelector('.spinner-border, .bi-clipboard-x')) {
                    return;
                }

                const rowText = row.textContent.toLowerCase();
                const coincide = rowText.includes(query);

                row.style.display = coincide ? '' : 'none';
                if (coincide) visibleCount++;
            });

            // Alterna la visibilidad del mensaje de "Sin resultados"
            if (noResultsMsg) {
                const mostrarMensaje = visibleCount === 0 && query.length > 0;
                noResultsMsg.classList.toggle('d-none', !mostrarMensaje);
            }
        });
    }
});
