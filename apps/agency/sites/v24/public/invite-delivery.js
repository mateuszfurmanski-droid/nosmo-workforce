(() => {
  const originalOpen = window.open.bind(window);

  function invitationReference(rawUrl) {
    try {
      const decoded = decodeURIComponent(String(rawUrl));
      if (!decoded.includes("NOSMO Worker App invitation")) return null;
      return decoded.match(/#invite=([A-Za-z0-9._~-]{1,180})/)?.[1] || null;
    } catch {
      return null;
    }
  }

  function safeExternalTarget(rawUrl) {
    try {
      const url = new URL(String(rawUrl));
      if (!["https:", "mailto:", "sms:"].includes(url.protocol)) return null;
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }

  function announce(message) {
    let region = document.querySelector("[data-nosmo-invite-delivery-status]");
    if (!region) {
      region = document.createElement("div");
      region.dataset.nosmoInviteDeliveryStatus = "true";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      Object.assign(region.style, {
        position: "fixed",
        inset: "auto 16px 84px 16px",
        zIndex: "2147483647",
        maxWidth: "520px",
        margin: "auto",
        padding: "12px 14px",
        border: "1px solid #9de6c2",
        borderRadius: "8px",
        background: "#111",
        color: "#fff",
        font: "600 13px/1.4 system-ui, sans-serif",
      });
      document.body.appendChild(region);
    }
    region.textContent = message;
    window.setTimeout(() => {
      if (region.textContent === message) region.textContent = "";
    }, 6000);
  }

  async function copyInvitation(message) {
    try {
      await navigator.clipboard.writeText(message);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = message;
      area.readOnly = true;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    }
  }

  async function prepareDelivery(inviteId, rawUrl, target, features, placeholder) {
    try {
      const response = await fetch(`/api/agency/invites/${encodeURIComponent(inviteId)}/delivery`, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.inviteCode || !result.workAppUrl) throw new Error("INVITE_DELIVERY_FAILED");
      const message = `${result.agency?.name || "An agency"} invited you to connect your NOSMO Worker Card.\n\nOpen NOSMO Worker:\n${result.workAppUrl}\n\nInvitation code:\n${result.inviteCode}\n\nPaste this code under Worker Card, review the agency, and approve only recruiter-safe Work Profile access.`;
      const copied = await copyInvitation(message);
      if (!copied) {
        placeholder?.close();
        window.prompt("Copy this NOSMO Worker invitation, then paste it into your message:", message);
        return;
      }
      announce("Secure invitation copied. Paste it into the external message before sending.");
      const destination = safeExternalTarget(rawUrl);
      if (!destination) throw new Error("INVITE_DESTINATION_INVALID");
      if (placeholder && !placeholder.closed) {
        placeholder.opener = null;
        placeholder.location.replace(destination);
      } else {
        originalOpen(destination, target, features);
      }
    } catch {
      placeholder?.close();
      announce("Secure invitation was not opened. Try again; no code was placed in a URL.");
    }
  }

  window.open = function nosmoSecureInviteOpen(rawUrl, target, features) {
    const inviteId = invitationReference(rawUrl);
    if (!inviteId) return originalOpen(rawUrl, target, features);
    const placeholder = target === "_blank" ? originalOpen("about:blank", "_blank", features) : null;
    void prepareDelivery(inviteId, rawUrl, target, features, placeholder);
    return placeholder;
  };
})();
