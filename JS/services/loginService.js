const container       = document.getElementById('container');
const toggleContainer = document.querySelector('.toggle-container');
const registerBtn     = document.getElementById('register');
const loginBtn        = document.getElementById('login');

const isMobile = () => window.innerWidth <= 540;

function validateForm(form) {
    let valid = true;

    form.querySelectorAll('input').forEach(input => {
        const errEl = input.nextElementSibling;
        
        input.classList.remove('input-error');
        if (errEl && errEl.classList.contains('error-msg')) {
            errEl.classList.remove('visible');
        }

        if (!input.value.trim()) {
            input.classList.add('input-error');
            if (errEl && errEl.classList.contains('error-msg')) {
                errEl.classList.add('visible');
            }
            valid = false;
        } 
        else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
            input.classList.add('input-error');
            if (errEl && errEl.classList.contains('error-msg')) {
                errEl.textContent = 'Ingresa un email válido';
                errEl.classList.add('visible');
            }
            valid = false;
        }
    });

    return valid;
}

document.querySelectorAll('.container input').forEach(input => {
    input.addEventListener('input', () => {
        input.classList.remove('input-error');
        const errEl = input.nextElementSibling;
        if (errEl && errEl.classList.contains('error-msg')) {
            errEl.classList.remove('visible');
        }
    });
});


const signUpBtn = document.querySelector('.sign-up button[type="button"]:not(.hidden)');
if (signUpBtn) {
    signUpBtn.addEventListener('click', () => {
        const form = document.querySelector('.sign-up form');
        if (validateForm(form)) {
            Notif.exito('¡Cuenta creada con éxito!');
        }
    });
}

function mobileSweep(direction, callback) {
    const sweepClass = direction === 'down' ? 'sweeping' : 'sweeping-up';

    toggleContainer.classList.add(sweepClass);

    toggleContainer.addEventListener('animationend', function onEnd() {
        toggleContainer.removeEventListener('animationend', onEnd);
        toggleContainer.classList.remove(sweepClass);
        callback();
    }, { once: true });
}

function goToSignUp() {
    if (isMobile()) {
        mobileSweep('down', () => {
            container.classList.add('active');
        });
    } else {
        container.classList.add('active');
    }
}

function goToSignIn() {
    if (isMobile()) {
        mobileSweep('up', () => {
            container.classList.remove('active');
        });
    } else {
        container.classList.remove('active');
    }
}

if (registerBtn) registerBtn.addEventListener('click', goToSignUp);
if (loginBtn)    loginBtn.addEventListener('click',    goToSignIn);