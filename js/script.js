const html = document.documentElement;
const header = document.querySelector(".header");
const menuToggle = document.querySelector(".menu-toggle");
const hamburger = document.querySelector(".hamburger");
const mobileMenu = document.querySelector(".mobile-menu");
const overlay = document.querySelector(".overlay");

window.addEventListener("scroll", () => {
  if (window.scrollY > 10) {
    header.classList.add("header-scrolled");
  } else {
    header.classList.remove("header-scrolled");
  }
});

// Mobile menu toggle
menuToggle.addEventListener("click", toggleMenu);
overlay.addEventListener("click", closeMenu);

function toggleMenu() {
  hamburger.classList.toggle("open");
  mobileMenu.classList.toggle("active");
  overlay.classList.toggle("active");
  document.body.style.overflow = mobileMenu.classList.contains("active")
    ? "hidden"
    : "";
}

function closeMenu() {
  hamburger.classList.remove("open");
  mobileMenu.classList.remove("active");
  overlay.classList.remove("active");
  document.body.style.overflow = "";
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 992 && mobileMenu.classList.contains("active")) {
    closeMenu();
  }
});
