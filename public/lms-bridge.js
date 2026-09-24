/*!
 * lms-bridge.js — Pont entre vos modules interactifs HTML et la plateforme LMS.
 *
 * Ajoutez dans votre module :
 *   <script src="https://VOTRE-LMS/lms-bridge.js"></script>
 * puis appelez :
 *   LMS.progress(45);          // progression affichée (0-100)
 *   LMS.complete();            // étape terminée
 *   LMS.complete(85);          // étape terminée avec un score (0-100)
 *   LMS.resize();              // ajuste la hauteur de l'iframe au contenu
 *
 * Complétion automatique facultative :
 *   <body data-lms-complete-on="#bouton-fin">   → termine au clic sur cet élément
 *   <body data-lms-complete-at-end>             → termine quand l'apprenant atteint le bas de la page
 */
(function () {
  if (window.LMS) return;
  var inFrame = window.parent && window.parent !== window;
  function send(msg) {
    if (inFrame) window.parent.postMessage(msg, "*");
  }
  var completed = false;
  window.LMS = {
    progress: function (value) { send({ type: "lms:progress", value: Number(value) || 0 }); },
    complete: function (score) {
      if (completed) return;
      completed = true;
      send({ type: "lms:complete", score: typeof score === "number" ? score : undefined });
    },
    resize: function () { send({ type: "lms:resize", height: document.documentElement.scrollHeight }); },
    isEmbedded: inFrame,
  };
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.body;
    var sel = b && b.getAttribute("data-lms-complete-on");
    if (sel) {
      document.addEventListener("click", function (e) {
        if (e.target && e.target.closest && e.target.closest(sel)) window.LMS.complete();
      });
    }
    if (b && b.hasAttribute("data-lms-complete-at-end")) {
      window.addEventListener("scroll", function () {
        var h = document.documentElement;
        var ratio = (h.scrollTop + window.innerHeight) / h.scrollHeight;
        window.LMS.progress(Math.min(100, Math.round(ratio * 100)));
        if (ratio > 0.97) window.LMS.complete();
      }, { passive: true });
    }
  });
})();
