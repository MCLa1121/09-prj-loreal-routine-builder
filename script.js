/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineButton = document.getElementById("generateRoutine");

/* Keep product data and selected products in memory */
let allProducts = [];
const selectedProductIds = new Set();

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Show a friendly empty state for the selected list */
selectedProductsList.innerHTML = `
  <div class="placeholder-message">
    Click products to add them here
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;

  return allProducts;
}

/* Toggle a product on or off */
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  renderSelectedProducts();
  renderVisibleProducts();
}

/* Get the products from the currently selected category */
function getFilteredProducts() {
  const selectedCategory = categoryFilter.value;

  if (!selectedCategory) {
    return [];
  }

  return allProducts.filter((product) => product.category === selectedCategory);
}

/* Render the selected products list above the button */
function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="placeholder-message">
        Click products to add them here
      </div>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-pill" data-product-id="${product.id}">
          <span class="selected-product-name">${product.brand} · ${product.name}</span>
        </div>
      `,
    )
    .join("");
}

/* Re-render the visible products so selected cards stay highlighted */
function renderVisibleProducts() {
  const filteredProducts = getFilteredProducts();

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  displayProducts(filteredProducts);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div
      class="product-card ${selectedProductIds.has(product.id) ? "selected" : ""}"
      data-product-id="${product.id}"
      role="button"
      tabindex="0"
      aria-pressed="${selectedProductIds.has(product.id)}"
    >
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
  renderSelectedProducts();
});

/* Let users click a product card to select or unselect it */
productsContainer.addEventListener("click", (e) => {
  const productCard = e.target.closest(".product-card");

  if (!productCard) {
    return;
  }

  const productId = Number(productCard.dataset.productId);
  toggleProductSelection(productId);
});

/* Support keyboard selection for accessibility */
productsContainer.addEventListener("keydown", (e) => {
  const productCard = e.target.closest(".product-card");

  if (!productCard) {
    return;
  }

  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    const productId = Number(productCard.dataset.productId);
    toggleProductSelection(productId);
  }
});

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});
