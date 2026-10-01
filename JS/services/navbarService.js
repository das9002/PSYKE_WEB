(function () {
    'use strict';

    const BUTTON_SELECTOR = '.btn-user-profile';
    const MENU_ID = 'profileDropdownMenu';

    let usuarioCache = null;
    let sesionVerificada = false;

    function getStoredToken() {
        if (typeof window.obtenerToken === 'function') {
            return window.obtenerToken();
        }
        const claves = ['psyke_token', 'token', 'jwt', 'access_token', 'auth_token'];
        for (let i = 0; i < claves.length; i++) {
            let val = localStorage.getItem(claves[i]) || sessionStorage.getItem(claves[i]);
            if (val) {
                val = String(val).trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1);
                }
                if (val && val !== 'null' && val !== 'undefined') {
                    return val;
                }
            }
        }
        return null;
    }

    function getStoredUser() {
        if (typeof window.obtenerUsuario === 'function') {
            return window.obtenerUsuario();
        }
        const claves = ['psyke_user', 'user', 'currentUser', 'usuario'];
        for (let i = 0; i < claves.length; i++) {
            const raw = localStorage.getItem(claves[i]) || sessionStorage.getItem(claves[i]);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') return parsed;
                } catch (e) { }
            }
        }
        return null;
    }

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

        const token = getStoredToken();
        const usuarioLocal = getStoredUser();

        if (!token && !usuarioLocal) {
            return null;
        }

        try {
            const baseUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');
            const headers = { 'Content-Type': 'application/json' };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            let respuesta;
            if (typeof window.authFetch === 'function') {
                respuesta = await window.authFetch('/me');
            } else {
                respuesta = await fetch(`${baseUrl}/me`, {
                    method: 'GET',
                    headers: headers,
                    credentials: 'include'
                });
            }

            if (respuesta && respuesta.ok) {
                const datos = await respuesta.json();
                
                const rawRol = datos.tipoUsuario || datos.rol || (Array.isArray(datos.roles) ? datos.roles[0] : '');
                const rol = String(rawRol).replace('ROLE_', '').toUpperCase();

                if (rol === 'ADMIN' || rol === 'PSICOLOGO') {
                    usuarioCache = {
                        nombre: datos.nombre || (datos.correo ? datos.correo.split('@')[0] : 'Usuario'),
                        email: datos.correo || datos.email || '',
                        rol: rol
                    };
                    sesionVerificada = true;
                    return usuarioCache;
                } else {
                    console.warn('[navbarService] Rol no autorizado para la versión web:', rol);
                    return null;
                }
            }
        } catch (e) {
            console.error('[navbarService] Error de red al verificar sesión:', e);
        }

        if (usuarioLocal) {
            const rawRolLocal = usuarioLocal.tipoUsuario || usuarioLocal.rol || (Array.isArray(usuarioLocal.roles) ? usuarioLocal.roles[0] : '');
            const rolLocal = String(rawRolLocal).replace('ROLE_', '').toUpperCase();

            if (rolLocal === 'ADMIN' || rolLocal === 'PSICOLOGO') {
                usuarioCache = {
                    nombre: usuarioLocal.nombre || (usuarioLocal.correo ? usuarioLocal.correo.split('@')[0] : 'Usuario'),
                    email: usuarioLocal.correo || usuarioLocal.email || '',
                    rol: rolLocal
                };
                sesionVerificada = true;
                return usuarioCache;
            }
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
            const baseUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');
            const token = getStoredToken();
            await fetch(`${baseUrl}/logout`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                credentials: 'include'
            });
        } catch (e) { }

        if (typeof window.cerrarSesionGlobal === 'function') {
            window.cerrarSesionGlobal({ voluntario: true });
        } else {
            localStorage.clear();
            sessionStorage.clear();
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
