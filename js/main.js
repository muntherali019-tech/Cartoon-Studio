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

  // --- Contact form validation & submission ---
  // Implemented: validates each field on submit (and clears errors as the
  // user corrects them), reports accessible per-field messages, and hands a
  // valid enquiry to sendEnquiry().
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");

  if (form) {
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    var validators = {
      name: function (value) {
        if (!value.trim()) return "Please enter your name.";
        return "";
      },
      email: function (value) {
        if (!value.trim()) return "Please enter your email address.";
        if (!EMAIL_RE.test(value.trim())) return "Please enter a valid email address.";
        return "";
      },
      message: function (value) {
        if (!value.trim()) return "Please tell us about your project.";
        if (value.trim().length < 10) return "Please add a little more detail (at least 10 characters).";
        return "";
      }
    };

    var setFieldError = function (field, message) {
      var errorEl = document.getElementById(field.name + "-error");
      field.classList.toggle("invalid", Boolean(message));
      field.setAttribute("aria-invalid", message ? "true" : "false");
      if (errorEl) {
        errorEl.textContent = message;
      }
      return !message;
    };

    var setStatus = function (message, type) {
      if (!status) return;
      status.textContent = message;
      status.className = "form-status" + (type ? " " + type : "");
    };

    // Placeholder transport. Resolves locally so the UI is fully functional.
    // TODO: POST the enquiry to a real backend endpoint once one exists.
    var sendEnquiry = function (data) {
      return Promise.resolve(data);
    };

    // Clear a field's error as soon as it becomes valid again.
    form.addEventListener("input", function (event) {
      var field = event.target;
      if (validators[field.name] && field.classList.contains("invalid")) {
        setFieldError(field, validators[field.name](field.value));
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setStatus("", null);

      var firstInvalid = null;
      Object.keys(validators).forEach(function (name) {
        var field = form.elements[name];
        var valid = setFieldError(field, validators[name](field.value));
        if (!valid && !firstInvalid) {
          firstInvalid = field;
        }
      });

      if (firstInvalid) {
        firstInvalid.focus();
        setStatus("Please fix the highlighted fields.", "error");
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      setStatus("Sending…", null);

      sendEnquiry({
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim()
      })
        .then(function () {
          form.reset();
          setStatus("Thanks! We'll be in touch soon.", "success");
        })
        .catch(function () {
          setStatus("Something went wrong. Please try again.", "error");
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  // TODO: load gallery images dynamically from a data source instead of hardcoding placeholders
})();
