/* ==========
   Ora Shel Torah - script.js
   - Nav mobile
   - Cart (localStorage)
   - Modales (Jeux, Panier, Checkout)
   - Formspree (contact / partenariats / newsletter)
   - Frais d’expédition FR/UE (forfaits)
   - Pré-intégration Stripe Checkout (Netlify/Vercel)
   - GA4 événements (si gtag présent)
   ========== */

(function () {
  const LS_CART_KEY = 'ost_cart';
  const EU_COUNTRIES = new Set([
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
    'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
  ]);

  // --- Utils
  const € = (n) => (Number(n || 0)).toFixed(2).replace('.', ',') + '€';
  const toNumber = (s) => Math.round((Number(s) + Number.EPSILON) * 100) / 100;

  const qs  = (sel, el=document) => el.querySelector(sel);
  const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  const dataLayerPush = (ev, params={}) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', ev, params);
    }
  };

  // --- NAV mobile
  const navToggle = qs('.nav-toggle');
  const navMenu = qs('.nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      navMenu.classList.toggle('open');
    });
  }

  // --- CART (structure en mémoire)
  let cart = loadCart();

  function loadCart() {
    try {
      const raw = localStorage.getItem(LS_CART_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveCart() { localStorage.setItem(LS_CART_KEY, JSON.stringify(cart)); }

  function cartCount() {
    return Object.values(cart).reduce((sum, it) => sum + (it.qty || 0), 0);
  }
  function cartSubtotal() {
    return toNumber(Object.values(cart).reduce((sum, it) => sum + it.price * it.qty, 0));
  }
  function addToCart(id, item) {
    if (!cart[id]) cart[id] = {...item, qty: 0};
    cart[id].qty += 1;
    if (cart[id].qty < 0) cart[id].qty = 0;
    saveCart(); renderCartBadge();
    dataLayerPush('add_to_cart', {item_id: id, value: item.price, currency: 'EUR'});
  }
  function setQty(id, qty) {
    if (!cart[id]) return;
    cart[id].qty = Math.max(0, qty);
    if (cart[id].qty === 0) delete cart[id];
    saveCart(); renderCartBadge();
  }

  // --- Lier UI produits
  qsa('.product-card').forEach(card => {
    const id    = card.dataset.product; // jerusalem | minhag | mitzvot
    const price = Number(card.dataset.price);
    const name  = qs('h4', card)?.textContent?.trim() || id;
    const stripePriceId = card.dataset.stripePriceId || ''; // à remplir dans index.html
    const input = qs('.qty-input', card);
    const plus  = qs('.qty-btn.plus', card);
    const minus = qs('.qty-btn.minus', card);

    const ensureItem = () => {
      if (!cart[id]) cart[id] = { id, name, price, stripePriceId, qty: 0, type: id === 'jerusalem' ? 'JDC' : 'DECK' };
    };

    plus?.addEventListener('click', () => {
      ensureItem();
      cart[id].qty += 1;
      input.value = cart[id].qty;
      saveCart(); renderCartBadge();
    });

    minus?.addEventListener('click', () => {
      ensureItem();
      cart[id].qty = Math.max(0, (cart[id].qty||0) - 1);
      input.value = cart[id].qty;
      if (cart[id].qty === 0) delete cart[id];
      saveCart(); renderCartBadge();
    });

    input?.addEventListener('change', () => {
      ensureItem();
      const v = Math.max(0, Number(input.value || 0));
      cart[id].qty = v;
      if (v === 0) delete cart[id];
      saveCart(); renderCartBadge();
    });
  });

  // --- Badge panier
  const cartToggleBtn = qs('#cart-toggle');
  const cartSidebar   = qs('#cart-sidebar');
  const cartCloseBtn  = qs('#cart-close');
  const cartCountEl   = qs('#cart-count');
  const cartItemsEl   = qs('#cart-items');
  const cartSubtotalEl= qs('#cart-subtotal');
  const cartTotalEl   = qs('#cart-total');

  function renderCartBadge() {
    if (cartCountEl) cartCountEl.textContent = String(cartCount());
  }
  renderCartBadge();

  function openCart() {
    if (!cartSidebar) return;
    cartSidebar.removeAttribute('hidden');
    cartToggleBtn?.setAttribute('aria-expanded', 'true');
    renderCart();
  }
  function closeCart() {
    cartSidebar?.setAttribute('hidden', '');
    cartToggleBtn?.setAttribute('aria-expanded', 'false');
  }
  cartToggleBtn?.addEventListener('click', openCart);
  cartCloseBtn?.addEventListener('click', closeCart);

  function renderCart() {
    if (!cartItemsEl) return;
    cartItemsEl.innerHTML = '';
    const items = Object.values(cart);
    if (items.length === 0) {
      cartItemsEl.innerHTML = '<p>Votre panier est vide.</p>';
    } else {
      items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
          <div class="ci-name">${it.name}</div>
          <div class="ci-qty">
            <button class="ci-minus" aria-label="Retirer un exemplaire">−</button>
            <span class="ci-q">${it.qty}</span>
            <button class="ci-plus" aria-label="Ajouter un exemplaire">＋</button>
          </div>
          <div class="ci-price">${€(toNumber(it.price*it.qty))}</div>
        `;
        row.querySelector('.ci-minus').addEventListener('click', () => {
          setQty(it.id, (it.qty||0) - 1); renderCart();
        });
        row.querySelector('.ci-plus').addEventListener('click', () => {
          setQty(it.id, (it.qty||0) + 1); renderCart();
        });
        cartItemsEl.appendChild(row);
      });
    }
    const sub = cartSubtotal();
    if (cartSubtotalEl) cartSubtotalEl.textContent = €(sub).replace('.', ',');
    if (cartTotalEl)     cartTotalEl.textContent   = €(sub).replace('.', ',');
    qs('#checkout-btn')?.toggleAttribute('disabled', sub <= 0);
  }

  // --- Modale Jeux (contenu simple)
  const gameModal = qs('#game-modal');
  const gameButtons = qsa('[data-open-game]');
  gameButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-open-game');
      const body = qs('#modal-body');
      if (body) {
        let title = 'Notre jeu';
        if (key === 'jerusalem') title = 'Jérusalem du Ciel';
        if (key === 'minhag')    title = 'Minhag ou Halakha ?';
        if (key === 'mitzvot')   title = 'Poztamitsvah';
        body.innerHTML = `
          <h3>${title}</h3>
          <p>Présentation détaillée prochainement. En attendant, retrouvez la fiche et la précommande plus bas.</p>
        `;
      }
      gameModal?.removeAttribute('hidden');
    });
  });
  qsa('.modal .modal-close').forEach(b => b.addEventListener('click', (e) => {
    e.target.closest('.modal')?.setAttribute('hidden','');
  }));

  // --- Checkout modale
  const checkoutBtn = qs('#checkout-btn');
  const checkoutModal = qs('#checkout-modal');
  const checkoutItemsEl = qs('#checkout-items');
  const checkoutSubtotalEl = qs('#checkout-subtotal');
  const checkoutTotalEl = qs('#checkout-total');
  const checkoutShippingEl = qs('#checkout-shipping');
  const payStripeBtn = qs('#pay-stripe');
  const payAppleBtn  = qs('#pay-apple');
  const countrySel   = qs('#checkout-pays');

  checkoutBtn?.addEventListener('click', () => {
    renderCheckout();
    checkoutModal?.removeAttribute('hidden');
    dataLayerPush('begin_checkout', {value: cartSubtotal(), currency: 'EUR'});
  });

  // Frais d’expédition (forfaits FR/UE)
  function computeShipping(country, items) {
    const qtyJDC  = items.filter(it => it.type === 'JDC').reduce((s, it) => s+it.qty, 0);
    const qtyDECK = items.filter(it => it.type !== 'JDC').reduce((s, it) => s+it.qty, 0);
    const hasMix  = qtyJDC>0 && qtyDECK>0;
    const isFR    = country === 'FR';
    const isEU    = EU_COUNTRIES.has(country || 'FR');

    if (isFR) {
      if (hasMix) return 8.90;
      if (qtyJDC>0) return 7.90;
      if (qtyDECK>0) return 4.90;
      return 0;
    }
    if (isEU) {
      if (hasMix) return 13.90;
      if (qtyJDC>0) return 12.90;
      if (qtyDECK>0) return 8.90;
      return 0;
    }
    // Hors UE : applique EU par défaut (à ajuster si nécessaire)
    if (hasMix) return 13.90;
    if (qtyJDC>0) return 12.90;
    if (qtyDECK>0) return 8.90;
    return 0;
  }

  function renderCheckout() {
    checkoutItemsEl.innerHTML = '';
    const items = Object.values(cart);
    if (items.length === 0) {
      checkoutItemsEl.innerHTML = '<p>Votre panier est vide.</p>';
      payStripeBtn?.setAttribute('disabled','');
      payAppleBtn?.setAttribute('disabled','');
      return;
    }
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'co-item';
      row.innerHTML = `
        <div class="co-name">${it.name}</div>
        <div class="co-qty">× ${it.qty}</div>
        <div class="co-price">${€(toNumber(it.price*it.qty))}</div>
      `;
      checkoutItemsEl.appendChild(row);
    });
    const sub = cartSubtotal();
    const country = countrySel?.value || 'FR';
    const shipping = computeShipping(country, items);
    const total = toNumber(sub + shipping);
    checkoutSubtotalEl.textContent = €(sub);
    checkoutShippingEl.textContent = shipping === 0 ? 'Gratuit' : €(shipping);
    checkoutTotalEl.textContent = €(total);

    // activer paiement si total > 0
    const enable = total > 0;
    payStripeBtn?.toggleAttribute('disabled', !enable);
    payAppleBtn?.toggleAttribute('disabled', !enable);
  }

  countrySel?.addEventListener('change', renderCheckout);

  // --- Paiement Stripe Checkout (pré-intégré)
  async function createCheckoutSession() {
    // Prépare les lignes: [{price: 'price_xxx', quantity: n}]
    const line_items = Object.values(cart)
      .filter(it => it.qty > 0 && it.stripePriceId)
      .map(it => ({ price: it.stripePriceId, quantity: it.qty }));

    if (line_items.length === 0) {
      alert("Les identifiants Stripe des produits ne sont pas configurés.");
      return;
    }

    const country = qs('#checkout-pays')?.value || 'FR';

    try {
      // Choisis UNE des deux routes selon ton hébergeur :
      // Netlify:  '/.netlify/functions/create-checkout'
      // Vercel:   '/api/create-checkout'
      const endpoint = '/.netlify/functions/create-checkout';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          line_items,
          shipping_country: country,
          // Optionnel: passer shipping amount si tu veux le fixer côté serveur:
          // shipping_amount: computeShipping(country, Object.values(cart))
        })
      });
      if (!res.ok) throw new Error('Échec serveur');
      const data = await res.json();
      if (data.url) {
        dataLayerPush('purchase_intent', {value: cartSubtotal(), currency: 'EUR'});
        window.location = data.url; // redirection vers Stripe Checkout
      } else {
        alert('Réponse inattendue du serveur de paiement.');
      }
    } catch (e) {
      console.error(e);
      alert("Impossible de démarrer le paiement pour le moment.");
    }
  }

  payStripeBtn?.addEventListener('click', createCheckoutSession);
  payAppleBtn?.addEventListener('click', createCheckoutSession); // même checkout (Apple Pay activé dans Stripe)

  // --- Formspree (submit via fetch pour rester sur la page)
  function wireFormspree(form, successMsg) {
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      // message de consentement RGPD présent ?
      if (form.querySelector('input[name="consent"]') && !form.querySelector('input[name="consent"]').checked) {
        showSuccess('Veuillez accepter le traitement des données (RGPD).');
        return;
      }

      try {
        const res = await fetch(form.action, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' }});
        if (res.ok) {
          showSuccess(successMsg);
          form.reset();
          dataLayerPush('form_submit', {form_id: form.id});
        } else {
          showSuccess("Une erreur est survenue. Réessayez plus tard.");
        }
      } catch (err) {
        showSuccess("Impossible d’envoyer le formulaire pour le moment.");
      }
    });
  }

  function showSuccess(text) {
    const modal = qs('#success-modal');
    qs('#success-message').textContent = text;
    modal?.removeAttribute('hidden');
    modal?.querySelector('[data-close="success-modal"]')?.focus();
  }
  qsa('[data-close="success-modal"]').forEach(btn => {
    btn.addEventListener('click', () => qs('#success-modal')?.setAttribute('hidden',''));
  });

  wireFormspree(qs('#contact-form'), "Merci ! Votre message a été envoyé. Nous répondons sous 48 h.");
  wireFormspree(qs('#partnership-form'), "Merci ! Votre demande de partenariat a bien été envoyée.");
  wireFormspree(qs('#newsletter-form'), "Merci ! Vérifiez votre boîte mail et **confirmez** votre inscription (double opt-in).");

  // --- Fermer modales au fond
  qsa('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.setAttribute('hidden','');
    });
  });

  // --- Init
  // Si on ouvre directement checkout, assure cohérence
  if (checkoutModal && !checkoutModal.hasAttribute('hidden')) renderCheckout();
})();
