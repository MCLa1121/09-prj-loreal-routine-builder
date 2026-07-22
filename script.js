/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineButton = document.getElementById("generateRoutine");
const clearSelectionsButton = document.getElementById("clearSelections");

/* Replace this placeholder with the class-hosted Cloudflare Worker URL. */
const workerUrl = "https://loreal-routine.your-subdomain.workers.dev/";
const selectedProductsStorageKey = "loreal-selected-products";

/* Keep the conversation history so follow-up questions stay in context. */
const conversationMessages = [
  {
    role: "system",
    content:
      "You are a friendly L'Oréal beauty advisor. Use beginner-friendly language. When the user shares selected products, build a personalized routine with clear AM/PM steps, explain why each product goes where it does, and keep the answer concise but helpful.",
  },
];

/* Keep product data and selected products in memory */
let allProducts = [];
const selectedProductIds = new Set();
const expandedProductIds = new Set();

/* Escape text before putting it into innerHTML. */
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Restore selected products after a page reload. */
function loadSavedSelections() {
  const savedSelections = localStorage.getItem(selectedProductsStorageKey);

  if (!savedSelections) {
    return;
  }

  try {
    const savedIds = JSON.parse(savedSelections);

    if (Array.isArray(savedIds)) {
      savedIds.forEach((productId) => {
        selectedProductIds.add(Number(productId));
      });
    }
  } catch (error) {
    localStorage.removeItem(selectedProductsStorageKey);
  }
}

/* Save the current selection to localStorage. */
function saveSelections() {
  localStorage.setItem(
    selectedProductsStorageKey,
    JSON.stringify([...selectedProductIds]),
  );
}

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

/* Show a starter message in the chat area */
chatWindow.innerHTML = `
  <div class="chat-message chat-message--assistant">
    Select a category, choose a few products, and click Generate Routine to get started.
  </div>
`;

/* Load products, restore selections, and render the saved state. */
async function initializeApp() {
  await loadProducts();
  loadSavedSelections();
  renderSelectedProducts();
  renderVisibleProducts();
  updateClearButtonState();
}

/* Run the first render as soon as the file loads. */
initializeApp();

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

  saveSelections();
  renderSelectedProducts();
  renderVisibleProducts();
  updateClearButtonState();
}

/* Remove a single product from the selection. */
function removeSelectedProduct(productId) {
  selectedProductIds.delete(productId);
  saveSelections();
  renderSelectedProducts();
  renderVisibleProducts();
  updateClearButtonState();
}

/* Clear every selected product at once. */
function clearSelectedProducts() {
  selectedProductIds.clear();
  saveSelections();
  renderSelectedProducts();
  renderVisibleProducts();
  updateClearButtonState();
}

/* Keep the clear button in sync with the current selection state. */
function updateClearButtonState() {
  clearSelectionsButton.disabled = selectedProductIds.size === 0;
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
          <span class="selected-product-name">${escapeHtml(product.brand)} · ${escapeHtml(product.name)}</span>
          <button
            type="button"
            class="selected-product-remove"
            data-remove-product-id="${product.id}"
            aria-label="Remove ${product.brand} ${product.name}"
          >
            ×
          </button>
        </div>
      `,
    )
    .join("");
}

/* Get the full selected product objects for the routine request */
function getSelectedProducts() {
  return allProducts.filter((product) => selectedProductIds.has(product.id));
}

/* Build a readable summary for the AI request */
function buildSelectedProductSummary(products) {
  return products
    .map(
      (product) =>
        `- ${product.brand} ${product.name} (${product.category}): ${product.description}`,
    )
    .join("\n");
}

/* Build a context message for the currently selected products */
function buildSelectionContextMessage() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    return "Current selected products: none.";
  }

  return `Current selected products:\n${buildSelectedProductSummary(selectedProducts)}`;
}

/* Make a description shorter for the preview text on each card. */
function getDescriptionPreview(description) {
  const previewLimit = 110;

  if (description.length <= previewLimit) {
    return description;
  }

  return `${description.slice(0, previewLimit).trim()}...`;
}

/* Add a message bubble to the chat window */
function appendChatMessage(role, content) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message chat-message--${role}`;
  messageElement.textContent = content;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return messageElement;
}

/* Show loading feedback while waiting for the AI reply */
function showLoadingMessage() {
  return appendChatMessage("assistant", "Generating your routine...");
}

