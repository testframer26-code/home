(function () {
  "use strict";

  /* Header elevation ------------------------------------------------------ */
  var header = document.getElementById("site-header");
  var onScroll = function () {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Mobile navigation ----------------------------------------------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.getElementById("mobile-menu");

  if (navToggle && mobileMenu) {
    var setMenu = function (open) {
      navToggle.setAttribute("aria-expanded", String(open));
      mobileMenu.hidden = !open;
    };

    navToggle.addEventListener("click", function () {
      setMenu(mobileMenu.hidden);
    });

    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !mobileMenu.hidden) {
        setMenu(false);
        navToggle.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1024 && !mobileMenu.hidden) {
        setMenu(false);
      }
    });
  }

  /* Footer navigation accordions (mobile) -------------------------------- */
  document.querySelectorAll(".fcol__toggle").forEach(function (toggle) {
    var column = toggle.closest(".fcol");
    var panel = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!column || !panel) return;

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      column.classList.toggle("is-open", open);
    });
  });

  /* Newsletter ------------------------------------------------------------ */
  var form = document.getElementById("newsletter-form");
  var input = document.getElementById("newsletter-email");
  var message = document.getElementById("newsletter-msg");
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (form && input && message) {
    var submit = form.querySelector("button[type='submit']");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim();

      form.classList.remove("is-success");

      if (!value) {
        form.classList.add("is-invalid");
        input.setAttribute("aria-invalid", "true");
        message.textContent = "Please enter your email address.";
        input.focus();
        return;
      }

      if (!emailPattern.test(value)) {
        form.classList.add("is-invalid");
        input.setAttribute("aria-invalid", "true");
        message.textContent = "That email doesn't look right — please check it.";
        input.focus();
        return;
      }

      form.classList.remove("is-invalid");
      form.classList.add("is-success");
      input.removeAttribute("aria-invalid");
      message.textContent = "Thank you — you're on the list. Welcome to Leon Home.";
      input.value = "";
      if (submit) {
        submit.innerHTML =
          'Subscribed <svg class="icon" aria-hidden="true"><use href="#icon-check"/></svg>';
      }
    });

    input.addEventListener("input", function () {
      if (form.classList.contains("is-invalid")) {
        form.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
        message.textContent = "";
      }
      if (form.classList.contains("is-success")) {
        form.classList.remove("is-success");
        message.textContent = "";
        if (submit) {
          submit.innerHTML =
            'Subscribe <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"/></svg>';
        }
      }
    });
  }

  /* Reveal on scroll ------------------------------------------------------ */
  var revealItems = document.querySelectorAll("[data-reveal]");

  if (revealItems.length) {
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );

      revealItems.forEach(function (item) {
        observer.observe(item);
      });
    } else {
      revealItems.forEach(function (item) {
        item.classList.add("is-revealed");
      });
    }
  }
})();
