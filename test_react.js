// Simulate the React state and WebSocket callback execution
let status = 'disconnected';
function setStatus(s) {
  console.log("React state update queued:", s);
  status = s;
}

function handleServerMessage() {
  console.log("handleServerMessage started");
  try {
    setStatus('connected');
    
    // Simulate the showToast crash
    console.log("Calling showToast (will crash)");
    throw new TypeError("wsClientRef.current.getDeviceInfo is not a function");
    
    console.log("This will never be reached");
  } catch (e) {
    console.log("Caught error in onmessage try/catch:", e.message);
  }
  console.log("handleServerMessage finished");
}

handleServerMessage();
console.log("Final React status:", status);
