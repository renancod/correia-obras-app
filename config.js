/* Endereço da API (Google Apps Script). Em teste local (localhost) usa o servidor de teste. */
window.API_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? '/api'
  : 'https://script.google.com/macros/s/AKfycbyfKKHaV54TkqdCX0y93DMoL0_Y900pyMmIcYsr6uV0MA90bgANpDxHEe-8a5UFGk_i/exec';
