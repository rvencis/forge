/* Rvencis Forge — main.js
   Page-shell behaviour, ported from the Rvencis site's script.js:
   mobile nav, scroll state, active link, smooth anchors, reveal-on-scroll.
   The original injected its mobile-menu CSS from JS; here it lives in styles.css. */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    var navToggle = document.querySelector('.nav-toggle');
    var navMenu = document.querySelector('.nav-menu');
    var navbar = document.querySelector('.navbar');

    if (navToggle && navMenu) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.addEventListener('click', function () {
        var open = navMenu.classList.toggle('active');
        navToggle.classList.toggle('active', open);
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      navMenu.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('click', function () {
          navMenu.classList.remove('active');
          navToggle.classList.remove('active');
          navToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    if (navbar) {
      var onScroll = function () {
        navbar.classList.toggle('scrolled', (window.pageYOffset || 0) > 40);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* Active nav link by page path (the original used hash sections). */
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-menu .nav-link').forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('#')[0];
      if (href && href === path) link.classList.add('active');
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    } else {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('animate-in'); });
    }

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href');
        if (href === '#') return;
        var target = document.getElementById(href.slice(1));
        if (target) {
          e.preventDefault();
          window.scrollTo({ top: target.offsetTop - 84, behavior: 'smooth' });
        }
      });
    });

    if (window.UI && UI.toastContainerInit) UI.toastContainerInit();
    if (window.Store && Store.initNav) Store.initNav();
  });
})();
