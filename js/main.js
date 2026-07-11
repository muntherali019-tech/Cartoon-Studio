// Cartoon Studio — site interactions
(function () {
  "use strict";

  // --- Mobile navigation toggle ---
  // Implemented: opens/closes the primary nav on small screens and keeps
  // the aria-expanded state in sync for assistive technologies.
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    var setNav = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      setNav(open);
    });

    // Close the menu when a nav link is tapped.
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setNav(false);
      }
    });

    // Close the menu on Escape for keyboard users.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setNav(false);
      }
    });
  }

  // --- Footer year ---
  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  // TODO: load gallery images dynamically from a data source instead of hardcoding placeholders
  // TODO: validate the contact form fields and submit to a backend endpoint
})();
