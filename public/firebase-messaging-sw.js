// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.messagingSenderId && firebaseConfig.messagingSenderId !== "placeholder-sender-id-for-build") {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.notification?.title || 'FinishLine Notification';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/vercel.svg',
      data: payload.data,
      actions: [
        { action: "complete", title: "Done" },
        { action: "reschedule", title: "Reschedule" }
      ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Interactive FCM Push Actions routing
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const commitmentId = data.commitmentId;

  if (event.action === 'complete') {
    const urlToOpen = `/commitments/complete-gated?id=${commitmentId}`;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        let matchingClient = null;
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes('/dashboard') || client.url.includes('/commitments')) {
            matchingClient = client;
            break;
          }
        }

        if (matchingClient) {
          matchingClient.postMessage({ type: "COMPLETE_COMMITMENT", commitmentId });
          return matchingClient.focus();
        } else {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
    return;
  }

  if (event.action === 'reschedule') {
    const urlToOpen = `/renegotiate/${commitmentId}`;
    event.waitUntil(
      self.clients.openWindow(urlToOpen)
    );
    return;
  }

  // Default click behavior: Focus or open dashboard
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/dashboard') || client.url.includes('/')) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/dashboard');
    })
  );
});
