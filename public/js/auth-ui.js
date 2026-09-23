(() => {
  'use strict';
  document.getElementById('togglePass')?.addEventListener('click', function () {
    const input = document.getElementById('password');
    const icon = this.querySelector('i');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
  });
})();
