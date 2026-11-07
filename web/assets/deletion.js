/*
 * Amélioration progressive des deux formulaires de suppression de compte (aucune dépendance, aucun suivi).
 * Sans JavaScript, les formulaires s'envoient normalement vers l'API (réponse brute) ; avec, la réponse est affichée sur la page.
 * Le point d'accès de l'API est l'attribut `action` du formulaire (à renseigner, voir docs/runbooks/site-public.md).
 */
(function () {
  'use strict';

  var forms = document.querySelectorAll('form[data-deletion-form]');
  var tokenField = document.getElementById('token');

  // Lien reçu par e-mail : /confirm-deletion?token=... (le jeton reste dans le navigateur, l'en-tête Referrer-Policy est no-referrer).
  if (tokenField) {
    try {
      var token = new URLSearchParams(window.location.search).get('token');
      if (token) {
        tokenField.value = token;
      }
    } catch (e) { /* champ laissé vide : saisie manuelle possible */ }
  }

  Array.prototype.forEach.call(forms, function (form) {
    var status = form.querySelector('.status');
    var button = form.querySelector('button');
    var msg = function (key) { return form.getAttribute('data-msg-' + key) || ''; };

    form.addEventListener('submit', function (event) {
      var action = form.getAttribute('action') || '';
      if (action.indexOf('.invalid') !== -1 || action === '') {
        event.preventDefault();
        status.textContent = msg('unconfigured');
        return;
      }
      if (!window.fetch || !window.FormData) {
        return; // envoi classique
      }
      event.preventDefault();

      var data = {};
      new FormData(form).forEach(function (value, key) { data[key] = String(value).trim(); });

      button.disabled = true;
      status.textContent = msg('sending');

      window.fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      }).then(function (response) {
        if (response.status === 202 || response.status === 204) {
          status.textContent = msg('done');
          form.reset();
        } else if (response.status === 429) {
          status.textContent = msg('throttled');
        } else if (response.status === 422) {
          status.textContent = msg('invalid');
        } else {
          status.textContent = msg('error');
        }
      }).catch(function () {
        status.textContent = msg('error');
      }).then(function () {
        button.disabled = false;
      });
    });
  });
})();
