/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener("message", (ev) => {
    if (!ev.data) {
      return;
    } else if (ev.data.type === "deregister") {
      self.registration.unregister().then(() => {
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => client.navigate(client.url));
      });
    }
  });

  self.addEventListener("fetch", function (event) {
    const r = event.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
      return;
    }

    const request = (coepCredentialless && r.mode === "no-cors")
      ? new Request(r, {
        credentials: "omit",
      })
      : r;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cross-Origin-Embedder-Policy",
            coepCredentialless ? "credentialless" : "require-corp");
          if (!newHeaders.get("Cross-Origin-Opener-Policy")) {
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
          }

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
    window.sessionStorage.removeItem("coiReloadedBySelf");
    const coepHeaders = {
      "coep": document.currentScript.getAttribute("coep") || "require-corp",
      "coop": document.currentScript.getAttribute("coop") || "same-origin",
    };
    const spec = {
      "coep": "same-origin",
      "coop": "same-origin",
    };
    if (reloadedBySelf) {
      console.log("coi-serviceworker reloaded.");
      return;
    }

    if (navigator.serviceWorker) {
      navigator.serviceWorker.register(window.document.currentScript.src).then(
        (registration) => {
          console.log("coi-serviceworker registered", registration.scope);

          registration.addEventListener("updatefound", () => {
            console.log("Reloading because of a new version...");
            window.sessionStorage.setItem("coiReloadedBySelf", "true");
            window.location.reload();
          });

          if (registration.active && !navigator.serviceWorker.controller) {
            console.log("Reloading for activation...");
            window.sessionStorage.setItem("coiReloadedBySelf", "true");
            window.location.reload();
          }
        },
        (err) => {
          console.error("coi-serviceworker registration failed: ", err);
        }
      );
    }
  })();
}
