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

    const switchOscuro = document.getElementById('switchOscuro'); 
    if (switchOscuro) {
        switchOscuro.checked = document.documentElement.classList.contains('dark-mode');
        
        switchOscuro.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark-mode');
                localStorage.setItem('psyke_dark_mode', 'enabled');
                console.log("Modo oscuro activado");
            } else {
                document.documentElement.classList.remove('dark-mode');
                localStorage.setItem('psyke_dark_mode', 'disabled');
                console.log("Modo claro activado");
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();

            Notif.confirmar(
                '¿Cerrar Sesión?',
                '¿Estás seguro de que deseas salir y volver a la pantalla de inicio?',
                'Sí, cerrar sesión'
            ).then(confirmado => {
                if (!confirmado) return;

                Notif.exito('Has salido de tu cuenta de forma segura.', 'Sesión Cerrada');
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 800);
            });
        });
    }

    const cookiePrefsBtn = document.getElementById('cookiePrefsBtn');
    if (cookiePrefsBtn) {
        cookiePrefsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showCookiePreferencesModal();
        });
    }

    function showCookiePreferencesModal() {
        const savedPrefs = localStorage.getItem('psyke_cookie_preferences');
        let currentPrefs = { preferences: true, analytics: true };

        if (savedPrefs) {
            try {
                currentPrefs = JSON.parse(savedPrefs);
            } catch (err) {
                console.error("Fallo al decodificar preferencias de cookies guardadas:", err);
            }
        }

        Swal.fire({
            title: 'Preferencias de Cookies',
            html: `
                <div class="text-muted mb-4" style="font-size: 0.9rem;">
                    Utilizamos cookies para optimizar tu experiencia y analizar el tráfico de
                    navegación. Configura tus niveles de consentimiento a continuación:
                </div>
                <div style="text-align: left;">
                    <div class="d-flex justify-content-between align-items-center py-3 border-bottom">
                        <div style="max-width: 80%;">
                            <div class="fw-bold" style="font-size: 0.9rem; color: #0f172a;">Cookies Técnicas (Esenciales)</div>
                            <div class="text-muted" style="font-size: 0.78rem; line-height: 1.3;">Obligatorias para el mantenimiento de sesión, seguridad del sistema y almacenamiento de configuraciones fundamentales.</div>
                        </div>
                        <div class="form-switch">
                            <input class="form-check-input" type="checkbox" checked disabled style="cursor: not-allowed; width: 2.8em; height: 1.5em;">
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center py-3 border-bottom">
                        <div style="max-width: 80%;">
                            <div class="fw-bold" style="font-size: 0.9rem; color: #0f172a;">Personalización y Preferencias</div>
                            <div class="text-muted" style="font-size: 0.78rem; line-height: 1.3;">Permiten al sitio web recordar parámetros definidos por el usuario (ej. interruptor del Modo Oscuro, idioma).</div>
                        </div>
                        <div class="form-switch">
                            <input class="form-check-input" type="checkbox" id="cookiePrefSwitch" ${currentPrefs.preferences ? 'checked' : ''} style="width: 2.8em; height: 1.5em;">
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center py-3">
                        <div style="max-width: 80%;">
                            <div class="fw-bold" style="font-size: 0.9rem; color: #0f172a;">Análisis y Rendimiento</div>
                            <div class="text-muted" style="font-size: 0.78rem; line-height: 1.3;">Recopilan información estadística y de uso de forma completamente anónima para medir y mejorar el rendimiento de la aplicación.</div>
                        </div>
                        <div class="form-switch">
                            <input class="form-check-input" type="checkbox" id="cookieAnalSwitch" ${currentPrefs.analytics ? 'checked' : ''} style="width: 2.8em; height: 1.5em;">
                        </div>
                    </div>
                </div>
            `,
            icon: 'info',
            width: 520,
            showCancelButton: true,
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Guardar Ajustes',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const prefCheckbox = document.getElementById('cookiePrefSwitch');
                const analCheckbox = document.getElementById('cookieAnalSwitch');

                localStorage.setItem('psyke_cookie_preferences', JSON.stringify({
                    preferences: prefCheckbox.checked,
                    analytics: analCheckbox.checked
                }));
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Notif.exito('Tus preferencias de privacidad han sido registradas y aplicadas.', 'Preferencias Actualizadas');
            }
        });
    }
});
