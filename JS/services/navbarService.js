(function () {
    'use strict';

    const BUTTON_SELECTOR = '.btn-user-profile';
    const MENU_ID = 'profileDropdownMenu';

    let usuarioCache = null;
    let sesionVerificada = false;

    function resolveLoginPage() {
        return /\/(HTML|btnsEstudiante)\//i.test(window.location.pathname) ? '../index.html' : 'index.html';
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

        const datos = typeof window.verificarSesion === 'function' ? await window.verificarSesion() : null;
        if (!datos) return null;

        const rawRol = datos.tipoUsuario || datos.rol || (Array.isArray(datos.roles) ? datos.roles[0] : '');
        const rol = String(rawRol).replace('ROLE_', '').toUpperCase();
        if (rol !== 'ADMIN' && rol !== 'PSICOLOGO') return null;

        usuarioCache = {
            nombre: datos.nombre || (datos.correo ? datos.correo.split('@')[0] : 'Usuario'),
            email: datos.correo || datos.email || '',
            rol
        };
        sesionVerificada = true;
        return usuarioCache;
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
        if (typeof Notif !== 'undefined') {
            const confirmado = await Notif.confirmar(
                '¿Cerrar sesión?',
                'Tendrás que ingresar tus credenciales nuevamente para volver a entrar.',
                'Sí, cerrar sesión',
                { icono: 'warning', peligro: true }
            );
            if (!confirmado) return;
        }

        if (window.AuthService && typeof window.AuthService.logoutUsuario === 'function') {
            await window.AuthService.logoutUsuario();
            return;
        }

        try {
            await fetch(`${String(window.AUTH_API_URL || '').replace(/\/+$/, '')}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) { }

        if (typeof window.cerrarSesionGlobal === 'function') {
            window.cerrarSesionGlobal({ voluntario: true });
        } else {
            window.location.replace(resolveLoginPage());
        }
    }

    function toggleMenu(menu, button) {
        const abierto = menu.classList.toggle('active');
        button.classList.toggle('active', abierto);
        button.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    }

    function closeMenu(menu, button) {
        menu.classList.remove('active');
        if (button) {
            button.classList.remove('active');
            button.setAttribute('aria-expanded', 'false');
        }
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

        button.setAttribute('aria-haspopup', 'true');
        button.setAttribute('aria-expanded', 'false');

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