/* Send the current conversation to the worker and return the assistant reply */
async function sendMessagesToWorker(messages) {
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      model: "gpt-4.1",
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/* Build and send the first routine request from the selected products */
async function generateRoutine() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    appendChatMessage(
      "assistant",
      "Choose at least one product before generating a routine.",
    );
    return;
  }

  const selectionContextMessage = buildSelectionContextMessage();
  const selectedSummary = buildSelectedProductSummary(selectedProducts);
  const userPrompt = `Build a personalized routine using these selected products:\n${selectedSummary}\n\nPlease include a simple AM/PM order, explain each step in plain language, and mention anything the user should avoid mixing.`;

  generateRoutineButton.disabled = true;
  generateRoutineButton.textContent = "Generating...";

  const loadingMessage = showLoadingMessage();

  try {
    const messagesToSend = [
      ...conversationMessages,
      {
        role: "user",
        content: selectionContextMessage,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    const reply = await sendMessagesToWorker(messagesToSend);

    loadingMessage.remove();
    appendChatMessage("user", "Generate a routine using my selected products.");
    appendChatMessage("assistant", reply);

    conversationMessages.push(
      {
        role: "user",
        content: userPrompt,
      },
      {
        role: "assistant",
        content: reply,
      },
    );
  } catch (error) {
    loadingMessage.remove();
    appendChatMessage(
      "assistant",
      "I could not generate the routine right now. Please check the worker URL and try again.",
    );
  } finally {
    generateRoutineButton.disabled = false;
    generateRoutineButton.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
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
      <img src="${product.image}" alt="${escapeHtml(product.name)}">
      <div class="product-info">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-brand">${escapeHtml(product.brand)}</p>
        <div class="product-description-wrap">
          <p class="product-description ${expandedProductIds.has(product.id) ? "product-description--expanded" : ""}" id="description-${product.id}">
            ${escapeHtml(expandedProductIds.has(product.id) ? product.description : getDescriptionPreview(product.description))}
          </p>
          <button
            type="button"
            class="product-description-toggle"
            data-description-product-id="${product.id}"
            aria-expanded="${expandedProductIds.has(product.id)}"
            aria-controls="description-${product.id}"
          >
            ${expandedProductIds.has(product.id) ? "Show less" : "View details"}
          </button>
        </div>
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

/* Update the selected products list when the clear button is clicked. */
clearSelectionsButton.addEventListener("click", () => {
  clearSelectedProducts();
});

/* Remove an individual selected product when its pill button is clicked. */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".selected-product-remove");

  if (!removeButton) {
    return;
  }

  const productId = Number(removeButton.dataset.removeProductId);
  removeSelectedProduct(productId);
});

/* Generate a personalized routine when the button is clicked */
generateRoutineButton.addEventListener("click", async () => {
  if (allProducts.length === 0) {
    await loadProducts();
  }

  await generateRoutine();
});

/* Let users click a product card to select or unselect it */
productsContainer.addEventListener("click", (e) => {
  const descriptionToggle = e.target.closest(".product-description-toggle");

  if (descriptionToggle) {
    e.stopPropagation();
    const productId = Number(descriptionToggle.dataset.descriptionProductId);

    if (expandedProductIds.has(productId)) {
      expandedProductIds.delete(productId);
    } else {
      expandedProductIds.add(productId);
    }

    renderVisibleProducts();
    return;
  }

  const productCard = e.target.closest(".product-card");

  if (!productCard) {
    return;
  }

  const productId = Number(productCard.dataset.productId);
  toggleProductSelection(productId);
});

/* Support keyboard selection for accessibility */
productsContainer.addEventListener("keydown", (e) => {
  const descriptionToggle = e.target.closest(".product-description-toggle");

  if (descriptionToggle && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    const productId = Number(descriptionToggle.dataset.descriptionProductId);

    if (expandedProductIds.has(productId)) {
      expandedProductIds.delete(productId);
    } else {
      expandedProductIds.add(productId);
    }

    renderVisibleProducts();
    return;
  }

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

  const userInput = document.getElementById("userInput");
  const userMessage = userInput.value.trim();

  if (!userMessage) {
    return;
  }

  const loadingMessage = showLoadingMessage();

  appendChatMessage("user", userMessage);

  sendMessagesToWorker([
    ...conversationMessages,
    {
      role: "user",
      content: buildSelectionContextMessage(),
    },
    {
      role: "user",
      content: userMessage,
    },
  ])
    .then((reply) => {
      loadingMessage.remove();
      appendChatMessage("assistant", reply);

      conversationMessages.push(
        {
          role: "user",
          content: userMessage,
        },
        {
          role: "assistant",
          content: reply,
        },
      );
    })
    .catch(() => {
      loadingMessage.remove();
      appendChatMessage(
        "assistant",
        "I could not answer right now. Please check the worker URL and try again.",
      );
    });

  userInput.value = "";
});
