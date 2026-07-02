// Derives the API base URL from the current browser hostname.
// This makes the app work both on localhost and when accessed from
// other devices on the same network (e.g. a phone via 172.20.10.2:5173).
export const API = `http://${window.location.hostname}:3000/api/v1`;
