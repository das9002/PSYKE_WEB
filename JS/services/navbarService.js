(function () {
    'use strict';

    const BUTTON_SELECTOR = '.btn-user-profile';
    const MENU_ID = 'profileDropdownMenu';

    let usuarioCache = null;
    let sesionVerificada = false;


    function resolveLoginPage() {
        const path = window.location.pathname;
        const carpeta = path.substring(0, path.lastIndexOf('/'));
        const profundidad = carpeta.split('/').filter(Boolean).length;
        return profundidad > 0 ? '../index.html' : 'index.html';
    }

    function pageLink(nombre) {
        const path = window.location.pathname;
        const enBtns = /\/btnsEstudiante(\/|$)/.test(path);
        return enBtns ? '../HTML/' + nombre : nombre;
    }

    async function verificarSesionYObtenerUsuario() {
        if (sesionVerificada && usuarioCache) {
            return usuarioCache;
        }

        try {
            // Usar la API de autenticación para verificar sesión via cookie
            const respuesta = await fetch('http://localhost:8081/api/auth/me', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (respuesta.status === 401) {
                return null;
            }

            if (respuesta.status === 403) {
                console.warn('[navbarService] Acceso denegado (403), pero se mantiene la sesión');
                return null;
            }

            if (respuesta.status >= 500) {
                console.error('[navbarService] Error del servidor (5xx), se mantiene la sesión');
                return null;
            }

            if (respuesta.ok) {
                const datos = await respuesta.json();
                // Solo permitir ADMIN y PSICOLOGO en la web
                const rol = datos.tipoUsuario;
                if (rol === 'ADMIN' || rol === 'PSICOLOGO') {
                    usuarioCache = {
                        nombre: datos.correo?.split('@')[0] || 'Usuario',
                        email: datos.correo || '',
                        rol: rol
                    };
                    sesionVerificada = true;
                    return usuarioCache;
                } else {
                    // Estudiante no puede acceder a la web
                    throw new Error('Acceso denegado');
                }
            }
        } catch (e) {
            // Error de red - no cerrar sesión
            console.error('[navbarService] Error de red al verificar sesión:', e);
        }
        return null;
    }

    function buildMenu() {
        let menu = document.getElementById(MENU_ID);
        if (menu) return menu;

        menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.className = 'profile-dropdown-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Menú de usuario');

        menu.innerHTML = `
            <div class="profile-dropdown-header">
                <i class="bi bi-person-circle"></i>
                <div>
                    <span class="profile-dropdown-name"></span>
                    <span class="profile-dropdown-email"></span>
                </div>
            </div>
            <div class="profile-dropdown-divider"></div>
            <a class="profile-dropdown-item" href="perfilConfig.html" data-action="profile" role="menuitem">
                <i class="bi bi-person-fill"></i> Mi Perfil
            </a>
            <a class="profile-dropdown-item" href="config.html" data-action="settings" role="menuitem">
                <i class="bi bi-gear-fill"></i> Configuración
            </a>
            <div class="profile-dropdown-divider"></div>
            <button type="button" class="profile-dropdown-item danger" data-action="logout" role="menuitem">
                <i class="bi bi-box-arrow-right"></i> Cerrar sesión
            </button>
        `;
        return menu;
    }

    function patchMenuLinks(menu) {
        menu.querySelectorAll('[data-action]').forEach(item => {
            if (item.tagName !== 'A') return;
            if (item.dataset.action === 'profile') {
                item.href = pageLink('perfilConfig.html');
            } else if (item.dataset.action === 'settings') {
                item.href = pageLink('config.html');
            }
        });
    }


    async function handleLogout() {
        try {
            await fetch('http://localhost:8081/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
        } catch (e) {
            // Ignorar errores
        }
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace(resolveLoginPage());
    }

    function toggleMenu(menu, button) {
        const abierto = menu.classList.toggle('active');
        button.classList.toggle('active', abierto);
    }

    function closeMenu(menu, button) {
        menu.classList.remove('active');
        if (button) button.classList.remove('active');
    }


    async function initNavbar() {
        const button = document.querySelector(BUTTON_SELECTOR);
        if (!button) return;

        const usuario = await verificarSesionYObtenerUsuario();
        if (!usuario) {
            window.location.replace(resolveLoginPage());
            return;
        }

        const nombreUsuario = usuario.nombre || 'Usuario';

        const nameEl = button.querySelector('.user-name');
        if (nameEl) {
            nameEl.textContent = nombreUsuario;
        }

        const container = button.parentElement;
        if (container) container.style.position = 'relative';

        const menu = buildMenu();
        patchMenuLinks(menu);

        if (menu.parentElement !== container) {
            container.appendChild(menu);
        }

        const menuName = menu.querySelector('.profile-dropdown-name');
        const menuEmail = menu.querySelector('.profile-dropdown-email');
        if (menuName) menuName.textContent = nombreUsuario;
        if (menuEmail) menuEmail.textContent = usuario.email || '';

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMenu(menu, button);
        });

        document.addEventListener('click', (e) => {
            if (!menu.classList.contains('active')) return;
            if (menu.contains(e.target) || button.contains(e.target)) return;
            closeMenu(menu, button);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu(menu, button);
        });

        menu.addEventListener('click', (e) => {
            const item = e.target.closest('[data-action]');
            if (!item) return;

            if (item.dataset.action === 'logout') {
                e.preventDefault();
                closeMenu(menu, button);
                handleLogout();
                return;
            }

            closeMenu(menu, button);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavbar);
    } else {
        initNavbar();
    }
})();