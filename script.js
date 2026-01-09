const searchInput = document.getElementById("searchFaq");
const faqItems = document.querySelectorAll(".faq-item");

const synonyms = {
  contraseña: ["clave", "password"],
  envio: ["envío", "entrega", "transporte"],
  pagina: ["página", "web", "sitio"],
  pago: ["pago", "pagos", "cobro"],
  garantia: ["garantía", "respaldo"]
};

// ===============================
// Normalizar texto (quita tildes)
// ===============================
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ===============================
// Expandir términos con sinónimos
// ===============================
function expandSearchTerms(text) {
  let terms = [text];
  Object.keys(synonyms).forEach(key => {
    if (text.includes(key)) {
      terms = terms.concat(synonyms[key]);
    }
  });
  return terms;
}

// ===============================
// Resaltar coincidencias
// ===============================
function highlight(text, term) {
  const regex = new RegExp(`(${term})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

// ===============================
// Acordeón por clic (NO se rompe)
// ===============================
faqItems.forEach(item => {
  const title = item.querySelector(".faq-title");
  title.addEventListener("click", () => {
    item.classList.toggle("active");
  });
});

// ===============================
// Buscador
// ===============================
searchInput.addEventListener("keyup", () => {
  const searchValue = normalizeText(searchInput.value);

  faqItems.forEach(item => {
    const titleEl = item.querySelector(".faq-title");
    const contentEl = item.querySelector("p");

    const titleText = titleEl.textContent;
    const contentText = contentEl.textContent;

    // Reset contenido
    titleEl.innerHTML = titleText;
    contentEl.innerHTML = contentText;

    // 🔁 Si no hay búsqueda → control total por clic
    if (!searchValue) {
      item.style.display = "block";
      item.classList.remove("active");
      return;
    }

    const searchableText = normalizeText(titleText + " " + contentText);
    const terms = expandSearchTerms(searchValue);

    const match = terms.some(term =>
      searchableText.includes(normalizeText(term))
    );

    if (match) {
      item.style.display = "block";

      // ✅ SOLO abrir automáticamente cuando se está buscando
      item.classList.add("active");

      terms.forEach(term => {
        titleEl.innerHTML = highlight(titleEl.innerHTML, term);
        contentEl.innerHTML = highlight(contentEl.innerHTML, term);
      });

    } else {
      item.style.display = "none";
      item.classList.remove("active");
    }
  });
});


document.querySelectorAll('.copy-btn').forEach(button => {
  button.addEventListener('click', () => {
    const answerText = button.parentElement.querySelector('p').innerText;

    navigator.clipboard.writeText(answerText).then(() => {
      button.innerText = '✅ Copiado';
      setTimeout(() => {
        button.innerText = '📋 Copiar respuesta';
      }, 1500);
    });
  });
});